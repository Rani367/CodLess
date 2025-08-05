"""
Waypoint Navigation module for CodLess FLL autonomous navigation
Provides waypoint following capabilities using GyroDriveBase
"""

from math import sqrt, atan2, degrees, radians, cos, sin, acos
from pybricks.tools import wait
from pybricks.robotics import DriveBase
from pybricks.parameters import Stop


class WaypointNavigator:
    """
    Navigates robot through waypoints using GyroDriveBase.
    """
    
    def __init__(self, drive_base, odometry, tolerance_distance=10, tolerance_angle=2):
        """
        Initialize waypoint navigator.
        
        Args:
            drive_base: GyroDriveBase instance for robot movement
            odometry: Odometry instance for position tracking
            tolerance_distance: Distance tolerance in mm for reaching waypoint
            tolerance_angle: Angle tolerance in degrees for final heading
        """
        self.drive_base = drive_base
        self.odometry = odometry
        self.tolerance_distance = tolerance_distance
        self.tolerance_angle = tolerance_angle
        
        # Navigation parameters
        self.turn_speed = 100  # degrees/second
        self.drive_speed = 200  # mm/second
        
    def go_to_waypoint(self, target_x, target_y, target_heading=None):
        """
        Navigate to a single waypoint.
        
        Args:
            target_x: Target X position in mm
            target_y: Target Y position in mm
            target_heading: Target heading in degrees (None to maintain current)
            
        Returns:
            bool: True if waypoint reached successfully
        """
        # Update odometry
        self.odometry.update()
        current_x, current_y, current_heading = self.odometry.get_pose()
        
        # Calculate distance and angle to target
        distance = self.odometry.get_distance_to(target_x, target_y)
        target_angle = self.odometry.get_angle_to(target_x, target_y)
        
        # Check if already at waypoint
        if distance <= self.tolerance_distance:
            if target_heading is not None:
                # Just adjust heading if needed
                angle_diff = self.odometry.get_angle_difference(target_heading)
                if abs(angle_diff) > self.tolerance_angle:
                    self.drive_base.turn(angle_diff)
            return True
        
        # Turn to face target
        angle_diff = self.odometry.get_angle_difference(target_angle)
        if abs(angle_diff) > self.tolerance_angle:
            self.drive_base.turn(angle_diff)
            wait(100)  # Short pause after turn
        
        # Drive to target
        self.drive_base.straight(distance)
        wait(100)  # Short pause after drive
        
        # Adjust final heading if specified
        if target_heading is not None:
            self.odometry.update()
            _, _, current_heading = self.odometry.get_pose()
            final_angle_diff = self.odometry.get_angle_difference(target_heading)
            if abs(final_angle_diff) > self.tolerance_angle:
                self.drive_base.turn(final_angle_diff)
        
        # Update odometry after movement
        self.odometry.update()
        
        # Verify we reached the waypoint
        final_distance = self.odometry.get_distance_to(target_x, target_y)
        return final_distance <= self.tolerance_distance
    
    def follow_waypoints(self, waypoints, stop_on_failure=True):
        """
        Follow a list of waypoints in sequence.
        
        Args:
            waypoints: List of waypoints, each as (x, y) or (x, y, heading)
            stop_on_failure: Stop if a waypoint cannot be reached
            
        Returns:
            int: Number of waypoints successfully reached
        """
        waypoints_reached = 0
        
        for i, waypoint in enumerate(waypoints):
            # Parse waypoint
            if len(waypoint) >= 3:
                x, y, heading = waypoint[0], waypoint[1], waypoint[2]
            else:
                x, y = waypoint[0], waypoint[1]
                heading = None
            
            # Navigate to waypoint
            success = self.go_to_waypoint(x, y, heading)
            
            if success:
                waypoints_reached += 1
            elif stop_on_failure:
                print(f"Failed to reach waypoint {i+1}: ({x}, {y})")
                break
            
            # Small pause between waypoints
            wait(200)
        
        return waypoints_reached
    
    def convert_path_to_waypoints(self, recorded_commands, sample_interval=500):
        """
        Convert recorded teleop commands to waypoints.
        
        Args:
            recorded_commands: List of recorded drive commands
            sample_interval: Time interval in ms between waypoints
            
        Returns:
            list: List of waypoints (x, y, heading)
        """
        waypoints = []
        
        # Reset odometry for conversion
        temp_x, temp_y, temp_heading = 0, 0, 0
        accumulated_time = 0
        
        for command in recorded_commands:
            if command.get('type') == 'drive':
                speed = command.get('speed', 0)
                turn_rate = command.get('turn_rate', 0)
                duration = command.get('duration', 0) * 1000  # Convert to ms
                
                # Simulate movement in small steps
                step_time = 50  # ms
                steps = int(duration / step_time)
                
                for _ in range(steps):
                    # Update position based on speed and turn rate
                    distance_step = (speed * step_time) / 1000.0
                    angle_step = (turn_rate * step_time) / 1000.0
                    
                    temp_heading += angle_step
                    heading_rad = radians(temp_heading)
                    
                    temp_x += distance_step * cos(heading_rad)
                    temp_y += distance_step * sin(heading_rad)
                    
                    accumulated_time += step_time
                    
                    # Add waypoint at sample interval
                    if accumulated_time >= sample_interval:
                        waypoints.append((temp_x, temp_y, temp_heading % 360))
                        accumulated_time = 0
        
        # Add final waypoint
        if len(waypoints) == 0 or (temp_x, temp_y) != (waypoints[-1][0], waypoints[-1][1]):
            waypoints.append((temp_x, temp_y, temp_heading % 360))
        
        return waypoints
    
    def optimize_waypoints(self, waypoints, min_distance=50):
        """
        Optimize waypoints by removing redundant points.
        
        Args:
            waypoints: List of waypoints
            min_distance: Minimum distance between waypoints in mm
            
        Returns:
            list: Optimized list of waypoints
        """
        if len(waypoints) <= 2:
            return waypoints
        
        optimized = [waypoints[0]]
        
        for i in range(1, len(waypoints) - 1):
            # Calculate distance from last kept waypoint
            dx = waypoints[i][0] - optimized[-1][0]
            dy = waypoints[i][1] - optimized[-1][1]
            distance = sqrt(dx*dx + dy*dy)
            
            # Check if direction changes significantly
            if i < len(waypoints) - 1:
                # Vector from previous to current
                v1_x = waypoints[i][0] - optimized[-1][0]
                v1_y = waypoints[i][1] - optimized[-1][1]
                
                # Vector from current to next
                v2_x = waypoints[i+1][0] - waypoints[i][0]
                v2_y = waypoints[i+1][1] - waypoints[i][1]
                
                # Calculate angle between vectors
                if v1_x != 0 or v1_y != 0 and v2_x != 0 or v2_y != 0:
                    dot_product = v1_x * v2_x + v1_y * v2_y
                    mag1 = sqrt(v1_x*v1_x + v1_y*v1_y)
                    mag2 = sqrt(v2_x*v2_x + v2_y*v2_y)
                    
                    if mag1 > 0 and mag2 > 0:
                        cos_angle = dot_product / (mag1 * mag2)
                        cos_angle = max(-1, min(1, cos_angle))  # Clamp to [-1, 1]
                        angle_change = degrees(acos(abs(cos_angle)))
                        
                        # Keep waypoint if significant direction change
                        if angle_change > 10 or distance >= min_distance:
                            optimized.append(waypoints[i])
                elif distance >= min_distance:
                    optimized.append(waypoints[i])
        
        # Always keep the last waypoint
        optimized.append(waypoints[-1])
        
        return optimized