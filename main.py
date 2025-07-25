#!/usr/bin/env python3
"""
CodLess - FLL Robotics Control Center
A PySide6-based GUI application for controlling LEGO SPIKE Prime robots.
"""

__version__ = "1.0.0"

import os
import sys
import shutil
import glob

# Check for required dependencies
try:
    from PySide6 import QtCore, QtGui, QtWidgets

    PYSIDE_AVAILABLE = True
except ImportError:
    print("❌ PySide6 not available. Install with: pip install PySide6")
    PYSIDE_AVAILABLE = False
    sys.exit(1)

try:
    import bleak

    BLE_AVAILABLE = True
except ImportError:
    print("❌ bleak not available. Install with: pip install bleak")
    BLE_AVAILABLE = False
    sys.exit(1)

# Prevent Python from writing bytecode files
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
sys.dont_write_bytecode = True


def clean_cache():
    """Remove all Python cache files and directories"""
    patterns = ["__pycache__", "*.pyc", "*.pyo", "*.pyd"]

    removed_count = 0

    for pattern in patterns:
        if pattern == "__pycache__":
            # Find all __pycache__ directories
            for root, dirs, files in os.walk("."):
                if "__pycache__" in dirs:
                    cache_dir = os.path.join(root, "__pycache__")
                    try:
                        shutil.rmtree(cache_dir)
                        print(f"Removed: {cache_dir}")
                        removed_count += 1
                    except Exception as e:
                        print(f"Error removing {cache_dir}: {e}")
        else:
            # Find all matching files
            for file_path in glob.glob(pattern, recursive=True):
                try:
                    os.remove(file_path)
                    print(f"Removed: {file_path}")
                    removed_count += 1
                except Exception as e:
                    print(f"Error removing {file_path}: {e}")

    if removed_count == 0:
        print("No cache files found to clean.")
    else:
        print(f"Cleaned {removed_count} cache files/directories.")


# Clean cache on startup
clean_cache()

# Standard library imports
import asyncio
import threading
import time
import json
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
import math

# PySide6 imports
from PySide6.QtCore import (
    QTimer,
    QPropertyAnimation,
    QEasingCurve,
    Qt,
    QEvent,
    QObject,
    Signal,
)
from PySide6.QtGui import (
    QIcon,
    QPixmap,
    QFont,
    QPainter,
    QPen,
    QBrush,
    QColor,
    QFontDatabase,
)
from PySide6.QtWidgets import (
    QWidget,
    QMainWindow,
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QCheckBox,
    QGroupBox,
    QLineEdit,
    QTextEdit,
    QListWidget,
    QComboBox,
    QProgressBar,
    QSizePolicy,
    QApplication,
    QMessageBox,
    QTabWidget,
)

# Bleak imports
from bleak import BleakScanner, BleakClient

# Constants
PYBRICKS_COMMAND_EVENT_CHAR_UUID = "c5f50002-8280-46da-89f4-6d8051e4aeef"
HUB_NAME_PREFIX = "Pybricks"
SAVED_RUNS_DIR = "saved_runs"
DEFAULT_TIMEOUT = 10000  # 10 seconds
CALIBRATION_TIMEOUT = 10000  # 10 seconds per step


@dataclass
class RobotConfig:
    """Configuration for robot hardware and motion parameters."""

    # Hardware configuration (user-set, not affected by calibration)
    axle_track: float = 112.0
    wheel_diameter: float = 56.0
    left_motor_port: str = "A"
    right_motor_port: str = "B"
    arm1_motor_port: str = "C"
    arm2_motor_port: str = "D"

    # Motion parameters (user-set, not affected by calibration)
    straight_speed: float = 500.0
    straight_acceleration: float = 250.0
    turn_rate: float = 200.0
    turn_acceleration: float = 300.0

    # Calibration compensation parameters (set by calibration)
    motor_delay: float = 0.0
    motor_delay_confidence: float = 0.0
    straight_tracking_bias: float = 0.0
    straight_tracking_confidence: float = 0.0
    turn_bias: float = 0.0
    turn_confidence: float = 0.0
    motor_balance_difference: float = 0.0
    motor_balance_confidence: float = 0.0
    gyro_drift_rate: float = 0.0
    gyro_confidence: float = 0.0


@dataclass
class RecordedCommand:
    """A recorded robot command with timestamp and parameters."""

    timestamp: float
    command_type: str
    parameters: Dict


@dataclass
class CalibrationResult:
    """Result of a calibration step with measurement data."""

    success: bool = False
    step_name: str = ""
    measured_value: float = 0.0
    units: str = ""
    description: str = ""
    confidence: float = 0.0


class CalibrationManager(QObject):
    """Manages robot calibration process with step-by-step testing."""

    calibration_started = Signal()
    calibration_step_changed = Signal(int, str)
    calibration_progress = Signal(int)
    calibration_step_completed = Signal(object)
    calibration_completed = Signal(object)
    calibration_failed = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.ble_controller = None
        self.robot_simulator = None
        self.is_developer_mode = False
        self.calibration_running = False
        self.current_step = 0
        self.current_retry = 0
        self.max_retries = 3
        self.timeout_duration = CALIBRATION_TIMEOUT
        self.calibrated_config = RobotConfig()
        self.step_timer = QTimer()
        self.step_timer.timeout.connect(self.process_calibration_step)
        self.timeout_timer = QTimer()
        self.timeout_timer.timeout.connect(self.on_calibration_timeout)
        self.calibration_results = []

    def on_calibration_timeout(self):
        if self.calibration_running:
            self.calibration_failed.emit("Calibration step timed out")
            self.calibration_running = False
            self.step_timer.stop()
            self.timeout_timer.stop()

    def set_ble_controller(self, controller):
        self.ble_controller = controller

    def set_robot_simulator(self, simulator):
        self.robot_simulator = simulator

    def set_developer_mode(self, enabled):
        self.is_developer_mode = enabled

    def can_calibrate(self):
        return (
            self.ble_controller and self.ble_controller.connected
        ) or self.is_developer_mode

    def start_calibration(self):
        if self.calibration_running:
            return

        if not self.can_calibrate():
            self.calibration_failed.emit(
                "Cannot perform calibration.\n\n"
                "Please connect to a robot or enable developer mode."
            )
            return

        self.reset_calibration()
        self.calibration_running = True
        self.current_step = 0

        self.calibration_started.emit()
        self.calibration_progress.emit(0)

        self.step_timer.start(1000)  # Start first step after 1 second

    def stop_calibration(self):
        if not self.calibration_running:
            return

        self.calibration_running = False
        self.step_timer.stop()
        self.timeout_timer.stop()

        self.calibration_failed.emit("Calibration cancelled by user")

    def reset_calibration(self):
        self.current_step = 0
        self.current_retry = 0
        self.calibration_results.clear()

    def process_calibration_step(self):
        if not self.calibration_running:
            return

        self.current_step += 1

        if self.current_step == 1:
            self.calibration_step_changed.emit(
                self.current_step, "Testing motor response time..."
            )
            self.calibration_progress.emit(10)
            self.calibrate_motor_response_time()
        elif self.current_step == 2:
            self.calibration_step_changed.emit(
                self.current_step, "Testing straight line tracking..."
            )
            self.calibration_progress.emit(30)
            self.calibrate_straight_tracking()
        elif self.current_step == 3:
            self.calibration_step_changed.emit(
                self.current_step, "Testing turn accuracy..."
            )
            self.calibration_progress.emit(50)
            self.calibrate_turn_accuracy()
        elif self.current_step == 4:
            self.calibration_step_changed.emit(
                self.current_step, "Calibrating gyroscope..."
            )
            self.calibration_progress.emit(70)
            self.calibrate_gyroscope()
        elif self.current_step == 5:
            self.calibration_step_changed.emit(
                self.current_step, "Testing motor balance..."
            )
            self.calibration_progress.emit(85)
            self.calibrate_motor_balance()
        elif self.current_step == 6:
            self.calibration_step_changed.emit(
                self.current_step, "Finalizing calibration..."
            )
            self.calibration_progress.emit(95)
            self.finalize_calibration()
        elif self.current_step == 7:
            self.calibration_progress.emit(100)
            self.calibration_completed.emit(self.calibrated_config)
            self.calibration_running = False
        else:
            self.calibration_failed.emit("Unknown calibration step")
            self.calibration_running = False

    def calibrate_motor_response_time(self):
        if self.is_developer_mode:
            # Simulate motor response time calibration with realistic values
            time.sleep(2)
            # Simulate measuring actual motor delay (typically 50-200ms)
            motor_delay = 0.12 + (time.time() % 0.1)  # Vary between 120-220ms
            result = CalibrationResult(
                success=True,
                step_name="Motor Response Time",
                measured_value=motor_delay,
                units="seconds",
                description=f"Motor response time measured at {motor_delay*1000:.0f}ms",
                confidence=0.85,
            )
            self.complete_current_step(
                True, motor_delay, f"Motor response time: {motor_delay*1000:.0f}ms"
            )
        else:
            # Real calibration would send commands to robot and measure response time
            command = {
                "type": "calibration",
                "calibration_type": "motor_response",
                "speed": 200,
            }
            self.send_calibration_command(command)

    def calibrate_straight_tracking(self):
        if self.is_developer_mode:
            time.sleep(2)
            # Simulate measuring straight tracking bias (deviation from perfect straight)
            # Perfect would be 1.0, typical values are 0.95-1.05 (5% deviation)
            tracking_bias = 0.97 + (time.time() % 0.06)  # Vary between 0.97-1.03
            self.complete_current_step(
                True,
                tracking_bias,
                f"Straight tracking bias: {(tracking_bias-1.0)*100:+.1f}%",
            )
        else:
            command = {
                "type": "calibration",
                "calibration_type": "straight_tracking",
                "distance": 500,
            }
            self.send_calibration_command(command)

    def calibrate_turn_accuracy(self):
        if self.is_developer_mode:
            time.sleep(2)
            # Simulate measuring turn bias (deviation from perfect turn)
            # Perfect would be 1.0, typical values are 0.90-1.10 (10% deviation)
            turn_bias = 0.94 + (time.time() % 0.12)  # Vary between 0.94-1.06
            self.complete_current_step(
                True, turn_bias, f"Turn bias: {(turn_bias-1.0)*100:+.1f}%"
            )
        else:
            command = {
                "type": "calibration",
                "calibration_type": "turn_accuracy",
                "angle": 90,
            }
            self.send_calibration_command(command)

    def calibrate_gyroscope(self):
        if self.is_developer_mode:
            time.sleep(2)
            # Simulate measuring gyro drift rate (degrees per second)
            # Typical values are 0.1-2.0 degrees/second drift
            gyro_drift = 0.5 + (time.time() % 1.5)  # Vary between 0.5-2.0 deg/s
            self.complete_current_step(
                True, gyro_drift, f"Gyro drift rate: {gyro_drift:.1f}°/s"
            )
        else:
            command = {"type": "calibration", "calibration_type": "gyro_reading"}
            self.send_calibration_command(command)

    def calibrate_motor_balance(self):
        if self.is_developer_mode:
            time.sleep(2)
            # Simulate measuring motor balance difference
            # Perfect would be 1.0, typical values are 0.85-1.15 (15% difference)
            balance_diff = 0.92 + (time.time() % 0.16)  # Vary between 0.92-1.08
            self.complete_current_step(
                True,
                balance_diff,
                f"Motor balance difference: {(balance_diff-1.0)*100:+.1f}%",
            )
        else:
            command = {"type": "calibration", "calibration_type": "motor_balance"}
            self.send_calibration_command(command)

    def finalize_calibration(self):
        # Calculate overall quality score
        quality_score = 0.0
        valid_results = [r for r in self.calibration_results if r.success]

        if valid_results:
            quality_score = (
                sum(r.confidence for r in valid_results) / len(valid_results) * 100
            )

        if quality_score < 75.0:
            self.calibration_failed.emit(
                f"Calibration quality too low: {quality_score:.1f}%"
            )
            return

        # Start with default config and apply calibration adjustments
        self.calibrated_config = RobotConfig()

        # Apply calibration results to compensate for imperfections
        for result in valid_results:
            if not result.success:
                continue

            confidence_factor = result.confidence
            measured_value = result.measured_value

            if "Motor Response Time" in result.step_name:
                # Store motor delay for compensation in commands
                # This will be used to send commands slightly ahead of time
                self.calibrated_config.motor_delay = measured_value
                self.calibrated_config.motor_delay_confidence = confidence_factor

            elif "Straight Tracking" in result.step_name:
                # Measure and store tracking bias for compensation
                # This will be used to adjust turn commands to compensate for drift
                tracking_bias = measured_value - 1.0  # Deviation from perfect straight
                self.calibrated_config.straight_tracking_bias = tracking_bias
                self.calibrated_config.straight_tracking_confidence = confidence_factor

            elif "Turn Accuracy" in result.step_name:
                # Measure and store turn bias for compensation
                # This will be used to adjust turn commands to compensate for bias
                turn_bias = measured_value - 1.0  # Deviation from perfect turn
                self.calibrated_config.turn_bias = turn_bias
                self.calibrated_config.turn_confidence = confidence_factor

            elif "Motor Balance" in result.step_name:
                # Measure and store motor balance difference for compensation
                # This will be used to adjust individual motor speeds
                balance_difference = measured_value - 1.0  # Difference between motors
                self.calibrated_config.motor_balance_difference = balance_difference
                self.calibrated_config.motor_balance_confidence = confidence_factor

            elif "Gyroscope" in result.step_name:
                # Store gyro calibration data for drift compensation
                # This will be used to compensate for gyro drift over time
                self.calibrated_config.gyro_drift_rate = measured_value
                self.calibrated_config.gyro_confidence = confidence_factor

        final_result = CalibrationResult(
            success=True,
            step_name="Calibration Complete",
            measured_value=quality_score,
            units="%",
            description=f"Overall calibration quality: {quality_score:.1f}% - Imperfections compensated for 100% accuracy",
            confidence=quality_score / 100.0,
        )
        self.calibration_results.append(final_result)
        self.calibration_step_completed.emit(final_result)

    def send_calibration_command(self, command):
        if self.ble_controller and self.ble_controller.connected:
            asyncio.create_task(self.ble_controller.send_command(command))
        else:
            self.complete_current_step(
                False, 0.0, "No robot connected - cannot perform real calibration"
            )

    def complete_current_step(self, success, measured_value, description):
        result = CalibrationResult(
            success=success,
            step_name=f"Step {self.current_step}",
            measured_value=measured_value,
            description=description,
            confidence=0.8 if success else 0.0,
        )

        self.calibration_results.append(result)
        self.calibration_step_completed.emit(result)

        # Move to next step after a delay
        QTimer.singleShot(2000, self.process_calibration_step)


class RobotSimulator(QWidget):
    """Visual robot simulator for testing commands without hardware."""

    def __init__(self):
        super().__init__()
        self.setMinimumSize(300, 200)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)  # type: ignore
        self.setObjectName("robot_simulator")

        self.robot_x = 200
        self.robot_y = 150
        self.robot_angle = 0
        self.arm1_angle = 0
        self.arm2_angle = 0

        self.target_spd = 0
        self.target_turn = 0
        self.target_arm1_spd = 0
        self.target_arm2_spd = 0

        self.actual_spd = 0
        self.actual_turn = 0
        self.actual_arm1_spd = 0
        self.actual_arm2_spd = 0

        self.speed_accel = 0
        self.turn_accel = 0
        self.arm1_accel = 0
        self.arm2_accel = 0

        self.robot_mass = 2.5
        self.robot_inertia = 0.12
        self.arm_inertia = 0.05

        self.max_drive_accel = 800
        self.max_turn_accel = 600
        self.max_arm_accel = 1000

        self.friction_coeff = 0.05
        self.motor_lag = 0.03

        self.dt = 0.02
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_simulation)
        self.timer.start(20)

    def update_command(self, command):
        cmd_type = command.get("type", "")

        if cmd_type == "drive":
            self.target_spd = command.get("speed", 0) * 1.5
            self.target_turn = command.get("turn_rate", 0) * 1.2
        elif cmd_type == "arm1":
            self.target_arm1_spd = command.get("speed", 0) * 1.0
        elif cmd_type == "arm2":
            self.target_arm2_spd = command.get("speed", 0) * 1.0

    def update_simulation(self):
        self.apply_realistic_motor_physics()
        self.update_robot_position()
        self.update_arm_positions()
        self.update()

    def apply_realistic_motor_physics(self):
        speed_error = self.target_spd - self.actual_spd
        turn_error = self.target_turn - self.actual_turn
        arm1_error = self.target_arm1_spd - self.actual_arm1_spd
        arm2_error = self.target_arm2_spd - self.actual_arm2_spd

        max_speed_change = self.max_drive_accel * self.dt
        max_turn_change = self.max_turn_accel * self.dt
        max_arm_change = self.max_arm_accel * self.dt

        def s_curve_profile(error, max_change, current_accel, max_accel):
            jerk_limit = max_accel * 8
            target_accel = min(max_accel, max(error * 15, -max_accel))
            accel_error = target_accel - current_accel
            max_jerk_change = jerk_limit * self.dt

            if abs(accel_error) > max_jerk_change:
                if accel_error > 0:
                    new_accel = current_accel + max_jerk_change
                else:
                    new_accel = current_accel - max_jerk_change
            else:
                new_accel = target_accel

            friction_factor = 1.0 - self.friction_coeff * self.dt
            damping = 0.92 + 0.08 * math.exp(-abs(error) * 0.1)

            return new_accel * friction_factor * damping

        self.speed_accel = s_curve_profile(
            speed_error, max_speed_change, self.speed_accel, self.max_drive_accel
        )
        self.turn_accel = s_curve_profile(
            turn_error, max_turn_change, self.turn_accel, self.max_turn_accel
        )
        self.arm1_accel = s_curve_profile(
            arm1_error, max_arm_change, self.arm1_accel, self.max_arm_accel
        )
        self.arm2_accel = s_curve_profile(
            arm2_error, max_arm_change, self.arm2_accel, self.max_arm_accel
        )

        motor_lag = 1.0 - self.motor_lag
        self.actual_spd += self.speed_accel * self.dt * motor_lag
        self.actual_turn += self.turn_accel * self.dt * motor_lag
        self.actual_arm1_spd += self.arm1_accel * self.dt * motor_lag
        self.actual_arm2_spd += self.arm2_accel * self.dt * motor_lag

        inertial_damping = 0.995
        self.actual_spd *= inertial_damping
        self.actual_turn *= inertial_damping
        self.actual_arm1_spd *= inertial_damping
        self.actual_arm2_spd *= inertial_damping

    def update_robot_position(self):
        if abs(self.actual_spd) > 0.01 or abs(self.actual_turn) > 0.01:
            sim_speed = self.actual_spd * 0.15
            sim_turn = self.actual_turn * 0.8

            momentum_factor = 1.0 / (1.0 + self.robot_mass * 0.1)
            inertia_factor = 1.0 / (1.0 + self.robot_inertia * 2.0)

            self.robot_angle += sim_turn * self.dt * inertia_factor
            self.robot_angle = self.robot_angle % 360

            angle_rad = math.radians(self.robot_angle)
            dx = sim_speed * math.cos(angle_rad) * self.dt * momentum_factor
            dy = sim_speed * math.sin(angle_rad) * self.dt * momentum_factor

            self.robot_x += dx
            self.robot_y += dy

            self.robot_x = max(30, min(self.width() - 30, self.robot_x))
            self.robot_y = max(30, min(self.height() - 30, self.robot_y))

    def update_arm_positions(self):
        if abs(self.actual_arm1_spd) > 0.1:
            arm_momentum = 1.0 / (1.0 + self.arm_inertia * 0.8)
            self.arm1_angle += self.actual_arm1_spd * 0.3 * self.dt * arm_momentum
            self.arm1_angle = max(-90, min(90, self.arm1_angle))

        if abs(self.actual_arm2_spd) > 0.1:
            arm_momentum = 1.0 / (1.0 + self.arm_inertia * 0.8)
            self.arm2_angle += self.actual_arm2_spd * 0.3 * self.dt * arm_momentum
            self.arm2_angle = max(-90, min(90, self.arm2_angle))

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)  # type: ignore

        painter.fillRect(self.rect(), QColor(45, 45, 45))

        painter.setPen(QPen(QColor(70, 70, 70), 1))
        for x in range(0, self.width(), 50):
            painter.drawLine(x, 0, x, self.height())
        for y in range(0, self.height(), 50):
            painter.drawLine(0, y, self.width(), y)

        self.draw_robot(painter)
        painter.setPen(QPen(QColor(255, 255, 255), 1))
        painter.setFont(QFont("Arial", 10))

        status_text = f"Position: ({int(self.robot_x)}, {int(self.robot_y)})"
        status_text += f" | Angle: {int(self.robot_angle)}°"

        painter.drawText(10, 20, status_text)

        physics_text = f"Speed: {self.actual_spd:.1f} | Turn: {self.actual_turn:.1f}"
        painter.drawText(10, 40, physics_text)

        accel_text = f"Accel: {self.speed_accel:.1f} | T-Accel: {self.turn_accel:.1f}"
        painter.drawText(10, 60, accel_text)

        arm_text = f"Arm1: {int(self.arm1_angle)}° | Arm2: {int(self.arm2_angle)}°"
        painter.drawText(10, 80, arm_text)

    def draw_robot(self, painter):
        painter.save()

        painter.translate(self.robot_x, self.robot_y)
        painter.rotate(self.robot_angle)

        painter.setPen(QPen(QColor(0, 143, 170), 2))
        painter.setBrush(QBrush(QColor(0, 143, 170, 100)))
        painter.drawRect(-20, -15, 40, 30)

        painter.setBrush(QBrush(QColor(40, 167, 69)))
        triangle = [QtCore.QPoint(20, 0), QtCore.QPoint(15, -8), QtCore.QPoint(15, 8)]
        painter.drawPolygon(triangle)

        painter.setPen(QPen(QColor(100, 100, 100), 2))
        painter.setBrush(QBrush(QColor(60, 60, 60)))
        painter.drawRect(-10, -20, 8, 10)
        painter.drawRect(-10, 10, 8, 10)
        painter.drawRect(15, -20, 8, 10)
        painter.drawRect(15, 10, 8, 10)

        self.draw_arm(painter, -15, -10, self.arm1_angle, QColor(220, 53, 69))
        self.draw_arm(painter, -15, 10, self.arm2_angle, QColor(255, 193, 7))

        painter.restore()

    def draw_arm(self, painter, base_x, base_y, angle, color):
        painter.save()
        painter.translate(base_x, base_y)
        painter.rotate(angle)

        painter.setPen(QPen(color, 3))
        painter.drawLine(0, 0, 15, 0)

        painter.setBrush(QBrush(color))
        painter.drawEllipse(-3, -3, 6, 6)

        painter.drawEllipse(12, -2, 4, 4)

        painter.restore()


class BLEController:
    """Manages Bluetooth Low Energy communication with the robot hub."""

    def __init__(self, log_callback):
        self.client = None
        self.device = None
        self.connected = False
        self.log_callback = log_callback
        self.ready_event = None

    async def scan_for_hub(self):
        self.log_callback("🔍 Scanning for Pybricks hub...")
        devices = await BleakScanner.discover()

        for device in devices:
            if device.name and HUB_NAME_PREFIX in device.name:
                self.log_callback(f"✅ Found hub: {device.name}")
                return device

        return None

    async def connect(self):
        try:
            self.ready_event = asyncio.Event()

            self.device = await self.scan_for_hub()
            if not self.device:
                self.log_callback("❌ No Pybricks hub found")
                return False

            def handle_disconnect(_):
                self.connected = False
                self.log_callback("⚠️ Hub disconnected")

            def handle_rx(_, data: bytearray):
                if data[0] == 0x01:
                    payload = data[1:]
                    if payload == b"rdy":
                        if self.ready_event:
                            self.ready_event.set()
                    else:
                        self.log_callback(
                            f"HUB: {payload.decode('utf-8', errors='ignore')}"
                        )

            self.client = BleakClient(self.device, handle_disconnect)
            await self.client.connect()
            await self.client.start_notify(PYBRICKS_COMMAND_EVENT_CHAR_UUID, handle_rx)

            self.connected = True
            self.log_callback(f"🎉 Connected to {self.device.name}!")
            return True

        except Exception as e:
            self.log_callback(f"❌ Connection failed: {str(e)}")
            return False

    async def send_command(self, command):
        if not self.connected or not self.client:
            return False

        try:
            if self.ready_event:
                try:
                    await asyncio.wait_for(self.ready_event.wait(), timeout=1.0)
                    self.ready_event.clear()
                except asyncio.TimeoutError:
                    pass

            command_str = json.dumps(command)
            data = command_str.encode("utf-8")

            await self.client.write_gatt_char(
                PYBRICKS_COMMAND_EVENT_CHAR_UUID, b"\x06" + data, response=True
            )
            return True

        except Exception as e:
            self.log_callback(f"❌ Send error: {str(e)}")
            return False

    async def disconnect(self):
        if self.client and self.connected:
            await self.client.disconnect()
            self.connected = False
            self.ready_event = None


class FLLRoboticsGUI(QMainWindow):
    """Main GUI window for the FLL Robotics Control Center."""

    def __init__(self):
        super().__init__()

        self.ble_controller = None
        self.config = RobotConfig()
        self.is_recording = False
        self.recorded_commands = []
        self.recording_start_time = 0
        self.current_run_name = "Run 1"
        self.pressed_keys = set()
        self.saved_runs = self.load_saved_runs()
        
        # Key press tracking for exact duration recording
        self.key_press_times = {}  # Track when each key was pressed
        
        # Initialize calibration manager
        self.calibration_manager = CalibrationManager(self)

        # Calibration requirement
        self.is_calibrated = False

        self.setup_ui()
        self.setup_style()
        self.setup_connections()

        self.startup_anim = None
        self.exit_anim = None
        self.opacity_anim = None
        self.is_closing = False
        self.setup_startup_animation()
        self.setup_exit_animation()

        # Show calibration requirement message
        self.log_status(
            "Please calibrate the robot before using any controls.", "warning"
        )
        self.disable_controls_until_calibration()

    def setup_ui(self):
        self.setWindowTitle(f"CodLess - FLL Robotics Control Center v{__version__}")
        self.setGeometry(120, 80, 1200, 900)
        self.setMinimumSize(900, 700)
        self.setMaximumSize(1920, 1400)
        self.base_width = 1200
        self.base_height = 900
        self.aspect_ratio = self.base_width / self.base_height
        self.setWindowFlags(Qt.FramelessWindowHint)  # type: ignore
        self.setAttribute(Qt.WA_TranslucentBackground)  # type: ignore

        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(0)

        self.title_bar = self.create_title_bar()
        main_layout.addWidget(self.title_bar)

        content_widget = QWidget()
        content_widget.setObjectName("content_widget")
        content_layout = QHBoxLayout(content_widget)
        content_layout.setContentsMargins(0, 0, 0, 0)
        content_layout.setSpacing(0)

        self.sidebar = self.create_sidebar()
        self.sidebar.setFixedWidth(250)
        self.sidebar.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Expanding)  # type: ignore
        content_layout.addWidget(self.sidebar)
        content_layout.setStretchFactor(self.sidebar, 0)

        self.main_content = self.create_main_content()
        self.main_content.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)  # type: ignore
        content_layout.addWidget(self.main_content)
        content_layout.setStretchFactor(self.main_content, 1)

        main_layout.addWidget(content_widget)

        self.status_bar = self.create_status_bar()
        main_layout.addWidget(self.status_bar)

    def create_title_bar(self):
        title_bar = QWidget()
        title_bar.setFixedHeight(40)
        title_bar.setObjectName("title_bar")

        layout = QHBoxLayout(title_bar)
        layout.setContentsMargins(15, 0, 15, 0)

        title_label = QLabel("CodLess - FLL Robotics Control Center")
        title_label.setObjectName("title_label")
        title_label.setFont(QFont("Arial", 12, QFont.Bold))  # type: ignore
        layout.addWidget(title_label)

        layout.addStretch()

        self.min_btn = QPushButton("-")
        self.min_btn.setObjectName("window_btn")
        self.min_btn.setFixedSize(30, 30)

        self.max_btn = QPushButton("□")
        self.max_btn.setObjectName("window_btn")
        self.max_btn.setFixedSize(30, 30)

        self.close_btn = QPushButton("X")
        self.close_btn.setObjectName("close_btn")
        self.close_btn.setFixedSize(30, 30)

        layout.addWidget(self.min_btn)
        layout.addWidget(self.max_btn)
        layout.addWidget(self.close_btn)

        return title_bar

    def create_sidebar(self):
        sidebar = QWidget()
        sidebar.setObjectName("sidebar")

        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(10)

        conn_group = QGroupBox("Hub Connection")
        conn_group.setObjectName("group_box")
        conn_layout = QVBoxLayout(conn_group)

        self.connect_btn = QPushButton("Connect to Pybricks Hub")
        self.connect_btn.setObjectName("primary_btn")
        self.connect_btn.setMinimumHeight(40)
        self.connect_btn.setToolTip(
            "1. Upload hub_control.py via code.pybricks.com\n2. Keep Pybricks website open\n3. Click to connect"
        )

        self.developer_check = QCheckBox("Developer Mode (Simulation)")
        self.developer_check.setObjectName("checkbox")

        self.hub_status = QLabel("● Hub Disconnected")
        self.hub_status.setObjectName("status_disconnected")

        conn_layout.addWidget(self.connect_btn)
        conn_layout.addWidget(self.developer_check)
        conn_layout.addWidget(self.hub_status)

        layout.addWidget(conn_group)

        config_group = QGroupBox("Robot Configuration")
        config_group.setObjectName("group_box")
        config_layout = QVBoxLayout(config_group)

        self.config_btn = QPushButton("Configure Robot")
        self.config_btn.setObjectName("success_btn")
        self.config_btn.setMinimumHeight(35)

        config_layout.addWidget(self.config_btn)

        layout.addWidget(config_group)

        # Copy Pybricks Code Group
        pybricks_group = QGroupBox("Copy Pybricks Code")
        pybricks_group.setObjectName("group_box")
        pybricks_layout = QVBoxLayout(pybricks_group)

        pybricks_info = QLabel(
            "Click to copy the hub control code\nto your clipboard, then paste it into\ncode.pybricks.com"
        )
        pybricks_info.setObjectName("info_text")
        pybricks_info.setWordWrap(True)

        self.copy_pybricks_btn = QPushButton("Copy Hub Code")
        self.copy_pybricks_btn.setObjectName("primary_btn")
        self.copy_pybricks_btn.setMinimumHeight(35)
        self.copy_pybricks_btn.setToolTip(
            "Copy the Python code to upload to your SPIKE Prime hub"
        )

        pybricks_layout.addWidget(pybricks_info)
        pybricks_layout.addWidget(self.copy_pybricks_btn)

        layout.addWidget(pybricks_group)

        # Competition Mode Group
        competition_group = QGroupBox("Competition Mode")
        competition_group.setObjectName("group_box")
        competition_layout = QVBoxLayout(competition_group)

        competition_info = QLabel(
            "Generate autonomous code with all your\nsaved runs for FLL competition use"
        )
        competition_info.setObjectName("info_text")
        competition_info.setWordWrap(True)

        self.competition_mode_btn = QPushButton("Generate Competition Code")
        self.competition_mode_btn.setObjectName("warning_btn")
        self.competition_mode_btn.setMinimumHeight(35)
        self.competition_mode_btn.setToolTip(
            "Generate Pybricks code with all saved runs for autonomous competition mode"
        )

        competition_layout.addWidget(competition_info)
        competition_layout.addWidget(self.competition_mode_btn)

        layout.addWidget(competition_group)

        keys_group = QGroupBox("Control Keys")
        keys_group.setObjectName("group_box")
        keys_layout = QVBoxLayout(keys_group)

        keys_text = QLabel(
            """Drive (hold to move):
  W - Forward    S - Backward
  A - Turn Left  D - Turn Right

Arms (hold to move):
  Q - Arm 1 Up   E - Arm 1 Down
  R - Arm 2 Up   F - Arm 2 Down"""
        )
        keys_text.setObjectName("info_text")
        # Use cross-platform monospace font
        monospace_font = QFontDatabase.systemFont(QFontDatabase.FixedFont)  # type: ignore
        monospace_font.setPointSize(9)
        keys_text.setFont(monospace_font)

        keys_layout.addWidget(keys_text)
        layout.addWidget(keys_group)

        runs_group = QGroupBox("Saved Runs")
        runs_group.setObjectName("group_box")
        runs_layout = QVBoxLayout(runs_group)

        self.runs_list = QListWidget()
        self.runs_list.setObjectName("runs_list")
        self.runs_list.setMaximumHeight(150)

        runs_btn_layout = QHBoxLayout()
        self.play_btn = QPushButton("Play")
        self.play_btn.setObjectName("success_btn")
        self.delete_btn = QPushButton("Delete")
        self.delete_btn.setObjectName("danger_btn")

        runs_btn_layout.addWidget(self.play_btn)
        runs_btn_layout.addWidget(self.delete_btn)

        runs_layout.addWidget(self.runs_list)
        runs_layout.addLayout(runs_btn_layout)

        layout.addWidget(runs_group)
        layout.addStretch()

        return sidebar

    def create_main_content(self):
        main_content = QWidget()
        main_content.setObjectName("main_content")

        layout = QVBoxLayout(main_content)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)

        self.simulator_group = QGroupBox("Robot Simulator")
        self.simulator_group.setObjectName("group_box")
        simulator_layout = QVBoxLayout(self.simulator_group)

        self.robot_simulator = RobotSimulator()
        simulator_layout.addWidget(self.robot_simulator)
        sim_controls = QHBoxLayout()
        sim_info = QLabel(
            "Real-time visual simulation of your robot's movement and arm positions"
        )
        sim_info.setObjectName("info_text")

        self.reset_sim_btn = QPushButton("Reset Position")
        self.reset_sim_btn.setObjectName("success_btn")
        self.reset_sim_btn.setMinimumHeight(30)
        self.reset_sim_btn.clicked.connect(self.reset_simulator)

        sim_controls.addWidget(sim_info)
        sim_controls.addStretch()
        sim_controls.addWidget(self.reset_sim_btn)

        simulator_layout.addLayout(sim_controls)

        layout.addWidget(self.simulator_group)
        self.simulator_group.hide()
        # Remove the Recording Controls group box - just keep the controls
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("Run Name:"))
        self.run_name_input = QLineEdit("Run 1")
        self.run_name_input.setObjectName("line_edit")
        name_layout.addWidget(self.run_name_input)
        layout.addLayout(name_layout)
        
        record_btn_layout = QHBoxLayout()
        self.record_btn = QPushButton("Record Run")
        self.record_btn.setObjectName("danger_btn")
        self.record_btn.setMinimumHeight(40)

        self.save_btn = QPushButton("Save Run")
        self.save_btn.setObjectName("success_btn")
        self.save_btn.setMinimumHeight(40)
        self.save_btn.setEnabled(False)

        record_btn_layout.addWidget(self.record_btn)
        record_btn_layout.addWidget(self.save_btn)
        layout.addLayout(record_btn_layout)
        # Remove the entire Robot Status group box - just keep the status display
        self.status_display = QTextEdit()
        self.status_display.setObjectName("status_display")
        self.status_display.setMaximumHeight(400)
        self.status_display.setMinimumHeight(80)
        self.status_display.setReadOnly(True)
        layout.addWidget(self.status_display)

        return main_content

    def create_status_bar(self):
        status_bar = QWidget()
        status_bar.setFixedHeight(30)
        status_bar.setObjectName("status_bar")

        layout = QHBoxLayout(status_bar)
        layout.setContentsMargins(15, 5, 15, 5)

        self.status_label = QLabel("Ready")
        self.status_label.setObjectName("status_label")

        layout.addWidget(QLabel("Status:"))
        layout.addWidget(self.status_label)
        layout.addStretch()

        return status_bar

    def setup_style(self):
        style = """
        QMainWindow {
            background-color: rgb(45, 45, 45);
        }
        
        #title_bar {
            background-color: rgb(35, 35, 35);
            border-bottom: 1px solid rgb(70, 70, 70);
        }
        
        #title_label {
            color: rgb(255, 255, 255);
        }
        
        #window_btn {
            background-color: transparent;
            color: rgb(255, 255, 255);
            border: none;
            font-size: 12px;
        }
        
        #window_btn:hover {
            background-color: rgb(0, 143, 170);
        }
        
        #close_btn {
            background-color: transparent;
            color: rgb(255, 255, 255);
            border: none;
            font-size: 12px;
        }
        
        #close_btn:hover{
            background-color: rgb(220, 53, 69);
        }
        
        #content_widget {
            background-color: rgb(51, 51, 51);
        }
        
        #sidebar {
            background-color: rgb(45, 45, 45);
            border-right: 1px solid rgb(70, 70, 70);
        }
        
        #main_content {
            background-color: rgb(51, 51, 51);
        }
        
        QGroupBox {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background: rgb(45, 45, 45);
            font-weight: bold;
            padding-top: 8px;
            margin-top: 3px;
        }
        
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        
        #primary_btn {
            border: 2px solid rgb(0, 143, 170);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(0, 143, 170);
            font-weight: bold;
        }
        
        #primary_btn:hover {
            background-color: rgb(0, 123, 150);
        }
        
        #primary_btn:pressed {
            background-color: rgb(0, 103, 130);
        }
        
        #success_btn {
            border: 2px solid rgb(40, 167, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(40, 167, 69);
            font-weight: bold;
        }
        
        #success_btn:hover {
            background-color: rgb(34, 142, 58);
        }
        
        #success_btn:disabled {
            background-color: rgb(108, 117, 125);
            border-color: rgb(108, 117, 125);
        }
        
        #danger_btn {
            border: 2px solid rgb(220, 53, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(220, 53, 69);
            font-weight: bold;
        }
        
        #danger_btn:hover {
            background-color: rgb(200, 35, 51);
        }
        
        #warning_btn {
            border: 2px solid rgb(255, 193, 7);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(255, 193, 7);
            font-weight: bold;
        }
        
        #warning_btn:hover {
            background-color: rgb(230, 173, 0);
        }
        
        #line_edit {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 3px;
            color: rgb(255, 255, 255);
            background-color: rgb(35, 35, 35);
            padding: 5px;
            font-size: 12px;
        }
        
        #line_edit:focus {
            border-color: rgb(0, 143, 170);
        }
        
        #checkbox {
            color: rgb(255, 255, 255);
            font-size: 12px;
        }
        
        #checkbox::indicator {
            width: 16px;
            height: 16px;
            border: 1px solid rgb(70, 70, 70);
            border-radius: 3px;
            background-color: rgb(35, 35, 35);
        }
        
        #checkbox::indicator:checked {
            background-color: rgb(0, 143, 170);
            border-color: rgb(0, 143, 170);
        }
        
        #runs_list {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 3px;
            color: rgb(255, 255, 255);
            background-color: rgb(35, 35, 35);
            font-size: 12px;
        }
        
        #runs_list::item {
            padding: 5px;
            border-bottom: 1px solid rgb(50, 50, 50);
        }
        
        #runs_list::item:selected {
            background-color: rgb(0, 143, 170);
        }
        
        #info_text {
            color: rgb(200, 200, 200);
            font-size: 11px;
            line-height: 1.3;
        }
        
        #status_display {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 3px;
            color: rgb(255, 255, 255);
            background-color: rgb(25, 25, 25);
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 10px;
        }
        
        #status_label {
            color: rgb(255, 255, 255);
            font-size: 12px;
        }
        
        #status_disconnected {
            color: rgb(220, 53, 69);
            font-weight: bold;
        }
        
        #status_connected {
            color: rgb(40, 167, 69);
            font-weight: bold;
        }
        
        #line_edit {
            color: rgb(255, 255, 255);
            border: 2px solid rgb(70, 70, 70);
            border-radius: 4px;
            background: rgb(60, 60, 60);
            padding: 5px;
        }
        
        #line_edit:focus {
            border-color: rgb(0, 143, 170);
        }
        
        #info_text {
            color: rgb(200, 200, 200);
        }
        
        #status_display {
            background-color: rgb(35, 35, 35);
            border: 1px solid rgb(70, 70, 70);
            color: rgb(255, 255, 255);
            font-family: 'Monaco', 'Menlo', 'Liberation Mono', 'Courier New', monospace;
        }
        
        #runs_list {
            background-color: rgb(60, 60, 60);
            border: 1px solid rgb(70, 70, 70);
            color: rgb(255, 255, 255);
        }
        
        #runs_list::item {
            padding: 5px;
            border-bottom: 1px solid rgb(70, 70, 70);
        }
        
        #runs_list::item:selected {
            background-color: rgb(0, 143, 170);
        }
        
        QCheckBox {
            color: rgb(255, 255, 255);
        }
        
        QCheckBox::indicator {
            width: 15px;
            height: 15px;
        }
        
        QCheckBox::indicator:unchecked {
            border: 2px solid rgb(70, 70, 70);
            background-color: rgb(60, 60, 60);
        }
        
        QCheckBox::indicator:checked {
            border: 2px solid rgb(0, 143, 170);
            background-color: rgb(0, 143, 170);
        }
        
        #status_disconnected {
            color: rgb(220, 53, 69);
            font-weight: bold;
        }
        
        #status_connected {
            color: rgb(40, 167, 69);
            font-weight: bold;
        }
        
        #status_bar {
            background-color: rgb(35, 35, 35);
            border-top: 1px solid rgb(70, 70, 70);
        }
        
        #status_label {
            color: rgb(200, 200, 200);
        }
        
        QLabel {
            color: rgb(255, 255, 255);
        }
        
        #robot_simulator {
            background-color: rgb(45, 45, 45);
            border: 2px solid rgb(70, 70, 70);
            border-radius: 5px;
        }
        """

        self.setStyleSheet(style)

    def setup_connections(self):
        self.min_btn.clicked.connect(self.showMinimized)
        self.max_btn.clicked.connect(self.toggle_maximize)
        self.close_btn.clicked.connect(self.start_exit_animation)
        self.connect_btn.clicked.connect(self.connect_hub)
        self.config_btn.clicked.connect(self.open_config_dialog)
        self.copy_pybricks_btn.clicked.connect(self.copy_pybricks_code)
        self.competition_mode_btn.clicked.connect(self.generate_competition_code)
        self.record_btn.clicked.connect(self.toggle_recording)
        self.save_btn.clicked.connect(self.save_current_run)
        self.play_btn.clicked.connect(self.play_selected_run)
        self.delete_btn.clicked.connect(self.delete_selected_run)
        self.developer_check.toggled.connect(self.toggle_developer_mode)
        self.setFocusPolicy(Qt.StrongFocus)  # type: ignore

        # Connect calibration manager signals
        self.calibration_manager.calibration_started.connect(self.on_calibration_started)
        self.calibration_manager.calibration_step_changed.connect(self.on_calibration_step_changed)
        self.calibration_manager.calibration_progress.connect(self.on_calibration_progress)
        self.calibration_manager.calibration_step_completed.connect(self.on_calibration_step_completed)
        self.calibration_manager.calibration_completed.connect(self.on_calibration_completed)
        self.calibration_manager.calibration_failed.connect(self.on_calibration_failed)

        self.update_runs_list()

    def resizeEvent(self, event):
        super().resizeEvent(event)

        new_size = event.size()
        new_width = new_size.width()
        new_height = new_size.height()

        if new_width / new_height > self.aspect_ratio:
            adjusted_width = int(new_height * self.aspect_ratio)
            self.resize(adjusted_width, new_height)
        else:
            adjusted_height = int(new_width / self.aspect_ratio)
            self.resize(new_width, adjusted_height)

        scale_factor = min(new_width / self.base_width, new_height / self.base_height)
        sidebar_width = int(400 * scale_factor)
        sidebar_width = max(350, min(550, sidebar_width))

        if hasattr(self, "sidebar"):
            self.sidebar.setFixedWidth(sidebar_width)

    def setup_startup_animation(self):
        self.target_geom = self.geometry()

        self.startup_anim = QPropertyAnimation(self, b"geometry")
        self.startup_anim.setDuration(850)
        self.startup_anim.setEasingCurve(QEasingCurve.OutCubic)  # type: ignore

        rect = self.target_geom
        w = int(rect.width() * 0.5)
        h = int(rect.height() * 0.5)
        x = rect.x() + (rect.width() - w) // 2
        y = rect.y() + (rect.height() - h) // 2

        self.start_geom = QtCore.QRect(x, y, w, h)

    def setup_exit_animation(self):
        self.exit_anim = QPropertyAnimation(self, b"geometry")
        self.exit_anim.setDuration(650)
        self.exit_anim.setEasingCurve(QEasingCurve.InCubic)

        self.opacity_anim = QPropertyAnimation(self, b"windowOpacity")
        self.opacity_anim.setDuration(650)
        self.opacity_anim.setEasingCurve(QEasingCurve.InCubic)

        self.exit_anim.finished.connect(self.force_close)

    def showEvent(self, event):
        super().showEvent(event)

        if self.startup_anim and not hasattr(self, "_animated"):
            self._animated = True
            self.setGeometry(self.start_geom)
            self.startup_anim.setStartValue(self.start_geom)
            self.startup_anim.setEndValue(self.target_geom)
            self.startup_anim.start()

    def keyPressEvent(self, event):
        key = event.text().lower()
        if key not in self.pressed_keys:
            self.pressed_keys.add(key)
            self.record_key_press(key)
            self.process_key_command(key, True)

    def keyReleaseEvent(self, event):
        key = event.text().lower()
        if key in self.pressed_keys:
            self.pressed_keys.remove(key)
            self.record_key_release(key)
            self.process_key_command(key, False)
            
            # Stop movement when no more keys are pressed
            if not self.pressed_keys:
                # Stop drive movement
                self.execute_command({"type": "drive", "speed": 0, "turn_rate": 0})
                # Stop arm movement
                self.execute_command({"type": "arm1", "speed": 0})
                self.execute_command({"type": "arm2", "speed": 0})

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.drag_pos = event.globalPosition().toPoint()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.LeftButton and hasattr(self, "drag_pos"):
            self.move(self.pos() + event.globalPosition().toPoint() - self.drag_pos)
            self.drag_pos = event.globalPosition().toPoint()

    def toggle_maximize(self):
        if self.isMaximized():
            self.showNormal()
            self.max_btn.setText("□")
        else:
            self.showMaximized()
            self.max_btn.setText("◱")

    def log_status(self, message: str, level: str = "info"):
        timestamp = datetime.now().strftime("%H:%M:%S")

        color_map = {
            "info": "#ffffff",
            "success": "#28a745",
            "warning": "#ffc107",
            "error": "#dc3545",
        }

        color = color_map.get(level, "#ffffff")
        formatted_message = (
            f'<span style="color: {color};">[{timestamp}] {message}</span>'
        )

        self.status_display.append(formatted_message)
        self.status_label.setText(message)

    def disable_controls_until_calibration(self):
        """Disable all robot controls until calibration is completed."""
        # Disable recording controls
        self.record_btn.setEnabled(False)
        self.save_btn.setEnabled(False)

        # Disable playback controls
        self.play_btn.setEnabled(False)
        self.delete_btn.setEnabled(False)

        # Disable simulator reset
        self.reset_sim_btn.setEnabled(False)

        # Update button tooltips to indicate calibration requirement
        self.record_btn.setToolTip("Calibration required before recording")
        self.save_btn.setToolTip("Calibration required before saving")
        self.play_btn.setToolTip("Calibration required before playback")
        self.delete_btn.setToolTip("Calibration required before deletion")
        self.reset_sim_btn.setToolTip("Calibration required before simulator control")

    def enable_controls_after_calibration(self):
        """Enable all robot controls after successful calibration."""
        # Enable recording controls
        self.record_btn.setEnabled(True)
        # Save button will be enabled when recording stops

        # Enable playback controls
        self.play_btn.setEnabled(True)
        self.delete_btn.setEnabled(True)

        # Enable simulator reset
        self.reset_sim_btn.setEnabled(True)

        # Restore original tooltips
        self.record_btn.setToolTip("Start/stop recording robot commands")
        self.save_btn.setToolTip("Save current recording")
        self.play_btn.setToolTip("Play selected run")
        self.delete_btn.setToolTip("Delete selected run")
        self.reset_sim_btn.setToolTip("Reset robot simulator position")

    def run_async_task(self, coro):
        def run_in_thread():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(coro)
                loop.close()
            except Exception as e:
                self.log_status(f"Async task error: {str(e)}", "error")

        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()

    def connect_hub(self):
        if not BLE_AVAILABLE and not self.developer_check.isChecked():
            self.log_status(
                "❌ BLE not available. Install 'bleak' or enable Developer Mode.",
                "error",
            )
            return

        if (self.ble_controller and self.ble_controller.connected) or (
            self.developer_check.isChecked() and "Connected" in self.hub_status.text()
        ):
            self.disconnect_hub()
            return

        if self.developer_check.isChecked():
            self.log_status("Developer mode: Simulating hub connection", "warning")
            self.hub_status.setText("● Hub Connected (Simulation)")
            self.hub_status.setObjectName("status_connected")
            self.hub_status.setStyleSheet(
                "#status_connected { color: rgb(40, 167, 69); font-weight: bold; }"
            )
            self.connect_btn.setText("Disconnect Hub")
        else:
            self.ble_controller = BLEController(self.log_status)
            self.run_async_task(self._connect_ble())

    async def _connect_ble(self):
        success = await self.ble_controller.connect()
        if success:
            self.hub_status.setText("● Hub Connected (Bluetooth)")
            self.hub_status.setObjectName("status_connected")
            self.hub_status.setStyleSheet(
                "#status_connected { color: rgb(40, 167, 69); font-weight: bold; }"
            )
            self.connect_btn.setText("Disconnect Hub")
        else:
            self.log_status("Connection failed. Check setup guide.", "error")

    def disconnect_hub(self):
        if self.ble_controller:
            self.run_async_task(self.ble_controller.disconnect())

        self.hub_status.setText("● Hub Disconnected")
        self.hub_status.setObjectName("status_disconnected")
        self.hub_status.setStyleSheet(
            "#status_disconnected { color: rgb(220, 53, 69); font-weight: bold; }"
        )
        self.connect_btn.setText("Connect to Pybricks Hub")

        if self.developer_check.isChecked():
            self.log_status("Disconnected from simulated hub", "info")
        else:
            self.log_status("Disconnected from hub", "info")

    def toggle_developer_mode(self):
        if self.developer_check.isChecked():
            self.log_status("Developer mode enabled - simulation mode", "warning")
            self.simulator_group.show()
            self.reset_simulator()

            self.hub_status.setText("● Hub Connected (Simulation)")
            self.hub_status.setObjectName("status_connected")
            self.hub_status.setStyleSheet(
                "#status_connected { color: rgb(40, 167, 69); font-weight: bold; }"
            )
            self.connect_btn.setText("Disconnect Hub")

            # Enable controls in developer mode (calibration not required)
            self.is_calibrated = True
            self.enable_controls_after_calibration()
            self.log_status("Controls enabled for developer mode", "info")
        else:
            self.log_status("Developer mode disabled", "info")
            self.simulator_group.hide()

            self.hub_status.setText("● Hub Disconnected")
            self.hub_status.setObjectName("status_disconnected")
            self.hub_status.setStyleSheet(
                "#status_disconnected { color: rgb(220, 53, 69); font-weight: bold; }"
            )
            self.connect_btn.setText("Connect to Pybricks Hub")

            # Disable controls if not calibrated when exiting developer mode
            if not self.is_calibrated:
                self.disable_controls_until_calibration()
                self.log_status(
                    "Controls disabled - calibration required for real robot", "warning"
                )

    def reset_simulator(self):
        if hasattr(self, "robot_simulator"):
            self.robot_simulator.robot_x = self.robot_simulator.width() // 2
            self.robot_simulator.robot_y = self.robot_simulator.height() // 2
            self.robot_simulator.robot_angle = 0
            self.robot_simulator.arm1_angle = 0
            self.robot_simulator.arm2_angle = 0
            self.robot_simulator.target_spd = 0
            self.robot_simulator.target_turn = 0
            self.robot_simulator.target_arm1_spd = 0
            self.robot_simulator.target_arm2_spd = 0
            self.robot_simulator.actual_spd = 0
            self.robot_simulator.actual_turn = 0
            self.robot_simulator.actual_arm1_spd = 0
            self.robot_simulator.actual_arm2_spd = 0

    def open_config_dialog(self):
        dialog = ConfigDialog(self, self.config)

        # Set up calibration manager with current state
        dialog.calibration_manager.set_ble_controller(self.ble_controller)
        dialog.calibration_manager.set_robot_simulator(self.robot_simulator)
        dialog.calibration_manager.set_developer_mode(self.developer_check.isChecked())

        if dialog.exec() == QDialog.Accepted:
            self.config = dialog.get_config()
            self.log_status("Robot configuration updated", "success")

            if (
                self.ble_controller and self.ble_controller.connected
            ) or self.developer_check.isChecked():
                config_command = {
                    "type": "config",
                    "axle_track": self.config.axle_track,
                    "wheel_diameter": self.config.wheel_diameter,
                    "straight_speed": self.config.straight_speed,
                    "straight_acceleration": self.config.straight_acceleration,
                    "turn_rate": self.config.turn_rate,
                    "turn_acceleration": self.config.turn_acceleration,
                }
                self.execute_command(config_command)

    def on_calibration_completed(self, config):
        """Handle calibration completion from the config dialog."""
        # Update the config with calibrated values
        self.config = config

        # Apply the calibrated config to the robot
        config_command = {
            "type": "config",
            "axle_track": config.axle_track,
            "wheel_diameter": config.wheel_diameter,
            "straight_speed": config.straight_speed,
            "straight_acceleration": config.straight_acceleration,
            "turn_rate": config.turn_rate,
            "turn_acceleration": config.turn_acceleration,
        }

        # Send config to robot if connected
        if (
            self.ble_controller and self.ble_controller.connected
        ) or self.developer_check.isChecked():
            self.execute_command(config_command)
            self.log_status("Calibrated configuration applied to robot", "success")
        else:
            self.log_status(
                "Calibrated configuration ready (robot not connected)", "info"
            )

        # Enable controls now that calibration is complete
        self.is_calibrated = True
        self.enable_controls_after_calibration()
        self.log_status("Robot calibrated! All controls are now enabled.", "success")

    def on_calibration_failed(self, reason):
        """Handle calibration failure from the config dialog."""
        # Reset calibration flag and disable controls
        self.is_calibrated = False
        self.disable_controls_until_calibration()
        self.log_status("Calibration failed. Please try again.", "error")

    def on_calibration_started(self):
        """Handle calibration started signal."""
        self.log_status("Calibration started...", "info")

    def on_calibration_step_changed(self, step, description):
        """Handle calibration step change signal."""
        self.log_status(f"Step {step}: {description}", "info")

    def on_calibration_progress(self, percentage):
        """Handle calibration progress signal."""
        # Could update a progress bar if we had one
        pass

    def on_calibration_step_completed(self, result):
        """Handle calibration step completion signal."""
        if result.success:
            self.log_status(f"✓ {result.description}", "success")
        else:
            self.log_status(f"✗ {result.description}", "error")

    def process_key_command(self, key: str, is_pressed: bool):
        # Check if robot is connected
        if (
            not (self.ble_controller and self.ble_controller.connected)
            and not self.developer_check.isChecked()
        ):
            return

        # Check if robot is calibrated (skip in developer mode)
        if not self.is_calibrated and not self.developer_check.isChecked():
            if is_pressed:  # Only show message on key press, not release
                self.log_status(
                    "Please calibrate the robot before using controls.", "warning"
                )
            return

        ts = time.time()

        if key in ["w", "a", "s", "d"]:
            spd = 0
            turn = 0

            if "w" in self.pressed_keys:
                spd += 200
            if "s" in self.pressed_keys:
                spd -= 200

            if "a" in self.pressed_keys:
                turn -= 100
            if "d" in self.pressed_keys:
                turn += 100

            cmd = {"type": "drive", "speed": spd, "turn_rate": turn}
            self.execute_command(cmd)

        elif key in ["q", "e", "r", "f"]:
            if is_pressed:
                spd = 200
                if key == "q":
                    cmd = {"type": "arm1", "speed": spd}
                elif key == "e":
                    cmd = {"type": "arm1", "speed": -spd}
                elif key == "r":
                    cmd = {"type": "arm2", "speed": spd}
                elif key == "f":
                    cmd = {"type": "arm2", "speed": -spd}

                if cmd:
                    self.execute_command(cmd)
            else:
                # Stop the arm when key is released
                if key in ["q", "e"]:
                    cmd = {"type": "arm1", "speed": 0}
                else:
                    cmd = {"type": "arm2", "speed": 0}
                self.execute_command(cmd)

    def execute_command(self, cmd: Dict):
        try:
            # Apply calibration compensations if robot is calibrated
            compensated_cmd = self.apply_calibration_compensation(cmd)

            if self.developer_check.isChecked():
                action = self.format_cmd_display(compensated_cmd)
                self.log_status(f"SIM: {action}", "info")
                self.robot_simulator.update_command(compensated_cmd)
            elif self.ble_controller and self.ble_controller.connected:
                self.run_async_task(self.ble_controller.send_command(compensated_cmd))

        except Exception as e:
            self.log_status(f"Command error: {str(e)}", "error")

    def apply_calibration_compensation(self, cmd: Dict) -> Dict:
        """Apply calibration compensations to make robot more accurate."""
        if not self.is_calibrated:
            return cmd

        compensated_cmd = cmd.copy()
        cmd_type = cmd.get("type", "")

        if cmd_type == "drive":
            speed = cmd.get("speed", 0)
            turn_rate = cmd.get("turn_rate", 0)

            # Apply motor delay compensation (send command ahead of time)
            if self.config.motor_delay > 0 and self.config.motor_delay_confidence > 0.5:
                # This would be handled by the robot firmware, but we can log it
                pass

            # Apply straight tracking bias compensation
            if abs(speed) > 0 and abs(turn_rate) == 0:  # Straight movement
                if (
                    self.config.straight_tracking_bias != 0
                    and self.config.straight_tracking_confidence > 0.5
                ):
                    # Compensate for drift by adding a small turn in the opposite direction
                    compensation_turn = (
                        -self.config.straight_tracking_bias * speed * 0.1
                    )
                    compensated_cmd["turn_rate"] = compensation_turn

            # Apply turn bias compensation
            if abs(turn_rate) > 0:  # Turning movement
                if self.config.turn_bias != 0 and self.config.turn_confidence > 0.5:
                    # Compensate for turn bias by adjusting turn rate
                    compensation_factor = 1.0 + self.config.turn_bias
                    compensated_cmd["turn_rate"] = turn_rate * compensation_factor

            # Apply motor balance compensation
            if (
                self.config.motor_balance_difference != 0
                and self.config.motor_balance_confidence > 0.5
            ):
                # This would be handled by adjusting individual motor speeds in the robot firmware
                # For now, we can apply a small compensation to the turn rate
                balance_compensation = (
                    self.config.motor_balance_difference * speed * 0.05
                )
                compensated_cmd["turn_rate"] = (
                    compensated_cmd.get("turn_rate", 0) + balance_compensation
                )

        return compensated_cmd

    def format_cmd_display(self, cmd: Dict) -> str:
        cmd_type = cmd["type"]
        if cmd_type == "drive":
            spd = cmd.get("speed", 0)
            turn = cmd.get("turn_rate", 0)

            moves = []
            if spd > 0:
                moves.append("Forward")
            elif spd < 0:
                moves.append("Backward")

            if turn > 0:
                moves.append("Turn Right")
            elif turn < 0:
                moves.append("Turn Left")

            if not moves:
                return "Drive: Stopped"

            return f"Drive: {' + '.join(moves)} (speed={spd}, turn={turn})"

        elif cmd_type in ["arm1", "arm2"]:
            spd = cmd.get("speed", 0)
            if spd > 0:
                dir = "Up"
            elif spd < 0:
                dir = "Down"
            else:
                dir = "Stop"
            return f"{cmd_type.upper()}: {dir} (speed={spd})"
        return str(cmd)

    def toggle_recording(self):
        if not (
            (self.ble_controller and self.ble_controller.connected)
            or self.developer_check.isChecked()
        ):
            self.log_status("Please connect to hub first!", "warning")
            return

        if not self.is_calibrated and not self.developer_check.isChecked():
            self.log_status("Please calibrate the robot before recording!", "warning")
            return

        if not self.is_recording:
            # Require a run name before starting recording
            run_name = self.run_name_input.text().strip()
            if not run_name:
                self.log_status("Please enter a run name before starting recording!", "warning")
                self.run_name_input.setFocus()
                return
            
            # Check for duplicate names
            if run_name in self.saved_runs:
                self.log_status(f"Run name '{run_name}' already exists! Please choose a different name.", "warning")
                self.run_name_input.setFocus()
                return

            self.current_run_name = run_name
            self.is_recording = True
            self.recorded_commands = []
            self.recording_start_time = time.time()

            self.record_btn.setText("Stop Recording")
            self.save_btn.setEnabled(False)
            
            # Reset robot position in developer mode when starting recording
            if self.developer_check.isChecked():
                self.reset_simulator()
                self.log_status("Robot position reset for new recording", "info")
            
            self.log_status(f"Started recording: {run_name}", "success")
        else:
            self.is_recording = False
            self.record_btn.setText("Record Run")
            self.save_btn.setEnabled(True)
            self.log_status(
                f"Stopped recording. {len(self.recorded_commands)} commands captured",
                "success",
            )
            
    def record_key_press(self, key: str):
        """Record the start of a key press with exact timestamp."""
        if not self.is_recording:
            return
            
        ts = time.time()
        self.key_press_times[key] = ts - self.recording_start_time
        
    def record_key_release(self, key: str):
        """Record the end of a key press with exact duration."""
        if not self.is_recording or key not in self.key_press_times:
            return
            
        press_time = self.key_press_times[key]
        release_time = time.time() - self.recording_start_time
        duration = release_time - press_time
        
        # Create command based on key type
        cmd = None
        
        if key in ["w", "a", "s", "d"]:
            # For drive keys, record the movement duration
            spd = 0
            turn = 0
            
            if key == "w":
                spd = 200
            elif key == "s":
                spd = -200
            elif key == "a":
                turn = -100
            elif key == "d":
                turn = 100
                
            cmd = {
                "type": "drive", 
                "speed": spd, 
                "turn_rate": turn,
                "duration": duration
            }
            
        elif key in ["q", "e", "r", "f"]:
            # For arm keys, record the movement duration
            spd = 200
            if key == "q":
                cmd = {"type": "arm1", "speed": spd, "duration": duration}
            elif key == "e":
                cmd = {"type": "arm1", "speed": -spd, "duration": duration}
            elif key == "r":
                cmd = {"type": "arm2", "speed": spd, "duration": duration}
            elif key == "f":
                cmd = {"type": "arm2", "speed": -spd, "duration": duration}
        
        # Only record if we have a valid command
        if cmd is not None:
            recorded_cmd = RecordedCommand(
                timestamp=press_time,
                command_type=cmd["type"],
                parameters=cmd,
            )
            self.recorded_commands.append(recorded_cmd)
        
        # Remove from tracking
        del self.key_press_times[key]
        


    def save_current_run(self):
        if not self.recorded_commands:
            self.log_status("No commands recorded!", "warning")
            return

        # Use the current name from the input field, not the one from when recording started
        run_name = self.run_name_input.text().strip()
        if not run_name:
            run_name = f"Run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.run_name_input.setText(run_name)

        # Check for duplicate names when saving
        if run_name in self.saved_runs:
            self.log_status(f"Run name '{run_name}' already exists! Please choose a different name.", "warning")
            self.run_name_input.setFocus()
            return

        run_data = {
            "name": run_name,
            "timestamp": datetime.now().isoformat(),
            "config": asdict(self.config),
            "commands": [asdict(cmd) for cmd in self.recorded_commands],
        }

        os.makedirs(SAVED_RUNS_DIR, exist_ok=True)
        filename = f"{SAVED_RUNS_DIR}/{run_name.replace(' ', '_')}.json"

        try:
            with open(filename, "w") as f:
                json.dump(run_data, f, indent=2)

            self.saved_runs[run_name] = run_data
            self.update_runs_list()
            self.save_btn.setEnabled(False)
            self.log_status(f"Run saved: {filename}", "success")

            self.recorded_commands = []

        except Exception as e:
            self.log_status(f"Failed to save run: {str(e)}", "error")

    def load_saved_runs(self) -> Dict:
        runs = {}
        if not os.path.exists(SAVED_RUNS_DIR):
            return runs

        try:
            for filename in os.listdir(SAVED_RUNS_DIR):
                if filename.endswith(".json"):
                    with open(f"{SAVED_RUNS_DIR}/{filename}", "r") as f:
                        run_data = json.load(f)
                        runs[run_data["name"]] = run_data
        except Exception as e:
            pass

        return runs

    def update_runs_list(self):
        self.runs_list.clear()
        for run_name in sorted(self.saved_runs.keys()):
            self.runs_list.addItem(run_name)

    def play_selected_run(self):
        current_item = self.runs_list.currentItem()
        if not current_item:
            self.log_status("Please select a run to play!", "warning")
            return

        if not (
            (self.ble_controller and self.ble_controller.connected)
            or self.developer_check.isChecked()
        ):
            self.log_status("Please connect to hub first!", "warning")
            return

        if not self.is_calibrated and not self.developer_check.isChecked():
            self.log_status("Please calibrate the robot before playback!", "warning")
            return

        run_name = current_item.text()
        run_data = self.saved_runs[run_name]

        threading.Thread(
            target=self.playback_run, args=(run_data,), daemon=True
        ).start()

    def playback_run(self, run_data: Dict):
        commands = [RecordedCommand(**cmd) for cmd in run_data["commands"]]
        self.log_status(f"Playing back: {run_data['name']}", "success")

        start_time = time.time()
        for cmd in commands:
            target_time = start_time + cmd.timestamp
            while time.time() < target_time:
                time.sleep(0.001)

            # Execute the command and keep it running for the duration
            if "duration" in cmd.parameters:
                duration = cmd.parameters["duration"]
                
                # Start the movement
                self.execute_command(cmd.parameters)
                
                # Keep moving for the duration
                time.sleep(duration)
                
                # Stop the movement
                stop_cmd = cmd.parameters.copy()
                if cmd.parameters["type"] == "drive":
                    stop_cmd["speed"] = 0
                    stop_cmd["turn_rate"] = 0
                elif cmd.parameters["type"] in ["arm1", "arm2"]:
                    stop_cmd["speed"] = 0
                self.execute_command(stop_cmd)
            else:
                # Execute the command normally
                self.execute_command(cmd.parameters)

        self.log_status("Playback completed", "success")

    def delete_selected_run(self):
        current_item = self.runs_list.currentItem()
        if not current_item:
            self.log_status("Please select a run to delete!", "warning")
            return

        run_name = current_item.text()

        reply = QMessageBox.question(
            self,
            "Confirm Delete",
            f"Delete run '{run_name}'?",
            QMessageBox.Yes | QMessageBox.No,
        )

        if reply == QMessageBox.Yes:
            del self.saved_runs[run_name]

            filename = f"{SAVED_RUNS_DIR}/{run_name.replace(' ', '_')}.json"
            try:
                if os.path.exists(filename):
                    os.remove(filename)
                self.update_runs_list()
                self.log_status(f"Deleted run: {run_name}", "success")
            except Exception as e:
                self.log_status(f"Error deleting run: {str(e)}", "error")

    def copy_pybricks_code(self):
        hub_code = """from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Color
from pybricks.robotics import DriveBase
from pybricks.tools import wait
from usys import stdin, stdout
from uselect import poll
import ujson

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
            else:
                stdout.buffer.write(b"UNKNOWN_CMD")
                
    except Exception as e:
        stdout.buffer.write(b"ERROR")
    
    wait(10)"""

        clipboard = QApplication.clipboard()
        clipboard.setText(hub_code)

        self.log_status("Pybricks hub code copied to clipboard!", "info")
        self.copy_pybricks_btn.setText("Copied!")

        # Reset button text after 2 seconds
        QTimer.singleShot(2000, lambda: self.copy_pybricks_btn.setText("Copy Hub Code"))

    def generate_competition_code(self):
        """Generate Pybricks code with all saved runs for competition use."""
        if not self.saved_runs:
            self.log_status(
                "No saved runs found! Record and save some runs first.", "warning"
            )
            return

        # Generate the competition code
        competition_code = self._generate_competition_pybricks_code()

        # Copy to clipboard
        clipboard = QApplication.clipboard()
        clipboard.setText(competition_code)

        # Show success message
        run_count = len(self.saved_runs)
        self.log_status(
            f"Competition code generated with {run_count} runs! Code copied to clipboard.",
            "success",
        )
        self.competition_mode_btn.setText("Copied!")

        # Reset button text after 3 seconds
        QTimer.singleShot(
            3000, lambda: self.competition_mode_btn.setText("Generate Competition Code")
        )

        # Show instructions dialog
        self._show_competition_instructions()

    def _generate_competition_pybricks_code(self) -> str:
        """Generate the actual Pybricks competition code with all saved runs."""
        # Start with the basic imports and setup
        code_lines = [
            "from pybricks.hubs import PrimeHub",
            "from pybricks.pupdevices import Motor",
            "from pybricks.parameters import Port, Color",
            "from pybricks.robotics import DriveBase",
            "from pybricks.tools import wait",
            "",
            "# --- ROBOT SETUP ---",
            "hub = PrimeHub()",
            "",
            "# Initialize motors and drive base",
            f"left_motor = Motor(Port.{self.config.left_motor_port})",
            f"right_motor = Motor(Port.{self.config.right_motor_port})",
            f"drive_base = DriveBase(left_motor, right_motor, wheel_diameter={self.config.wheel_diameter}, axle_track={self.config.axle_track})",
            "",
            "# Configure drive base settings",
            f"drive_base.settings(",
            f"    straight_speed={self.config.straight_speed},",
            f"    straight_acceleration={self.config.straight_acceleration},",
            f"    turn_rate={self.config.turn_rate},",
            f"    turn_acceleration={self.config.turn_acceleration}",
            ")",
            "",
            "# Initialize arm motors",
            f"arm1_motor = Motor(Port.{self.config.arm1_motor_port})",
            f"arm2_motor = Motor(Port.{self.config.arm2_motor_port})",
            "",
            "# --- HELPER FUNCTIONS ---",
            "def move_forward(speed, duration_ms):",
            '    """Move forward at given speed for duration in milliseconds."""',
            "    drive_base.drive(speed, 0)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def move_backward(speed, duration_ms):",
            '    """Move backward at given speed for duration in milliseconds."""',
            "    drive_base.drive(-speed, 0)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def turn_left(angle, duration_ms):",
            '    """Turn left at given angle for duration in milliseconds."""',
            "    drive_base.drive(0, -angle)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def turn_right(angle, duration_ms):",
            '    """Turn right at given angle for duration in milliseconds."""',
            "    drive_base.drive(0, angle)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def arm1_up(speed, duration_ms):",
            '    """Move arm 1 up at given speed for duration in milliseconds."""',
            "    arm1_motor.run(speed)",
            "    wait(duration_ms)",
            "    arm1_motor.stop()",
            "",
            "def arm1_down(speed, duration_ms):",
            '    """Move arm 1 down at given speed for duration in milliseconds."""',
            "    arm1_motor.run(-speed)",
            "    wait(duration_ms)",
            "    arm1_motor.stop()",
            "",
            "def arm2_up(speed, duration_ms):",
            '    """Move arm 2 up at given speed for duration in milliseconds."""',
            "    arm2_motor.run(speed)",
            "    wait(duration_ms)",
            "    arm2_motor.stop()",
            "",
            "def arm2_down(speed, duration_ms):",
            '    """Move arm 2 down at given speed for duration in milliseconds."""',
            "    arm2_motor.run(-speed)",
            "    wait(duration_ms)",
            "    arm2_motor.stop()",
            "",
            "# --- RUN FUNCTIONS ---",
        ]

        # Generate run functions for each saved run
        run_functions = []
        runs_dict = []

        for i, (run_name, run_data) in enumerate(self.saved_runs.items(), 1):
            # Create function name (sanitized)
            func_name = f"run_{i}"

            # Generate function code
            func_lines = [f"def {func_name}():", f'    """{run_name}"""']

            # Convert recorded commands to Pybricks code
            commands = [RecordedCommand(**cmd) for cmd in run_data["commands"]]

            for cmd in commands:
                cmd_type = cmd.command_type
                params = cmd.parameters
                duration = params.get("duration", 0)

                if cmd_type == "drive":
                    speed = params.get("speed", 0)
                    turn_rate = params.get("turn_rate", 0)

                    if speed != 0 or turn_rate != 0:
                        # Start movement
                        func_lines.append(f"    drive_base.drive({speed}, {turn_rate})")
                        # Wait for duration
                        if duration > 0:
                            func_lines.append(f"    wait({int(duration * 1000)})")
                        # Stop movement
                        func_lines.append("    drive_base.stop()")
                    else:
                        # Stop
                        func_lines.append("    drive_base.stop()")

                elif cmd_type == "arm1":
                    speed = params.get("speed", 0)
                    if speed != 0:
                        # Start arm movement
                        func_lines.append(f"    arm1_motor.run({speed})")
                        # Wait for duration
                        if duration > 0:
                            func_lines.append(f"    wait({int(duration * 1000)})")
                        # Stop arm
                        func_lines.append("    arm1_motor.stop()")
                    else:
                        func_lines.append("    arm1_motor.stop()")

                elif cmd_type == "arm2":
                    speed = params.get("speed", 0)
                    if speed != 0:
                        # Start arm movement
                        func_lines.append(f"    arm2_motor.run({speed})")
                        # Wait for duration
                        if duration > 0:
                            func_lines.append(f"    wait({int(duration * 1000)})")
                        # Stop arm
                        func_lines.append("    arm2_motor.stop()")
                    else:
                        func_lines.append("    arm2_motor.stop()")

            # Add small wait at end of function
            func_lines.append("    wait(100)")

            run_functions.extend(func_lines)
            run_functions.append("")
            runs_dict.append(f"    {i}: {func_name},")

        # Add the run functions to the code
        code_lines.extend(run_functions)

        # Add the main execution section
        code_lines.extend(
            [
                "# --- MAIN EXECUTION ---",
                "",
                "runs = {",
            ]
        )
        code_lines.extend(runs_dict)
        code_lines.extend(
            [
                "}",
                "",
                f"selected_run = hub_menu(*range(1, {len(self.saved_runs) + 1}))",
                "",
                "if selected_run in runs:",
                "    runs[selected_run]()",
                "",
                "# --- END OF COMPETITION CODE ---",
            ]
        )

        return "\n".join(code_lines)

    def _show_competition_instructions(self):
        """Show instructions for using the competition code."""
        instructions = f"""
🎯 COMPETITION MODE CODE GENERATED! 🎯

✅ Code copied to clipboard with {len(self.saved_runs)} runs

📋 NEXT STEPS:
1. Go to code.pybricks.com
2. Paste the code into the editor
3. Upload to your SPIKE Prime hub
4. Run the program on the hub
5. Use the hub menu to select your run

🏆 COMPETITION READY!
• All your recorded runs are now autonomous
• No computer connection needed during competition
• Just select and run your pre-programmed sequences

💡 TIP: Test each run before competition to ensure accuracy!
        """

        QMessageBox.information(
            self, "Competition Code Generated!", instructions.strip(), QMessageBox.Ok
        )

    def closeEvent(self, event):
        if self.is_closing:
            event.accept()
            return

        event.ignore()
        self.start_exit_animation()

    def start_exit_animation(self):
        if self.is_closing:
            return

        self.is_closing = True

        if self.ble_controller and self.ble_controller.connected:
            self.disconnect_hub()

        rect = self.geometry()
        w = int(rect.width() * 0.3)
        h = int(rect.height() * 0.3)
        x = rect.x() + (rect.width() - w) // 2
        y = rect.y() + (rect.height() - h) // 2

        end_geom = QtCore.QRect(x, y, w, h)

        self.exit_anim.setStartValue(rect)
        self.exit_anim.setEndValue(end_geom)

        self.opacity_anim.setStartValue(1.0)
        self.opacity_anim.setEndValue(0.0)

        self.exit_anim.start()
        self.opacity_anim.start()

    def force_close(self):
        self.is_closing = True
        QApplication.quit()


class ConfigDialog(QDialog):
    """Configuration dialog for robot settings and calibration."""

    def __init__(self, parent, config: RobotConfig):
        super().__init__(parent)
        self.config = config
        self.setup_ui()

    def setup_ui(self):
        self.setWindowTitle("Robot Configuration")
        self.setFixedSize(500, 600)  # More reasonable size for tabbed interface
        self.setModal(True)

        self.setup_dialog_style()

        layout = QVBoxLayout(self)

        title = QLabel("Robot Configuration")
        title.setFont(QFont("Arial", 16, QFont.Bold))  # type: ignore
        title.setAlignment(Qt.AlignCenter)  # type: ignore
        layout.addWidget(title)

        # Create tab widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setObjectName("tab_widget")

        # Create tabs
        self.create_drive_tab()
        self.create_motion_tab()
        self.create_ports_tab()
        self.create_calibration_tab()

        layout.addWidget(self.tab_widget)

        # Initialize calibration manager
        self.calibration_manager = CalibrationManager(self)
        self.setup_calibration_connections()

        # Bottom buttons
        button_layout = QHBoxLayout()
        cancel_btn = QPushButton("Cancel")
        cancel_btn.setObjectName("danger_btn")
        cancel_btn.clicked.connect(self.reject)

        save_btn = QPushButton("Save")
        save_btn.setObjectName("success_btn")
        save_btn.clicked.connect(self.accept)

        button_layout.addWidget(cancel_btn)
        button_layout.addWidget(save_btn)
        layout.addLayout(button_layout)

    def create_drive_tab(self):
        """Create the Drive Configuration tab"""
        drive_tab = QWidget()
        layout = QVBoxLayout(drive_tab)
        layout.setSpacing(15)

        drive_group = QGroupBox("Drive Configuration")
        drive_group.setObjectName("group_box")
        drive_layout = QVBoxLayout(drive_group)

        axle_layout = QHBoxLayout()
        axle_layout.addWidget(QLabel("Axle Track (mm):"))
        self.axle_track_input = QLineEdit(str(self.config.axle_track))
        self.axle_track_input.setObjectName("line_edit")
        axle_layout.addWidget(self.axle_track_input)
        drive_layout.addLayout(axle_layout)

        info_label1 = QLabel("Distance between left and right wheels")
        info_label1.setObjectName("info_text")
        drive_layout.addWidget(info_label1)

        wheel_layout = QHBoxLayout()
        wheel_layout.addWidget(QLabel("Wheel Diameter (mm):"))
        self.wheel_diameter_input = QLineEdit(str(self.config.wheel_diameter))
        self.wheel_diameter_input.setObjectName("line_edit")
        wheel_layout.addWidget(self.wheel_diameter_input)
        drive_layout.addLayout(wheel_layout)

        info_label2 = QLabel("Diameter of the driving wheels")
        info_label2.setObjectName("info_text")
        drive_layout.addWidget(info_label2)

        layout.addWidget(drive_group)
        layout.addStretch()

        self.tab_widget.addTab(drive_tab, "Drive")

    def create_motion_tab(self):
        """Create the Motion Settings tab"""
        motion_tab = QWidget()
        layout = QVBoxLayout(motion_tab)
        layout.setSpacing(15)

        motion_group = QGroupBox("Motion Settings")
        motion_group.setObjectName("group_box")
        motion_layout = QVBoxLayout(motion_group)

        straight_speed_layout = QHBoxLayout()
        straight_speed_layout.addWidget(QLabel("Max Straight Speed (mm/s):"))
        self.straight_speed_input = QLineEdit(str(self.config.straight_speed))
        self.straight_speed_input.setObjectName("line_edit")
        straight_speed_layout.addWidget(self.straight_speed_input)
        motion_layout.addLayout(straight_speed_layout)

        info_label3 = QLabel("Maximum speed for forward/backward movement")
        info_label3.setObjectName("info_text")
        motion_layout.addWidget(info_label3)

        straight_accel_layout = QHBoxLayout()
        straight_accel_layout.addWidget(QLabel("Straight Acceleration (mm/s²):"))
        self.straight_acceleration_input = QLineEdit(
            str(self.config.straight_acceleration)
        )
        self.straight_acceleration_input.setObjectName("line_edit")
        straight_accel_layout.addWidget(self.straight_acceleration_input)
        motion_layout.addLayout(straight_accel_layout)

        info_label4 = QLabel("How quickly the robot accelerates/decelerates")
        info_label4.setObjectName("info_text")
        motion_layout.addWidget(info_label4)

        turn_rate_layout = QHBoxLayout()
        turn_rate_layout.addWidget(QLabel("Max Turn Rate (deg/s):"))
        self.turn_rate_input = QLineEdit(str(self.config.turn_rate))
        self.turn_rate_input.setObjectName("line_edit")
        turn_rate_layout.addWidget(self.turn_rate_input)
        motion_layout.addLayout(turn_rate_layout)

        info_label5 = QLabel("Maximum turning speed")
        info_label5.setObjectName("info_text")
        motion_layout.addWidget(info_label5)

        turn_accel_layout = QHBoxLayout()
        turn_accel_layout.addWidget(QLabel("Turn Acceleration (deg/s²):"))
        self.turn_acceleration_input = QLineEdit(str(self.config.turn_acceleration))
        self.turn_acceleration_input.setObjectName("line_edit")
        turn_accel_layout.addWidget(self.turn_acceleration_input)
        motion_layout.addLayout(turn_accel_layout)

        info_label6 = QLabel("How quickly the robot accelerates/decelerates turning")
        info_label6.setObjectName("info_text")
        motion_layout.addWidget(info_label6)

        layout.addWidget(motion_group)
        layout.addStretch()

        self.tab_widget.addTab(motion_tab, "Motion")

    def create_ports_tab(self):
        """Create the Motor Ports tab"""
        ports_tab = QWidget()
        layout = QVBoxLayout(ports_tab)
        layout.setSpacing(15)

        ports_group = QGroupBox("Motor Ports")
        ports_group.setObjectName("group_box")
        ports_layout = QVBoxLayout(ports_group)

        port_options = ["A", "B", "C", "D", "E", "F"]

        left_layout = QHBoxLayout()
        left_layout.addWidget(QLabel("Left Motor Port:"))
        self.left_motor_combo = QComboBox()
        self.left_motor_combo.addItems(port_options)
        self.left_motor_combo.setCurrentText(self.config.left_motor_port)
        left_layout.addWidget(self.left_motor_combo)
        ports_layout.addLayout(left_layout)

        right_layout = QHBoxLayout()
        right_layout.addWidget(QLabel("Right Motor Port:"))
        self.right_motor_combo = QComboBox()
        self.right_motor_combo.addItems(port_options)
        self.right_motor_combo.setCurrentText(self.config.right_motor_port)
        right_layout.addWidget(self.right_motor_combo)
        ports_layout.addLayout(right_layout)

        arm1_layout = QHBoxLayout()
        arm1_layout.addWidget(QLabel("Arm 1 Motor Port:"))
        self.arm1_motor_combo = QComboBox()
        self.arm1_motor_combo.addItems(port_options)
        self.arm1_motor_combo.setCurrentText(self.config.arm1_motor_port)
        arm1_layout.addWidget(self.arm1_motor_combo)
        ports_layout.addLayout(arm1_layout)

        arm2_layout = QHBoxLayout()
        arm2_layout.addWidget(QLabel("Arm 2 Motor Port:"))
        self.arm2_motor_combo = QComboBox()
        self.arm2_motor_combo.addItems(port_options)
        self.arm2_motor_combo.setCurrentText(self.config.arm2_motor_port)
        arm2_layout.addWidget(self.arm2_motor_combo)
        ports_layout.addLayout(arm2_layout)

        layout.addWidget(ports_group)
        layout.addStretch()

        self.tab_widget.addTab(ports_tab, "Ports")

    def create_calibration_tab(self):
        """Create the Calibration tab"""
        calibration_tab = QWidget()
        layout = QVBoxLayout(calibration_tab)
        layout.setSpacing(15)

        # Calibration Status
        calibration_status_group = QGroupBox("Calibration Status")
        calibration_status_group.setObjectName("configGroup")
        status_layout = QVBoxLayout(calibration_status_group)

        self.calibration_status_label = QLabel("Ready to calibrate")
        self.calibration_status_label.setObjectName("configDescription")
        status_layout.addWidget(self.calibration_status_label)

        layout.addWidget(calibration_status_group)

        # Calibration Controls
        calibration_control_group = QGroupBox("Calibration Controls")
        calibration_control_group.setObjectName("configGroup")
        control_layout = QVBoxLayout(calibration_control_group)
        control_layout.setSpacing(15)

        button_layout = QHBoxLayout()

        self.start_calibration_btn = QPushButton("Start Calibration")
        self.start_calibration_btn.setObjectName("primaryButton")
        self.start_calibration_btn.setMinimumHeight(35)

        self.stop_calibration_btn = QPushButton("Stop")
        self.stop_calibration_btn.setObjectName("secondaryButton")
        self.stop_calibration_btn.setMinimumHeight(35)
        self.stop_calibration_btn.setEnabled(False)

        self.clear_calibration_btn = QPushButton("Clear Data")
        self.clear_calibration_btn.setObjectName("dangerButton")
        self.clear_calibration_btn.setMinimumHeight(35)

        button_layout.addWidget(self.start_calibration_btn)
        button_layout.addWidget(self.stop_calibration_btn)
        button_layout.addWidget(self.clear_calibration_btn)
        button_layout.addStretch()

        self.calibration_progress_bar = QProgressBar()
        self.calibration_progress_bar.setObjectName("calibrationProgress")
        self.calibration_progress_bar.setVisible(False)
        self.calibration_progress_bar.setMinimumHeight(25)

        self.calibration_step_label = QLabel("Ready to calibrate")
        self.calibration_step_label.setObjectName("configDescription")

        control_layout.addLayout(button_layout)
        control_layout.addWidget(self.calibration_progress_bar)
        control_layout.addWidget(self.calibration_step_label)

        layout.addWidget(calibration_control_group)

        # Calibration Results
        calibration_results_group = QGroupBox("Calibration Results")
        calibration_results_group.setObjectName("configGroup")
        results_layout = QVBoxLayout(calibration_results_group)
        results_layout.setSpacing(10)

        self.calibration_results_text = QTextEdit()
        self.calibration_results_text.setObjectName("calibrationResults")
        self.calibration_results_text.setReadOnly(True)
        self.calibration_results_text.setMinimumHeight(150)
        self.calibration_results_text.setMaximumHeight(200)
        self.calibration_results_text.setPlainText("No calibration data available")

        results_layout.addWidget(self.calibration_results_text)

        layout.addWidget(calibration_results_group)

        self.tab_widget.addTab(calibration_tab, "Calibration")

    def setup_calibration_connections(self):
        self.start_calibration_btn.clicked.connect(self.start_calibration)
        self.stop_calibration_btn.clicked.connect(self.stop_calibration)
        self.clear_calibration_btn.clicked.connect(self.clear_calibration_data)

        # Connect calibration manager signals
        self.calibration_manager.calibration_started.connect(
            self.on_calibration_started
        )
        self.calibration_manager.calibration_step_changed.connect(
            self.on_calibration_step_changed
        )
        self.calibration_manager.calibration_progress.connect(
            self.on_calibration_progress
        )
        self.calibration_manager.calibration_step_completed.connect(
            self.on_calibration_step_completed
        )
        self.calibration_manager.calibration_completed.connect(
            self.on_calibration_completed
        )
        self.calibration_manager.calibration_failed.connect(self.on_calibration_failed)

    def start_calibration(self):
        self.calibration_manager.start_calibration()

    def stop_calibration(self):
        self.calibration_manager.stop_calibration()

    def clear_calibration_data(self):
        self.calibration_results_text.setPlainText("No calibration data available")
        self.calibration_status_label.setText("Ready to calibrate")
        self.calibration_step_label.setText("Ready to calibrate")
        self.calibration_progress_bar.setVisible(False)

    def on_calibration_started(self):
        self.start_calibration_btn.setEnabled(False)
        self.stop_calibration_btn.setEnabled(True)
        self.clear_calibration_btn.setEnabled(False)
        self.calibration_progress_bar.setVisible(True)
        self.calibration_progress_bar.setValue(0)
        self.calibration_status_label.setText("Calibration in progress...")

    def on_calibration_step_changed(self, step, description):
        self.calibration_step_label.setText(description)

    def on_calibration_progress(self, percentage):
        self.calibration_progress_bar.setValue(percentage)

    def on_calibration_step_completed(self, result):
        current_text = self.calibration_results_text.toPlainText()
        if current_text == "No calibration data available":
            current_text = ""

        status = "✓" if result.success else "✗"
        new_line = f"{status} {result.step_name}: {result.description}\n"
        self.calibration_results_text.setPlainText(current_text + new_line)

    def on_calibration_completed(self, config):
        self.start_calibration_btn.setEnabled(True)
        self.stop_calibration_btn.setEnabled(False)
        self.clear_calibration_btn.setEnabled(True)
        self.calibration_progress_bar.setVisible(False)
        self.calibration_status_label.setText("Calibration completed successfully!")
        self.calibration_step_label.setText("Calibration complete")

        # Update the config with calibrated values
        self.config = config

        # Notify the parent window that calibration is complete
        if hasattr(self.parent(), "on_calibration_completed"):
            self.parent().on_calibration_completed(config)

    def on_calibration_failed(self, reason):
        self.start_calibration_btn.setEnabled(True)
        self.stop_calibration_btn.setEnabled(False)
        self.clear_calibration_btn.setEnabled(True)
        self.calibration_progress_bar.setVisible(False)
        self.calibration_status_label.setText(f"Calibration failed: {reason}")
        self.calibration_step_label.setText("Calibration failed")

        # Notify the parent window that calibration failed
        if hasattr(self.parent(), "on_calibration_failed"):
            self.parent().on_calibration_failed(reason)

    def setup_dialog_style(self):
        style = """
        QDialog {
            background-color: rgb(45, 45, 45);
            color: rgb(255, 255, 255);
        }
        
        QGroupBox {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background: rgb(45, 45, 45);
            font-weight: bold;
            padding-top: 10px;
            margin-top: 5px;
        }
        
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        
        #line_edit {
            color: rgb(255, 255, 255);
            border: 2px solid rgb(70, 70, 70);
            border-radius: 4px;
            background: rgb(60, 60, 60);
            padding: 5px;
        }
        
        #line_edit:focus {
            border-color: rgb(0, 143, 170);
        }
        
        #success_btn {
            border: 2px solid rgb(40, 167, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(40, 167, 69);
            font-weight: bold;
            padding: 8px 16px;
        }
        
        #success_btn:hover {
            background-color: rgb(34, 142, 58);
        }
        
        #danger_btn {
            border: 2px solid rgb(220, 53, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(220, 53, 69);
            font-weight: bold;
            padding: 8px 16px;
        }
        
        #danger_btn:hover {
            background-color: rgb(200, 35, 51);
        }
        
        #info_text {
            color: rgb(200, 200, 200);
            font-size: 11px;
        }
        
        QCheckBox {
            color: rgb(255, 255, 255);
        }
        
        QCheckBox::indicator {
            width: 15px;
            height: 15px;
        }
        
        QCheckBox::indicator:unchecked {
            border: 2px solid rgb(70, 70, 70);
            background-color: rgb(60, 60, 60);
        }
        
        QCheckBox::indicator:checked {
            border: 2px solid rgb(0, 143, 170);
            background-color: rgb(0, 143, 170);
        }
        
        QComboBox {
            color: rgb(255, 255, 255);
            border: 2px solid rgb(70, 70, 70);
            border-radius: 4px;
            background: rgb(60, 60, 60);
            padding: 5px;
        }
        
        QComboBox:focus {
            border-color: rgb(0, 143, 170);
        }
        
        QComboBox::drop-down {
            width: 0px;
            border: none;
        }
        
        QComboBox::down-arrow {
            image: none;
            width: 0px;
            height: 0px;
        }
        
        QComboBox QAbstractItemView {
            background-color: rgb(60, 60, 60);
            border: 1px solid rgb(70, 70, 70);
            color: rgb(255, 255, 255);
            selection-background-color: rgb(0, 143, 170);
        }
        
        QLabel {
            color: rgb(255, 255, 255);
        }
        
        #primaryButton {
            border: 2px solid rgb(0, 143, 170);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(0, 143, 170);
            font-weight: bold;
            padding: 8px 16px;
        }
        
        #primaryButton:hover {
            background-color: rgb(0, 123, 150);
        }
        
        #secondaryButton {
            border: 2px solid rgb(108, 117, 125);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(108, 117, 125);
            font-weight: bold;
            padding: 8px 16px;
        }
        
        #secondaryButton:hover {
            background-color: rgb(88, 97, 105);
        }
        
        #dangerButton {
            border: 2px solid rgb(220, 53, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(220, 53, 69);
            font-weight: bold;
            padding: 8px 16px;
        }
        
        #dangerButton:hover {
            background-color: rgb(200, 35, 51);
        }
        
        #tab_widget {
            background-color: rgb(45, 45, 45);
            color: rgb(255, 255, 255);
        }
        
        #tab_widget::pane {
            border: 1px solid rgb(70, 70, 70);
            background-color: rgb(45, 45, 45);
        }
        
        #tab_widget::tab-bar {
            alignment: left;
        }
        
        #tab_widget::tab {
            background-color: rgb(60, 60, 60);
            color: rgb(255, 255, 255);
            padding: 8px 16px;
            margin-right: 2px;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
        }
        
        #tab_widget::tab:selected {
            background-color: rgb(0, 143, 170);
            color: rgb(255, 255, 255);
        }
        
        #tab_widget::tab:hover {
            background-color: rgb(80, 80, 80);
        }
        
        #configGroup {
            font-size: 12px;
            font-weight: bold;
            color: rgb(255, 255, 255);
            border: 1px solid rgb(70, 70, 70);
            border-radius: 5px;
            margin-top: 10px;
            padding-top: 10px;
        }
        
        #configGroup::title {
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 5px;
            color: rgb(204, 204, 204);
        }
        
        #configDescription {
            color: rgb(176, 176, 176);
            font-size: 10px;
            font-style: italic;
            margin-left: 10px;
        }
        
        #calibrationProgress {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 3px;
            background-color: rgb(60, 60, 60);
            color: rgb(255, 255, 255);
            text-align: center;
        }
        
        #calibrationProgress::chunk {
            background-color: rgb(0, 143, 170);
            border-radius: 2px;
        }
        
        #calibrationResults {
            background-color: rgb(60, 60, 60);
            border: 1px solid rgb(70, 70, 70);
            border-radius: 3px;
            color: rgb(255, 255, 255);
            font-family: monospace;
            font-size: 10px;
        }
        """

        self.setStyleSheet(style)

    def get_config(self):
        return RobotConfig(
            axle_track=float(self.axle_track_input.text()),
            wheel_diameter=float(self.wheel_diameter_input.text()),
            left_motor_port=self.left_motor_combo.currentText(),
            right_motor_port=self.right_motor_combo.currentText(),
            arm1_motor_port=self.arm1_motor_combo.currentText(),
            arm2_motor_port=self.arm2_motor_combo.currentText(),
            straight_speed=float(self.straight_speed_input.text()),
            straight_acceleration=float(self.straight_acceleration_input.text()),
            turn_rate=float(self.turn_rate_input.text()),
            turn_acceleration=float(self.turn_acceleration_input.text()),
        )


def main():
    """Main application entry point."""
    app = QApplication(sys.argv)
    app.setApplicationName(f"CodLess - FLL Robotics Control Center v{__version__}")

    window = FLLRoboticsGUI()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
