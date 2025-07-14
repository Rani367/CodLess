from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Color
from pybricks.robotics import DriveBase
from pybricks.tools import wait
from usys import stdin, stdout
from uselect import poll
import ujson
import time

hub = PrimeHub()

hub.display.icon([
    [100, 100, 100, 100, 100],
    [100, 0, 100, 0, 100], 
    [100, 100, 100, 100, 100],
    [100, 0, 0, 0, 100],
    [100, 100, 100, 100, 100]
])

motors = {}
drive_base = None

left_motor_port = Port.A
right_motor_port = Port.B
arm1_motor_port = Port.C
arm2_motor_port = Port.D

try:
    left_motor = Motor(left_motor_port)
    right_motor = Motor(right_motor_port)
    drive_base = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)
    
    drive_base.settings(
        straight_speed=500,
        straight_acceleration=250,
        turn_rate=200,
        turn_acceleration=300
    )
    
    hub.light.on(Color.GREEN)
except:
    hub.light.on(Color.YELLOW)

try:
    motors['arm1'] = Motor(arm1_motor_port)
except:
    pass

try:
    motors['arm2'] = Motor(arm2_motor_port)
except:
    pass

keyboard = poll()
keyboard.register(stdin)

hub.display.icon([
    [0, 100, 0, 100, 0],
    [100, 100, 100, 100, 100],
    [0, 100, 100, 100, 0],
    [0, 0, 100, 0, 0],
    [0, 0, 100, 0, 0]
])

while True:
    stdout.buffer.write(b"rdy")
    
    while not keyboard.poll(10):
        wait(1)
    
    try:
        data = stdin.buffer.read()
        if data:
            command_str = data.decode('utf-8')
            command = ujson.loads(command_str)
            
            cmd_type = command.get('type', '')
            
            if cmd_type == 'drive' and drive_base:
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
                
            elif cmd_type == 'config':
                try:
                    axle_track = command.get('axle_track', 112)
                    wheel_diameter = command.get('wheel_diameter', 56)
                    if drive_base:
                        drive_base = DriveBase(left_motor, right_motor, 
                                             wheel_diameter=wheel_diameter, 
                                             axle_track=axle_track)
                        
                        straight_speed = command.get('straight_speed', 500)
                        straight_acceleration = command.get('straight_acceleration', 250)
                        turn_rate = command.get('turn_rate', 200)
                        turn_acceleration = command.get('turn_acceleration', 300)
                        
                        drive_base.settings(
                            straight_speed=straight_speed,
                            straight_acceleration=straight_acceleration,
                            turn_rate=turn_rate,
                            turn_acceleration=turn_acceleration
                        )
                        
                    stdout.buffer.write(b"CONFIG_OK")
                except:
                    stdout.buffer.write(b"CONFIG_ERROR")
                    
            elif cmd_type == 'calibrate':
                try:
                    calibration_type = command.get('calibration_type', '')
                    
                    if calibration_type == 'gyro_reading':
                        # Get gyroscope heading
                        gyro_value = hub.imu.heading()
                        stdout.buffer.write(f"GYRO:{gyro_value}".encode())
                    
                    elif calibration_type == 'motor_position':
                        # Get motor positions
                        if drive_base:
                            left_pos = left_motor.angle()
                            right_pos = right_motor.angle()
                            stdout.buffer.write(f"MOTORS:{left_pos},{right_pos}".encode())
                        else:
                            stdout.buffer.write(b"MOTORS_NOT_AVAILABLE")
                    
                    elif calibration_type == 'motor_balance':
                        # Run motors for balance test
                        if drive_base:
                            # Reset motor positions
                            left_motor.reset_angle(0)
                            right_motor.reset_angle(0)
                            
                            # Run both motors at same speed for 1 second
                            left_motor.run(200)
                            right_motor.run(200)
                            wait(1000)
                            
                            # Stop and read positions
                            left_motor.stop()
                            right_motor.stop()
                            
                            left_pos = left_motor.angle()
                            right_pos = right_motor.angle()
                            
                            stdout.buffer.write(f"BALANCE:{left_pos},{right_pos}".encode())
                        else:
                            stdout.buffer.write(b"BALANCE_NOT_AVAILABLE")
                    
                    elif calibration_type == 'response_time':
                        # Test motor response time
                        if drive_base:
                            # Record timestamp, start motor, stop motor
                            start_time = time.ticks_ms()
                            left_motor.run(200)
                            wait(100)
                            left_motor.stop()
                            end_time = time.ticks_ms()
                            
                            response_time = time.ticks_diff(end_time, start_time)
                            stdout.buffer.write(f"RESPONSE_TIME:{response_time}".encode())
                        else:
                            stdout.buffer.write(b"RESPONSE_TIME_NOT_AVAILABLE")
                    
                    else:
                        stdout.buffer.write(b"UNKNOWN_CALIBRATION_TYPE")
                        
                except Exception as e:
                    stdout.buffer.write(b"CALIBRATION_ERROR")
                    
            else:
                stdout.buffer.write(b"UNKNOWN_CMD")
                
    except Exception as e:
        stdout.buffer.write(b"ERROR")
    
    wait(10) 