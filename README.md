# CodLess FLL Robotics Control Center v3.0.0

A professional, feature-rich robotics control and simulation platform for FIRST LEGO League (FLL) competitions. This web-based application provides advanced robot control, recording/playback functionality, real-time simulation, and comprehensive calibration tools.

![CodLess Robotics Banner](assets/banner.png)

## ✨ Features

### 🤖 Robot Control
- **Bluetooth LE connectivity** to Pybricks-compatible hubs
- **🚀 Direct code upload and execution** - Upload your competition code wirelessly to the hub and run it instantly
- **Real-time robot control** with keyboard input
- **Advanced calibration system** for precision movement
- **Emergency stop functionality** for safety
- **Comprehensive motor configuration** for drive and attachment motors

### 🎮 Simulation & Visualization
- **Real-time 3D robot simulator** with physics
- **Interactive camera controls** (pan, zoom)
- **Background map support** for field layouts
- **Movement trail visualization**
- **Performance monitoring** (FPS, latency)
- **Obstacle detection and avoidance simulation**

### 📹 Recording & Playback
- **High-precision command recording** with timing
- **Run management system** with save/load functionality
- **Export/import capabilities** for sharing runs
- **Pause and resume recording**
- **Command sequence visualization**

### ⚙️ Configuration & Calibration
- **Intuitive configuration interface** for robot parameters
- **Automated calibration routines** for optimal performance
- **Motor port mapping** and validation
- **Movement parameter tuning**
- **Calibration confidence scoring**

### 🌐 Progressive Web App (PWA)
- **Offline functionality** with service worker caching
- **Installable on desktop and mobile devices**
- **Background sync** for data persistence
- **Push notifications** (future feature)
- **Responsive design** for all screen sizes

### 🛠️ Developer Tools
- **Comprehensive logging system** with export capabilities
- **Real-time performance monitoring**
- **Debug mode** with detailed diagnostics
- **Toast notification system** for user feedback
- **Accessibility compliance** (WCAG 2.1)

## 🚀 Getting Started

### Prerequisites
- Modern web browser with Web Bluetooth API support (Chrome 56+, Edge 79+)
- Pybricks-compatible LEGO hub (SPIKE Prime, Robot Inventor, etc.)
- HTTPS connection (required for Web Bluetooth)

### Installation

#### Option 1: Local Development
```bash
# Clone the repository
git clone https://github.com/codless-robotics/fll-control-center.git
cd fll-control-center/JavaScript

# Serve the application (HTTPS required for Bluetooth)
# Using Python 3:
python -m http.server 8000 --bind 127.0.0.1

# Using Node.js (with http-server):
npx http-server -p 8000 -a 127.0.0.1 --ssl

# Access at https://localhost:8000
```

#### Option 2: GitHub Pages (Recommended)
Visit the live application at: [https://codless-robotics.github.io/fll-control-center/](https://codless-robotics.github.io/fll-control-center/)

#### Option 3: Install as PWA
1. Visit the application in a supported browser
2. Click the "Install" button in the address bar
3. The app will be installed as a desktop/mobile application

### Hub Setup

1. **Flash Pybricks firmware** to your LEGO hub following the [official Pybricks installation guide](https://pybricks.com/install/)
2. **Download the competition code** from the application (use the "Download Competition Code" button), OR **upload directly to your hub** (use the "Upload & Run on Hub" button)
3. **If downloaded**: Upload the .py file to your hub using any MicroPython editor or the Pybricks desktop app
4. **If uploaded directly**: The code will automatically start running on your connected hub
4. **Connect to the hub** using the application's Bluetooth connection feature

## 🎯 Usage Guide

### Basic Operation

1. **Connect Your Hub**
   - Enable Bluetooth on your device
   - Click "Connect to Pybricks Hub" 
   - Select your hub from the device list
   - Wait for connection confirmation

2. **Configure Your Robot**
   - Click "Configure Robot" to open settings
   - Set motor ports and physical parameters
   - Adjust movement speeds and accelerations
   - Save your configuration

3. **Calibrate for Precision** (Recommended)
   - Navigate to the Calibration tab in configuration
   - Click "Start Calibration"
   - Follow the automated calibration routine
   - Review calibration results and confidence scores

4. **Control Your Robot**
   - Use keyboard controls (WASD for movement, QERF for arms)
   - Hold Space bar for emergency stop
   - Monitor robot status in real-time

### Recording & Playback

1. **Record a Run**
   - Enter a descriptive name for your run
   - Click "Record Run" to start recording
   - Perform your robot sequence
   - Click "Stop Recording" when finished
   - Save the run for future use

2. **Play Back Runs**
   - Select a saved run from the dropdown
   - Click "Play" to execute the sequence
   - Monitor execution in real-time
   - Stop or pause playback as needed

### Simulation Mode

1. **Enable Developer Mode**
   - Check "Simulation Mode" to enable the simulator
   - Use all controls without a physical robot
   - Perfect for testing and training

2. **Simulator Features**
   - Upload field maps as backgrounds
   - View real-time robot position and orientation
   - Monitor arm positions and movements
   - Reset robot position when needed

## ⌨️ Keyboard Controls

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `W` | Move Forward | `Q` | Arm 1 Up |
| `S` | Move Backward | `E` | Arm 1 Down |
| `A` | Turn Left | `R` | Arm 2 Up |
| `D` | Turn Right | `F` | Arm 2 Down |
| `Space` | Emergency Stop | `Esc` | Close Modals |

*Hold multiple keys for combined movements (e.g., W+D for forward-right)*

## 🔧 Configuration Options

### Physical Parameters
- **Axle Track**: Distance between drive wheels (50-300mm)
- **Wheel Diameter**: Diameter of drive wheels (20-100mm)
- **Motor Ports**: Assignment of motors to hub ports (A-D)

### Movement Settings
- **Straight Speed**: Maximum forward/backward speed (100-1000 deg/s)
- **Straight Acceleration**: Acceleration for linear movement (50-500 deg/s²)
- **Turn Rate**: Maximum rotation speed (50-400 deg/s)
- **Turn Acceleration**: Acceleration for rotation (100-600 deg/s²)

### Advanced Settings
- **Command Timeout**: Maximum time to wait for command response (100-5000ms)
- **Battery Warning**: Low battery alert threshold (5-50%)
- **Auto-save**: Automatically save configuration and runs
- **Debug Mode**: Enable detailed logging and diagnostics

## 🛡️ Safety Features

- **Emergency Stop**: Immediate halt of all robot movement
- **Connection Monitoring**: Automatic detection of hub disconnection
- **Battery Monitoring**: Low battery warnings and status display
- **Command Validation**: Prevention of invalid or dangerous commands
- **Timeout Protection**: Automatic stop if communication is lost

## 🔬 Calibration System

The advanced calibration system improves robot accuracy through automated measurement and compensation:

### Calibration Measurements
1. **Motor Delay**: Response time compensation
2. **Straight Tracking**: Drift correction for straight-line movement
3. **Turn Bias**: Rotation accuracy adjustment
4. **Motor Balance**: Left/right motor power balancing
5. **Gyro Drift**: Sensor drift compensation

### Confidence Scoring
Each calibration measurement includes a confidence score (0-100%) indicating the reliability of the measurement. Higher confidence scores result in more aggressive compensation.

## 🌐 Browser Compatibility

| Browser | Version | Bluetooth | PWA | Notes |
|---------|---------|-----------|-----|-------|
| Chrome | 56+ | ✅ | ✅ | Recommended |
| Edge | 79+ | ✅ | ✅ | Full support |
| Firefox | - | ❌ | ✅ | Simulation only |
| Safari | - | ❌ | ✅ | Simulation only |

*Web Bluetooth API support is required for physical robot connection*

## 📱 Mobile Support

The application is fully responsive and supports mobile devices:
- **Touch Controls**: Tap-based interface for mobile users
- **Mobile Installation**: Install as a mobile app via PWA
- **Responsive Design**: Optimized layout for all screen sizes
- **Gesture Support**: Pinch-to-zoom in simulator view

## 🔒 Privacy & Security

- **Local Storage**: All data stored locally on your device
- **No Tracking**: No analytics or user tracking
- **Secure Connection**: HTTPS required for all features
- **Data Export**: Full control over your data with export options

## 🛠️ Development

### Project Structure
```
JavaScript/
├── index.html          # Main application interface
├── app.js             # Core application logic
├── styles.css         # Application styling
├── manifest.json      # PWA configuration
├── sw.js             # Service worker for offline support
├── README.md         # This documentation
└── assets/           # Images and icons
```

### Key Components
- **FLLRoboticsApp**: Main application class
- **BLEController**: Bluetooth communication handler
- **RobotSimulator**: Physics-based robot simulation
- **RobotConfig**: Configuration management
- **ToastManager**: User notification system
- **Logger**: Comprehensive logging system
- **PerformanceMonitor**: Real-time performance tracking

### Building & Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Code Standards
- **ES6+ JavaScript** with strict mode
- **Comprehensive error handling** with try-catch blocks
- **Accessibility compliance** with ARIA labels
- **Responsive design** with mobile-first approach
- **Performance optimization** with efficient algorithms

## 📖 API Documentation

### Robot Command Structure
```javascript
// Drive command
{
  type: "drive",
  speed: 200,        // -1000 to 1000 (deg/s)
  turn_rate: 100     // -1000 to 1000 (deg/s)
}

// Arm command
{
  type: "arm1",      // or "arm2"
  speed: 150         // -1000 to 1000 (deg/s)
}

// Emergency stop
{
  type: "emergency_stop"
}
```

### Event System
```javascript
// Subscribe to events
app.on('robotConnected', (data) => {
  console.log(`Connected to ${data.deviceName}`);
});

app.on('calibrationComplete', (results) => {
  console.log('Calibration finished:', results);
});
```

## 🤝 Support & Community

- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/codless-robotics/fll-control-center/issues)
- **Discussions**: Join the community at [GitHub Discussions](https://github.com/codless-robotics/fll-control-center/discussions)
- **Documentation**: Complete guides at [docs.codless-robotics.com](https://docs.codless-robotics.com)
- **Discord**: Real-time chat at [discord.gg/codless-robotics](https://discord.gg/codless-robotics)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Pybricks Team** for the excellent MicroPython platform
- **LEGO Education** for the excellent SPIKE Prime and Robot Inventor platforms
- **FIRST LEGO League** for inspiring robotics education
- **Open Source Community** for tools and libraries used
- **Community Contributors** who helped refine the application

---

## 📝 Changelog

### Version 3.0.0 (Latest)
- **🎉 Stable Release**: Removed "Beta" designation - this is now a production-ready application
- **🔧 Enhanced Browser Compatibility**: Improved Web Bluetooth API error handling with user-friendly messages
- **🌐 HTTPS Requirements**: Added proactive checks for secure context (HTTPS) requirements
- **🔄 Improved Connection Reliability**: Added exponential backoff for connection retries
- **💡 Troubleshooting Assistant**: Automatic troubleshooting help after connection failures
- **🐛 Bug Fixes**: 
  - Fixed "not available in browser" error with better error messages
  - Added browser compatibility warnings on app startup
  - Improved handling of Bluetooth permission denied scenarios
  - Enhanced error messages for various connection failure scenarios
- **📱 Updated UI**: Better connection status indicators for unsupported browsers
- **🔒 Security**: Enhanced secure context validation for all Bluetooth operations

---

<div align="center">

**Made with ❤️ for the FLL Community**

[Website](https://codless-robotics.com) • [Documentation](https://docs.codless-robotics.com) • [Community](https://discord.gg/codless-robotics)

*Empowering the next generation of robotics engineers*

</div>