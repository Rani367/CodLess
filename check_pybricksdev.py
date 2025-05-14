#!/usr/bin/env python3
"""
Utility script to check pybricksdev installation and report issues
"""

import sys
import importlib
import importlib.metadata
import subprocess
import os
import platform

# Import our adapter
import pybricks_adapter

def check_pybricksdev():
    print("=== PyBricksdev Installation Check ===")
    print(f"Python version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Executable: {sys.executable}")
    print("")
    
    # Get status from our adapter
    status = pybricks_adapter.get_status()
    print(f"Adapter status: {'Available' if status['available'] else 'Not available'}")
    print(f"Version: {status['version']}")
    
    if status["error"]:
        print(f"Error: {status['error']}")
    
    # Check the actual pybricksdev package
    try:
        import pybricksdev
        print(f"pybricksdev is installed: {pybricksdev.__file__}")
        
        # Check BLE module
        try:
            import pybricksdev.ble
            print("\nBLE module attributes:")
            for attr in dir(pybricksdev.ble):
                if not attr.startswith('__'):
                    print(f"- {attr}")
        except (ImportError, AttributeError) as e:
            print(f"BLE module issue: {str(e)}")
        
        # Check if package structure matches expectations
        print("\nPackage structure:")
        for item in dir(pybricksdev):
            if not item.startswith('__'):
                print(f"- {item}")
    
    except ImportError as e:
        print(f"pybricksdev is not installed: {str(e)}")
    
    # Try to list installed packages
    print("\nInstalled packages:")
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', 'list'], 
                               capture_output=True, text=True)
        packages = result.stdout.split('\n')
        for package in packages:
            if 'pybricksdev' in package.lower():
                print(package)
    except Exception as e:
        print(f"Could not list packages: {str(e)}")
    
    # Print Python path
    print("\nPython path:")
    for path in sys.path:
        print(f"- {path}")

if __name__ == "__main__":
    check_pybricksdev()
    
    print("\n=== Installation Instructions ===")
    print(pybricks_adapter.get_installation_instructions())
    
    input("\nPress Enter to exit...") 