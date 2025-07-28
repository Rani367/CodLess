# CodLess – Robot Control & Training Platform

**CodLess** is a control platform for FLL robot development and training. It provides real-time control and physics simulation for LEGO SPIKE Prime robots running Pybricks.

Built for **LEGO SPIKE Prime** and **Pybricks**, the app offers keyboard control, movement recording/playback, and physics simulation for strategy development.

---

## Features

- **Real-time keyboard control** with WASD movement + QE/RF arm controls
- **Bluetooth communication** with LEGO SPIKE Prime hubs via Pybricks
- **Record & replay system** for saving robot runs
- **Physics simulator** with motor dynamics and S-curve acceleration
- **Developer mode** for testing without hardware
- **Robot configuration** for different wheel sizes, motor ports, and settings
- **Dark theme interface** with real-time status monitoring

---

## Setup

### Hardware Setup (Real Robot)
1. Upload `hub_control.py` to your SPIKE Prime hub via code.pybricks.com
2. Keep the Pybricks website open and connected to your hub
3. Run the app and click "Connect to Pybricks Hub"
4. Use WASD keys for movement, QE/RF for arms, SPACE for emergency stop

### Developer Mode (Simulation)
1. Enable Developer Mode in the app
2. Use the same controls to test with the physics simulator
3. Test strategies before using real hardware

### Recording & Playback
1. Start recording while controlling your robot
2. Save runs with custom names
3. Play back saved runs to repeat movements
4. Build a library of competition runs

---

## Technical Details

### Physics Simulation
- **S-curve motion profiles** with smooth acceleration/deceleration
- **Motor response lag** and **friction modeling**
- **Mass and inertia effects** for realistic robot behavior
- **Real-time physics** running at 30Hz

### Communication Architecture
```
PC App ←→ Pybricks Website ←→ Robot Hub
```

### Robot Configuration
- Configurable wheel diameter and axle track
- Adjustable motor ports and speed settings
- Custom acceleration and turn rate parameters

---

## System Requirements

- **Python 3.8+** with PySide6
- **macOS, Windows, or Linux**
- **Bluetooth capability** for real robot connection
- **LEGO SPIKE Prime hub** with Pybricks firmware
- **Internet connection** for Pybricks website communication

Optional: `bleak` library for enhanced Bluetooth support

---

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.

---

## Open Source

CodLess is an open-source project for robotics education and competition preparation. 
