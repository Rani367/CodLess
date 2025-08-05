"""
Autonomous Navigation Demo for CodLess FLL
Demonstrates how to use the autonomous navigation system
"""

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor
from pybricks.parameters import Port, Color, Button
from pybricks.tools import wait

from autonomous_runner import AutonomousRunner


def main():
    """Main demo function showing autonomous navigation capabilities."""
    
    # Initialize hub
    hub = PrimeHub()
    hub.light.on(Color.BLUE)
    
    # Initialize motors
    left_motor = Motor(Port.A)
    right_motor = Motor(Port.B)
    
    # Robot configuration (adjust for your robot)
    wheel_diameter = 56  # mm
    axle_track = 114     # mm
    
    # Create autonomous runner
    print("Initializing autonomous navigation...")
    autonomous = AutonomousRunner(
        hub, 
        left_motor, 
        right_motor, 
        wheel_diameter, 
        axle_track
    )
    
    # Attach sensors (optional but recommended)
    autonomous.attach_color_sensor(Port.C, sensor_offset=(0, 50))
    
    # Setup FLL mat obstacles
    autonomous.setup_fll_mat()
    
    # Initialize position at start (bottom-left corner)
    autonomous.initialize_position(x=100, y=100, heading=0)
    
    print("Autonomous navigation ready!")
    hub.light.on(Color.GREEN)
    
    # Wait for button press to start
    print("Press CENTER button to start demo")
    while Button.CENTER not in hub.buttons.pressed():
        wait(10)
    
    # Demo 1: Simple waypoint navigation
    demo_simple_navigation(autonomous, hub)
    
    # Demo 2: Path planning with obstacles
    demo_path_planning(autonomous, hub)
    
    # Demo 3: Following recorded path
    demo_recorded_path(autonomous, hub)
    
    # Demo 4: Localization with landmarks
    demo_localization(autonomous, hub)
    
    print("Demo complete!")
    hub.light.on(Color.WHITE)


def demo_simple_navigation(autonomous, hub):
    """Demo 1: Simple waypoint navigation without obstacles."""
    print("\n=== Demo 1: Simple Waypoint Navigation ===")
    hub.light.on(Color.YELLOW)
    
    # Define waypoints (square pattern)
    waypoints = [
        (100, 100, 0),    # Start position
        (400, 100, 0),    # Move right
        (400, 400, 90),   # Move up and turn
        (100, 400, 180),  # Move left and turn
        (100, 100, 0),    # Return to start
    ]
    
    print("Following square pattern...")
    
    # Follow waypoints without path planning
    for i, (x, y, heading) in enumerate(waypoints[1:], 1):
        print(f"Going to waypoint {i}: ({x}, {y}, {heading}°)")
        success = autonomous.navigate_to(x, y, heading, use_path_planning=False)
        
        if success:
            print(f"Reached waypoint {i}")
            # Show current pose
            pose = autonomous.get_best_pose()
            print(f"Current pose: x={pose[0]:.1f}, y={pose[1]:.1f}, heading={pose[2]:.1f}°")
        else:
            print(f"Failed to reach waypoint {i}")
            break
        
        wait(500)  # Pause between waypoints
    
    hub.light.on(Color.GREEN)
    wait(1000)


def demo_path_planning(autonomous, hub):
    """Demo 2: Path planning around obstacles."""
    print("\n=== Demo 2: Path Planning with Obstacles ===")
    hub.light.on(Color.ORANGE)
    
    # Add custom obstacle in the middle
    print("Adding obstacle at center of field...")
    autonomous.add_obstacle(400, 400, 400, 400)
    
    # Navigate from one corner to opposite corner
    print("Planning path from (100, 100) to (1100, 1100)...")
    
    # Reset position
    autonomous.initialize_position(100, 100, 0)
    
    # Navigate using path planning
    success = autonomous.navigate_to(1100, 1100, 45, use_path_planning=True)
    
    if success:
        print("Successfully navigated around obstacles!")
        pose = autonomous.get_best_pose()
        print(f"Final pose: x={pose[0]:.1f}, y={pose[1]:.1f}, heading={pose[2]:.1f}°")
    else:
        print("Failed to find path to target")
    
    hub.light.on(Color.GREEN)
    wait(1000)


def demo_recorded_path(autonomous, hub):
    """Demo 3: Following a recorded teleop path."""
    print("\n=== Demo 3: Following Recorded Path ===")
    hub.light.on(Color.MAGENTA)
    
    # Example recorded commands (figure-8 pattern)
    recorded_commands = [
        {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},    # Forward
        {'type': 'drive', 'speed': 100, 'turn_rate': 45, 'duration': 3.0},   # Curve right
        {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},    # Forward
        {'type': 'drive', 'speed': 100, 'turn_rate': -45, 'duration': 3.0},  # Curve left
        {'type': 'drive', 'speed': 100, 'turn_rate': -45, 'duration': 3.0},  # Continue left
        {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},    # Forward
        {'type': 'drive', 'speed': 100, 'turn_rate': 45, 'duration': 3.0},   # Curve right
        {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},    # Forward
    ]
    
    # Reset position
    autonomous.initialize_position(600, 600, 0)
    
    print("Following recorded figure-8 pattern...")
    success = autonomous.follow_recorded_path(recorded_commands, use_waypoints=True)
    
    if success:
        print("Successfully completed recorded path!")
    else:
        print("Path following interrupted")
    
    hub.light.on(Color.GREEN)
    wait(1000)


def demo_localization(autonomous, hub):
    """Demo 4: Localization using landmarks."""
    print("\n=== Demo 4: Localization with Landmarks ===")
    hub.light.on(Color.CYAN)
    
    if not autonomous.color_sensor:
        print("No color sensor attached, skipping localization demo")
        return
    
    # Initialize with some uncertainty
    print("Initializing with uncertain position...")
    autonomous.initialize_position(300, 300, 0)
    
    # Move to find a black line
    print("Searching for black line landmark...")
    
    # Slowly move forward while checking for line
    autonomous.drive_base.drive(50, 0)  # Slow forward
    
    found_line = False
    for _ in range(100):  # Check for 10 seconds
        autonomous.update_navigation()
        
        if autonomous.color_sensor.color() == Color.BLACK:
            autonomous.drive_base.stop()
            found_line = True
            break
        
        wait(100)
    
    autonomous.drive_base.stop()
    
    if found_line:
        print("Found black line! Calibrating position...")
        autonomous.calibrate_on_line(Color.BLACK)
        
        # Get localized position
        pose = autonomous.get_best_pose()
        confidence = autonomous.localization.get_confidence()
        
        print(f"Localized pose: x={pose[0]:.1f}, y={pose[1]:.1f}, heading={pose[2]:.1f}°")
        print(f"Confidence: {confidence:.2f}")
    else:
        print("No line found for calibration")
    
    hub.light.on(Color.GREEN)
    wait(1000)


def emergency_stop(autonomous, hub):
    """Emergency stop function."""
    autonomous.drive_base.stop()
    autonomous.is_running = False
    hub.light.on(Color.RED)
    print("EMERGENCY STOP ACTIVATED")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        # Try to stop motors on error
        try:
            from pybricks.pupdevices import Motor
            from pybricks.parameters import Port
            Motor(Port.A).stop()
            Motor(Port.B).stop()
        except:
            pass