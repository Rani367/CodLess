# CodLess C++ - Robot Control Platform

A modern C++20 implementation of the CodLess robot control platform with Qt6 GUI framework.

## Features

- **Real-time keyboard control** with WASD movement + QE/RF arm controls
- **Direct Bluetooth communication** with LEGO SPIKE Prime hubs via Pybricks
- **Record & replay system** for saving and perfecting robot runs
- **Advanced physics simulator** with realistic motor dynamics, S-curve acceleration, and inertia
- **Developer mode** for testing without hardware
- **Robot configuration** for different wheel sizes, motor ports, and performance settings
- **Modern dark theme interface** with real-time status monitoring

## System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **Compiler**: GCC 10+, Clang 12+, or MSVC 2019+
- **C++ Standard**: C++20 or later
- **Qt Version**: Qt6.2 or later
- **CMake**: 3.25 or later
- **Bluetooth**: Bluetooth Low Energy (BLE) support
- **Hardware**: LEGO SPIKE Prime hub with Pybricks firmware

## Building from Source

### Prerequisites

Install the required dependencies:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install build-essential cmake git
sudo apt install qt6-base-dev qt6-bluetooth-dev qt6-serialport-dev
```

**macOS:**
```bash
brew install cmake qt6
```

**Windows:**
- Install Visual Studio 2019 or later
- Install Qt6 from qt.io
- Install CMake from cmake.org

### Clone and Build

```bash
git clone https://github.com/your-repo/codless-cpp.git
cd codless-cpp/cpp
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### Build Options

Configure the build with CMake options:

```bash
# Release build
cmake -DCMAKE_BUILD_TYPE=Release ..

# Debug build with verbose output
cmake -DCMAKE_BUILD_TYPE=Debug -DVERBOSE_LOGGING=ON ..

# Build with testing
cmake -DBUILD_TESTING=ON ..
```

## Installation

### From Build Directory

```bash
make install
```

### Package Installation

Create platform-specific packages:

```bash
# Linux AppImage
make appimage

# macOS DMG
make dmg

# Windows Installer
make installer
```

## Usage

### Basic Operation

1. **Launch the application**
   ```bash
   ./CodLess
   ```

2. **Connect your robot** (Real Hardware Mode)
   - Upload `hub_control.py` to your SPIKE Prime hub via code.pybricks.com
   - Keep the Pybricks website open and connected
   - Click "Connect Hub" in the application
   - Use WASD keys for movement, QE/RF for arms

3. **Developer Mode** (Simulation Only)
   - Enable "Developer Mode" in the sidebar
   - Use the same controls to test with the physics simulator
   - Perfect your strategies before using real hardware

### Keyboard Controls

- **W/S**: Forward/Backward movement
- **A/D**: Left/Right turning
- **Q/E**: Arm 1 control (up/down)
- **R/F**: Arm 2 control (up/down)
- **SPACE**: Emergency stop

### Recording & Playback

1. **Start Recording**: Click "Start Recording" before controlling your robot
2. **Stop Recording**: Click "Stop Recording" when finished
3. **Save Run**: Click "Save Run" to save with a custom name
4. **Play Run**: Select a saved run and click "Play Run"

### Robot Configuration

Access the configuration dialog to adjust:
- Wheel diameter and axle track
- Motor port assignments
- Speed and acceleration settings
- Advanced motion parameters

## Project Structure

```
cpp/
├── CMakeLists.txt          # Build configuration
├── README.md              # This file
├── src/                   # Source files
│   ├── main.cpp          # Application entry point
│   ├── core/             # Core data structures
│   │   ├── robot_config.cpp
│   │   └── recorded_command.cpp
│   ├── sim/              # Physics simulation
│   │   └── robot_simulator.cpp
│   ├── hardware/         # Hardware communication
│   │   └── ble_controller.cpp
│   ├── gui/              # User interface
│   │   ├── main_window.cpp
│   │   └── config_dialog.cpp
│   └── utils/            # Utility functions
│       └── json_utils.cpp
├── include/              # Header files
│   ├── core/
│   ├── sim/
│   ├── hardware/
│   ├── gui/
│   └── utils/
├── resources/            # Application resources
│   ├── icons/
│   └── fonts/
└── hub_control.py        # SPIKE Prime hub code
```

## Physics Simulation

The simulator implements realistic robot physics:

- **S-curve motion profiles** with smooth acceleration/deceleration
- **Motor response lag** and **friction modeling**
- **Mass and inertia effects** for authentic robot behavior
- **Real-time physics** running at 50Hz (20ms intervals)

### Physics Parameters

```cpp
// Robot physical properties
const double robotMass = 2.5;        // kg
const double robotInertia = 0.12;    // kg⋅m²
const double armInertia = 0.05;      // kg⋅m²

// Motor constraints
const double maxDriveAccel = 800.0;  // mm/s²
const double maxTurnAccel = 600.0;   // °/s²
const double maxArmAccel = 1000.0;   // mm/s²

// Environmental factors
const double frictionCoeff = 0.05;   // Friction coefficient
const double motorLag = 0.03;       // Motor response lag (s)
```

## Communication Protocol

### Bluetooth Low Energy (BLE)

The application communicates with SPIKE Prime hubs using:
- **Service UUID**: Custom Pybricks service
- **Characteristic UUID**: `c5f50002-8280-46da-89f4-6d8051e4aeef`
- **Protocol**: JSON commands over BLE

### Command Format

```json
{
  "type": "drive",
  "speed": 200,
  "turn_rate": 100
}
```

### Response Format

```json
{
  "status": "ok",
  "message": "DRIVE_OK"
}
```

## Development

### Code Style

- Follow C++ Core Guidelines
- Use modern C++20 features
- RAII for resource management
- Smart pointers for memory management
- Consistent naming conventions

### Testing

Run the test suite:

```bash
cd build
make test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Debugging

Enable debug output:

```bash
./CodLess --debug --verbose
```

Set Qt logging rules:

```bash
export QT_LOGGING_RULES="*.debug=true"
```

## Troubleshooting

### Build Issues

**CMake version too old:**
```bash
# Install newer CMake
pip install cmake --upgrade
```

**Qt6 not found:**
```bash
# Set Qt6 path
export CMAKE_PREFIX_PATH=/path/to/qt6
```

**Missing Bluetooth headers:**
```bash
# Install Bluetooth development packages
sudo apt install libbluetooth-dev
```

### Runtime Issues

**BLE connection fails:**
- Ensure Bluetooth is enabled
- Check hub is in pairing mode
- Verify Pybricks firmware is installed

**Physics simulation stutters:**
- Check CPU usage
- Reduce window size
- Close other applications

**Application crashes:**
- Run with debug symbols
- Check system requirements
- Update graphics drivers

## Performance Optimization

### Compiler Flags

```bash
# Release build with optimizations
cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-O3 -march=native" ..
```

### Runtime Optimizations

- Enable hardware acceleration
- Use dedicated graphics card
- Increase thread priority
- Disable Windows Game Mode

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.

You may view, download, and share the contents of this repository for personal and educational use only. No commercial use or redistribution is allowed.

[View Full License](https://creativecommons.org/licenses/by-nc-nd/4.0/)

## Acknowledgments

- Qt framework for cross-platform GUI
- Pybricks for SPIKE Prime integration
- LEGO Education for hardware platform
- FLL community for inspiration and feedback

## Contact

For questions, issues, or contributions:
- GitHub Issues: [Project Issues](https://github.com/your-repo/codless-cpp/issues)
- Email: support@codless.app
- Documentation: [Wiki](https://github.com/your-repo/codless-cpp/wiki)

---

**Built for teams, by teams. 🤖** 