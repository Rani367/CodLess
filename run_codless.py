#!/usr/bin/env python3
"""
CodLess Launcher
This script checks for required dependencies and launches the CodLess app.
"""

import os
import sys
import subprocess
import importlib.util
import importlib

REQUIRED_PACKAGES = {
    'tkinter': 'Included with Python (should be pre-installed)',
    'pillow': 'pip install pillow',
    'matplotlib': 'pip install matplotlib',
    'pybricksdev': 'pip install pybricksdev'
}

# File to store the fact that we've already done the dependency check
DEPENDENCY_CHECK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".dependency_check_done")

def check_dependency(package_name):
    """Check if a package is installed."""
    try:
        spec = importlib.util.find_spec(package_name)
        if spec is not None:
            # Extra check to ensure the package is actually importable
            importlib.import_module(package_name)
            return True
    except (ImportError, ModuleNotFoundError):
        pass
    return False
        
def check_pybricksdev_ble():
    """Specifically check if pybricksdev.ble module is available with the right functions."""
    if not check_dependency('pybricksdev'):
        return False, "pybricksdev is not installed"
    
    try:
        # Try to import the specific module and functions
        import pybricksdev.ble
        # We'll just check if it has any attributes; the adapter will handle specifics
        if hasattr(pybricksdev.ble, '__file__'):
            return True, "pybricksdev.ble module is available"
        else:
            return False, "pybricksdev.ble module exists but appears to be empty"
    except ImportError:
        return False, "pybricksdev is installed but the ble module is missing"
    except Exception as e:
        return False, f"Error checking pybricksdev.ble: {str(e)}"

def print_help():
    """Print help information about command-line options."""
    print("CodLess - SPIKE Prime Robot Navigation")
    print("======================================")
    print("Command-line options:")
    print("  --check-deps    Force dependency check even if already completed")
    print("  --simulation    Run in simulation mode (no actual Bluetooth connection)")
    print("  --force-real    Force real Bluetooth mode (will fail if pybricksdev doesn't work properly)")
    print("  --help          Display this help message")
    print("\nExamples:")
    print("  python run_codless.py --simulation    # Run in simulation mode")
    print("  python run_codless.py --force-real    # Require real Bluetooth, no simulation fallback")
    print("  python run_codless.py --check-deps    # Force dependency check")

def main():
    # Check for help request
    if "--help" in sys.argv or "-h" in sys.argv:
        print_help()
        return

    print("CodLess - SPIKE Prime Robot Navigation")
    print("======================================")
    
    # Process command-line flags
    simulation_flag = "--simulation" in sys.argv
    force_real_flag = "--force-real" in sys.argv
    check_deps_flag = "--check-deps" in sys.argv
    
    # Add help about the force-real flag
    if force_real_flag:
        print("Forcing real mode: App will fail if Bluetooth is unavailable")
    
    # Check if we've already done the dependency check and if the user wants to skip
    skip_check = False
    if os.path.exists(DEPENDENCY_CHECK_FILE) and not check_deps_flag:
        skip_check = True
        print("Skipping dependency check. Use '--check-deps' flag to force check.")
    
    if skip_check:
        pass  # Already printed the skip message
    else:
        # Check for all dependencies
        missing_packages = []
        for package, install_cmd in REQUIRED_PACKAGES.items():
            if package == 'tkinter':
                # Special case for tkinter which is part of standard library
                try:
                    import tkinter
                except ImportError:
                    missing_packages.append((package, install_cmd))
            elif package == 'pybricksdev':
                # We'll let the adapter handle pybricksdev issues
                if not check_dependency('pybricksdev'):
                    missing_packages.append((package, install_cmd))
            else:
                if not check_dependency(package):
                    missing_packages.append((package, install_cmd))
        
        # If dependencies are missing, offer to install them
        if missing_packages:
            print("\nSome dependencies are missing:")
            for package, install_cmd in missing_packages:
                print(f"  - {package} -> {install_cmd}")
            
            if input("\nWould you like to install them now? (y/n): ").lower() == 'y':
                for package, install_cmd in missing_packages:
                    if 'pip install' in install_cmd:
                        package_name = install_cmd.split()[2]  # Get just the package name
                        print(f"\nInstalling {package_name}...")
                        if package == 'pybricksdev':
                            # For pybricksdev, do a force reinstall
                            try:
                                subprocess.call([sys.executable, '-m', 'pip', 'uninstall', '-y', package_name])
                            except:
                                pass
                            subprocess.call([sys.executable, '-m', 'pip', 'install', '--force-reinstall', package_name])
                        else:
                            subprocess.call([sys.executable, '-m', 'pip', 'install', package_name])
                    else:
                        print(f"\nPlease install {package} manually: {install_cmd}")
            else:
                print("\nPlease install the missing dependencies before running CodLess.")
                return
        
        # Mark that we've done the dependency check
        with open(DEPENDENCY_CHECK_FILE, "w") as f:
            f.write("Dependency check completed.")
    
    # Import our pybricks adapter to configure mode
    try:
        import pybricks_adapter
        
        # Handle simulation mode
        if simulation_flag:
            print("\nEnabling simulation mode as requested...")
            pybricks_adapter.enable_simulation_mode()
        elif force_real_flag:
            # Make absolutely sure we're in real mode
            print("\nForcing real Bluetooth mode (will not fall back to simulation)...")
            if not pybricks_adapter.disable_simulation_mode():
                print("ERROR: Could not initialize pybricksdev in real mode")
                print(f"Reason: {pybricks_adapter.api_error}")
                print("\nPlease reinstall pybricksdev or use --simulation flag if you want to continue")
                return
        
        # Get status after configuration
        status = pybricks_adapter.get_status()
        
        if status.get("simulation_mode", False):
            print("\n===== NOTICE: SIMULATION MODE =====")
            print("CodLess is running in simulation mode.")
            print("In this mode, Bluetooth connections are simulated.")
            print("You will be able to use all app features, but actual robot control won't work.")
            print("This is useful for testing and planning robot paths.")
            print("====================================\n")
        else:
            print("\nRunning in real mode - Bluetooth connections will be actual.")
    except ImportError as e:
        print(f"ERROR: Failed to import pybricks_adapter module: {e}")
        return
    
    # Run the app
    print("\nStarting CodLess app...")
    try:
        from codless_app import CodLessApp
        app = CodLessApp()
        app.mainloop()
    except Exception as e:
        print(f"ERROR: Failed to start CodLess app: {e}")
        return

if __name__ == "__main__":
    main() 