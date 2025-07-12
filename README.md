# CodLess – Real-Time Robot Control & Training Platform

**CodLess** is a comprehensive platform designed to make FLL robot control, testing, and training intuitive and efficient for teams of all levels. Whether you're developing new strategies or fine-tuning robot performance, CodLess provides real-time control and realistic simulation to perfect your runs.

Built specifically for **LEGO SPIKE Prime** and **Pybricks**, the app offers direct keyboard control, movement recording/playback, and an advanced physics simulator that behaves like a real robot — giving you the tools to develop winning strategies before stepping onto the competition field.

*It's responsive. It's realistic. It just works.*

---

## Features

- **Real-time keyboard control** with WASD movement + QE/RF arm controls
- **Direct Bluetooth communication** with LEGO SPIKE Prime hubs via Pybricks
- **Record & replay system** for saving and perfecting robot runs
- **Advanced physics simulator** with realistic motor dynamics, S-curve acceleration, and inertia
- **Developer mode** for testing without hardware
- **Robot configuration** for different wheel sizes, motor ports, and performance settings
- **Modern dark theme interface** with real-time status monitoring

---

## Why CodLess?

Competition success requires practice, precision, and iteration. This app removes the complexity of programming individual runs and lets teams focus on what matters: strategy development, movement optimization, and consistent performance.

Our mission is to help FLL teams develop faster, test more efficiently, and compete with confidence — whether you have access to the robot or not.

---

## How It Works

### Hardware Setup (Real Robot)
1. Upload `hub_control.py` to your SPIKE Prime hub via code.pybricks.com
2. Keep the Pybricks website open and connected to your hub
3. Run the app and click "Connect to Pybricks Hub"
4. Use WASD keys for movement, QE/RF for arms

### Developer Mode (Simulation)
1. Enable Developer Mode in the app
2. Use the same controls to test with the realistic physics simulator
3. Watch your robot move with proper acceleration curves and momentum
4. Perfect your strategies before touching the real hardware

### Recording & Playback
1. Start recording while controlling your robot
2. Save successful runs with custom names
3. Play back any saved run to repeat perfect movements
4. Build a library of reliable competition runs

No setup headaches. No programming required. Just pure robot control.

---

## Technical Features

### Realistic Physics Simulation
- **S-curve motion profiles** with smooth acceleration/deceleration
- **Motor response lag** and **friction modeling**
- **Mass and inertia effects** for authentic robot behavior
- **Real-time physics** running at 50Hz for smooth movement

### Communication Architecture
```
PC App ←→ Pybricks Website ←→ Robot Hub
```
The Pybricks website acts as a communication bridge, enabling seamless control.

### Robot Configuration
- Configurable wheel diameter and axle track
- Adjustable motor ports and speed settings
- Custom acceleration and turn rate parameters
- Optimized for various FLL robot designs

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
You may view, download, and share the contents of this repository for personal and educational use only.  
No commercial use or redistribution is allowed.

[View Full License](https://creativecommons.org/licenses/by-nc-nd/4.0/)

---

## Open Source and Open to All

CodLess is an open-source project developed to make robotics education and competition preparation more accessible. Contributions, feedback, and ideas are welcome from the global FLL community.

**Built for teams, by teams. 🤖** 