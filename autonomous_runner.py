"""
Autonomous Runner module for CodLess FLL autonomous navigation
Integrates odometry, localization, path planning, and waypoint navigation
"""

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor
from pybricks.parameters import Port, Color, Button, Stop
from pybricks.robotics import GyroDriveBase
from pybricks.tools import wait, StopWatch

from odometry import Odometry
from localization import Localization
from path_planner import PathPlanner
from waypoint_navigator import WaypointNavigator


class AutonomousRunner:
    """
    Main autonomous navigation system for FLL robots.
    Integrates all navigation components and provides high-level control.
    """
    
    def __init__(self, hub, left_motor, right_motor, wheel_diameter, axle_track):
        """
        Initialize autonomous runner.
        
        Args:
            hub: PrimeHub instance
            left_motor: Left drive motor
            right_motor: Right drive motor
            wheel_diameter: Wheel diameter in mm
            axle_track: Distance between wheels in mm
        """
        self.hub = hub
        
        # Create GyroDriveBase
        self.drive_base = GyroDriveBase(
            left_motor, 
            right_motor, 
            wheel_diameter, 
            axle_track
        )
        
        # Configure drive settings for precision
        self.drive_base.settings(
            straight_speed=200,     # mm/s
            straight_acceleration=100,  # mm/s²
            turn_rate=90,          # deg/s
            turn_acceleration=180   # deg/s²
        )
        
        # Initialize navigation components
        self.odometry = Odometry(self.drive_base, self.hub.imu)
        self.localization = Localization(num_particles=75)  # Optimized for Spike Prime
        self.path_planner = PathPlanner()
        self.navigator = WaypointNavigator(self.drive_base, self.odometry)
        
        # Sensors (initialize as needed)
        self.color_sensor = None
        self.distance_sensor = None
        
        # State tracking
        self.is_running = False
        self.update_timer = StopWatch()
        self.localization_timer = StopWatch()
        
        # Performance parameters
        self.odometry_update_interval = 20  # ms
        self.localization_update_interval = 200  # ms
        
    def attach_color_sensor(self, port, sensor_offset=(0, 50)):
        """
        Attach color sensor for landmark detection.
        
        Args:
            port: Port where color sensor is connected
            sensor_offset: (x, y) offset from robot center in mm
        """
        try:
            self.color_sensor = ColorSensor(port)
            self.color_sensor_offset = sensor_offset
            return True
        except:
            print(f"Failed to initialize color sensor on port {port}")
            return False
    
    def attach_distance_sensor(self, port):
        """
        Attach ultrasonic distance sensor.
        
        Args:
            port: Port where distance sensor is connected
        """
        try:
            self.distance_sensor = UltrasonicSensor(port)
            return True
        except:
            print(f"Failed to initialize distance sensor on port {port}")
            return False
    
    def initialize_position(self, x=0, y=0, heading=0):
        """
        Initialize robot position for both odometry and localization.
        
        Args:
            x: Initial X position in mm
            y: Initial Y position in mm
            heading: Initial heading in degrees
        """
        # Reset odometry
        self.odometry.reset_odometry(x, y, heading)
        
        # Initialize particles around known position
        self.localization.initialize_particles(x, y, heading, spread=50)
        
        # Reset timers
        self.update_timer.reset()
        self.localization_timer.reset()
    
    def update_navigation(self):
        """
        Update navigation systems (odometry and localization).
        Should be called regularly during autonomous operation.
        """
        # Update odometry at high frequency
        if self.update_timer.time() >= self.odometry_update_interval:
            self.odometry.update()
            
            # Get motion since last update
            current_x, current_y, current_heading = self.odometry.get_pose()
            
            # Update particle filter with motion
            if hasattr(self, '_last_pose'):
                dx = current_x - self._last_pose[0]
                dy = current_y - self._last_pose[1]
                dheading = current_heading - self._last_pose[2]
                
                # Convert to distance and angle
                distance = (dx**2 + dy**2)**0.5
                if distance > 0.1:  # Only update if moved
                    self.localization.update_motion(distance, dheading)
            
            self._last_pose = (current_x, current_y, current_heading)
            self.update_timer.reset()
        
        # Update localization with sensors at lower frequency
        if self.localization_timer.time() >= self.localization_update_interval:
            self._update_localization_sensors()
            self.localization_timer.reset()
    
    def _update_localization_sensors(self):
        """Update localization with sensor readings."""
        # Update with color sensor
        if self.color_sensor:
            try:
                color = self.color_sensor.color()
                if color != Color.NONE:
                    self.localization.update_sensor(
                        'color', 
                        color,
                        self.color_sensor_offset[0],
                        self.color_sensor_offset[1]
                    )
            except:
                pass
        
        # Update with distance sensor
        if self.distance_sensor:
            try:
                distance = self.distance_sensor.distance()
                if distance < 2000:  # Valid reading
                    self.localization.update_sensor('distance', distance)
            except:
                pass
        
        # Resample particles periodically
        if self.localization.get_confidence() < 0.5:
            self.localization.resample()
    
    def navigate_to(self, target_x, target_y, target_heading=None, use_path_planning=True):
        """
        Navigate to a target position using path planning or direct navigation.
        
        Args:
            target_x: Target X position in mm
            target_y: Target Y position in mm
            target_heading: Target heading in degrees (optional)
            use_path_planning: Use A* path planning to avoid obstacles
            
        Returns:
            bool: True if target reached successfully
        """
        self.is_running = True
        
        try:
            if use_path_planning:
                # Get current position from localization
                current_x, current_y, _ = self.get_best_pose()
                
                # Plan path
                path = self.path_planner.plan_path(
                    (current_x, current_y),
                    (target_x, target_y)
                )
                
                if path is None:
                    print(f"No path found to ({target_x}, {target_y})")
                    return False
                
                # Convert path to waypoints with heading
                waypoints = []
                for i, (x, y) in enumerate(path):
                    if i == len(path) - 1 and target_heading is not None:
                        waypoints.append((x, y, target_heading))
                    else:
                        waypoints.append((x, y))
                
                # Follow waypoints
                success = self._follow_waypoints_with_updates(waypoints)
            else:
                # Direct navigation
                success = self._navigate_direct_with_updates(target_x, target_y, target_heading)
            
            return success
            
        finally:
            self.is_running = False
            self.drive_base.stop()
    
    def _follow_waypoints_with_updates(self, waypoints):
        """Follow waypoints while updating navigation systems."""
        for i, waypoint in enumerate(waypoints):
            # Parse waypoint
            if len(waypoint) >= 3:
                x, y, heading = waypoint[0], waypoint[1], waypoint[2]
            else:
                x, y = waypoint[0], waypoint[1]
                heading = None
            
            # Navigate to waypoint
            while self.odometry.get_distance_to(x, y) > self.navigator.tolerance_distance:
                # Update navigation
                self.update_navigation()
                
                # Check for stop button
                if Button.CENTER in self.hub.buttons.pressed():
                    print("Navigation stopped by user")
                    return False
                
                # Move towards waypoint
                self.navigator.go_to_waypoint(x, y, heading)
                
                # Small delay
                wait(10)
            
            print(f"Reached waypoint {i+1}/{len(waypoints)}")
        
        return True
    
    def _navigate_direct_with_updates(self, target_x, target_y, target_heading):
        """Navigate directly to target while updating navigation systems."""
        while self.odometry.get_distance_to(target_x, target_y) > self.navigator.tolerance_distance:
            # Update navigation
            self.update_navigation()
            
            # Check for stop button
            if Button.CENTER in self.hub.buttons.pressed():
                print("Navigation stopped by user")
                return False
            
            # Move towards target
            self.navigator.go_to_waypoint(target_x, target_y, target_heading)
            
            # Small delay
            wait(10)
        
        return True
    
    def follow_recorded_path(self, recorded_commands, use_waypoints=True):
        """
        Follow a recorded teleop path.
        
        Args:
            recorded_commands: List of recorded drive commands
            use_waypoints: Convert to waypoints for smoother navigation
            
        Returns:
            bool: True if path completed successfully
        """
        if use_waypoints:
            # Convert to waypoints
            waypoints = self.navigator.convert_path_to_waypoints(recorded_commands)
            waypoints = self.navigator.optimize_waypoints(waypoints)
            
            print(f"Following {len(waypoints)} waypoints")
            return self._follow_waypoints_with_updates(waypoints)
        else:
            # Replay commands directly
            self.is_running = True
            try:
                for command in recorded_commands:
                    if command.get('type') == 'drive':
                        speed = command.get('speed', 0)
                        turn_rate = command.get('turn_rate', 0)
                        duration = command.get('duration', 0) * 1000  # Convert to ms
                        
                        # Start driving
                        self.drive_base.drive(speed, turn_rate)
                        
                        # Wait while updating navigation
                        elapsed = 0
                        while elapsed < duration:
                            self.update_navigation()
                            
                            if Button.CENTER in self.hub.buttons.pressed():
                                print("Replay stopped by user")
                                return False
                            
                            wait(10)
                            elapsed += 10
                        
                        self.drive_base.stop()
                
                return True
            finally:
                self.is_running = False
                self.drive_base.stop()
    
    def get_best_pose(self):
        """
        Get best estimate of robot pose combining odometry and localization.
        
        Returns:
            tuple: (x, y, heading) in mm and degrees
        """
        # Get poses from both systems
        odometry_pose = self.odometry.get_pose()
        localized_pose = self.localization.get_localized_pose()
        confidence = self.localization.get_confidence()
        
        # Weighted average based on confidence
        if confidence > 0.8:
            # High confidence - trust localization more
            weight = 0.8
        elif confidence > 0.5:
            # Medium confidence - balanced
            weight = 0.5
        else:
            # Low confidence - trust odometry more
            weight = 0.2
        
        # Combine poses
        x = weight * localized_pose[0] + (1 - weight) * odometry_pose[0]
        y = weight * localized_pose[1] + (1 - weight) * odometry_pose[1]
        
        # Use localized heading if confidence is good
        if confidence > 0.6:
            heading = localized_pose[2]
        else:
            heading = odometry_pose[2]
        
        return (x, y, heading)
    
    def setup_fll_mat(self):
        """Setup path planner with FLL mat obstacles."""
        self.path_planner.setup_fll_obstacles()
        print("FLL mat obstacles configured")
    
    def add_obstacle(self, x, y, width, height):
        """
        Add an obstacle to the path planner.
        
        Args:
            x, y: Top-left corner in mm
            width, height: Size in mm
        """
        self.path_planner.set_obstacle(x, y, width, height)
    
    def clear_obstacles(self):
        """Clear all obstacles from path planner."""
        self.path_planner.clear_obstacles()
    
    def calibrate_on_line(self, expected_color=Color.BLACK):
        """
        Calibrate position when on a known line.
        
        Args:
            expected_color: Expected color of the line
        """
        if not self.color_sensor:
            print("No color sensor attached")
            return False
        
        # Check if on expected color
        detected_color = self.color_sensor.color()
        if detected_color == expected_color:
            # Strong sensor update to correct position
            for _ in range(5):
                self.localization.update_sensor(
                    'color', 
                    detected_color,
                    self.color_sensor_offset[0],
                    self.color_sensor_offset[1]
                )
            
            self.localization.resample()
            print(f"Calibrated on {expected_color} line")
            return True
        
        return False