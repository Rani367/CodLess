# CodLess Developer Guide

This document provides information for developers who want to extend or modify the CodLess application.

## Architecture

The application is built using:

- **Tkinter**: For the graphical user interface
- **Matplotlib**: For the interactive map and waypoint visualization
- **PyBricksdev**: For Bluetooth communication with SPIKE Prime hubs

## Key Components

- **codless_app.py**: Main application code containing the UI and core functionality
- **pybricks_adapter.py**: Adapter for PyBricksdev that handles different API versions
- **run_codless.py**: Launcher script that handles dependencies
- **check_pybricksdev.py**: Diagnostic utility for checking PyBricksdev installation

## PyBricksdev Integration

The application is designed to work with different versions of the PyBricksdev library:

1. The `pybricks_adapter.py` module abstracts away PyBricksdev API details
2. It provides consistent function interfaces regardless of underlying PyBricksdev version
3. It handles API changes gracefully by adapting to available functions

### Current Status

The PyBricksdev library is in active development and its API may change. Common issues include:

- Function name changes (e.g., `connect` might be renamed to `connect_device`)
- Module structure changes
- Signature changes in functions

Our adapter is designed to:
- Detect and adapt to these changes when possible
- Provide detailed diagnostics when issues occur
- Guide users to fix installation problems

## Extending the App

### Adding New Features

To add new features to the application:

1. Review the existing code to understand the structure
2. Add new UI elements to the appropriate tab in `codless_app.py`
3. Implement any new functionality following the existing patterns
4. Update documentation as needed

### Working with PyBricksdev

When working with PyBricksdev:

1. Always use the adapter functions in `pybricks_adapter.py`
2. Add new adapter functions if you need additional PyBricksdev functionality
3. Handle errors gracefully and provide clear user feedback

### Testing

Before distributing changes:

1. Test on different platforms (Windows, macOS, Linux)
2. Test with different Python versions
3. Test with different versions of PyBricksdev
4. Run the diagnostic tool (`check_pybricksdev.py`)

## Resources

- [PyBricksdev GitHub Repository](https://github.com/pybricks/pybricksdev)
- [PyBricks Documentation](https://pybricks.com/) 