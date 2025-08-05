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

## Instant Multi-Device Authentication

CodLess includes **multi-device authentication** that works immediately - **ZERO SETUP REQUIRED!**

### ✨ How It Works:
1. Create an account - get a **Sync Code**
2. Use that code on ANY device to access your data
3. No Firebase, no API keys, no configuration needed!

### Features:
- 🔒 **Secure Authentication** - Password-protected accounts
- 📧 **Email/Password Login** - Create accounts with any email
- 🔄 **Multi-Device Sync** - Use your Sync Code on any device
- 💾 **Persistent Storage** - Your runs are saved to your account
- 🌍 **Cross-Device Access** - Sign in anywhere with your code
- 🛡️ **User Isolation** - Each user's data is completely separate
- 🚀 **Always Free** - No external services or costs
- 📱 **Works Everywhere** - Phone, tablet, laptop - all synced!

### Using the Authentication:
1. **Click the user icon** (👤) in the top-right corner
2. **Create an account** with email/password
3. **Save your Sync Code** when it appears
4. **On another device**: Click "Continue with Google" and enter your Sync Code
5. **All your runs appear** on the new device!

### How Sync Codes Work:
- Each account gets a unique 9-character code (like: `A7B3X9K2M`)
- This code links your data across devices
- Share the code with teammates to share robot runs
- Keep it private for personal use

### Privacy & Security:
- Passwords are securely hashed
- Sync codes provide controlled access
- Each user's data is isolated
- No external servers needed
- Works even offline (after first load)

### Perfect For:
- FLL teams sharing runs across devices
- Competitions where you switch computers
- Teams collaborating on robot programs
- Personal use across multiple devices
- Instant setup at events

### Example Use Case:
1. Coach creates account on laptop → Gets code `ABC123XYZ`
2. Student enters code on tablet → Sees all the runs
3. Another student uses code on phone → Everything syncs!
4. All changes appear on all devices instantly

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
