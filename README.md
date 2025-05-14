# CodLess - SPIKE Prime Robot Navigation

A desktop application that allows you to plan and control SPIKE Prime robot navigation paths.

## Features

- Connect to SPIKE Prime hub via Bluetooth
- Plan robot navigation paths by clicking on a custom map
- Configure robot parameters (wheel diameter and axle track)
- Save and load multiple route plans
- Visualize robot paths with waypoints
- Import/export routes for sharing

## Running the Application

To run the application:

```bash
python run_codless.py
```

### Command-Line Options

The application supports several command-line options:

- `--check-deps`: Force dependency check even if already completed
- `--simulation`: Run in simulation mode (no actual Bluetooth connection)
- `--force-real`: Force real Bluetooth mode (will fail if Bluetooth isn't working properly)
- `--help`: Display help information

Examples:
```bash
python run_codless.py --simulation   # Run in simulation mode
python run_codless.py --force-real   # Require real Bluetooth, no simulation fallback
```

## Modes

### Real Mode (Default)

By default, CodLess runs in real mode, which attempts to establish actual Bluetooth connections with SPIKE Prime hubs. This mode requires:

- Working pybricksdev installation
- Bluetooth enabled on your computer
- SPIKE Prime hub turned on and within range

### Simulation Mode

If you want to plan robot paths without a physical hub or if you're having issues with Bluetooth connectivity, you can use simulation mode:

```bash
python run_codless.py --simulation
```

In simulation mode, all Bluetooth operations are simulated, allowing you to:
- Test the application interface
- Plan and save robot paths
- Practice using the application

## Requirements

- Python 3.x
- Tkinter (included with Python)
- Pillow (PIL)
- Matplotlib
- pybricksdev

The application will check for required dependencies on first run and offer to install them if missing.

## Troubleshooting

If you're having issues with Bluetooth connectivity:

1. Make sure Bluetooth is enabled on your computer
2. Ensure your SPIKE Prime hub is turned on and within range
3. Try reinstalling pybricksdev: `pip install --force-reinstall pybricksdev`
4. Use simulation mode (`--simulation`) if you need to work without a physical hub

---

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.  
You may view, download, and share the contents of this repository for personal and educational use only.  
No commercial use or redistribution is allowed.

[View Full License](https://creativecommons.org/licenses/by-nc-nd/4.0/)

---

## Open Source and Open to All

CodLess is an open-source project developed to make robotics education more accessible. Contributions, feedback, and ideas are welcome.
