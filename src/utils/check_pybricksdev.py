#!/usr/bin/env python3
"""
PyBricks Diagnostic Tool

This utility checks if pybricksdev is installed correctly and has BLE support.
"""

import importlib
import sys
import subprocess
import textwrap

def check_pybricksdev():
    """Check if pybricksdev is installed correctly."""
    try:
        import pybricksdev
        print(f"pybricksdev is installed, version: {getattr(pybricksdev, '__version__', 'unknown')}")
        
        # Check for ble module
        try:
            from pybricksdev import ble
            print("pybricksdev.ble module is available")
            
            # Check for specific functions
            functions_found = []
            if hasattr(ble, 'find_device'):
                functions_found.append('find_device')
            elif hasattr(ble, 'find_hub'):
                functions_found.append('find_hub')
                
            if hasattr(ble, 'connect_ble'):
                functions_found.append('connect_ble')
            elif hasattr(ble, 'BleakClient'):
                functions_found.append('BleakClient')
                
            # Check if we found appropriate functions
            if functions_found:
                print(f"Found required BLE functions: {', '.join(functions_found)}")
                return True
            else:
                print("Could not find required BLE functions in pybricksdev.ble")
                return False
        except ImportError:
            print("pybricksdev is installed but the BLE module is missing")
            return False
    except ImportError:
        print("pybricksdev is not installed")
        return False

def reinstall_pybricksdev():
    """Reinstall pybricksdev."""
    print("\nAttempting to reinstall pybricksdev...")
    try:
        subprocess.call([sys.executable, '-m', 'pip', 'uninstall', '-y', 'pybricksdev'])
        subprocess.call([sys.executable, '-m', 'pip', 'install', 'pybricksdev'])
        print("\nReinstallation completed. Please run this script again to verify.")
    except Exception as e:
        print(f"Error reinstalling pybricksdev: {e}")

def main():
    """Run the diagnostic check."""
    print("PyBricks Diagnostic Tool")
    print("=======================")
    
    if check_pybricksdev():
        print("\nThe pybricksdev library appears to be correctly installed!")
        print("CodLess should be able to connect to SPIKE Prime hubs.")
    else:
        print("\nThere are issues with the pybricksdev installation.")
        if input("Would you like to reinstall pybricksdev? (y/n): ").lower() == 'y':
            reinstall_pybricksdev()
        else:
            print(textwrap.dedent("""
                To resolve this issue manually:
                1. Uninstall pybricksdev: pip uninstall pybricksdev
                2. Reinstall pybricksdev: pip install pybricksdev
                3. Run this script again to verify
                
                If problems persist, you can still use CodLess in simulation mode.
            """))

if __name__ == '__main__':
    main() 