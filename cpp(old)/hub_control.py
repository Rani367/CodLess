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

poll_obj = poll()
poll_obj.register(stdin, 1)

stdout.write("rdy\n")
wait(1)

def execute_command(cmd):
    try:
        cmd_type = cmd.get("type", "")
        
        if cmd_type == "drive" and drive_base:
            speed = cmd.get("speed", 0)
            turn_rate = cmd.get("turn_rate", 0)
            drive_base.drive(speed, turn_rate)
            
        elif cmd_type == "stop" and drive_base:
            drive_base.stop()
            
        elif cmd_type == "arm1" and "arm1" in motors:
            speed = cmd.get("speed", 0)
            if speed == 0:
                motors["arm1"].stop()
            else:
                motors["arm1"].run(speed)
                
        elif cmd_type == "arm2" and "arm2" in motors:
            speed = cmd.get("speed", 0)
            if speed == 0:
                motors["arm2"].stop()
            else:
                motors["arm2"].run(speed)
                
        elif cmd_type == "beep":
            hub.speaker.beep(frequency=1000, duration=100)
            
        elif cmd_type == "light":
            color_map = {
                "red": Color.RED,
                "green": Color.GREEN,
                "blue": Color.BLUE,
                "yellow": Color.YELLOW,
                "white": Color.WHITE,
                "off": None
            }
            color = color_map.get(cmd.get("color", "off"))
            if color:
                hub.light.on(color)
            else:
                hub.light.off()
                
        elif cmd_type == "display":
            icon = cmd.get("icon", [])
            if icon:
                hub.display.icon(icon)
            else:
                hub.display.off()
                
        elif cmd_type == "calibration":
            calibration_type = cmd.get("calibration_type", "")
            
            if calibration_type == "motor_response":
                start_time = time.time()
                if drive_base:
                    drive_base.drive(100, 0)
                    wait(100)
                    drive_base.stop()
                response_time = time.time() - start_time
                result = {
                    "type": "calibration_result",
                    "calibration_type": "motor_response",
                    "measured_value": response_time,
                    "success": True
                }
                stdout.write(ujson.dumps(result) + "\n")
                
            elif calibration_type == "straight_tracking":
                if drive_base:
                    initial_heading = hub.imu.heading()
                    drive_base.straight(300)
                    final_heading = hub.imu.heading()
                    drift = abs(final_heading - initial_heading)
                    result = {
                        "type": "calibration_result",
                        "calibration_type": "straight_tracking",
                        "measured_value": drift,
                        "success": True
                    }
                    stdout.write(ujson.dumps(result) + "\n")
                    
            elif calibration_type == "turn_accuracy":
                if drive_base:
                    initial_heading = hub.imu.heading()
                    target_angle = cmd.get("angle", 90)
                    drive_base.turn(target_angle)
                    actual_angle = hub.imu.heading() - initial_heading
                    accuracy = actual_angle / target_angle if target_angle != 0 else 1.0
                    result = {
                        "type": "calibration_result",
                        "calibration_type": "turn_accuracy", 
                        "measured_value": accuracy,
                        "success": True
                    }
                    stdout.write(ujson.dumps(result) + "\n")
                    
            elif calibration_type == "gyro_reading":
                readings = []
                for _ in range(10):
                    readings.append(hub.imu.angular_velocity()[2])
                    wait(10)
                avg_drift = sum(readings) / len(readings)
                result = {
                    "type": "calibration_result",
                    "calibration_type": "gyro_reading",
                    "measured_value": abs(avg_drift),
                    "success": True
                }
                stdout.write(ujson.dumps(result) + "\n")
                
            elif calibration_type == "motor_balance":
                if drive_base and "arm1" in motors:
                    left_motor.reset_angle(0)
                    right_motor.reset_angle(0)
                    drive_base.straight(200)
                    left_angle = abs(left_motor.angle())
                    right_angle = abs(right_motor.angle())
                    balance = left_angle / right_angle if right_angle != 0 else 1.0
                    result = {
                        "type": "calibration_result",
                        "calibration_type": "motor_balance",
                        "measured_value": balance,
                        "success": True
                    }
                    stdout.write(ujson.dumps(result) + "\n")
                    
        stdout.write("rdy\n")
        
    except Exception as e:
        error_result = {
            "type": "error",
            "message": str(e)
        }
        stdout.write(ujson.dumps(error_result) + "\n")
        stdout.write("rdy\n")

while True:
    if poll_obj.poll(0):
        line = stdin.readline().strip()
        if line:
            try:
                command = ujson.loads(line)
                execute_command(command)
            except:
                stdout.write("rdy\n")
    else:
        wait(10) 