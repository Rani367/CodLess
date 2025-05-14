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
        return f"{self.name} ({self.address})"

# This gets called first during initialization
def _init_module():
    """Initialize the adapter module."""
    global api_available, api_error, find_device_func, connect_func, pybricksdev_version
    
    # Check if pybricksdev is installed
    try:
        import pybricksdev
        pybricksdev_version = getattr(pybricksdev, "__version__", "unknown")
        
        # Check for BLE support in various pybricksdev versions
        try:
            # New approach - use whatever is in pybricksdev.ble
            import importlib
            ble_module = importlib.import_module('pybricksdev.ble')
            
            # Find the functions we need
            # First try to find the find_device function - there are multiple variants
            if hasattr(ble_module, 'find_device'):
                find_device_func = ble_module.find_device
            elif hasattr(ble_module, 'find_hub'):
                find_device_func = ble_module.find_hub
            
            # Then try to find the connect function
            if hasattr(ble_module, 'BleakClient') and hasattr(ble_module, 'get_nus_tx_characteristic') and hasattr(ble_module, 'get_nus_rx_characteristic'):
                # Recent pybricksdev versions use BleakClient directly
                import inspect
                
                # We need to create a compatible function signature for connect
                async def bleakclient_connect(address, disconnect_callback=None, notification_handler=None):
                    from pybricksdev.ble import BleakClient, get_nus_tx_characteristic, get_nus_rx_characteristic
                    
                    client = BleakClient(address)
                    await client.connect()
                    
                    # Get characteristics
                    tx_char = await get_nus_tx_characteristic(client)
                    rx_char = await get_nus_rx_characteristic(client)
                    
                    # Set up notifications if requested
                    if notification_handler:
                        await client.start_notify(rx_char, notification_handler)
                    
                    # Create a compatible conn object
                    conn = type('', (), {})()
                    conn.client = client
                    conn.tx_char = tx_char
                    conn.rx_char = rx_char
                    
                    return conn
                    
                connect_func = bleakclient_connect
            elif hasattr(ble_module, 'connect_ble'):
                connect_func = ble_module.connect_ble
            
            # Ensure both functions were found
            if find_device_func is not None and connect_func is not None:
                api_available = True
            else:
                api_error = "Required BLE functions not found in pybricksdev"
        except (ImportError, AttributeError) as e:
            api_error = f"Error initializing pybricksdev BLE: {str(e)}"
    except ImportError:
        api_error = "pybricksdev is not installed"

# Initialize the module when imported
_init_module()

def get_status():
    """Get the current status of the adapter."""
    return {
        "api_available": api_available,
        "api_error": api_error,
        "simulation_mode": simulation_mode,
        "force_real_mode": force_real_mode,
        "pybricksdev_version": pybricksdev_version
    }

def enable_simulation_mode():
    """Enable simulation mode for development/testing."""
    global simulation_mode
    simulation_mode = True
    return True

def disable_simulation_mode():
    """Disable simulation mode, requiring real hardware."""
    global simulation_mode, force_real_mode
    simulation_mode = False
    force_real_mode = True
    return api_available

async def find_devices():
    """Find available SPIKE Prime devices over BLE."""
    # In simulation mode, return mock devices
    if simulation_mode:
        await asyncio.sleep(1.0)  # Simulate search delay
        # Return a mock device
        return [MockBLEDevice("SPIKE Prime Hub", "00:11:22:33:44:55")]
    
    # Use the actual Bluetooth functionality
    if not api_available:
        if not force_real_mode:
            # Fallback to simulation mode
            return await find_devices()
        raise Exception(f"Bluetooth functionality not available: {api_error}")
    
    # Call the appropriate function from pybricksdev
    try:
        return await find_device_func()
    except Exception as e:
        # If we fail here and not forcing real mode, fall back to simulation
        if not force_real_mode:
            global simulation_mode
            simulation_mode = True
            return await find_devices()
        raise Exception(f"Error finding devices: {str(e)}")

async def connect_device(device, callback=None):
    """Connect to a SPIKE Prime device."""
    # In simulation mode, simulate a connection
    if simulation_mode:
        await asyncio.sleep(0.5)  # Simulate connection delay
        
        # Define a simulated notification handler
        async def _send_simulated_notifications(conn, callback):
            """Send periodic simulated data in the background."""
            if callback is None:
                return
                
            i = 0
            try:
                while True:
                    # Simulate receiving some data occasionally
                    await asyncio.sleep(2.0 + random.random() * 3.0)
                    i += 1
                    
                    # Create some simulated data (battery level, sensor readings, etc.)
                    data = bytes([i % 256, (i * 2) % 256, (i * 3) % 256, 0x0A])
                    callback(None, data)
            except asyncio.CancelledError:
                pass
                
        # Create a mock connection object
        conn = type('Connection', (), {})()
        conn.client = type('Client', (), {'is_connected': True})()
        conn.tx_char = "tx_char_uuid"
        conn.rx_char = "rx_char_uuid"
        
        # Store the task in the connection so it can be cancelled
        if callback:
            conn._sim_task = asyncio.create_task(_send_simulated_notifications(conn, callback))
            
        return conn
    
    # Use the actual Bluetooth functionality
    if not api_available:
        raise Exception(f"Bluetooth functionality not available: {api_error}")
    
    # Get the address from the device
    address = getattr(device, "address", device)
    
    # Call the appropriate function from pybricksdev
    try:
        return await connect_func(address, notification_handler=callback)
    except Exception as e:
        raise Exception(f"Error connecting to device: {str(e)}")

async def disconnect_device(conn):
    """Disconnect from a SPIKE Prime device."""
    # In simulation mode, simulate a disconnection
    if simulation_mode:
        await asyncio.sleep(0.5)  # Simulate disconnection delay
        
        # Cancel the simulation task if it exists
        if hasattr(conn, '_sim_task'):
            conn._sim_task.cancel()
            try:
                await conn._sim_task
            except asyncio.CancelledError:
                pass
        
        return True
    
    # Use the actual Bluetooth functionality
    if not api_available:
        raise Exception(f"Bluetooth functionality not available: {api_error}")
    
    # Different versions have different disconnection methods
    try:
        client = getattr(conn, "client", conn)
        if hasattr(client, "disconnect"):
            await client.disconnect()
        elif hasattr(client, "close"):
            await client.close()
        else:
            return False
        return True
    except Exception as e:
        raise Exception(f"Error disconnecting from device: {str(e)}")

async def send_data(conn, data):
    """Send data to a SPIKE Prime device."""
    # In simulation mode, simulate sending data
    if simulation_mode:
        await asyncio.sleep(0.1)  # Simulate transmission delay
        return True
    
    # Use the actual Bluetooth functionality
    if not api_available:
        raise Exception(f"Bluetooth functionality not available: {api_error}")
    
    # Different versions have different send methods
    try:
        client = getattr(conn, "client", conn)
        tx_char = getattr(conn, "tx_char", None)
        
        if hasattr(client, "write_gatt_char") and tx_char:
            await client.write_gatt_char(tx_char, data)
        elif hasattr(client, "write_value"):
            await client.write_value(tx_char, data)
        elif hasattr(client, "write"):
            await client.write(tx_char, data)
        else:
            return False
        return True
    except Exception as e:
        raise Exception(f"Error sending data to device: {str(e)}") 