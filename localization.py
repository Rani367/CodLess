"""
Monte Carlo Localization (Particle Filter) for CodLess FLL autonomous navigation
Provides robust position estimation using sensor readings and landmarks
"""

from math import sin, cos, radians, degrees, sqrt, exp, pi, atan2
import random
from pybricks.parameters import Color


class Particle:
    """Represents a single particle in the particle filter."""
    
    def __init__(self, x, y, heading, weight=1.0):
        self.x = x
        self.y = y
        self.heading = heading
        self.weight = weight
    
    def move(self, distance, angle, noise_distance=2.0, noise_angle=2.0):
        """
        Move particle based on motion model with noise.
        
        Args:
            distance: Distance moved in mm
            angle: Angle turned in degrees
            noise_distance: Standard deviation for distance noise (mm)
            noise_angle: Standard deviation for angle noise (degrees)
        """
        # Add noise to motion
        noisy_distance = distance + random.gauss(0, noise_distance)
        noisy_angle = angle + random.gauss(0, noise_angle)
        
        # Update heading
        self.heading += noisy_angle
        self.heading = self.heading % 360
        
        # Update position
        heading_rad = radians(self.heading)
        self.x += noisy_distance * cos(heading_rad)
        self.y += noisy_distance * sin(heading_rad)
    
    def copy(self):
        """Create a copy of this particle."""
        return Particle(self.x, self.y, self.heading, self.weight)


class Landmark:
    """Represents a landmark on the FLL mat."""
    
    def __init__(self, x, y, landmark_type, value):
        """
        Initialize landmark.
        
        Args:
            x: X position in mm
            y: Y position in mm
            landmark_type: Type of landmark ('line', 'color', 'distance')
            value: Expected sensor value (Color enum or distance in mm)
        """
        self.x = x
        self.y = y
        self.type = landmark_type
        self.value = value


class Localization:
    """
    Monte Carlo Localization using particle filter.
    Maintains a set of particles representing possible robot positions.
    """
    
    def __init__(self, num_particles=100, field_width=1200, field_height=1200):
        """
        Initialize localization system.
        
        Args:
            num_particles: Number of particles to maintain (50-100 for Spike Prime)
            field_width: Width of FLL field in mm
            field_height: Height of FLL field in mm
        """
        self.num_particles = num_particles
        self.field_width = field_width
        self.field_height = field_height
        
        # Initialize particles uniformly across field
        self.particles = []
        self.initialize_particles()
        
        # Landmarks on FLL mat (customize for specific season)
        self.landmarks = self._setup_fll_landmarks()
        
        # Sensor noise parameters
        self.color_noise_prob = 0.1  # Probability of color misreading
        self.distance_noise_std = 20  # Standard deviation for distance sensor (mm)
        
        # Motion noise parameters
        self.motion_distance_noise = 3.0  # mm
        self.motion_angle_noise = 2.0  # degrees
    
    def _setup_fll_landmarks(self):
        """
        Setup common FLL mat landmarks.
        Customize this for specific FLL season mat.
        """
        landmarks = []
        
        # Example landmarks - customize for your FLL mat
        # Black lines at regular intervals
        for x in range(0, self.field_width + 1, 300):
            landmarks.append(Landmark(x, 0, 'line', Color.BLACK))
            landmarks.append(Landmark(x, self.field_height, 'line', Color.BLACK))
        
        for y in range(0, self.field_height + 1, 300):
            landmarks.append(Landmark(0, y, 'line', Color.BLACK))
            landmarks.append(Landmark(self.field_width, y, 'line', Color.BLACK))
        
        # Add colored zones (example - customize for your mat)
        landmarks.append(Landmark(300, 300, 'color', Color.BLUE))
        landmarks.append(Landmark(900, 300, 'color', Color.RED))
        landmarks.append(Landmark(300, 900, 'color', Color.GREEN))
        landmarks.append(Landmark(900, 900, 'color', Color.YELLOW))
        
        return landmarks
    
    def initialize_particles(self, x=None, y=None, heading=None, spread=100):
        """
        Initialize or reset particles.
        
        Args:
            x: Initial X position (None for uniform distribution)
            y: Initial Y position (None for uniform distribution)
            heading: Initial heading (None for uniform distribution)
            spread: Spread around initial position in mm
        """
        self.particles = []
        
        if x is not None and y is not None:
            # Initialize around known position
            for _ in range(self.num_particles):
                px = x + random.gauss(0, spread)
                py = y + random.gauss(0, spread)
                ph = heading if heading is not None else random.uniform(0, 360)
                if heading is not None:
                    ph += random.gauss(0, 10)  # Add some heading uncertainty
                
                # Keep particles within field bounds
                px = max(0, min(self.field_width, px))
                py = max(0, min(self.field_height, py))
                
                self.particles.append(Particle(px, py, ph % 360))
        else:
            # Uniform distribution across field
            for _ in range(self.num_particles):
                px = random.uniform(0, self.field_width)
                py = random.uniform(0, self.field_height)
                ph = random.uniform(0, 360)
                self.particles.append(Particle(px, py, ph))
    
    def update_motion(self, distance, angle):
        """
        Update all particles based on robot motion.
        
        Args:
            distance: Distance moved in mm
            angle: Angle turned in degrees
        """
        for particle in self.particles:
            particle.move(distance, angle, self.motion_distance_noise, self.motion_angle_noise)
            
            # Keep particles within bounds
            particle.x = max(0, min(self.field_width, particle.x))
            particle.y = max(0, min(self.field_height, particle.y))
    
    def update_sensor(self, sensor_type, sensor_value, sensor_x_offset=0, sensor_y_offset=50):
        """
        Update particle weights based on sensor reading.
        
        Args:
            sensor_type: Type of sensor ('color', 'distance')
            sensor_value: Sensor reading (Color enum or distance in mm)
            sensor_x_offset: Sensor X offset from robot center (mm)
            sensor_y_offset: Sensor Y offset from robot center (mm)
        """
        for particle in self.particles:
            # Calculate sensor position for this particle
            heading_rad = radians(particle.heading)
            sensor_x = particle.x + sensor_x_offset * cos(heading_rad) - sensor_y_offset * sin(heading_rad)
            sensor_y = particle.y + sensor_x_offset * sin(heading_rad) + sensor_y_offset * cos(heading_rad)
            
            # Calculate weight based on sensor reading
            if sensor_type == 'color':
                weight = self._calculate_color_weight(sensor_x, sensor_y, sensor_value)
            elif sensor_type == 'distance':
                weight = self._calculate_distance_weight(sensor_x, sensor_y, sensor_value, particle.heading)
            else:
                weight = 1.0
            
            particle.weight *= weight
        
        # Normalize weights
        self._normalize_weights()
    
    def _calculate_color_weight(self, x, y, detected_color):
        """Calculate particle weight based on color sensor reading."""
        # Find nearest landmark
        min_distance = float('inf')
        nearest_landmark = None
        
        for landmark in self.landmarks:
            if landmark.type == 'color' or (landmark.type == 'line' and detected_color == Color.BLACK):
                dist = sqrt((x - landmark.x)**2 + (y - landmark.y)**2)
                if dist < min_distance:
                    min_distance = dist
                    nearest_landmark = landmark
        
        if nearest_landmark is None:
            return 1.0
        
        # Weight based on distance to landmark and color match
        if min_distance < 50:  # Within 50mm of landmark
            if detected_color == nearest_landmark.value:
                return 10.0  # High weight for correct color
            else:
                return self.color_noise_prob  # Low weight for wrong color
        else:
            # Not near any landmark
            if detected_color == Color.WHITE:  # Expected on white areas
                return 1.0
            else:
                return 0.5  # Unexpected color
    
    def _calculate_distance_weight(self, x, y, measured_distance, heading):
        """Calculate particle weight based on distance sensor reading."""
        # Simple wall distance calculation (customize for your setup)
        # Assume sensor points forward
        heading_rad = radians(heading)
        
        # Calculate expected distance to walls
        distances_to_walls = []
        
        # North wall
        if heading > 315 or heading < 45:
            dist = (self.field_height - y) / cos(heading_rad)
            distances_to_walls.append(dist)
        
        # East wall
        if 45 < heading < 135:
            dist = (self.field_width - x) / sin(heading_rad)
            distances_to_walls.append(dist)
        
        # South wall
        if 135 < heading < 225:
            dist = y / abs(cos(heading_rad))
            distances_to_walls.append(dist)
        
        # West wall
        if 225 < heading < 315:
            dist = x / abs(sin(heading_rad))
            distances_to_walls.append(dist)
        
        # Find closest expected distance
        if distances_to_walls:
            expected_distance = min(distances_to_walls)
            # Gaussian weight based on difference
            diff = measured_distance - expected_distance
            weight = exp(-0.5 * (diff / self.distance_noise_std) ** 2)
            return weight
        
        return 1.0
    
    def _normalize_weights(self):
        """Normalize particle weights to sum to 1."""
        total_weight = sum(p.weight for p in self.particles)
        if total_weight > 0:
            for particle in self.particles:
                particle.weight /= total_weight
    
    def resample(self):
        """Resample particles based on weights (systematic resampling)."""
        new_particles = []
        
        # Calculate cumulative weights
        cumulative_weights = []
        cumsum = 0
        for particle in self.particles:
            cumsum += particle.weight
            cumulative_weights.append(cumsum)
        
        # Systematic resampling
        step = 1.0 / self.num_particles
        start = random.uniform(0, step)
        
        for i in range(self.num_particles):
            target = start + i * step
            
            # Find particle to copy
            idx = 0
            while idx < len(cumulative_weights) - 1 and cumulative_weights[idx] < target:
                idx += 1
            
            # Copy particle with slight noise
            new_particle = self.particles[idx].copy()
            new_particle.x += random.gauss(0, 5)  # Small position noise
            new_particle.y += random.gauss(0, 5)
            new_particle.heading += random.gauss(0, 2)  # Small heading noise
            new_particle.weight = 1.0 / self.num_particles
            
            new_particles.append(new_particle)
        
        self.particles = new_particles
    
    def get_localized_pose(self):
        """
        Get estimated robot pose from weighted average of particles.
        
        Returns:
            tuple: (x, y, heading) where x,y are in mm and heading in degrees
        """
        # Weighted average
        total_weight = sum(p.weight for p in self.particles)
        if total_weight == 0:
            # Fallback to simple average
            x = sum(p.x for p in self.particles) / self.num_particles
            y = sum(p.y for p in self.particles) / self.num_particles
            
            # Circular mean for heading
            sin_sum = sum(sin(radians(p.heading)) for p in self.particles)
            cos_sum = sum(cos(radians(p.heading)) for p in self.particles)
            heading = degrees(atan2(sin_sum, cos_sum)) % 360
        else:
            # Weighted average
            x = sum(p.x * p.weight for p in self.particles) / total_weight
            y = sum(p.y * p.weight for p in self.particles) / total_weight
            
            # Weighted circular mean for heading
            sin_sum = sum(sin(radians(p.heading)) * p.weight for p in self.particles) / total_weight
            cos_sum = sum(cos(radians(p.heading)) * p.weight for p in self.particles) / total_weight
            heading = degrees(atan2(sin_sum, cos_sum)) % 360
        
        return (x, y, heading)
    
    def get_confidence(self):
        """
        Get confidence measure based on particle spread.
        
        Returns:
            float: Confidence value (0-1), higher means more certain
        """
        # Calculate standard deviation of particles
        x_mean, y_mean, _ = self.get_localized_pose()
        
        x_variance = sum((p.x - x_mean)**2 * p.weight for p in self.particles)
        y_variance = sum((p.y - y_mean)**2 * p.weight for p in self.particles)
        
        # Convert variance to confidence (inverse relationship)
        spread = sqrt(x_variance + y_variance)
        confidence = 1.0 / (1.0 + spread / 100.0)  # Normalize to 0-1
        
        return confidence