# CodLess™

[![GitHub stars](https://img.shields.io/github/stars/rani367/CodLess?style=social)](https://github.com/rani367/CodLess)
[![GitHub issues](https://img.shields.io/github/issues/rani367/CodLess)](https://github.com/rani367/CodLess/issues)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-deployed-brightgreen)](https://rani367.github.io/CodLess/)

**Visual programming for FLL teams**

CodLess™ is a web app for FIRST LEGO League teams that turns robot driving and simulation into repeatable programs. Pair a Pybricks-compatible LEGO hub over Web Bluetooth, record precise movements as named runs, and turn those runs into competition-ready Python you can run on the hub.

## [Live Demo – CodLess™](https://rani367.github.io/CodLess/)

---

## Features

- Connect to Pybricks-compatible LEGO hubs over Web Bluetooth (Chromium desktop)
- Optional Xbox controller drive for manual recording and teleop
- Record robot motion and save it as named runs
- Generate competition code that bundles your runs as functions
- Upload and run Python on the hub from the browser
- Real-time 2D simulator for testing without a robot
- Robot configuration for ports, wheel size, track width, and basic calibration
- Export and import runs for sharing or backup
- Offline-first PWA after the first load; saved runs stay in your browser
- Runs in the browser, no installation needed

---

## Quick Start

1. Open [CodLess™](https://rani367.github.io/CodLess/) in Chrome, Edge, or Opera on desktop (HTTPS required for Bluetooth)
2. Click **Connect to Pybricks Hub** to pair your hub
3. Configure robot ports and dimensions under **Configure Robot**
4. Optional: connect an Xbox controller for driving and recording
5. Use the **Robot Simulator** or drive the robot to record a run
6. Save the run with a name; it appears under **Saved Runs**
7. Replay runs, export Python, or **Upload & Run on Hub**

---

## How the app looks:

![Main Interface](screenshots/main-interface.png)  
*Control panel with recording options*

![2D Simulation](screenshots/robot-simulator.png)  
*Real-time 2D robot simulation for testing runs*

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
