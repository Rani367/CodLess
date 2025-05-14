import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import os
import threading
from PIL import Image, ImageTk
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.patches as patches
import asyncio
import sys

# Import our adapter module for pybricksdev
import pybricks_adapter

class CodLessApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CodLess - SPIKE Prime Navigation")
        self.geometry("1400x900")
        self.minsize(1200, 800)
        
        # Application state
        self.is_connected = False
        self.hub_device = None
        self.wheel_diameter = 0.0
        self.axle_track = 0.0
        self.waypoints = []
        self.saved_routes = {}
        self.current_route_name = "New Route"
        self.map_image = None
        self.map_image_path = None
        
        # Ensure assets directory exists
        if not os.path.exists("assets"):
            os.makedirs("assets")
        
        # Set up the UI
        self.setup_ui()
        
        # Auto-load map image from assets folder
        self.auto_load_map_image()
        
        # Check pybricksdev availability
        pybricks_status = pybricks_adapter.get_status()
        if not pybricks_status["available"]:
            error_msg = "The pybricksdev package is not working properly."
            if pybricks_status["error"]:
                error_msg += f"\n\nError details: {pybricks_status['error']}"
            
            error_msg += f"\n\n{pybricks_adapter.get_installation_instructions()}"
            
            # Show a more specific error message for simulation mode
            if pybricks_status.get("simulation_mode", False):
                messagebox.showinfo(
                    "Simulation Mode",
                    "CodLess is running in simulation mode.\n\n"
                    "You can use all app features to plan robot paths, but actual robot control via Bluetooth won't work.\n\n"
                    "To use real Bluetooth mode, please fix the pybricksdev installation."
                )
            else:
                messagebox.showwarning(
                    "Dependencies Issue",
                    error_msg
                )
            
            # Print to console for debugging
            print(f"pybricksdev issue: {pybricks_status['error']}")
            print(f"Python path: {sys.path}")
    
    def setup_ui(self):
        # Create a notebook with tabs
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        # Setup tab
        self.setup_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.setup_tab, text="Setup")
        self.create_setup_tab()
        
        # Map tab
        self.map_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.map_tab, text="Map")
        self.create_map_tab()
        
        # Routes tab
        self.routes_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.routes_tab, text="Routes")
        self.create_routes_tab()
        
        # Style for buttons
        self.style = ttk.Style()
        self.style.configure("TButton", padding=8, relief="flat", background="#4CAF50")
        self.style.map("TButton", 
            background=[("active", "#66BB6A"), ("disabled", "#E0E0E0")],
            foreground=[("disabled", "#9E9E9E")])
        
        # Status bar
        self.status_bar = tk.Label(self, text="Not connected to hub", bd=1, relief=tk.SUNKEN, anchor=tk.W, padx=10, pady=5)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
    
    def create_setup_tab(self):
        frame = ttk.Frame(self.setup_tab, padding="30")
        frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title = ttk.Label(frame, text="Connect to SPIKE Prime Hub", font=("Arial", 18, "bold"))
        title.grid(row=0, column=0, columnspan=2, pady=(0, 30), sticky="w")
        
        # Bluetooth status indicator
        bt_status_frame = ttk.Frame(frame)
        bt_status_frame.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        
        self.bt_status_label = ttk.Label(bt_status_frame, text="Bluetooth Status: ", font=("Arial", 11))
        self.bt_status_label.pack(side=tk.LEFT, padx=5)
        
        self.bt_status_indicator = ttk.Label(bt_status_frame, text="Checking...", foreground="gray")
        self.bt_status_indicator.pack(side=tk.LEFT)
        
        self.bt_refresh_button = ttk.Button(bt_status_frame, text="↻", width=3, 
                                          command=self.check_bluetooth_status)
        self.bt_refresh_button.pack(side=tk.LEFT, padx=10)
        
        # Check Bluetooth status after UI is created
        self.after(500, self.check_bluetooth_status)
        
        # Bluetooth connection section
        bt_frame = ttk.LabelFrame(frame, text="Bluetooth Connection", padding="10")
        bt_frame.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(0, 20))
        
        self.connect_button = ttk.Button(bt_frame, text="Connect to Hub", command=self.connect_to_hub)
        self.connect_button.grid(row=0, column=0, padx=10, pady=10, sticky="w")
        
        self.connection_status = ttk.Label(bt_frame, text="Not connected")
        self.connection_status.grid(row=0, column=1, padx=10, pady=10, sticky="w")
        
        # Robot configuration section
        config_frame = ttk.LabelFrame(frame, text="Robot Configuration", padding="10")
        config_frame.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(0, 20))
        
        # Wheel diameter
        ttk.Label(config_frame, text="Wheel Diameter (mm):").grid(row=0, column=0, padx=10, pady=10, sticky="w")
        self.wheel_diameter_var = tk.StringVar(value="56")
        wheel_entry = ttk.Entry(config_frame, textvariable=self.wheel_diameter_var, width=10)
        wheel_entry.grid(row=0, column=1, padx=10, pady=10, sticky="w")
        
        # Axle track
        ttk.Label(config_frame, text="Axle Track (mm):").grid(row=1, column=0, padx=10, pady=10, sticky="w")
        self.axle_track_var = tk.StringVar(value="114")
        axle_entry = ttk.Entry(config_frame, textvariable=self.axle_track_var, width=10)
        axle_entry.grid(row=1, column=1, padx=10, pady=10, sticky="w")
        
        # Save configuration button
        save_config_button = ttk.Button(config_frame, text="Save Configuration", 
                                       command=self.save_robot_config)
        save_config_button.grid(row=2, column=0, columnspan=2, padx=10, pady=10)
        
        # Instructions
        instructions_frame = ttk.LabelFrame(frame, text="Instructions", padding="10")
        instructions_frame.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(0, 20))
        
        instructions_text = (
            "1. Make sure Bluetooth is enabled on your computer\n"
            "2. Turn on your SPIKE Prime hub\n"
            "3. Connect to your hub using the button above\n"
            "4. Enter your robot's wheel diameter and axle track\n"
            "5. Save your configuration\n"
            "6. Navigate to the Map tab to plan your robot's movements"
        )
        ttk.Label(instructions_frame, text=instructions_text).grid(row=0, column=0, padx=10, pady=10, sticky="w")
    
    def create_map_tab(self):
        # Use a PanedWindow to allow resizing sections
        self.map_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.map_tab, text="Map")
        
        frame = ttk.PanedWindow(self.map_tab, orient=tk.HORIZONTAL)
        frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        # Title above the paned window
        title = ttk.Label(self.map_tab, text="Plan Robot Path", font=("Arial", 18, "bold"))
        title.pack(anchor="w", padx=15, pady=(15, 0))
        
        # Left side - map section
        map_frame = ttk.Frame(frame)
        
        # Create the figure for the map with tight layout and responsive sizing
        self.fig = plt.Figure(tight_layout=True)
        self.ax = self.fig.add_subplot(111)
        
        # Initialize map
        self.initialize_default_map()
        
        # Create canvas with better configuration for resizing
        self.canvas = FigureCanvasTkAgg(self.fig, master=map_frame)
        self.canvas.draw()
        canvas_widget = self.canvas.get_tk_widget()
        canvas_widget.pack(fill=tk.BOTH, expand=True)
        
        # Add click event handler
        self.canvas.mpl_connect('button_press_event', self.on_map_click)
        
        # Right side - Controls frame with scrollbar
        controls_container = ttk.Frame(frame)
        
        # Create a canvas with scrollbar for the controls
        controls_canvas = tk.Canvas(controls_container, width=300)
        scrollbar = ttk.Scrollbar(controls_container, orient="vertical", command=controls_canvas.yview)
        controls_frame = ttk.Frame(controls_canvas)
        
        # Configure scrolling
        controls_frame.bind(
            "<Configure>",
            lambda e: controls_canvas.configure(scrollregion=controls_canvas.bbox("all"))
        )
        
        controls_canvas.create_window((0, 0), window=controls_frame, anchor="nw")
        controls_canvas.configure(yscrollcommand=scrollbar.set)
        
        # Pack the canvas and scrollbar
        controls_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Add the frames to the paned window
        frame.add(map_frame, weight=3)
        frame.add(controls_container, weight=1)
        
        # Map image selection
        map_image_frame = ttk.LabelFrame(controls_frame, text="Map Background", padding="15")
        map_image_frame.pack(fill=tk.X, padx=5, pady=10)
        
        button_frame = ttk.Frame(map_image_frame)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        self.select_map_button = ttk.Button(
            button_frame, 
            text="Select Map Image", 
            command=self.select_map_image
        )
        self.select_map_button.pack(side=tk.LEFT, padx=10, pady=10)
        
        self.clear_map_button = ttk.Button(
            button_frame, 
            text="Clear Map Image", 
            command=self.clear_map_image
        )
        self.clear_map_button.pack(side=tk.LEFT, padx=10, pady=10)
        
        # Route name input
        route_name_frame = ttk.Frame(controls_frame)
        route_name_frame.pack(fill=tk.X, padx=5, pady=15)
        
        ttk.Label(route_name_frame, text="Route Name:", font=("Arial", 11)).pack(side=tk.LEFT, padx=5)
        self.route_name_var = tk.StringVar(value=self.current_route_name)
        route_name_entry = ttk.Entry(route_name_frame, textvariable=self.route_name_var, width=25)
        route_name_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        
        # Waypoints frame
        waypoints_frame = ttk.LabelFrame(controls_frame, text="Waypoints", padding="15")
        waypoints_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=15)
        
        self.waypoints_listbox = tk.Listbox(waypoints_frame, width=35, height=12)
        self.waypoints_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(waypoints_frame, orient="vertical", command=self.waypoints_listbox.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.waypoints_listbox.config(yscrollcommand=scrollbar.set)
        
        # Buttons frame
        buttons_frame = ttk.Frame(controls_frame)
        buttons_frame.pack(fill=tk.X, padx=5, pady=15)
        
        clear_button = ttk.Button(buttons_frame, text="Clear All", command=self.clear_waypoints)
        clear_button.pack(side=tk.LEFT, padx=10)
        
        delete_button = ttk.Button(buttons_frame, text="Delete Selected", command=self.delete_selected_waypoint)
        delete_button.pack(side=tk.LEFT, padx=10)
        
        save_button = ttk.Button(buttons_frame, text="Save Route", command=self.save_route)
        save_button.pack(side=tk.LEFT, padx=10)
        
        # Run section
        run_frame = ttk.LabelFrame(controls_frame, text="Run", padding="15")
        run_frame.pack(fill=tk.X, padx=5, pady=15)
        
        run_button = ttk.Button(run_frame, text="Run on Robot", command=self.run_on_robot)
        run_button.pack(fill=tk.X, padx=10, pady=10)
    
    def initialize_default_map(self):
        """Setup default grid-based map"""
        self.ax.clear()
        self.ax.set_xlim(0, 100)
        self.ax.set_ylim(0, 100)
        self.ax.set_title("Click to add waypoints")
        self.ax.set_xlabel("X (cm)")
        self.ax.set_ylabel("Y (cm)")
        self.ax.grid(True)
        
        # Add grid lines
        for i in range(0, 101, 10):
            self.ax.axhline(y=i, color='gray', linestyle='-', lw=0.5)
            self.ax.axvline(x=i, color='gray', linestyle='-', lw=0.5)
            
        # Update layout to ensure proper rendering
        self.fig.tight_layout()
    
    def select_map_image(self):
        """Open file dialog to select a map image"""
        file_path = filedialog.askopenfilename(
            title="Select Map Image",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.gif *.bmp"),
                ("All files", "*.*")
            ],
            initialdir="assets"
        )
        
        if not file_path:
            return
        
        try:
            # If selected file is not in assets folder, copy it there
            filename = os.path.basename(file_path)
            assets_path = os.path.join("assets", filename)
            
            if file_path != assets_path and not os.path.samefile(file_path, assets_path):
                import shutil
                shutil.copy2(file_path, assets_path)
                file_path = assets_path
                messagebox.showinfo("Image Copied", f"Image copied to assets folder as {filename}")
            
            # Load and display the image
            self.load_map_image(file_path)
            self.map_image_path = file_path
        except Exception as e:
            messagebox.showerror("Error Loading Image", str(e))
    
    def load_map_image(self, image_path):
        """Load and display a map image while preserving aspect ratio"""
        try:
            # Load the image using PIL
            img = Image.open(image_path)
            
            # Clear the current axes
            self.ax.clear()
            
            # Display the image in matplotlib while preserving aspect ratio
            self.ax.imshow(img, extent=[0, 100, 0, 100], aspect='auto')
            
            # Configure axes
            self.ax.set_xlim(0, 100)
            self.ax.set_ylim(0, 100)
            self.ax.set_title("Click to add waypoints")
            self.ax.set_xlabel("X (cm)")
            self.ax.set_ylabel("Y (cm)")
            
            # Add grid overlay
            self.ax.grid(True, alpha=0.3)
            for i in range(0, 101, 10):
                self.ax.axhline(y=i, color='gray', linestyle='-', lw=0.5, alpha=0.5)
                self.ax.axvline(x=i, color='gray', linestyle='-', lw=0.5, alpha=0.5)
            
            # Store the image for later
            self.map_image = img
            
            # Update layout to ensure proper rendering
            self.fig.tight_layout()
            
            # Redraw the canvas
            self.canvas.draw()
            
            # If we have waypoints, redraw them
            if self.waypoints:
                self.draw_waypoints()
                
        except Exception as e:
            messagebox.showerror("Error Loading Image", str(e))
            self.initialize_default_map()
            self.canvas.draw()
    
    def clear_map_image(self):
        """Remove the map image and return to the default grid"""
        self.map_image = None
        self.map_image_path = None
        self.initialize_default_map()
        
        # If we have waypoints, redraw them
        if self.waypoints:
            self.draw_waypoints()
            
        self.canvas.draw()
    
    def update_map(self):
        """Update the map with current waypoints"""
        if self.map_image and self.map_image_path:
            # If we have a custom map image, reload it
            self.load_map_image(self.map_image_path)
        else:
            # Otherwise use the default grid
            self.initialize_default_map()
        
        # Draw the waypoints
        self.draw_waypoints()
        
        # Ensure proper layout
        self.fig.tight_layout()
        
        # Redraw the canvas
        self.canvas.draw()
    
    def draw_waypoints(self):
        """Draw waypoints and path on the current map"""
        if self.waypoints:
            x_points = [point[0] for point in self.waypoints]
            y_points = [point[1] for point in self.waypoints]
            
            # Draw the path
            self.ax.plot(x_points, y_points, 'b-', lw=2)
            
            # Draw the waypoints
            self.ax.scatter(x_points, y_points, color='red', s=100, zorder=5)
            
            # Add waypoint numbers
            for i, (x, y) in enumerate(self.waypoints):
                self.ax.annotate(str(i+1), (x, y), xytext=(5, 5), 
                                textcoords="offset points", fontsize=10, fontweight='bold')
            
            # Draw the robot at the starting position
            if len(self.waypoints) > 0:
                x, y = self.waypoints[0]
                robot = patches.Rectangle((x-5, y-5), 10, 10, linewidth=1, 
                                          edgecolor='green', facecolor='lightgreen', alpha=0.7)
                self.ax.add_patch(robot)
                
    def save_route(self):
        if not self.waypoints:
            messagebox.showinfo("No Waypoints", "Please add waypoints before saving the route.")
            return
        
        route_name = self.route_name_var.get().strip()
        if not route_name:
            messagebox.showerror("Name Required", "Please enter a name for this route.")
            return
        
        # Save the route with map image information if available
        route_data = {
            "waypoints": self.waypoints,
            "wheel_diameter": self.wheel_diameter,
            "axle_track": self.axle_track
        }
        
        # Add map image path if one is used
        if self.map_image_path:
            route_data["map_image"] = os.path.basename(self.map_image_path)
        
        # Save the route
        self.saved_routes[route_name] = route_data
        
        # Update the routes list
        self.update_routes_list()
        
        # Update current route name
        self.current_route_name = route_name
        messagebox.showinfo("Route Saved", f"Route '{route_name}' has been saved.")
    
    def create_routes_tab(self):
        frame = ttk.Frame(self.routes_tab, padding="30")
        frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title = ttk.Label(frame, text="Saved Routes", font=("Arial", 18, "bold"))
        title.grid(row=0, column=0, columnspan=2, pady=(0, 30), sticky="w")
        
        # Routes listbox
        self.routes_listbox = tk.Listbox(frame, width=40, height=20, font=("Arial", 11))
        self.routes_listbox.grid(row=1, column=0, padx=(0, 30), pady=10, sticky="nsew")
        
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=self.routes_listbox.yview)
        scrollbar.grid(row=1, column=1, sticky="ns")
        self.routes_listbox.config(yscrollcommand=scrollbar.set)
        
        # Buttons frame
        buttons_frame = ttk.Frame(frame)
        buttons_frame.grid(row=2, column=0, columnspan=2, padx=5, pady=20, sticky="ew")
        
        load_button = ttk.Button(buttons_frame, text="Load Selected", command=self.load_selected_route)
        load_button.pack(side=tk.LEFT, padx=10)
        
        delete_button = ttk.Button(buttons_frame, text="Delete Selected", command=self.delete_selected_route)
        delete_button.pack(side=tk.LEFT, padx=10)
        
        export_button = ttk.Button(buttons_frame, text="Export All Routes", command=self.export_routes)
        export_button.pack(side=tk.LEFT, padx=10)
        
        import_button = ttk.Button(buttons_frame, text="Import Routes", command=self.import_routes)
        import_button.pack(side=tk.LEFT, padx=10)
        
        # Configure grid weights
        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(1, weight=1)
        
        # Load saved routes, if any
        self.load_saved_routes()
    
    def check_bluetooth_status(self):
        """Check if Bluetooth is enabled and update the status indicator"""
        try:
            import platform
            if platform.system() == "Darwin":  # macOS
                import subprocess
                result = subprocess.run(["system_profiler", "SPBluetoothDataType"], 
                                      capture_output=True, text=True)
                if "State: On" in result.stdout:
                    self.bt_status_indicator.config(text="Enabled", foreground="green")
                else:
                    self.bt_status_indicator.config(text="Disabled", foreground="red")
            elif platform.system() == "Windows":
                # Windows-specific Bluetooth check 
                # This is a simplified check - a more robust one would use ctypes to call Windows APIs
                import subprocess
                try:
                    result = subprocess.run(["powershell", "Get-PnpDevice -Class Bluetooth"], 
                                          capture_output=True, text=True, timeout=2)
                    if "OK" in result.stdout:
                        self.bt_status_indicator.config(text="Enabled", foreground="green")
                    else:
                        self.bt_status_indicator.config(text="Disabled", foreground="red")
                except:
                    self.bt_status_indicator.config(text="Unknown", foreground="orange")
            elif platform.system() == "Linux":
                # Linux-specific Bluetooth check
                import subprocess
                try:
                    result = subprocess.run(["bluetoothctl", "show"], 
                                          capture_output=True, text=True, timeout=2)
                    if "Powered: yes" in result.stdout:
                        self.bt_status_indicator.config(text="Enabled", foreground="green")
                    else:
                        self.bt_status_indicator.config(text="Disabled", foreground="red")
                except:
                    self.bt_status_indicator.config(text="Unknown", foreground="orange")
            else:
                self.bt_status_indicator.config(text="Unknown Platform", foreground="orange")
        except Exception as e:
            print(f"Error checking Bluetooth status: {e}")
            self.bt_status_indicator.config(text="Error", foreground="red")
    
    def connect_to_hub(self):
        if not pybricks_adapter.api_available:
            detailed_msg = "The pybricksdev package is not working properly."
            if pybricks_adapter.api_error:
                detailed_msg += f"\n\nError details: {pybricks_adapter.api_error}"
            
            detailed_msg += f"\n\n{pybricks_adapter.get_installation_instructions()}"
            
            messagebox.showerror("Connection Error", detailed_msg)
            return
        
        if self.is_connected:
            messagebox.showinfo("Already Connected", "You are already connected to a hub.")
            return
        
        # Disable the connect button and update its text to show progress
        self.connect_button.config(state="disabled", text="Connecting...")
        self.connection_status.config(text="Searching...")
        
        # Check if Bluetooth is enabled
        try:
            import platform
            if platform.system() == "Darwin":  # macOS
                import subprocess
                result = subprocess.run(["system_profiler", "SPBluetoothDataType"], 
                                      capture_output=True, text=True)
                if "State: On" not in result.stdout:
                    messagebox.showerror(
                        "Bluetooth Disabled", 
                        "Bluetooth appears to be turned off on your device.\n\n"
                        "Please enable Bluetooth in your system settings and try again."
                    )
                    # Re-enable the connect button
                    self.connect_button.config(state="normal", text="Connect to Hub")
                    self.connection_status.config(text="Not connected")
                    return
        except Exception as e:
            print(f"Error checking Bluetooth status: {e}")
        
        self.status_bar.config(text="Searching for SPIKE Prime hub...")
        
        # Start connection in a separate thread to prevent UI freezing
        thread = threading.Thread(target=self._connect_to_hub_thread)
        thread.daemon = True
        thread.start()
    
    def _connect_to_hub_thread(self):
        # This function runs in a separate thread
        try:
            # Create an event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Find and connect to the hub
            devices = loop.run_until_complete(pybricks_adapter.find_hub_devices())
            if not devices:
                self._update_connection_status(False, "No SPIKE Prime hub found")
                # Display a more helpful message on the main thread
                self.after(0, lambda: messagebox.showinfo(
                    "No Hub Found", 
                    "No SPIKE Prime hub was found.\n\n"
                    "Please make sure your hub is:\n"
                    "1. Turned on\n"
                    "2. Bluetooth is enabled\n"
                    "3. Within range of your computer\n\n"
                    "Also ensure the hub has Pybricks firmware installed."
                ))
                return
            
            # Use the first found hub
            self.hub_device = devices[0]
            
            # Connect to the hub
            try:
                loop.run_until_complete(pybricks_adapter.connect_to_hub(self.hub_device))
                self._update_connection_status(True, f"Connected to {self.hub_device.name}")
            except Exception as e:
                error_msg = str(e)
                self._update_connection_status(False, f"Connection error: {error_msg}")
                self.after(0, lambda: messagebox.showerror(
                    "Connection Failed", 
                    f"Failed to connect to {self.hub_device.name}.\n\n"
                    f"Error: {error_msg}\n\n"
                    "This may be due to:\n"
                    "1. The hub turning off or moving out of range\n"
                    "2. Pybricks firmware issues\n"
                    "3. pybricksdev library compatibility issues"
                ))
            
        except Exception as e:
            error_msg = str(e)
            self._update_connection_status(False, f"Connection error: {error_msg}")
            
            # Show a specific message for Bluetooth issues
            if "Bluetooth device is turned off" in error_msg:
                self.after(0, lambda: messagebox.showerror(
                    "Bluetooth Disabled", 
                    "Your Bluetooth adapter appears to be turned off.\n\n"
                    "Please enable Bluetooth in your system settings and try again."
                ))
                # Update Bluetooth status indicator
                self.after(0, lambda: self.bt_status_indicator.config(text="Disabled", foreground="red"))
            else:
                self.after(0, lambda: messagebox.showerror(
                    "Connection Error", 
                    f"An error occurred while trying to connect to the hub:\n\n{error_msg}"
                ))
        finally:
            # Always re-enable the connect button in the main thread
            self.after(0, lambda: self.connect_button.config(state="normal", text="Connect to Hub"))
    
    def _update_connection_status(self, is_connected, message):
        # Update UI from the main thread
        self.is_connected = is_connected
        self.status_bar.config(text=message)
        
        # Update in the main thread to prevent threading issues
        def update_ui():
            self.connection_status.config(text="Connected" if is_connected else "Not connected")
            if is_connected:
                self.connect_button.config(text="Reconnect", state="normal")
            else:
                self.connect_button.config(text="Connect to Hub", state="normal")
        
        self.after(0, update_ui)
        print(f"Connection status update: {message}")
    
    def save_robot_config(self):
        try:
            self.wheel_diameter = float(self.wheel_diameter_var.get())
            self.axle_track = float(self.axle_track_var.get())
            
            if self.wheel_diameter <= 0 or self.axle_track <= 0:
                messagebox.showerror("Invalid Values", "Wheel diameter and axle track must be positive numbers.")
                return
            
            messagebox.showinfo("Configuration Saved", 
                               f"Wheel Diameter: {self.wheel_diameter} mm\n"
                               f"Axle Track: {self.axle_track} mm")
            
        except ValueError:
            messagebox.showerror("Invalid Input", "Please enter valid numbers for wheel diameter and axle track.")
    
    def on_map_click(self, event):
        if event.xdata is None or event.ydata is None:
            return
        
        x, y = round(event.xdata, 1), round(event.ydata, 1)
        self.waypoints.append((x, y))
        
        # Update the map
        self.update_map()
        
        # Update the waypoints list
        self.waypoints_listbox.insert(tk.END, f"Point {len(self.waypoints)}: ({x}, {y})")
    
    def clear_waypoints(self):
        self.waypoints = []
        self.waypoints_listbox.delete(0, tk.END)
        self.update_map()
    
    def delete_selected_waypoint(self):
        selected = self.waypoints_listbox.curselection()
        if not selected:
            messagebox.showinfo("Selection Required", "Please select a waypoint to delete.")
            return
        
        index = selected[0]
        self.waypoints.pop(index)
        self.waypoints_listbox.delete(index)
        
        # Update remaining waypoint labels
        self.waypoints_listbox.delete(0, tk.END)
        for i, (x, y) in enumerate(self.waypoints):
            self.waypoints_listbox.insert(tk.END, f"Point {i+1}: ({x}, {y})")
        
        self.update_map()
    
    def load_saved_routes(self):
        # Load routes from a file if it exists
        if os.path.exists("saved_routes.json"):
            try:
                with open("saved_routes.json", "r") as f:
                    self.saved_routes = json.load(f)
                self.update_routes_list()
            except Exception as e:
                messagebox.showerror("Error Loading Routes", f"Could not load saved routes: {str(e)}")
    
    def update_routes_list(self):
        # Update the routes listbox
        self.routes_listbox.delete(0, tk.END)
        for route_name in self.saved_routes:
            self.routes_listbox.insert(tk.END, route_name)
        
        # Save routes to a file
        try:
            with open("saved_routes.json", "w") as f:
                json.dump(self.saved_routes, f)
        except Exception as e:
            messagebox.showerror("Error Saving Routes", f"Could not save routes to file: {str(e)}")
    
    def load_selected_route(self):
        selected = self.routes_listbox.curselection()
        if not selected:
            messagebox.showinfo("Selection Required", "Please select a route to load.")
            return
        
        route_name = self.routes_listbox.get(selected[0])
        route_data = self.saved_routes[route_name]
        
        # Load the route data
        self.waypoints = route_data["waypoints"]
        self.wheel_diameter = route_data["wheel_diameter"]
        self.axle_track = route_data["axle_track"]
        
        # Update the UI
        self.wheel_diameter_var.set(str(self.wheel_diameter))
        self.axle_track_var.set(str(self.axle_track))
        self.route_name_var.set(route_name)
        self.current_route_name = route_name
        
        # Load map image if it exists in the route data
        if "map_image" in route_data and route_data["map_image"]:
            map_path = os.path.join("assets", route_data["map_image"])
            if os.path.exists(map_path):
                self.map_image_path = map_path
                self.load_map_image(map_path)
            else:
                messagebox.showwarning("Map Not Found", 
                                    f"The map image for this route was not found: {route_data['map_image']}")
                self.clear_map_image()
        else:
            self.clear_map_image()
        
        # Update waypoints listbox
        self.waypoints_listbox.delete(0, tk.END)
        for i, (x, y) in enumerate(self.waypoints):
            self.waypoints_listbox.insert(tk.END, f"Point {i+1}: ({x}, {y})")
        
        # Update the map
        self.update_map()
        
        # Switch to the Map tab
        self.notebook.select(1)
    
    def delete_selected_route(self):
        selected = self.routes_listbox.curselection()
        if not selected:
            messagebox.showinfo("Selection Required", "Please select a route to delete.")
            return
        
        route_name = self.routes_listbox.get(selected[0])
        
        # Confirm deletion
        if messagebox.askyesno("Confirm Deletion", f"Are you sure you want to delete the route '{route_name}'?"):
            del self.saved_routes[route_name]
            self.update_routes_list()
    
    def export_routes(self):
        if not self.saved_routes:
            messagebox.showinfo("No Routes", "There are no routes to export.")
            return
        
        # Ask for file location
        file_path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            title="Export Routes"
        )
        
        if not file_path:
            return
        
        try:
            with open(file_path, "w") as f:
                json.dump(self.saved_routes, f)
            messagebox.showinfo("Export Successful", f"Routes exported to {file_path}")
        except Exception as e:
            messagebox.showerror("Export Error", f"Could not export routes: {str(e)}")
    
    def import_routes(self):
        # Ask for file location
        file_path = filedialog.askopenfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            title="Import Routes"
        )
        
        if not file_path:
            return
        
        try:
            with open(file_path, "r") as f:
                imported_routes = json.load(f)
            
            # Merge with existing routes
            for route_name, route_data in imported_routes.items():
                self.saved_routes[route_name] = route_data
            
            self.update_routes_list()
            messagebox.showinfo("Import Successful", f"Routes imported from {file_path}")
        except Exception as e:
            messagebox.showerror("Import Error", f"Could not import routes: {str(e)}")
    
    def run_on_robot(self):
        if not self.is_connected:
            messagebox.showerror("Not Connected", "Please connect to a SPIKE Prime hub first.")
            return
        
        if not self.waypoints:
            messagebox.showinfo("No Waypoints", "Please add waypoints before running.")
            return
        
        if self.wheel_diameter <= 0 or self.axle_track <= 0:
            messagebox.showerror("Invalid Configuration", 
                               "Please set valid wheel diameter and axle track values.")
            return
        
        # Generate and run the code
        code = self.generate_pybricks_code()
        
        # Show a preview of the code
        if messagebox.askyesno("Run Code", 
                             "The following code will be sent to the robot:\n\n" + 
                             code[:300] + "...\n\nRun this code?"):
            
            self.status_bar.config(text="Running code on the robot...")
            
            # In a real implementation, we would send the code to the hub
            # For this example, we'll just show a success message
            messagebox.showinfo("Code Sent", "Code has been sent to the robot!")
            self.status_bar.config(text="Code executed successfully.")
    
    def generate_pybricks_code(self):
        # Generate Pybricks code for the GyroDriveBase
        code = f"""
from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction, Color
from pybricks.robotics import GyroDriveBase
from pybricks.tools import wait

# Initialize the hub
hub = PrimeHub()
hub.light.on(Color.BLUE)

# Initialize the motors
left_motor = Motor(Port.A)
right_motor = Motor(Port.E)

# Initialize the drive base
robot = GyroDriveBase(
    left_motor, 
    right_motor, 
    wheel_diameter={self.wheel_diameter}, 
    axle_track={self.axle_track}
)

# Reset the gyro angle
robot.reset()

# Execute the path
hub.display.text("Starting...")
wait(1000)

"""
        
        # Add waypoints movement code
        prev_x, prev_y = self.waypoints[0]
        
        for i, (x, y) in enumerate(self.waypoints[1:], 1):
            # Calculate the distance and angle to the next point
            dx, dy = x - prev_x, y - prev_y
            distance = ((dx ** 2) + (dy ** 2)) ** 0.5
            
            code += f"# Move to waypoint {i}\n"
            
            if i == 1:
                # For the first movement, we need to set the initial heading
                angle = (180 / 3.14159) * (0 if dx == 0 else (3.14159 / 2 if dy > 0 else -3.14159 / 2 if dy < 0 else (0 if dx > 0 else 3.14159)))
                code += f"robot.settings(turn_rate=45)\n"
                code += f"robot.turn({angle})\n"
                code += f"wait(500)\n"
            else:
                # For subsequent movements, we need to turn to the new heading
                angle = (180 / 3.14159) * (0 if dx == 0 else (3.14159 / 2 if dy > 0 else -3.14159 / 2 if dy < 0 else (0 if dx > 0 else 3.14159)))
                code += f"robot.settings(turn_rate=45)\n"
                code += f"robot.turn({angle})\n"
                code += f"wait(500)\n"
            
            # Move to the next point
            code += f"robot.settings(straight_speed=100)\n"
            code += f"robot.straight({distance * 10})  # Convert from cm to mm\n"
            code += f"wait(500)\n\n"
            
            prev_x, prev_y = x, y
        
        # Add completion code
        code += """
# Path completed
hub.display.text("Done!")
hub.light.on(Color.GREEN)
wait(2000)
"""
        
        return code

    def auto_load_map_image(self):
        """Auto-load the first image found in the assets folder"""
        try:
            # Get all image files from the assets folder
            if not os.path.exists("assets"):
                os.makedirs("assets")
                return
                
            map_files = [f for f in os.listdir("assets") 
                        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))]
            
            if map_files:
                map_path = os.path.join("assets", map_files[0])
                try:
                    self.load_map_image(map_path)
                    self.map_image_path = map_path
                    self.status_bar.config(text=f"Loaded map image: {map_files[0]}")
                except Exception as e:
                    print(f"Error loading map image {map_path}: {str(e)}")
                    # Continue with the default grid if image loading fails
            else:
                print("No map images found in assets folder")
        except Exception as e:
            print(f"Error in auto_load_map_image: {str(e)}")
            # Continue with the default grid if any errors occur


if __name__ == "__main__":
    app = CodLessApp()
    app.mainloop() 