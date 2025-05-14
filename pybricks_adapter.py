"""
PyBricks Adapter Module

This module provides a consistent interface to pybricksdev functionality,
adapting to different API versions.
"""

import sys
import asyncio
import random
import time

# API status and error tracking
api_available = False
api_error = None
find_device_func = None
connect_func = None
pybricksdev_version = "unknown"

# Simulation mode - will be enabled if pybricksdev doesn't work correctly
simulation_mode = False
force_real_mode = True  # New flag to force real mode and disable simulation

# Mock device class for simulation
class MockBLEDevice:
    def __init__(self, name, address):
        self.name = name
        self.address = address
        self.rssi = -60
        
    def __str__(self):
        return f"MockBLEDevice(name={self.name}, address={self.address})"

async def simulate_find_devices():
    """Simulate finding devices for testing"""
    # Simulate a delay as if scanning
    await asyncio.sleep(2)
    
    # Create mock devices
    devices = [
        MockBLEDevice("SPIKE Prime Hub", "00:11:22:33:44:55"), 
        MockBLEDevice("LEGO Technic Hub", "66:77:88:99:AA:BB")
    ]
    
    # Sometimes return no devices to simulate hub being off
    if random.random() < 0.3:  # 30% chance of no devices
        return []
        
    return devices

async def simulate_connect(device):
    """Simulate connecting to a device"""
    # Simulate a delay as if connecting
    await asyncio.sleep(1.5)
    
    # Simulate a connection failure 
    if random.random() < 0.2:  # 20% chance of failing
        raise RuntimeError("Simulated connection failure")
        
    return True

def initialize_pybricksdev():
    """
    Initialize the pybricksdev API and set up adapter functions.
    Returns True if successful, False otherwise.
    """
    global api_available, api_error, find_device_func, connect_func, pybricksdev_version, simulation_mode
    
    # First attempt the real pybricksdev
    try:
        import pybricksdev
        
        # Get version info if available
        try:
            from pybricksdev.__version__ import __version__ as version
            pybricksdev_version = version
            print(f"Imported pybricksdev version: {pybricksdev_version}")
        except (ImportError, AttributeError):
            print("Could not determine pybricksdev version")
        
        # Check for BLE module
        try:
            import pybricksdev.ble
            print(f"Available BLE module attributes: {dir(pybricksdev.ble)}")
            
            # Find device function - we need this for discovery
            device_found = False
            if hasattr(pybricksdev.ble, 'find_device'):
                find_device_func = pybricksdev.ble.find_device
                device_found = True
            elif hasattr(pybricksdev.ble, 'discover_devices'):
                find_device_func = pybricksdev.ble.discover_devices
                device_found = True
            elif hasattr(pybricksdev.ble, 'BleakScanner') and hasattr(pybricksdev.ble, 'BLEDevice'):
                # Create a find_device function using BleakScanner directly
                async def bleak_find_devices():
                    print("Using BleakScanner for device discovery")
                    scanner = pybricksdev.ble.BleakScanner()
                    devices = await scanner.discover()
                    return list(devices)
                find_device_func = bleak_find_devices
                device_found = True
            
            if not device_found and force_real_mode:
                api_error = "Required device discovery function missing in pybricksdev.ble"
                return False
            elif not device_found:
                # Fall back to simulation only if not forcing real mode
                find_device_func = simulate_find_devices
                api_error = "Required find_device function missing, using simulation"
                simulation_mode = True
            
            # Connect function - this is where the issue was
            connect_found = False
            
            # Check for standard connect functions first
            if hasattr(pybricksdev.ble, 'connect'):
                connect_func = pybricksdev.ble.connect
                connect_found = True
            elif hasattr(pybricksdev.ble, 'connect_device'):
                connect_func = pybricksdev.ble.connect_device
                connect_found = True
            elif hasattr(pybricksdev.ble, 'connect_by_name'):
                async def connect_adapter(device):
                    return await pybricksdev.ble.connect_by_name(device.name)
                connect_func = connect_adapter
                connect_found = True
            
            # If standard functions not found, try BleakClient approach
            elif hasattr(pybricksdev.ble, 'BleakClient'):
                print("Using BleakClient for connection")
                async def bleak_connect(device):
                    try:
                        client = pybricksdev.ble.BleakClient(device.address if hasattr(device, 'address') else device)
                        await client.connect()
                        return client
                    except Exception as e:
                        print(f"BleakClient connection error: {e}")
                        raise
                
                connect_func = bleak_connect
                connect_found = True
            
            # Check for BLEConnection class
            elif hasattr(pybricksdev.ble, 'BLEConnection'):
                print("Using BLEConnection for connection")
                async def connection_adapter(device):
                    try:
                        conn = pybricksdev.ble.BLEConnection()
                        if hasattr(device, 'address'):
                            await conn.connect(device.address)
                        else:
                            await conn.connect(device)
                        return conn
                    except Exception as e:
                        print(f"BLEConnection error: {e}")
                        raise
                
                connect_func = connection_adapter
                connect_found = True
                
            # If none found, handle based on force_real_mode
            if not connect_found and force_real_mode:
                api_error = "Required connect function missing in pybricksdev.ble"
                return False
            elif not connect_found:
                # Fall back to simulation only if not forcing real mode
                connect_func = simulate_connect
                if not simulation_mode:
                    api_error = "Required connect function missing, using simulation"
                    simulation_mode = True
            
            # If we have real functions, mark as available
            if not simulation_mode:
                api_available = True
                api_error = None
                return True
            else:
                if force_real_mode:
                    # Don't allow simulation mode if forcing real mode
                    api_available = False
                    return False
                    
                api_available = True  # Simulation is still "available"
                print("WARNING: Using simulation mode for Bluetooth functions")
                return True
                
        except (ImportError, AttributeError) as e:
            api_error = f"Found pybricksdev but couldn't initialize BLE module: {str(e)}"
            if force_real_mode:
                # Don't allow simulation mode if forcing real mode
                return False
                
            # Fall back to simulation
            simulation_mode = True
            find_device_func = simulate_find_devices
            connect_func = simulate_connect
            api_available = True  # Simulation is still "available"
            print(f"WARNING: {api_error}")
            print("Using simulation mode for Bluetooth functions")
            return True
            
    except ImportError as e:
        api_error = f"Could not import pybricksdev: {str(e)}"
        if force_real_mode:
            # Don't allow simulation mode if forcing real mode
            return False
            
        # Fall back to simulation
        simulation_mode = True
        find_device_func = simulate_find_devices
        connect_func = simulate_connect
        api_available = True  # Simulation is still "available"
        print(f"WARNING: {api_error}")
        print("Using simulation mode for Bluetooth functions")
        return True
    
    # If we got here, initialization failed
    api_available = False
    return False

async def find_hub_devices():
    """Find SPIKE Prime hub devices"""
    if not api_available:
        return []
    
    try:
        devices = await find_device_func()
        
        # If in simulation mode, just return all mock devices
        if simulation_mode:
            return devices
            
        # Otherwise filter for SPIKE/Technic hubs
        # First check if we have a name attribute on the device objects
        if devices and hasattr(devices[0], 'name'):
            return [d for d in devices if hasattr(d, 'name') and ("SPIKE" in d.name or "Technic Hub" in d.name)]
        
        # Fall back to just returning all devices if we can't filter
        return devices
    except Exception as e:
        print(f"Error in find_hub_devices: {str(e)}")
        return []

async def connect_to_hub(device):
    """Connect to a hub device"""
    if not api_available:
        raise RuntimeError("PyBricks API not available")
    
    try:
        return await connect_func(device)
    except Exception as e:
        print(f"Error in connect_to_hub: {str(e)}")
        raise

def get_status():
    """Get the current status of the pybricksdev API"""
    return {
        "available": api_available,
        "error": api_error,
        "version": pybricksdev_version,
        "simulation_mode": simulation_mode
    }

def get_installation_instructions():
    """Get instructions for installing or fixing pybricksdev"""
    instructions = [
        "To install or reinstall pybricksdev:",
        "1. Open a terminal or command prompt",
        "2. Run: pip uninstall pybricksdev",
        "3. Run: pip install pybricksdev --force-reinstall",
        "",
        "If the issue persists, try:",
        "- Updating pip: python -m pip install --upgrade pip",
        "- Installing development version: pip install git+https://github.com/pybricks/pybricksdev.git",
        "",
        "For more information, visit: https://github.com/pybricks/pybricksdev"
    ]
    
    if simulation_mode:
        instructions.insert(0, "NOTE: The app is currently running in simulation mode because of pybricksdev issues.")
    
    return "\n".join(instructions)

# Function to disable simulation mode
def disable_simulation_mode():
    """Disable simulation mode manually"""
    global simulation_mode, force_real_mode
    simulation_mode = False
    force_real_mode = True
    # Re-initialize to apply changes
    return initialize_pybricksdev()

# Function to enable simulation mode
def enable_simulation_mode():
    """Enable simulation mode manually"""
    global simulation_mode, force_real_mode
    simulation_mode = True
    force_real_mode = False
    find_device_func = simulate_find_devices
    connect_func = simulate_connect
    api_available = True

# Initialize the module when imported, but don't auto-enable simulation
if not initialize_pybricksdev() and not force_real_mode:
    # Only enable simulation if initialization failed and not forcing real mode
    enable_simulation_mode() 