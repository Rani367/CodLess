/**
 * Autonomous Hub Code Generator for CodLess
 * Generates complete Pybricks code including autonomous navigation modules
 */

class AutonomousHubCodeGenerator {
    constructor() {
        this.autonomousModules = {
            odometry: this.getOdometryModule(),
            localization: this.getLocalizationModule(),
            pathPlanner: this.getPathPlannerModule(),
            waypointNavigator: this.getWaypointNavigatorModule(),
            autonomousRunner: this.getAutonomousRunnerModule()
        };
    }

    generateCompleteHubCode(config, savedRuns = [], includeAutonomous = true) {
        let code = [];
        
        // Add imports
        code.push(this.generateImports(includeAutonomous));
        code.push('');
        
        // Add autonomous modules if enabled
        if (includeAutonomous) {
            code.push('# === AUTONOMOUS NAVIGATION MODULES ===');
            code.push('');
            
            // Add each module
            code.push(this.autonomousModules.odometry);
            code.push('');
            code.push(this.autonomousModules.localization);
            code.push('');
            code.push(this.autonomousModules.pathPlanner);
            code.push('');
            code.push(this.autonomousModules.waypointNavigator);
            code.push('');
            code.push(this.autonomousModules.autonomousRunner);
            code.push('');
        }
        
        // Add main robot code
        code.push('# === MAIN ROBOT CODE ===');
        code.push('');
        code.push(this.generateMainCode(config, savedRuns, includeAutonomous));
        
        return code.join('\n');
    }

    generateImports(includeAutonomous) {
        let imports = [
            'from pybricks.hubs import PrimeHub',
            'from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor',
            'from pybricks.parameters import Port, Color, Button, Stop',
            'from pybricks.robotics import DriveBase, GyroDriveBase',
            'from pybricks.tools import wait, StopWatch',
            'from usys import stdin, stdout',
            'from uselect import poll',
            'import ujson'
        ];
        
        if (includeAutonomous) {
            imports.push('from math import sin, cos, radians, degrees, sqrt, exp, pi, atan2, acos');
            imports.push('import random');
            imports.push('import heapq');
        }
        
        return imports.join('\n');
    }

    generateMainCode(config, savedRuns, includeAutonomous) {
        return `
# Initialize hub
hub = PrimeHub()
hub.display.icon([
    [100, 100, 100, 100, 100],
    [100, 0, 100, 0, 100], 
    [100, 100, 100, 100, 100],
    [100, 0, 0, 0, 100],
    [100, 100, 100, 100, 100]
])

# Motor configuration
left_motor_port = Port.${config.leftMotorPort || 'A'}
right_motor_port = Port.${config.rightMotorPort || 'B'}
arm1_motor_port = Port.${config.arm1MotorPort || 'C'}
arm2_motor_port = Port.${config.arm2MotorPort || 'D'}

# Robot parameters
wheel_diameter = ${config.wheelDiameter || 56}
axle_track = ${config.axleTrack || 114}

# Initialize motors and drive base
try:
    left_motor = Motor(left_motor_port)
    right_motor = Motor(right_motor_port)
    
    ${includeAutonomous ? `# Use GyroDriveBase for autonomous navigation
    drive_base = GyroDriveBase(left_motor, right_motor, wheel_diameter, axle_track)` : 
    `# Use standard DriveBase
    drive_base = DriveBase(left_motor, right_motor, wheel_diameter, axle_track)`}
    
    drive_base.settings(
        straight_speed=${config.straightSpeed || 200},
        straight_acceleration=${config.straightAcceleration || 100},
        turn_rate=${config.turnRate || 90},
        turn_acceleration=${config.turnAcceleration || 180}
    )
    
    hub.light.on(Color.GREEN)
except:
    hub.light.on(Color.YELLOW)
    drive_base = None

# Initialize arm motors
motors = {}
try:
    motors['arm1'] = Motor(arm1_motor_port)
except:
    pass

try:
    motors['arm2'] = Motor(arm2_motor_port)
except:
    pass

${includeAutonomous ? this.generateAutonomousSetup(config) : ''}

# Operating modes
MODE_TELEOP = 0
MODE_REPLAY = 1
MODE_AUTONOMOUS = 2
current_mode = MODE_TELEOP

${this.generateRunFunctions(savedRuns)}

${includeAutonomous ? this.generateAutonomousRunFunctions() : ''}

# Main control loop
def main():
    global current_mode
    
    # Setup keyboard polling for teleop mode
    keyboard = poll()
    keyboard.register(stdin)
    
    hub.display.icon([
        [0, 100, 0, 100, 0],
        [100, 100, 100, 100, 100],
        [0, 100, 100, 100, 0],
        [0, 0, 100, 0, 0],
        [0, 0, 100, 0, 0]
    ])
    
    print("Robot ready!")
    print("Control mode from CodLess app")
    
    # Start in teleop mode
    current_mode = MODE_TELEOP
    hub.light.on(Color.CYAN)
    
    while True:
        # Run current mode
        if current_mode == MODE_TELEOP:
            hub.light.on(Color.CYAN)
            print("Teleop mode active")
            teleop_mode(keyboard)
        elif current_mode == MODE_REPLAY:
            hub.light.on(Color.MAGENTA)
            print("Replay mode active")
            replay_mode(keyboard)
        ${includeAutonomous ? `elif current_mode == MODE_AUTONOMOUS:
            hub.light.on(Color.ORANGE)
            print("Autonomous mode active")
            autonomous_mode(keyboard)` : ''}
        
        wait(50)

def teleop_mode(keyboard):
    """Teleoperation mode - control via Bluetooth commands."""
    global current_mode
    
    while current_mode == MODE_TELEOP:
        stdout.buffer.write(b"rdy")
        
        while not keyboard.poll(10):
            if hub.buttons.pressed():
                return  # Exit if button pressed
            wait(1)
        
        try:
            data = stdin.buffer.read()
            if data:
                command_str = data.decode('utf-8')
                command = ujson.loads(command_str)
                
                cmd_type = command.get('type', '')
                
                if cmd_type == 'mode':
                    # Handle mode change from app
                    new_mode = command.get('mode', '')
                    if new_mode == 'teleop':
                        current_mode = MODE_TELEOP
                    elif new_mode == 'replay':
                        current_mode = MODE_REPLAY
                    elif new_mode == 'autonomous':
                        current_mode = MODE_AUTONOMOUS
                    stdout.buffer.write(b"MODE_CHANGED")
                    return  # Exit to main loop for mode switch
                    
                elif cmd_type == 'drive' and drive_base:
                    speed = command.get('speed', 0)
                    turn_rate = command.get('turn_rate', 0)
                    drive_base.drive(speed, turn_rate)
                    stdout.buffer.write(b"DRIVE_OK")
                    
                elif cmd_type in ['arm1', 'arm2'] and cmd_type in motors:
                    motor = motors[cmd_type]
                    speed = command.get('speed', 0)
                    if speed == 0:
                        motor.stop()
                    else:
                        motor.run(speed)
                    stdout.buffer.write(b"ARM_OK")
                    
                elif cmd_type == 'stop':
                    if drive_base:
                        drive_base.stop()
                    for motor in motors.values():
                        motor.stop()
                    stdout.buffer.write(b"STOP_OK")
                else:
                    stdout.buffer.write(b"UNKNOWN_CMD")
                    
        except Exception as e:
            stdout.buffer.write(b"ERROR")
        
        wait(10)

def replay_mode(keyboard):
    """Replay saved runs - controlled from app."""
    global current_mode
    
    while current_mode == MODE_REPLAY:
        stdout.buffer.write(b"rdy")
        
        while not keyboard.poll(10):
            wait(1)
        
        try:
            data = stdin.buffer.read()
            if data:
                command_str = data.decode('utf-8')
                command = ujson.loads(command_str)
                
                cmd_type = command.get('type', '')
                
                if cmd_type == 'mode':
                    # Handle mode change from app
                    new_mode = command.get('mode', '')
                    if new_mode == 'teleop':
                        current_mode = MODE_TELEOP
                    elif new_mode == 'replay':
                        current_mode = MODE_REPLAY
                    elif new_mode == 'autonomous':
                        current_mode = MODE_AUTONOMOUS
                    stdout.buffer.write(b"MODE_CHANGED")
                    return
                    
                elif cmd_type == 'replay':
                    # Run specific saved run
                    run_id = command.get('run_id', 1)
                    runs = {
                        ${savedRuns.map((run, i) => `${i + 1}: run_${i + 1},  # ${run.name}`).join(',\n                        ')}
                    }
                    if run_id in runs:
                        hub.light.on(Color.BLUE)
                        runs[run_id]()
                        hub.light.on(Color.GREEN)
                        stdout.buffer.write(b"REPLAY_COMPLETE")
                    else:
                        stdout.buffer.write(b"RUN_NOT_FOUND")
                    
                elif cmd_type == 'stop':
                    if drive_base:
                        drive_base.stop()
                    for motor in motors.values():
                        motor.stop()
                    stdout.buffer.write(b"STOP_OK")
                else:
                    stdout.buffer.write(b"UNKNOWN_CMD")
                    
        except Exception as e:
            stdout.buffer.write(b"ERROR")
        
        wait(10)

# Start main program
main()`;
    }

    generateAutonomousSetup(config) {
        return `
# Initialize autonomous navigation
autonomous = None
if drive_base:
    try:
        autonomous = AutonomousRunner(hub, left_motor, right_motor, wheel_diameter, axle_track)
        
        # Attach sensors if available
        try:
            autonomous.attach_color_sensor(Port.${config.colorSensorPort || 'E'})
            print("Color sensor attached")
        except:
            print("No color sensor found")
        
        try:
            autonomous.attach_distance_sensor(Port.${config.distanceSensorPort || 'F'})
            print("Distance sensor attached")
        except:
            print("No distance sensor found")
        
        # Setup FLL mat
        autonomous.setup_fll_mat()
        
        # Initialize at home position
        autonomous.initialize_position(100, 100, 0)
        
        print("Autonomous navigation ready")
    except Exception as e:
        print(f"Failed to initialize autonomous: {e}")
        autonomous = None`;
    }

    generateRunFunctions(savedRuns) {
        if (!savedRuns || savedRuns.length === 0) {
            return '# No saved runs';
        }
        
        let code = ['# Saved run functions'];
        
        savedRuns.forEach((run, index) => {
            code.push(`
def run_${index + 1}():
    """${run.name}"""
    print("Running: ${run.name}")
    
    if not drive_base:
        print("No drive base available")
        return`);
            
            if (run.commands && run.commands.length > 0) {
                run.commands.forEach(cmd => {
                    const cmdType = cmd.command_type || cmd.type;
                    const params = cmd.parameters || cmd;
                    const duration = params.duration ? Math.round(params.duration * 1000) : 0;
                    
                    if (cmdType === 'drive') {
                        const speed = params.speed || 0;
                        const turnRate = params.turn_rate || 0;
                        
                        if (speed !== 0 || turnRate !== 0) {
                            code.push(`    drive_base.drive(${speed}, ${turnRate})`);
                            if (duration > 0) {
                                code.push(`    wait(${duration})`);
                            }
                            code.push('    drive_base.stop()');
                        } else {
                            code.push('    drive_base.stop()');
                        }
                    } else if (cmdType === 'arm1' || cmdType === 'arm2') {
                        const speed = params.speed || 0;
                        code.push(`    if '${cmdType}' in motors:`);
                        if (speed !== 0) {
                            code.push(`        motors['${cmdType}'].run(${speed})`);
                            if (duration > 0) {
                                code.push(`        wait(${duration})`);
                            }
                            code.push(`        motors['${cmdType}'].stop()`);
                        } else {
                            code.push(`        motors['${cmdType}'].stop()`);
                        }
                    }
                });
            } else {
                code.push('    pass');
            }
            
            code.push('    wait(100)');
            code.push('');
        });
        
        return code.join('\n');
    }

    generateAutonomousRunFunctions() {
        return `
def autonomous_mode(keyboard):
    """Autonomous navigation mode - controlled from app."""
    global current_mode
    
    if not autonomous:
        print("Autonomous navigation not available")
        hub.light.on(Color.RED)
        wait(1000)
        return
    
    # Send initial position
    x, y, heading = autonomous.get_best_pose()
    status_msg = ujson.dumps({
        'type': 'status',
        'position': {'x': x, 'y': y, 'heading': heading},
        'confidence': autonomous.localization.get_confidence()
    })
    stdout.buffer.write(status_msg.encode())
    
    while current_mode == MODE_AUTONOMOUS:
        stdout.buffer.write(b"rdy")
        
        while not keyboard.poll(10):
            # Update navigation periodically
            autonomous.update_navigation()
            
            # Send status updates every 500ms
            if autonomous.update_timer.time() > 500:
                x, y, heading = autonomous.get_best_pose()
                status_msg = ujson.dumps({
                    'type': 'status',
                    'position': {'x': x, 'y': y, 'heading': heading},
                    'confidence': autonomous.localization.get_confidence()
                })
                stdout.buffer.write(status_msg.encode())
                autonomous.update_timer.reset()
            
            wait(1)
        
        try:
            data = stdin.buffer.read()
            if data:
                command_str = data.decode('utf-8')
                command = ujson.loads(command_str)
                
                cmd_type = command.get('type', '')
                
                if cmd_type == 'mode':
                    # Handle mode change from app
                    new_mode = command.get('mode', '')
                    if new_mode == 'teleop':
                        current_mode = MODE_TELEOP
                    elif new_mode == 'replay':
                        current_mode = MODE_REPLAY
                    elif new_mode == 'autonomous':
                        current_mode = MODE_AUTONOMOUS
                    stdout.buffer.write(b"MODE_CHANGED")
                    return
                    
                elif cmd_type == 'autonomous':
                    action = command.get('action', '')
                    
                    if action == 'navigate':
                        x = command.get('x', 0)
                        y = command.get('y', 0)
                        heading = command.get('heading', None)
                        use_path_planning = command.get('usePathPlanning', True)
                        
                        success = autonomous.navigate_to(x, y, heading, use_path_planning)
                        if success:
                            stdout.buffer.write(b"NAV_SUCCESS")
                        else:
                            stdout.buffer.write(b"NAV_FAILED")
                    
                    elif action == 'followPath':
                        commands = command.get('commands', [])
                        use_waypoints = command.get('useWaypoints', True)
                        
                        success = autonomous.follow_recorded_path(commands, use_waypoints)
                        if success:
                            stdout.buffer.write(b"PATH_SUCCESS")
                        else:
                            stdout.buffer.write(b"PATH_FAILED")
                    
                    elif action == 'demo':
                        demo_type = command.get('demoType', '')
                        
                        if demo_type == 'square':
                            autonomous_waypoint_demo()
                        elif demo_type == 'figure8':
                            # Implement figure 8 demo
                            commands = [
                                {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},
                                {'type': 'drive', 'speed': 100, 'turn_rate': 45, 'duration': 3.0},
                                {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},
                                {'type': 'drive', 'speed': 100, 'turn_rate': -45, 'duration': 6.0},
                                {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},
                                {'type': 'drive', 'speed': 100, 'turn_rate': 45, 'duration': 3.0},
                            ]
                            autonomous.follow_recorded_path(commands, True)
                        elif demo_type == 'obstacle':
                            autonomous_path_planning_demo()
                        elif demo_type == 'mission':
                            autonomous_full_demo()
                        
                        stdout.buffer.write(b"DEMO_COMPLETE")
                    
                    elif action == 'calibrate':
                        expected_color = command.get('expectedColor', 'BLACK')
                        color_map = {'BLACK': Color.BLACK, 'WHITE': Color.WHITE, 'RED': Color.RED}
                        color = color_map.get(expected_color, Color.BLACK)
                        
                        success = autonomous.calibrate_on_line(color)
                        if success:
                            stdout.buffer.write(b"CALIBRATE_SUCCESS")
                        else:
                            stdout.buffer.write(b"CALIBRATE_FAILED")
                    
                    elif action == 'resetPosition':
                        x = command.get('x', 0)
                        y = command.get('y', 0)
                        heading = command.get('heading', 0)
                        
                        autonomous.initialize_position(x, y, heading)
                        stdout.buffer.write(b"POSITION_RESET")
                    
                    elif action == 'addObstacle':
                        x = command.get('x', 0)
                        y = command.get('y', 0)
                        width = command.get('width', 100)
                        height = command.get('height', 100)
                        
                        autonomous.add_obstacle(x, y, width, height)
                        stdout.buffer.write(b"OBSTACLE_ADDED")
                    
                    elif action == 'clearObstacles':
                        autonomous.clear_obstacles()
                        stdout.buffer.write(b"OBSTACLES_CLEARED")
                    
                elif cmd_type == 'stop':
                    autonomous.drive_base.stop()
                    autonomous.is_running = False
                    stdout.buffer.write(b"STOP_OK")
                else:
                    stdout.buffer.write(b"UNKNOWN_CMD")
                    
        except Exception as e:
            stdout.buffer.write(b"ERROR")
            print(f"Error: {e}")
        
        wait(10)

def autonomous_waypoint_demo():
    """Demo waypoint navigation."""
    print("Waypoint navigation demo")
    
    # Square pattern
    waypoints = [
        (400, 100, 0),
        (400, 400, 90),
        (100, 400, 180),
        (100, 100, 270)
    ]
    
    for i, (x, y, heading) in enumerate(waypoints):
        print(f"Going to waypoint {i+1}")
        success = autonomous.navigate_to(x, y, heading, use_path_planning=False)
        if not success:
            print("Navigation failed")
            break
        wait(500)

def autonomous_path_planning_demo():
    """Demo path planning with obstacles."""
    print("Path planning demo")
    
    # Navigate to opposite corner avoiding obstacles
    success = autonomous.navigate_to(1100, 1100, 45, use_path_planning=True)
    
    if success:
        print("Reached target!")
        # Return home
        autonomous.navigate_to(100, 100, 0, use_path_planning=True)
    else:
        print("Path planning failed")

def autonomous_replay_demo():
    """Convert and replay a recorded run autonomously."""
    print("Autonomous replay demo")
    
    # Example: replay first saved run if available
    if 'run_1' in globals():
        # Create sample commands for demo
        commands = [
            {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0},
            {'type': 'drive', 'speed': 100, 'turn_rate': 45, 'duration': 2.0},
            {'type': 'drive', 'speed': 200, 'turn_rate': 0, 'duration': 2.0}
        ]
        
        success = autonomous.follow_recorded_path(commands, use_waypoints=True)
        
        if success:
            print("Replay completed")
        else:
            print("Replay interrupted")
    else:
        print("No saved runs to replay")

def autonomous_full_demo():
    """Full autonomous demo."""
    print("Full autonomous demo")
    
    # Reset to known position
    autonomous.initialize_position(100, 100, 0)
    
    # 1. Navigate to first mission
    print("Mission 1: Navigate to (600, 300)")
    autonomous.navigate_to(600, 300, 0)
    wait(1000)
    
    # 2. Calibrate on line if possible
    if autonomous.color_sensor:
        print("Looking for line...")
        if autonomous.calibrate_on_line(Color.BLACK):
            print("Calibrated!")
    
    # 3. Navigate to second mission
    print("Mission 2: Navigate to (900, 900)")
    autonomous.navigate_to(900, 900, 45)
    wait(1000)
    
    # 4. Return home
    print("Returning home...")
    autonomous.navigate_to(100, 100, 0)
    
    print("Demo complete!")`;
    }

    // Minified module getters
    getOdometryModule() {
        return `# Odometry Module
class Odometry:
    def __init__(self, drive_base, gyro_sensor=None):
        self.drive_base = drive_base
        self.gyro = gyro_sensor
        self.x = 0.0
        self.y = 0.0
        self.heading = 0.0
        self.prev_distance = 0
        self.prev_angle = 0
        self.use_gyro = gyro_sensor is not None
        self.reset_encoders()
    
    def reset_encoders(self):
        if hasattr(self.drive_base, 'distance'):
            self.prev_distance = self.drive_base.distance()
        if hasattr(self.drive_base, 'angle'):
            self.prev_angle = self.drive_base.angle()
        if self.use_gyro and hasattr(self.gyro, 'reset'):
            self.gyro.reset()
    
    def reset_odometry(self, x=0, y=0, heading=0):
        self.x = float(x)
        self.y = float(y)
        self.heading = float(heading)
        self.reset_encoders()
    
    def update(self):
        current_distance = self.drive_base.distance() if hasattr(self.drive_base, 'distance') else 0
        current_angle = self.drive_base.angle() if hasattr(self.drive_base, 'angle') else 0
        
        delta_distance = current_distance - self.prev_distance
        delta_angle = current_angle - self.prev_angle
        
        if self.use_gyro and hasattr(self.gyro, 'angle'):
            self.heading = self.gyro.angle()
        else:
            self.heading += delta_angle
            
        self.heading = self.heading % 360
        
        if abs(delta_angle) < 0.01:
            heading_rad = radians(self.heading)
            self.x += delta_distance * cos(heading_rad)
            self.y += delta_distance * sin(heading_rad)
        else:
            radius = delta_distance / radians(delta_angle)
            heading_rad = radians(self.heading - delta_angle / 2)
            
            dx = radius * (sin(radians(self.heading)) - sin(radians(self.heading - delta_angle)))
            dy = radius * (cos(radians(self.heading - delta_angle)) - cos(radians(self.heading)))
            
            self.x += dx
            self.y += dy
        
        self.prev_distance = current_distance
        self.prev_angle = current_angle
    
    def get_pose(self):
        return (self.x, self.y, self.heading)
    
    def get_distance_to(self, target_x, target_y):
        dx = target_x - self.x
        dy = target_y - self.y
        return sqrt(dx * dx + dy * dy)
    
    def get_angle_to(self, target_x, target_y):
        dx = target_x - self.x
        dy = target_y - self.y
        angle = degrees(atan2(dy, dx))
        return angle % 360
    
    def get_angle_difference(self, target_angle):
        diff = target_angle - self.heading
        while diff > 180:
            diff -= 360
        while diff < -180:
            diff += 360
        return diff`;
    }

    getLocalizationModule() {
        // Simplified version for hub - full version would be too large
        return `# Localization Module (Simplified)
class Particle:
    def __init__(self, x, y, heading, weight=1.0):
        self.x = x
        self.y = y
        self.heading = heading
        self.weight = weight
    
    def move(self, distance, angle, noise_distance=2.0, noise_angle=2.0):
        noisy_distance = distance + random.gauss(0, noise_distance)
        noisy_angle = angle + random.gauss(0, noise_angle)
        
        self.heading += noisy_angle
        self.heading = self.heading % 360
        
        heading_rad = radians(self.heading)
        self.x += noisy_distance * cos(heading_rad)
        self.y += noisy_distance * sin(heading_rad)
    
    def copy(self):
        return Particle(self.x, self.y, self.heading, self.weight)

class Localization:
    def __init__(self, num_particles=50, field_width=1200, field_height=1200):
        self.num_particles = num_particles
        self.field_width = field_width
        self.field_height = field_height
        self.particles = []
        self.initialize_particles()
    
    def initialize_particles(self, x=None, y=None, heading=None, spread=100):
        self.particles = []
        
        if x is not None and y is not None:
            for _ in range(self.num_particles):
                px = x + random.gauss(0, spread)
                py = y + random.gauss(0, spread)
                ph = heading if heading is not None else random.uniform(0, 360)
                if heading is not None:
                    ph += random.gauss(0, 10)
                
                px = max(0, min(self.field_width, px))
                py = max(0, min(self.field_height, py))
                
                self.particles.append(Particle(px, py, ph % 360))
        else:
            for _ in range(self.num_particles):
                px = random.uniform(0, self.field_width)
                py = random.uniform(0, self.field_height)
                ph = random.uniform(0, 360)
                self.particles.append(Particle(px, py, ph))
    
    def update_motion(self, distance, angle):
        for particle in self.particles:
            particle.move(distance, angle, 3.0, 2.0)
            particle.x = max(0, min(self.field_width, particle.x))
            particle.y = max(0, min(self.field_height, particle.y))
    
    def update_sensor(self, sensor_type, sensor_value, sensor_x_offset=0, sensor_y_offset=50):
        # Simplified sensor update
        for particle in self.particles:
            if sensor_type == 'color' and sensor_value == Color.BLACK:
                # Higher weight if near expected line positions
                if particle.x < 100 or particle.x > 1100 or particle.y < 100 or particle.y > 1100:
                    particle.weight *= 5.0
                else:
                    particle.weight *= 0.5
        
        self._normalize_weights()
    
    def _normalize_weights(self):
        total_weight = sum(p.weight for p in self.particles)
        if total_weight > 0:
            for particle in self.particles:
                particle.weight /= total_weight
    
    def resample(self):
        # Simplified resampling
        new_particles = []
        step = 1.0 / self.num_particles
        start = random.uniform(0, step)
        
        cumulative_weights = []
        cumsum = 0
        for particle in self.particles:
            cumsum += particle.weight
            cumulative_weights.append(cumsum)
        
        for i in range(self.num_particles):
            target = start + i * step
            idx = 0
            while idx < len(cumulative_weights) - 1 and cumulative_weights[idx] < target:
                idx += 1
            
            new_particle = self.particles[idx].copy()
            new_particle.x += random.gauss(0, 5)
            new_particle.y += random.gauss(0, 5)
            new_particle.heading += random.gauss(0, 2)
            new_particle.weight = 1.0 / self.num_particles
            
            new_particles.append(new_particle)
        
        self.particles = new_particles
    
    def get_localized_pose(self):
        total_weight = sum(p.weight for p in self.particles)
        if total_weight == 0:
            x = sum(p.x for p in self.particles) / self.num_particles
            y = sum(p.y for p in self.particles) / self.num_particles
            
            sin_sum = sum(sin(radians(p.heading)) for p in self.particles)
            cos_sum = sum(cos(radians(p.heading)) for p in self.particles)
            heading = degrees(atan2(sin_sum, cos_sum)) % 360
        else:
            x = sum(p.x * p.weight for p in self.particles) / total_weight
            y = sum(p.y * p.weight for p in self.particles) / total_weight
            
            sin_sum = sum(sin(radians(p.heading)) * p.weight for p in self.particles) / total_weight
            cos_sum = sum(cos(radians(p.heading)) * p.weight for p in self.particles) / total_weight
            heading = degrees(atan2(sin_sum, cos_sum)) % 360
        
        return (x, y, heading)
    
    def get_confidence(self):
        x_mean, y_mean, _ = self.get_localized_pose()
        
        x_variance = sum((p.x - x_mean)**2 * p.weight for p in self.particles)
        y_variance = sum((p.y - y_mean)**2 * p.weight for p in self.particles)
        
        spread = sqrt(x_variance + y_variance)
        confidence = 1.0 / (1.0 + spread / 100.0)
        
        return confidence`;
    }

    getPathPlannerModule() {
        // Simplified A* implementation
        return `# Path Planner Module (Simplified A*)
class Node:
    def __init__(self, x, y, g=0, h=0, parent=None):
        self.x = x
        self.y = y
        self.g = g
        self.h = h
        self.f = g + h
        self.parent = parent
    
    def __lt__(self, other):
        return self.f < other.f

class PathPlanner:
    def __init__(self, field_width=1200, field_height=1200, grid_size=50):
        self.field_width = field_width
        self.field_height = field_height
        self.grid_size = grid_size
        
        self.grid_width = field_width // grid_size
        self.grid_height = field_height // grid_size
        
        self.grid = [[True for _ in range(self.grid_width)] 
                     for _ in range(self.grid_height)]
        
        self.directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    def world_to_grid(self, world_x, world_y):
        grid_x = int(world_x / self.grid_size)
        grid_y = int(world_y / self.grid_size)
        return (grid_x, grid_y)
    
    def grid_to_world(self, grid_x, grid_y):
        world_x = (grid_x + 0.5) * self.grid_size
        world_y = (grid_y + 0.5) * self.grid_size
        return (world_x, world_y)
    
    def set_obstacle(self, x, y, width, height):
        start_gx, start_gy = self.world_to_grid(x, y)
        end_gx, end_gy = self.world_to_grid(x + width, y + height)
        
        for gy in range(start_gy, min(end_gy + 1, self.grid_height)):
            for gx in range(start_gx, min(end_gx + 1, self.grid_width)):
                if 0 <= gx < self.grid_width and 0 <= gy < self.grid_height:
                    self.grid[gy][gx] = False
    
    def clear_obstacles(self):
        self.grid = [[True for _ in range(self.grid_width)] 
                     for _ in range(self.grid_height)]
    
    def setup_fll_obstacles(self):
        # Example obstacles
        self.set_obstacle(500, 500, 200, 200)
        self.set_obstacle(100, 300, 100, 100)
        self.set_obstacle(1000, 300, 100, 100)
        
        # Field margins
        margin = 50
        self.set_obstacle(0, 0, self.field_width, margin)
        self.set_obstacle(0, self.field_height - margin, self.field_width, margin)
        self.set_obstacle(0, 0, margin, self.field_height)
        self.set_obstacle(self.field_width - margin, 0, margin, self.field_height)
    
    def is_valid(self, x, y):
        return (0 <= x < self.grid_width and 
                0 <= y < self.grid_height and 
                self.grid[y][x])
    
    def heuristic(self, x1, y1, x2, y2):
        return sqrt((x2 - x1)**2 + (y2 - y1)**2)
    
    def plan_path(self, start_pos, goal_pos):
        start = self.world_to_grid(start_pos[0], start_pos[1])
        goal = self.world_to_grid(goal_pos[0], goal_pos[1])
        
        if not self.is_valid(start[0], start[1]) or not self.is_valid(goal[0], goal[1]):
            return None
        
        open_set = []
        closed_set = set()
        
        start_node = Node(start[0], start[1], 0, 
                         self.heuristic(start[0], start[1], goal[0], goal[1]))
        heapq.heappush(open_set, start_node)
        
        while open_set:
            current = heapq.heappop(open_set)
            
            if current.x == goal[0] and current.y == goal[1]:
                path = []
                while current:
                    world_pos = self.grid_to_world(current.x, current.y)
                    path.append(world_pos)
                    current = current.parent
                path.reverse()
                return path
            
            closed_set.add((current.x, current.y))
            
            for dx, dy in self.directions:
                nx, ny = current.x + dx, current.y + dy
                
                if not self.is_valid(nx, ny) or (nx, ny) in closed_set:
                    continue
                
                g_cost = current.g + 1
                h_cost = self.heuristic(nx, ny, goal[0], goal[1])
                
                neighbor = Node(nx, ny, g_cost, h_cost, current)
                
                update = False
                for i, node in enumerate(open_set):
                    if node.x == nx and node.y == ny:
                        if g_cost < node.g:
                            open_set[i] = neighbor
                            heapq.heapify(open_set)
                        update = True
                        break
                
                if not update:
                    heapq.heappush(open_set, neighbor)
        
        return None`;
    }

    getWaypointNavigatorModule() {
        return `# Waypoint Navigator Module
class WaypointNavigator:
    def __init__(self, drive_base, odometry, tolerance_distance=10, tolerance_angle=2):
        self.drive_base = drive_base
        self.odometry = odometry
        self.tolerance_distance = tolerance_distance
        self.tolerance_angle = tolerance_angle
        
        self.turn_speed = 100
        self.drive_speed = 200
    
    def go_to_waypoint(self, target_x, target_y, target_heading=None):
        self.odometry.update()
        current_x, current_y, current_heading = self.odometry.get_pose()
        
        distance = self.odometry.get_distance_to(target_x, target_y)
        target_angle = self.odometry.get_angle_to(target_x, target_y)
        
        if distance <= self.tolerance_distance:
            if target_heading is not None:
                angle_diff = self.odometry.get_angle_difference(target_heading)
                if abs(angle_diff) > self.tolerance_angle:
                    self.drive_base.turn(angle_diff)
            return True
        
        angle_diff = self.odometry.get_angle_difference(target_angle)
        if abs(angle_diff) > self.tolerance_angle:
            self.drive_base.turn(angle_diff)
            wait(100)
        
        self.drive_base.straight(distance)
        wait(100)
        
        if target_heading is not None:
            self.odometry.update()
            _, _, current_heading = self.odometry.get_pose()
            final_angle_diff = self.odometry.get_angle_difference(target_heading)
            if abs(final_angle_diff) > self.tolerance_angle:
                self.drive_base.turn(final_angle_diff)
        
        self.odometry.update()
        
        final_distance = self.odometry.get_distance_to(target_x, target_y)
        return final_distance <= self.tolerance_distance
    
    def follow_waypoints(self, waypoints, stop_on_failure=True):
        waypoints_reached = 0
        
        for i, waypoint in enumerate(waypoints):
            if len(waypoint) >= 3:
                x, y, heading = waypoint[0], waypoint[1], waypoint[2]
            else:
                x, y = waypoint[0], waypoint[1]
                heading = None
            
            success = self.go_to_waypoint(x, y, heading)
            
            if success:
                waypoints_reached += 1
            elif stop_on_failure:
                print(f"Failed to reach waypoint {i+1}: ({x}, {y})")
                break
            
            wait(200)
        
        return waypoints_reached
    
    def convert_path_to_waypoints(self, recorded_commands, sample_interval=500):
        waypoints = []
        
        temp_x, temp_y, temp_heading = 0, 0, 0
        accumulated_time = 0
        
        for command in recorded_commands:
            if command.get('type') == 'drive':
                speed = command.get('speed', 0)
                turn_rate = command.get('turn_rate', 0)
                duration = command.get('duration', 0) * 1000
                
                step_time = 50
                steps = int(duration / step_time)
                
                for _ in range(steps):
                    distance_step = (speed * step_time) / 1000.0
                    angle_step = (turn_rate * step_time) / 1000.0
                    
                    temp_heading += angle_step
                    heading_rad = radians(temp_heading)
                    
                    temp_x += distance_step * cos(heading_rad)
                    temp_y += distance_step * sin(heading_rad)
                    
                    accumulated_time += step_time
                    
                    if accumulated_time >= sample_interval:
                        waypoints.append((temp_x, temp_y, temp_heading % 360))
                        accumulated_time = 0
        
        if len(waypoints) == 0 or (temp_x, temp_y) != (waypoints[-1][0], waypoints[-1][1]):
            waypoints.append((temp_x, temp_y, temp_heading % 360))
        
        return waypoints`;
    }

    getAutonomousRunnerModule() {
        // Simplified version
        return `# Autonomous Runner Module
class AutonomousRunner:
    def __init__(self, hub, left_motor, right_motor, wheel_diameter, axle_track):
        self.hub = hub
        
        self.drive_base = GyroDriveBase(
            left_motor, 
            right_motor, 
            wheel_diameter, 
            axle_track
        )
        
        self.drive_base.settings(
            straight_speed=200,
            straight_acceleration=100,
            turn_rate=90,
            turn_acceleration=180
        )
        
        self.odometry = Odometry(self.drive_base, self.hub.imu)
        self.localization = Localization(num_particles=50)
        self.path_planner = PathPlanner()
        self.navigator = WaypointNavigator(self.drive_base, self.odometry)
        
        self.color_sensor = None
        self.distance_sensor = None
        
        self.is_running = False
        self.update_timer = StopWatch()
        self.localization_timer = StopWatch()
        
        self.odometry_update_interval = 20
        self.localization_update_interval = 200
    
    def attach_color_sensor(self, port, sensor_offset=(0, 50)):
        try:
            self.color_sensor = ColorSensor(port)
            self.color_sensor_offset = sensor_offset
            return True
        except:
            return False
    
    def attach_distance_sensor(self, port):
        try:
            self.distance_sensor = UltrasonicSensor(port)
            return True
        except:
            return False
    
    def initialize_position(self, x=0, y=0, heading=0):
        self.odometry.reset_odometry(x, y, heading)
        self.localization.initialize_particles(x, y, heading, spread=50)
        self.update_timer.reset()
        self.localization_timer.reset()
        self._last_pose = (x, y, heading)
    
    def update_navigation(self):
        if self.update_timer.time() >= self.odometry_update_interval:
            self.odometry.update()
            
            current_x, current_y, current_heading = self.odometry.get_pose()
            
            if hasattr(self, '_last_pose'):
                dx = current_x - self._last_pose[0]
                dy = current_y - self._last_pose[1]
                dheading = current_heading - self._last_pose[2]
                
                distance = sqrt(dx**2 + dy**2)
                if distance > 0.1:
                    self.localization.update_motion(distance, dheading)
            
            self._last_pose = (current_x, current_y, current_heading)
            self.update_timer.reset()
        
        if self.localization_timer.time() >= self.localization_update_interval:
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
            
            if self.localization.get_confidence() < 0.5:
                self.localization.resample()
            
            self.localization_timer.reset()
    
    def navigate_to(self, target_x, target_y, target_heading=None, use_path_planning=True):
        self.is_running = True
        
        try:
            if use_path_planning:
                current_x, current_y, _ = self.get_best_pose()
                
                path = self.path_planner.plan_path(
                    (current_x, current_y),
                    (target_x, target_y)
                )
                
                if path is None:
                    print(f"No path found to ({target_x}, {target_y})")
                    return False
                
                waypoints = []
                for i, (x, y) in enumerate(path):
                    if i == len(path) - 1 and target_heading is not None:
                        waypoints.append((x, y, target_heading))
                    else:
                        waypoints.append((x, y))
                
                for waypoint in waypoints:
                    if len(waypoint) >= 3:
                        x, y, heading = waypoint[0], waypoint[1], waypoint[2]
                    else:
                        x, y = waypoint[0], waypoint[1]
                        heading = None
                    
                    while self.odometry.get_distance_to(x, y) > self.navigator.tolerance_distance:
                        self.update_navigation()
                        
                        if Button.CENTER in self.hub.buttons.pressed():
                            return False
                        
                        self.navigator.go_to_waypoint(x, y, heading)
                        wait(10)
                
                return True
            else:
                while self.odometry.get_distance_to(target_x, target_y) > self.navigator.tolerance_distance:
                    self.update_navigation()
                    
                    if Button.CENTER in self.hub.buttons.pressed():
                        return False
                    
                    self.navigator.go_to_waypoint(target_x, target_y, target_heading)
                    wait(10)
                
                return True
                
        finally:
            self.is_running = False
            self.drive_base.stop()
    
    def follow_recorded_path(self, recorded_commands, use_waypoints=True):
        if use_waypoints:
            waypoints = self.navigator.convert_path_to_waypoints(recorded_commands)
            return self.navigator.follow_waypoints(waypoints)
        else:
            self.is_running = True
            try:
                for command in recorded_commands:
                    if command.get('type') == 'drive':
                        speed = command.get('speed', 0)
                        turn_rate = command.get('turn_rate', 0)
                        duration = command.get('duration', 0) * 1000
                        
                        self.drive_base.drive(speed, turn_rate)
                        
                        elapsed = 0
                        while elapsed < duration:
                            self.update_navigation()
                            
                            if Button.CENTER in self.hub.buttons.pressed():
                                return False
                            
                            wait(10)
                            elapsed += 10
                        
                        self.drive_base.stop()
                
                return True
            finally:
                self.is_running = False
                self.drive_base.stop()
    
    def get_best_pose(self):
        odometry_pose = self.odometry.get_pose()
        localized_pose = self.localization.get_localized_pose()
        confidence = self.localization.get_confidence()
        
        if confidence > 0.8:
            weight = 0.8
        elif confidence > 0.5:
            weight = 0.5
        else:
            weight = 0.2
        
        x = weight * localized_pose[0] + (1 - weight) * odometry_pose[0]
        y = weight * localized_pose[1] + (1 - weight) * odometry_pose[1]
        
        if confidence > 0.6:
            heading = localized_pose[2]
        else:
            heading = odometry_pose[2]
        
        return (x, y, heading)
    
    def setup_fll_mat(self):
        self.path_planner.setup_fll_obstacles()
    
    def add_obstacle(self, x, y, width, height):
        self.path_planner.set_obstacle(x, y, width, height)
    
    def clear_obstacles(self):
        self.path_planner.clear_obstacles()
    
    def calibrate_on_line(self, expected_color=Color.BLACK):
        if not self.color_sensor:
            return False
        
        detected_color = self.color_sensor.color()
        if detected_color == expected_color:
            for _ in range(5):
                self.localization.update_sensor(
                    'color', 
                    detected_color,
                    self.color_sensor_offset[0],
                    self.color_sensor_offset[1]
                )
            
            self.localization.resample()
            return True
        
        return False`;
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutonomousHubCodeGenerator;
} else {
    window.AutonomousHubCodeGenerator = AutonomousHubCodeGenerator;
}