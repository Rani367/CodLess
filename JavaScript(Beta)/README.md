# CodLess - FLL Robotics Control Center (JavaScript Web Version)

A modern web-based recreation of the FLL Robotics Control Center with all the functionality of the original Python application.

## 🚀 Features

### Core Functionality
- **Web Bluetooth Integration** - Connect directly to Pybricks-enabled SPIKE Prime hubs
- **Real-time Robot Control** - WASD movement controls and QE/RF arm controls
- **Visual Robot Simulator** - 2D canvas-based robot simulation with physics
- **Recording & Playback** - Record robot command sequences and replay them
- **Robot Calibration** - Automated calibration system for motor accuracy
- **Configuration Management** - Customizable robot parameters and motor ports

### Modern Web Features
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Beautiful UI** - Modern dark theme with gradients, shadows, and animations
- **Smooth Animations** - CSS transitions and hover effects throughout
- **Real-time Updates** - Live status display and simulator visualization
- **Local Storage** - Saved runs persist between sessions
- **File Upload** - Map image support for enhanced simulation

## 🎮 Controls

### Movement
- **W** - Move Forward
- **S** - Move Backward  
- **A** - Turn Left
- **D** - Turn Right

### Arms
- **Q** - Arm 1 Up
- **E** - Arm 1 Down
- **R** - Arm 2 Up
- **F** - Arm 2 Down

## 🔧 Setup Instructions

### 1. Prepare Your SPIKE Prime Hub

1. Visit [code.pybricks.com](https://code.pybricks.com)
2. Click the "Copy Hub Code" button in the web app
3. Paste the code into the Pybricks editor
4. Upload the code to your SPIKE Prime hub
5. Keep the Pybricks website open

### 2. Use the Web Application

1. Open `index.html` in a modern web browser
2. Click "Connect to Pybricks Hub" 
3. Select your hub when prompted
4. Run calibration for optimal performance
5. Start controlling your robot!

## 📱 Browser Compatibility

### Supported Browsers
- **Chrome 56+** (Recommended)
- **Edge 79+**
- **Opera 43+**
- **Samsung Internet 6.0+**

### Required Features
- Web Bluetooth API
- ES6+ JavaScript support
- Canvas 2D API
- Local Storage

## 🎯 Usage Guide

### Getting Started
1. **Enable Simulation Mode** - Toggle "Simulation Mode" to test without hardware
2. **Configure Robot** - Set up motor ports and physical dimensions
3. **Calibrate** - Run the automated calibration process
4. **Start Recording** - Begin capturing your robot commands
5. **Save & Replay** - Store runs and play them back later

### Configuration Options

#### Physical Parameters
- **Axle Track** - Distance between wheels (mm)
- **Wheel Diameter** - Wheel size (mm)
- **Motor Ports** - Assignment for left/right drive and arms

#### Movement Settings
- **Straight Speed** - Forward/backward speed (deg/s)
- **Turn Rate** - Rotation speed (deg/s)
- **Acceleration** - Motor acceleration values

### Recording Workflow
1. Set a descriptive run name
2. Click "Record Run" to start
3. Control your robot using keyboard
4. Click "Stop Recording" when finished
5. Click "Save Run" to store permanently

## 🔬 Technical Features

### Robot Simulation
- **Realistic Physics** - Motor lag, friction, and inertia modeling
- **Calibration Integration** - Compensation for hardware variations
- **Visual Feedback** - Real-time position and status display
- **Map Support** - Upload FLL maps for better visualization

### Bluetooth Communication
- **Web Bluetooth API** - Direct browser-to-hub communication
- **Command Queuing** - Reliable message delivery
- **Status Monitoring** - Connection state and hub feedback
- **Error Handling** - Robust connection management

### Data Management
- **Local Storage** - Persistent run and configuration data
- **JSON Format** - Human-readable data structures
- **Import/Export** - Easy backup and sharing
- **Version Control** - Timestamp tracking for all runs

## 🛠️ Development

### Architecture
- **Modular Classes** - Separate concerns for simulation, BLE, calibration
- **Event-Driven** - Responsive UI with proper event handling
- **Canvas Graphics** - Hardware-accelerated 2D rendering
- **Modern JavaScript** - ES6+ features throughout

### Code Structure
```
JavaScript(Beta)/
├── index.html          # Main application HTML
├── styles.css          # Modern CSS with animations
├── app.js             # Complete JavaScript application
└── README.md          # This documentation
```

### Key Classes
- **`FLLRoboticsApp`** - Main application controller
- **`RobotSimulator`** - Canvas-based robot visualization
- **`BLEController`** - Web Bluetooth communication
- **`CalibrationManager`** - Automated calibration system
- **`RobotConfig`** - Configuration data structure

## 🎨 Design Philosophy

### Modern Web Standards
- **CSS Grid & Flexbox** - Responsive layout system
- **CSS Variables** - Consistent theming
- **CSS Animations** - Smooth transitions and effects
- **Web APIs** - Native browser capabilities

### User Experience
- **Intuitive Interface** - Familiar desktop application feel
- **Visual Feedback** - Hover states, animations, status indicators
- **Error Prevention** - Disabled states and clear messaging
- **Progressive Enhancement** - Graceful degradation for older browsers

## 🔍 Troubleshooting

### Connection Issues
- Ensure Web Bluetooth is enabled in browser flags
- Verify Pybricks code is uploaded and running
- Check that hub is in pairing mode
- Try refreshing the page and reconnecting

### Performance Tips
- Use simulation mode for development and testing
- Upload smaller map images for better performance
- Clear saved runs periodically to free storage
- Close other Bluetooth applications

### Browser Support
- Chrome/Chromium browsers work best
- Enable "Experimental Web Platform Features" if needed
- Some features may not work in private/incognito mode
- Mobile support varies by device and browser

## 📈 Future Enhancements

### Planned Features
- Multiple robot support
- Advanced path planning
- Competition timer integration
- Remote collaboration features
- Enhanced debugging tools

### API Extensions
- RESTful web service integration
- Cloud storage synchronization
- Real-time multiplayer support
- Advanced analytics and metrics

## 📄 License

This project maintains the same license as the original Python application.

## 🤝 Contributing

Contributions welcome! Please maintain the modern web development standards and ensure cross-browser compatibility.

---

**Built with modern web technologies for the FLL robotics community** 🤖✨