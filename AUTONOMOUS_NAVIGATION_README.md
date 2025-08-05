# CodLess Autonomous Navigation System

## Overview

The CodLess Autonomous Navigation System adds high-precision autonomous capabilities to your FLL robot using advanced navigation algorithms. This system integrates seamlessly with the existing CodLess teleop and recording features.

## Features

### 1. **Odometry System**
- Real-time position tracking using wheel encoders
- Optional gyro sensor integration for improved heading accuracy
- Tracks robot pose (x, y, heading) in millimeters and degrees
- Handles both straight-line and arc motions

### 2. **Monte Carlo Localization (Particle Filter)**
- Maintains 50-100 particles for position estimation
- Sensor fusion with color and distance sensors
- Automatic landmark detection and position correction
- Confidence-based pose estimation

### 3. **A* Path Planning**
- Grid-based path planning (50mm resolution)
- Automatic obstacle avoidance
- Customizable FLL mat obstacles
- Path smoothing for efficient navigation

### 4. **Waypoint Navigation**
- Precise waypoint following using GyroDriveBase
- Convert recorded teleop paths to optimized waypoints
- Support for position and heading targets
- Configurable tolerances (10mm distance, 2° angle)

### 5. **Integrated Autonomous Runner**
- Combines all navigation components
- Multiple autonomous modes:
  - Direct waypoint navigation
  - Path planning with obstacles
  - Recorded path replay
  - Full autonomous missions

## Installation

The autonomous navigation system is integrated into the CodLess hub code generator. When generating code for your hub:

1. Enable "Include Autonomous Navigation" in settings
2. Configure sensor ports (if using):
   - Color sensor: Port E (default)
   - Distance sensor: Port F (default)
3. Upload the generated code to your hub

## Usage

### Basic Setup

```python
# The autonomous system is automatically initialized when you upload code
# Access it through the hub's button interface:
# - LEFT button: Teleop mode
# - CENTER button: Replay mode  
# - RIGHT button: Autonomous mode
```

### Autonomous Modes

When in autonomous mode (RIGHT button), use the hub buttons to select:

1. **Waypoint Demo** - Follow a square pattern
2. **Path Planning Demo** - Navigate around obstacles
3. **Replay Demo** - Convert and follow recorded paths
4. **Full Demo** - Complete autonomous mission example

### Programming Custom Autonomous Routines

```python
# Example: Navigate to specific positions
autonomous.navigate_to(600, 300, 0)  # Go to (600mm, 300mm) facing 0°

# Example: Follow custom waypoints
waypoints = [
    (100, 100, 0),    # Start position
    (400, 100, 0),    # Move right
    (400, 400, 90),   # Move up and turn
    (100, 400, 180),  # Move left and turn
]
for x, y, heading in waypoints:
    autonomous.navigate_to(x, y, heading)

# Example: Use path planning to avoid obstacles
autonomous.add_obstacle(400, 400, 200, 200)  # Add obstacle
autonomous.navigate_to(1000, 1000, 45, use_path_planning=True)

# Example: Calibrate on line
if autonomous.calibrate_on_line(Color.BLACK):
    print("Calibrated position!")
```

## FLL Mat Configuration

The system includes pre-configured FLL mat landmarks:
- Black lines at field edges and regular intervals
- Colored zones for localization
- Safety margins around field perimeter

Customize for your specific FLL season in the path planner:

```python
def setup_fll_obstacles(self):
    # Add your mission models
    self.set_obstacle(x, y, width, height)
```

## Performance Optimization

The system is optimized for Spike Prime:
- 50-75 particles for localization (balance accuracy vs performance)
- 20ms odometry update rate
- 200ms localization update rate
- 50mm grid resolution for path planning

## Troubleshooting

### Robot doesn't reach waypoints accurately
- Check wheel diameter and axle track measurements
- Ensure motors are firmly connected
- Calibrate on known landmarks when possible

### Path planning fails
- Verify obstacles don't block all paths
- Check start/goal positions are valid
- Reduce grid size for tighter spaces

### Localization confidence is low
- Add more landmarks to the mat configuration
- Ensure color sensor is properly mounted
- Calibrate on lines periodically

## Advanced Features

### Recording to Autonomous Conversion
The system can convert your recorded teleop runs into optimized autonomous paths:

```python
# Record a path using teleop mode
# Then in autonomous mode:
recorded_commands = [...]  # Your recorded commands
success = autonomous.follow_recorded_path(recorded_commands, use_waypoints=True)
```

### Dynamic Obstacle Avoidance
Add obstacles during runtime:

```python
# Clear previous obstacles
autonomous.clear_obstacles()

# Add new obstacles
autonomous.add_obstacle(300, 300, 150, 150)

# Re-plan path
autonomous.navigate_to(target_x, target_y, use_path_planning=True)
```

### Multi-Sensor Fusion
The localization system combines:
- Wheel odometry
- Gyro sensor (if available)
- Color sensor landmarks
- Distance sensor readings

## Best Practices

1. **Start Simple**: Test basic waypoint navigation before complex paths
2. **Use Landmarks**: Calibrate on lines/colors when passing known positions
3. **Plan Paths**: Use path planning for complex environments
4. **Test Thoroughly**: Verify autonomous routines multiple times
5. **Have Backups**: Keep manual control ready for competitions

## Example Mission

```python
def complete_fll_mission():
    # Initialize at base
    autonomous.initialize_position(100, 100, 0)
    
    # Mission 1: Deliver to blue zone
    print("Mission 1: Delivering to blue zone")
    autonomous.navigate_to(300, 300, 0)
    # Perform mission actions here
    
    # Calibrate on nearby line
    autonomous.calibrate_on_line(Color.BLACK)
    
    # Mission 2: Collect from red zone
    print("Mission 2: Collecting from red zone")
    autonomous.navigate_to(900, 300, 90)
    # Perform mission actions here
    
    # Return home avoiding center obstacle
    print("Returning to base")
    autonomous.navigate_to(100, 100, 0, use_path_planning=True)
    
    print("Mission complete!")
```

## Technical Details

### Coordinate System
- Origin (0, 0) at bottom-left of field
- X-axis: horizontal (increases right)
- Y-axis: vertical (increases up)
- Heading: 0° = right, 90° = up, 180° = left, 270° = down

### Module Architecture
1. **odometry.py** - Low-level position tracking
2. **localization.py** - Particle filter for robust positioning
3. **path_planner.py** - A* algorithm for obstacle avoidance
4. **waypoint_navigator.py** - High-level movement control
5. **autonomous_runner.py** - Integration and coordination

### Memory Considerations
The complete autonomous system uses significant memory. If you encounter memory issues:
- Reduce particle count (minimum 30-40)
- Simplify path planning grid
- Remove unused features

## Support

For questions or issues with the autonomous navigation system:
1. Check the troubleshooting section above
2. Verify your robot configuration matches the code
3. Test individual components separately
4. Report issues on the CodLess GitHub repository

Happy autonomous navigating! 🤖🚀