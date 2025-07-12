#!/usr/bin/env python3

import os
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'

import sys
import asyncio
import threading
import time
import json
import os
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
import math

try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from PySide6.QtCore import QTimer, QPropertyAnimation, QEasingCurve, Qt, QEvent
    from PySide6.QtGui import QIcon, QPixmap, QFont, QPainter, QPen, QBrush, QColor
    from PySide6.QtWidgets import *
    PYSIDE_AVAILABLE = True
except ImportError:
    PYSIDE_AVAILABLE = False

try:
    import bleak
    from bleak import BleakScanner, BleakClient
    BLE_AVAILABLE = True
except ImportError:
    BLE_AVAILABLE = False

PYBRICKS_COMMAND_EVENT_CHAR_UUID = "c5f50002-8280-46da-89f4-6d8051e4aeef"
HUB_NAME_PREFIX = "Pybricks"

@dataclass
class RobotConfig:
    axle_track: float = 112.0
    wheel_diameter: float = 56.0
    left_motor_port: str = "A"
    right_motor_port: str = "B"
    arm1_motor_port: str = "C"
    arm2_motor_port: str = "D"
    straight_speed: float = 500.0
    straight_acceleration: float = 250.0
    turn_rate: float = 200.0
    turn_acceleration: float = 300.0

@dataclass
class RecordedCommand:
    timestamp: float
    command_type: str
    parameters: Dict

class RobotSimulator(QWidget):
    def __init__(self):
        super().__init__()
        self.setMinimumSize(400, 300)
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
        cmd_type = command.get('type', '')
        
        if cmd_type == 'drive':
            self.target_spd = command.get('speed', 0) * 1.5
            self.target_turn = command.get('turn_rate', 0) * 1.2
        elif cmd_type == 'arm1':
            self.target_arm1_spd = command.get('speed', 0) * 1.0
        elif cmd_type == 'arm2':
            self.target_arm2_spd = command.get('speed', 0) * 1.0
            
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
        
        self.speed_accel = s_curve_profile(speed_error, max_speed_change, self.speed_accel, self.max_drive_accel)
        self.turn_accel = s_curve_profile(turn_error, max_turn_change, self.turn_accel, self.max_turn_accel)
        self.arm1_accel = s_curve_profile(arm1_error, max_arm_change, self.arm1_accel, self.max_arm_accel)
        self.arm2_accel = s_curve_profile(arm2_error, max_arm_change, self.arm2_accel, self.max_arm_accel)
        
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
        painter.setRenderHint(QPainter.Antialiasing)
        
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
        triangle = [
            QtCore.QPoint(20, 0),
            QtCore.QPoint(15, -8),
            QtCore.QPoint(15, 8)
        ]
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
                        self.log_callback(f"HUB: {payload.decode('utf-8', errors='ignore')}")
                        
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
            data = command_str.encode('utf-8')
            
            await self.client.write_gatt_char(
                PYBRICKS_COMMAND_EVENT_CHAR_UUID,
                b"\x06" + data,
                response=True
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
    def __init__(self):
        super().__init__()
        
        if not PYSIDE_AVAILABLE:
            print("❌ PySide6 not available. Install with: pip install PySide6")
            sys.exit(1)
            
        self.ble_controller = None
        self.config = RobotConfig()
        self.is_recording = False
        self.recorded_commands = []
        self.recording_start_time = 0
        self.current_run_name = "Run 1"
        self.pressed_keys = set()
        self.saved_runs = self.load_saved_runs()
        
        self.setup_ui()
        self.setup_style()
        self.setup_connections()
        
        self.startup_anim = None
        self.exit_anim = None
        self.opacity_anim = None
        self.is_closing = False
        self.setup_startup_animation()
        self.setup_exit_animation()
        


        
    def setup_ui(self):
        self.setWindowTitle("FLL Robotics Control Center")
        self.setGeometry(120, 80, 1200, 800)
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
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
        content_layout.addWidget(self.sidebar)
        
        self.main_content = self.create_main_content()
        content_layout.addWidget(self.main_content)
        
        main_layout.addWidget(content_widget)
        
        self.status_bar = self.create_status_bar()
        main_layout.addWidget(self.status_bar)
        
    def create_title_bar(self):
        title_bar = QWidget()
        title_bar.setFixedHeight(40)
        title_bar.setObjectName("title_bar")
        
        layout = QHBoxLayout(title_bar)
        layout.setContentsMargins(15, 0, 15, 0)
        
        title_label = QLabel("CodeLess - FLL Robotics Control Center")
        title_label.setObjectName("title_label")
        title_label.setFont(QFont("Arial", 12, QFont.Bold))
        layout.addWidget(title_label)
        
        layout.addStretch()
        
        self.min_btn = QPushButton("-")
        self.min_btn.setObjectName("window_btn")
        self.min_btn.setFixedSize(30, 30)
        
        self.max_btn = QPushButton("[]")
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
        sidebar.setFixedWidth(250)
        sidebar.setObjectName("sidebar")
        
        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        conn_group = QGroupBox("Hub Connection")
        conn_group.setObjectName("group_box")
        conn_layout = QVBoxLayout(conn_group)
        
        self.connect_btn = QPushButton("Connect to Pybricks Hub")
        self.connect_btn.setObjectName("primary_btn")
        self.connect_btn.setMinimumHeight(40)
        self.connect_btn.setToolTip("1. Upload hub_control.py via code.pybricks.com\n2. Keep Pybricks website open\n3. Click to connect")
        
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
        
        keys_group = QGroupBox("Control Keys")
        keys_group.setObjectName("group_box")
        keys_layout = QVBoxLayout(keys_group)
        
        keys_text = QLabel("""Drive (hold to move):
  W - Forward    S - Backward
  A - Turn Left  D - Turn Right

Arms (hold to move):
  Q - Arm 1 Up   E - Arm 1 Down
  R - Arm 2 Up   F - Arm 2 Down""")
        keys_text.setObjectName("info_text")
        keys_text.setFont(QFont("Monaco", 9))
        
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
        layout.setSpacing(20)
        
        self.simulator_group = QGroupBox("Robot Simulator")
        self.simulator_group.setObjectName("group_box")
        simulator_layout = QVBoxLayout(self.simulator_group)
        
        self.robot_simulator = RobotSimulator()
        simulator_layout.addWidget(self.robot_simulator)
        sim_controls = QHBoxLayout()
        sim_info = QLabel("Real-time visual simulation of your robot's movement and arm positions")
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
        record_group = QGroupBox("Recording Controls")
        record_group.setObjectName("group_box")
        record_layout = QVBoxLayout(record_group)
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("Run Name:"))
        self.run_name_input = QLineEdit("Run 1")
        self.run_name_input.setObjectName("line_edit")
        name_layout.addWidget(self.run_name_input)
        record_layout.addLayout(name_layout)
        record_btn_layout = QHBoxLayout()
        self.record_btn = QPushButton("Record Run")
        self.record_btn.setObjectName("danger_btn")
        self.record_btn.setMinimumHeight(50)
        
        self.save_btn = QPushButton("Save Run")
        self.save_btn.setObjectName("success_btn")
        self.save_btn.setMinimumHeight(50)
        self.save_btn.setEnabled(False)
        
        record_btn_layout.addWidget(self.record_btn)
        record_btn_layout.addWidget(self.save_btn)
        record_layout.addLayout(record_btn_layout)
        self.record_status = QLabel("Not Recording")
        self.record_status.setObjectName("info_text")
        record_layout.addWidget(self.record_status)
        
        layout.addWidget(record_group)
        manual_group = QGroupBox("Manual Controls")
        manual_group.setObjectName("group_box")
        manual_layout = QVBoxLayout(manual_group)
        
        manual_info = QLabel("Click in this window and use keyboard controls")
        manual_info.setObjectName("info_text")
        manual_layout.addWidget(manual_info)
        
        self.key_status = QLabel("No keys pressed")
        self.key_status.setObjectName("info_text")
        self.key_status.setFont(QFont("Monaco", 10))
        manual_layout.addWidget(self.key_status)
        
        layout.addWidget(manual_group)
        status_group = QGroupBox("Robot Status")
        status_group.setObjectName("group_box")
        status_layout = QVBoxLayout(status_group)
        
        self.status_display = QTextEdit()
        self.status_display.setObjectName("status_display")
        self.status_display.setMaximumHeight(200)
        self.status_display.setReadOnly(True)
        
        status_layout.addWidget(self.status_display)
        layout.addWidget(status_group)
        
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
            padding-top: 10px;
            margin-top: 5px;
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
            font-family: 'Consolas', monospace;
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
        self.record_btn.clicked.connect(self.toggle_recording)
        self.save_btn.clicked.connect(self.save_current_run)
        self.play_btn.clicked.connect(self.play_selected_run)
        self.delete_btn.clicked.connect(self.delete_selected_run)
        self.developer_check.toggled.connect(self.toggle_developer_mode)
        self.setFocusPolicy(Qt.StrongFocus)
        
        self.update_runs_list()
    
    def setup_startup_animation(self):
        self.target_geom = self.geometry()
        
        self.startup_anim = QPropertyAnimation(self, b"geometry")
        self.startup_anim.setDuration(850)  
        self.startup_anim.setEasingCurve(QEasingCurve.OutCubic)
        
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
        
        if self.startup_anim and not hasattr(self, '_animated'):
            self._animated = True
            self.setGeometry(self.start_geom)
            self.startup_anim.setStartValue(self.start_geom)
            self.startup_anim.setEndValue(self.target_geom)
            self.startup_anim.start()
        
    def keyPressEvent(self, event):
        key = event.text().lower()
        if key not in self.pressed_keys:
            self.pressed_keys.add(key)
            self.process_key_command(key, True)
            self.update_key_status()
            
    def keyReleaseEvent(self, event):
        key = event.text().lower()
        if key in self.pressed_keys:
            self.pressed_keys.remove(key)
            self.process_key_command(key, False)
            self.update_key_status()
            
    def update_key_status(self):
        if not self.pressed_keys:
            self.key_status.setText("No keys pressed")
        else:
            sorted_keys = sorted([k.upper() for k in self.pressed_keys if k.isalpha()])
            if sorted_keys:
                self.key_status.setText(f"Holding: {' + '.join(sorted_keys)}")
            else:
                self.key_status.setText("No keys pressed")
            
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.drag_pos = event.globalPosition().toPoint()
            
    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.LeftButton and hasattr(self, 'drag_pos'):
            self.move(self.pos() + event.globalPosition().toPoint() - self.drag_pos)
            self.drag_pos = event.globalPosition().toPoint()
            
    def toggle_maximize(self):
        if self.isMaximized():
            self.showNormal()
            self.max_btn.setText("[]")
        else:
            self.showMaximized()
            self.max_btn.setText("=[]")
            
    def log_status(self, message: str, level: str = "info"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        color_map = {
            "info": "#ffffff",
            "success": "#28a745", 
            "warning": "#ffc107",
            "error": "#dc3545"
        }
        
        color = color_map.get(level, "#ffffff")
        formatted_message = f'<span style="color: {color};">[{timestamp}] {message}</span>'
        
        self.status_display.append(formatted_message)
        self.status_label.setText(message)
        
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
            self.log_status("❌ BLE not available. Install 'bleak' or enable Developer Mode.", "error")
            return
            
        if ((self.ble_controller and self.ble_controller.connected) or 
            (self.developer_check.isChecked() and "Connected" in self.hub_status.text())):
            self.disconnect_hub()
            return
            
        if self.developer_check.isChecked():
            self.log_status("Developer mode: Simulating hub connection", "warning")
            self.hub_status.setText("● Hub Connected (Simulation)")
            self.hub_status.setObjectName("status_connected")
            self.hub_status.setStyleSheet("#status_connected { color: rgb(40, 167, 69); font-weight: bold; }")
            self.connect_btn.setText("Disconnect Hub")
        else:
            self.ble_controller = BLEController(self.log_status)
            self.run_async_task(self._connect_ble())
            
    async def _connect_ble(self):
        success = await self.ble_controller.connect()
        if success:
            self.hub_status.setText("● Hub Connected (Bluetooth)")
            self.hub_status.setObjectName("status_connected")
            self.hub_status.setStyleSheet("#status_connected { color: rgb(40, 167, 69); font-weight: bold; }")
            self.connect_btn.setText("Disconnect Hub")
        else:
            self.log_status("Connection failed. Check setup guide.", "error")
            
    def disconnect_hub(self):
        if self.ble_controller:
            self.run_async_task(self.ble_controller.disconnect())
            
        self.hub_status.setText("● Hub Disconnected")
        self.hub_status.setObjectName("status_disconnected")
        self.hub_status.setStyleSheet("#status_disconnected { color: rgb(220, 53, 69); font-weight: bold; }")
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
            self.hub_status.setStyleSheet("#status_connected { color: rgb(40, 167, 69); font-weight: bold; }")
            self.connect_btn.setText("Disconnect Hub")
        else:
            self.log_status("Developer mode disabled", "info")
            self.simulator_group.hide()
            
            self.hub_status.setText("● Hub Disconnected")
            self.hub_status.setObjectName("status_disconnected")
            self.hub_status.setStyleSheet("#status_disconnected { color: rgb(220, 53, 69); font-weight: bold; }")
            self.connect_btn.setText("Connect to Pybricks Hub")
            
    def reset_simulator(self):
        if hasattr(self, 'robot_simulator'):
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
        if dialog.exec() == QDialog.Accepted:
            self.config = dialog.get_config()
            self.log_status("Robot configuration updated", "success")
            
            if ((self.ble_controller and self.ble_controller.connected) or self.developer_check.isChecked()):
                config_command = {
                    'type': 'config',
                    'axle_track': self.config.axle_track,
                    'wheel_diameter': self.config.wheel_diameter,
                    'straight_speed': self.config.straight_speed,
                    'straight_acceleration': self.config.straight_acceleration,
                    'turn_rate': self.config.turn_rate,
                    'turn_acceleration': self.config.turn_acceleration
                }
                self.execute_command(config_command)
            
    def process_key_command(self, key: str, is_pressed: bool):
        if not (self.ble_controller and self.ble_controller.connected) and not self.developer_check.isChecked():
            return
            
        ts = time.time()
        
        if key in ['w', 'a', 's', 'd']:
            spd = 0
            turn = 0
            
            if 'w' in self.pressed_keys:
                spd += 200
            if 's' in self.pressed_keys:
                spd -= 200
                
            if 'a' in self.pressed_keys:
                turn -= 100
            if 'd' in self.pressed_keys:
                turn += 100
                
            cmd = {'type': 'drive', 'speed': spd, 'turn_rate': turn}
            self.execute_command(cmd)
            
            if self.is_recording:
                recorded_cmd = RecordedCommand(
                    timestamp=ts - self.recording_start_time,
                    command_type=cmd['type'],
                    parameters=cmd
                )
                self.recorded_commands.append(recorded_cmd)
                
        elif key in ['q', 'e', 'r', 'f']:
            spd = 200 if is_pressed else 0
            
            if key == 'q':
                cmd = {'type': 'arm1', 'speed': spd}
            elif key == 'e':
                cmd = {'type': 'arm1', 'speed': -spd}
            elif key == 'r':
                cmd = {'type': 'arm2', 'speed': spd}
            elif key == 'f':
                cmd = {'type': 'arm2', 'speed': -spd}
                
            if cmd:
                self.execute_command(cmd)
                
                if self.is_recording:
                    rec_cmd = RecordedCommand(
                        timestamp=ts - self.recording_start_time,
                        command_type=cmd['type'],
                        parameters=cmd
                    )
                    self.recorded_commands.append(rec_cmd)
                
    def execute_command(self, cmd: Dict):
        try:
            if self.developer_check.isChecked():
                action = self.format_cmd_display(cmd)
                self.log_status(f"SIM: {action}", "info")
                self.robot_simulator.update_command(cmd)
            elif self.ble_controller and self.ble_controller.connected:
                self.run_async_task(self.ble_controller.send_command(cmd))
                
        except Exception as e:
            self.log_status(f"Command error: {str(e)}", "error")
            
    def format_cmd_display(self, cmd: Dict) -> str:
        cmd_type = cmd['type']
        if cmd_type == 'drive':
            spd = cmd.get('speed', 0)
            turn = cmd.get('turn_rate', 0)
            
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
            
        elif cmd_type in ['arm1', 'arm2']:
            spd = cmd.get('speed', 0)
            if spd > 0:
                dir = "Up"
            elif spd < 0:
                dir = "Down"
            else:
                dir = "Stop"
            return f"{cmd_type.upper()}: {dir} (speed={spd})"
        return str(cmd)
        
    def toggle_recording(self):
        if not ((self.ble_controller and self.ble_controller.connected) or self.developer_check.isChecked()):
            self.log_status("Please connect to hub first!", "warning")
            return
            
        if not self.is_recording:
            run_name = self.run_name_input.text().strip()
            if not run_name:
                run_name = f"Run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                self.run_name_input.setText(run_name)
                
            self.current_run_name = run_name
            self.is_recording = True
            self.recorded_commands = []
            self.recording_start_time = time.time()
            
            self.record_btn.setText("Stop Recording")
            self.record_status.setText(f"Recording: {run_name}")
            self.save_btn.setEnabled(False)
            self.log_status(f"Started recording: {run_name}", "success")
        else:
            self.is_recording = False
            self.record_btn.setText("Record Run") 
            self.record_status.setText(f"Recorded {len(self.recorded_commands)} commands")
            self.save_btn.setEnabled(True)
            self.log_status(f"Stopped recording. {len(self.recorded_commands)} commands captured", "success")
            
    def save_current_run(self):
        if not self.recorded_commands:
            self.log_status("No commands recorded!", "warning")
            return
            
        run_data = {
            'name': self.current_run_name,
            'timestamp': datetime.now().isoformat(),
            'config': asdict(self.config),
            'commands': [asdict(cmd) for cmd in self.recorded_commands]
        }
        
        os.makedirs("saved_runs", exist_ok=True)
        filename = f"saved_runs/{self.current_run_name.replace(' ', '_')}.json"
        
        try:
            with open(filename, 'w') as f:
                json.dump(run_data, f, indent=2)
                
            self.saved_runs[self.current_run_name] = run_data
            self.update_runs_list()
            self.save_btn.setEnabled(False)
            self.log_status(f"Run saved: {filename}", "success")
            
            self.recorded_commands = []
            self.record_status.setText("Not Recording")
            
        except Exception as e:
            self.log_status(f"Failed to save run: {str(e)}", "error")
            
    def load_saved_runs(self) -> Dict:
        runs = {}
        if not os.path.exists("saved_runs"):
            return runs
            
        try:
            for filename in os.listdir("saved_runs"):
                if filename.endswith(".json"):
                    with open(f"saved_runs/{filename}", 'r') as f:
                        run_data = json.load(f)
                        runs[run_data['name']] = run_data
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
            
        if not ((self.ble_controller and self.ble_controller.connected) or self.developer_check.isChecked()):
            self.log_status("Please connect to hub first!", "warning")
            return
            
        run_name = current_item.text()
        run_data = self.saved_runs[run_name]
        
        threading.Thread(target=self.playback_run, args=(run_data,), daemon=True).start()
        
    def playback_run(self, run_data: Dict):
        commands = [RecordedCommand(**cmd) for cmd in run_data['commands']]
        self.log_status(f"Playing back: {run_data['name']}", "success")
        
        start_time = time.time()
        for cmd in commands:
            target_time = start_time + cmd.timestamp
            while time.time() < target_time:
                time.sleep(0.001)
                
            self.execute_command(cmd.parameters)
            
        self.log_status("Playback completed", "success")
        
    def delete_selected_run(self):
        current_item = self.runs_list.currentItem()
        if not current_item:
            self.log_status("Please select a run to delete!", "warning")
            return
            
        run_name = current_item.text()
        
        reply = QMessageBox.question(self, "Confirm Delete", 
                                   f"Delete run '{run_name}'?",
                                   QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            del self.saved_runs[run_name]
            
            filename = f"saved_runs/{run_name.replace(' ', '_')}.json"
            try:
                if os.path.exists(filename):
                    os.remove(filename)
                self.update_runs_list()
                self.log_status(f"Deleted run: {run_name}", "success")
            except Exception as e:
                self.log_status(f"Error deleting run: {str(e)}", "error")
                
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
    def __init__(self, parent, config: RobotConfig):
        super().__init__(parent)
        self.config = config
        self.setup_ui()
        
    def setup_ui(self):
        self.setWindowTitle("Robot Configuration")
        self.setFixedSize(460, 520)
        self.setModal(True)
        
        self.setup_dialog_style()
        
        layout = QVBoxLayout(self)
        
        title = QLabel("Robot Configuration")
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)
        
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
        
        self.advanced_checkbox = QCheckBox("Advanced Options (Speed/Acceleration Settings)")
        self.advanced_checkbox.setObjectName("checkbox")
        self.advanced_checkbox.toggled.connect(self.toggle_advanced_options)
        layout.addWidget(self.advanced_checkbox)
        
        self.motion_group = QGroupBox("Motion Settings (Acceleration/Deceleration)")
        self.motion_group.setObjectName("group_box")
        motion_layout = QVBoxLayout(self.motion_group)
        
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
        self.straight_acceleration_input = QLineEdit(str(self.config.straight_acceleration))
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
        
        self.motion_group.hide()
        layout.addWidget(self.motion_group)
        
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
    
    def toggle_advanced_options(self, checked):
        if checked:
            self.motion_group.show()
            self.setFixedSize(460, 760)
        else:
            self.motion_group.hide()
            self.setFixedSize(460, 520)
    
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
            turn_acceleration=float(self.turn_acceleration_input.text())
        )



def main():
    if not PYSIDE_AVAILABLE:
        print("❌ PySide6 not available. Install with: pip install PySide6")
        return
        
    app = QApplication(sys.argv)
    app.setApplicationName("FLL Robotics Control Center")
    
    window = FLLRoboticsGUI()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main() 
