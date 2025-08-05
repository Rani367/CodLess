"""
Odometry module for CodLess FLL autonomous navigation
Tracks robot position using wheel encoders and gyro sensor
"""

from math import sin, cos, radians, degrees, sqrt, atan2
from pybricks.tools import wait


class Odometry:
    """
    Tracks robot position and orientation using wheel encoders and gyro sensor.
    Uses GyroDriveBase geometry for accurate distance calculations.
    """
    
    def __init__(self, drive_base, gyro_sensor=None):
        """
        Initialize odometry system.
        
        Args:
            drive_base: GyroDriveBase instance for robot movement
            gyro_sensor: Gyro sensor instance (optional, uses drive_base gyro if available)
        """
        self.drive_base = drive_base
        self.gyro = gyro_sensor
        
        # Position state (mm and degrees)
        self.x = 0.0  # mm
        self.y = 0.0  # mm
        self.heading = 0.0  # degrees
        
        # Previous encoder values
        self.prev_distance = 0
        self.prev_angle = 0
        
        # Odometry parameters
        self.use_gyro = gyro_sensor is not None
        
        # Initialize encoder readings
        self.reset_encoders()
    
    def reset_encoders(self):
        """Reset encoder baseline values."""
        if hasattr(self.drive_base, 'distance'):
            self.prev_distance = self.drive_base.distance()
        if hasattr(self.drive_base, 'angle'):
            self.prev_angle = self.drive_base.angle()
        if self.use_gyro and hasattr(self.gyro, 'reset'):
            self.gyro.reset()
    
    def reset_odometry(self, x=0, y=0, heading=0):
        """
        Reset odometry to a known position.
        
        Args:
            x: X position in mm
            y: Y position in mm
            heading: Heading in degrees
        """
        self.x = float(x)
        self.y = float(y)
        self.heading = float(heading)
        self.reset_encoders()
    
    def update(self):
        """
        Update position based on encoder readings.
        Should be called regularly (e.g., every 10-50ms).
        """
        # Get current encoder values
        current_distance = self.drive_base.distance() if hasattr(self.drive_base, 'distance') else 0
        current_angle = self.drive_base.angle() if hasattr(self.drive_base, 'angle') else 0
        
        # Calculate deltas
        delta_distance = current_distance - self.prev_distance
        delta_angle = current_angle - self.prev_angle
        
        # Update heading
        if self.use_gyro and hasattr(self.gyro, 'angle'):
            # Use gyro for more accurate heading if available
            self.heading = self.gyro.angle()
        else:
            # Use wheel encoders for heading
            self.heading += delta_angle
            
        # Normalize heading to 0-360 range
        self.heading = self.heading % 360
        
        # Calculate position change
        # For differential drive, we use arc approximation
        if abs(delta_angle) < 0.01:  # Straight line motion
            # Simple straight line
            heading_rad = radians(self.heading)
            self.x += delta_distance * cos(heading_rad)
            self.y += delta_distance * sin(heading_rad)
        else:
            # Arc motion
            # Calculate radius of arc
            radius = delta_distance / radians(delta_angle)
            
            # Calculate center of rotation
            heading_rad = radians(self.heading - delta_angle / 2)
            
            # Update position using arc geometry
            dx = radius * (sin(radians(self.heading)) - sin(radians(self.heading - delta_angle)))
            dy = radius * (cos(radians(self.heading - delta_angle)) - cos(radians(self.heading)))
            
            self.x += dx
            self.y += dy
        
        # Store current values for next update
        self.prev_distance = current_distance
        self.prev_angle = current_angle
    
    def get_pose(self):
        """
        Get current robot pose.
        
        Returns:
            tuple: (x, y, heading) where x,y are in mm and heading in degrees
        """
        return (self.x, self.y, self.heading)
    
    def get_distance_to(self, target_x, target_y):
        """
        Calculate distance to a target position.
        
        Args:
            target_x: Target X position in mm
            target_y: Target Y position in mm
            
        Returns:
            float: Distance in mm
        """
        dx = target_x - self.x
        dy = target_y - self.y
        return sqrt(dx * dx + dy * dy)
    
    def get_angle_to(self, target_x, target_y):
        """
        Calculate angle to a target position.
        
        Args:
            target_x: Target X position in mm
            target_y: Target Y position in mm
            
        Returns:
            float: Angle in degrees (0-360)
        """
        dx = target_x - self.x
        dy = target_y - self.y
        angle = degrees(atan2(dy, dx))
        # Normalize to 0-360 range
        return angle % 360
    
    def get_angle_difference(self, target_angle):
        """
        Calculate the shortest angle difference to target.
        
        Args:
            target_angle: Target angle in degrees
            
        Returns:
            float: Angle difference in degrees (-180 to 180)
        """
        diff = target_angle - self.heading
        # Normalize to -180 to 180 range
        while diff > 180:
            diff -= 360
        while diff < -180:
            diff += 360
        return diff