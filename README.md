# CodLess

[![GitHub stars](https://img.shields.io/github/stars/rani367/CodLess?style=social)](https://github.com/rani367/CodLess)
[![GitHub issues](https://img.shields.io/github/issues/rani367/CodLess)](https://github.com/rani367/CodLess/issues)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-deployed-brightgreen)](https://rani367.github.io/CodLess/)

**Visual programming for FLL teams**

CodLess is a web-based tool that helps FIRST LEGO League teams program their robots without writing complex code. You can connect your LEGO hub, record movements, save them as reusable runs, and use them during competitions.

**🔐 New: Secure Cloud Storage** - Sign in with email or Google to save your robot runs to the cloud, access them from any device, and collaborate with your team!

## [Live Demo](https://rani367.github.io/CodLess/)

---

## Features

- Connect to Pybricks-compatible LEGO hubs using Bluetooth
- Record robot movements and save them as named runs
- Upload and run Python code directly on the hub
- Real-time 2D simulation of robot movements
- Motor calibration for accurate control
- Export and import saved runs
- Works offline after the first load
- Runs in the browser, no installation needed
- **🔐 Secure Authentication**: Sign in with email/password or Google account
- **☁️ Cloud Storage**: Save runs to the cloud and access from any device
- **🔄 Real-time Sync**: Changes automatically sync across all your devices
- **🔒 Private & Secure**: Your data is encrypted and only accessible by you

---

## Quick Start

1. Open [CodLess](https://rani367.github.io/CodLess/) in Chrome, Edge, or Opera
2. Click **Connect Robot** to pair with your Pybricks hub
3. Configure motor ports in the settings
4. Record movements using the control panel
5. Save runs with custom names for later use
6. Replay runs or export them as Python code

---

## How the app looks:

![Main Interface](screenshots/main-interface.png)  
*Control panel with recording options*

![2D Simulation](screenshots/robot-simulator.png)  
*Real-time 2D robot simulation for testing runs*

---

## Authentication System

CodLess includes a **ready-to-use authentication system** with no setup required! 

### Features:
- ✅ **Instant Setup** - Works immediately, no configuration needed
- 📧 **Email/Password Login** - Create an account with your email
- 🔐 **Google Sign-in** - One-click login with Google account  
- ☁️ **Cloud Storage** - Your runs are saved to the cloud automatically
- 🔄 **Multi-device Sync** - Access your runs from any device
- 🚀 **Free to Use** - Using Firebase's generous free tier

### How to Use:
1. Click the user icon in the top-right corner
2. Sign up with email or Google
3. Your runs will automatically sync to the cloud
4. Sign in on any device to access your saved runs

### Note for High-Traffic Deployments:
The default configuration uses a shared Firebase project. For production deployments with many users, you may want to create your own Firebase project following the [Firebase Setup Guide](FIREBASE_SETUP.md).

---

## Contributing

We welcome contributions from the FLL community:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Open a pull request

Please follow the existing style and add clear documentation for new features.

---

## License

This project is licensed under the terms in the [LICENSE](LICENSE) file.
