// @ts-nocheck
'use strict';
const APP_CONFIG = {
    VERSION: '1.0.0',
    NAME: 'CodLess™',
    BLUETOOTH_SERVICE_UUID: 'c5f50002-8280-46da-89f4-6d8051e4aeef',
    HUB_NAME_PREFIX: 'Pybricks',
    DEFAULT_COMMAND_TIMEOUT: 1000,
    MAX_LOG_ENTRIES: 1000,
    AUTO_SAVE_INTERVAL: 30000, // 30 seconds
    PERFORMANCE_MONITOR_INTERVAL: 1000
};
const STORAGE_KEYS = {
    SAVED_RUNS: 'fllRoboticsRuns_v3',
    CONFIG: 'fllRoboticsConfig_v3',
    USER_PREFERENCES: 'fllRoboticsPrefs_v3',
    CALIBRATION_DATA: 'fllRoboticsCalibration_v3'
};
// Utilities
class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return () => this.off(event, callback);
    }
    off(event, callback) {
        if (!this.events[event])
            return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    emit(event, ...args) {
        if (!this.events[event])
            return;
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            }
            catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
}
class Logger {
    constructor(maxEntries = APP_CONFIG.MAX_LOG_ENTRIES) {
        this.maxEntries = maxEntries;
        this.entries = [];
        this.callbacks = [];
    }
    log(message, level = 'info', data = null) {
        const entry = {
            timestamp: new Date(),
            message,
            level,
            data
        };
        this.entries.push(entry);
        // Trim old entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }
        // Notify callbacks
        this.callbacks.forEach(callback => {
            try {
                callback(entry);
            }
            catch (error) {
                console.error('Logger callback error:', error);
            }
        });
    }
    onLog(callback) {
        this.callbacks.push(callback);
        return () => {
            this.callbacks = this.callbacks.filter(cb => cb !== callback);
        };
    }
    exportLogs() {
        return JSON.stringify(this.entries, null, 2);
    }
    clear() {
        this.entries = [];
    }
}
class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = this.createContainer();
        }
        this.toasts = new Map();
        this.nextId = 1;
    }
    createContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    }
    show(message, type = 'info', duration = 5000, title = null) {
        const id = this.nextId++;
        const toast = this.createToast(id, message, type, title);
        this.container.appendChild(toast);
        this.toasts.set(id, toast);
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
        return id;
    }
    createToast(id, message, type, title) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        const iconMap = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        };
        toast.innerHTML = `
            <div class="toast-header">
                <i class="${iconMap[type] || iconMap.info}" aria-hidden="true"></i>
                <h4>${title || type.charAt(0).toUpperCase() + type.slice(1)}</h4>
                <button class="toast-close" onclick="window.app?.toastManager?.remove(${id})" aria-label="Close">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="toast-body">${message}</div>
        `;
        return toast;
    }
    remove(id) {
        const toast = this.toasts.get(id);
        if (!toast)
            return;
        toast.style.animation = 'slideOutToast 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(id);
        }, 300);
    }
    clear() {
        this.toasts.forEach((_, id) => this.remove(id));
    }
}
class XboxControllerHandler {
    constructor() {
        this.connected = false;
        this.gamepadIndex = null;
        this.pollInterval = null;
        this.lastButtonStates = {};
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onButtonPress: null,
            onButtonRelease: null,
            onAxisChange: null
        };
        // Xbox button mapping
        this.buttonMap = {
            0: 'A',
            1: 'B',
            2: 'X',
            3: 'Y',
            4: 'LB',
            5: 'RB',
            6: 'LT',
            7: 'RT',
            8: 'View',
            9: 'Menu',
            10: 'LeftStick',
            11: 'RightStick',
            12: 'DPadUp',
            13: 'DPadDown',
            14: 'DPadLeft',
            15: 'DPadRight',
            16: 'Xbox'
        };
        // Start listening for gamepad connections
        window.addEventListener('gamepadconnected', (e) => this.handleGamepadConnected(e));
        window.addEventListener('gamepaddisconnected', (e) => this.handleGamepadDisconnected(e));
    }
    handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        // Check if it's an Xbox controller
        if (gamepad.id.toLowerCase().includes('xbox') ||
            gamepad.id.toLowerCase().includes('xinput') ||
            gamepad.id.toLowerCase().includes('045e')) { // Microsoft vendor ID
            this.gamepadIndex = gamepad.index;
            this.connected = true;
            // Initialize button states
            for (let i = 0; i < gamepad.buttons.length; i++) {
                this.lastButtonStates[i] = false;
            }
            // Start polling
            this.startPolling();
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect(gamepad);
            }
        }
    }
    handleGamepadDisconnected(event) {
        if (event.gamepad.index === this.gamepadIndex) {
            this.connected = false;
            this.gamepadIndex = null;
            this.stopPolling();
            if (this.callbacks.onDisconnect) {
                this.callbacks.onDisconnect();
            }
        }
    }
    startPolling() {
        if (this.pollInterval)
            return;
        this.pollInterval = setInterval(() => {
            this.pollGamepad();
        }, 16); // ~60fps polling
    }
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    pollGamepad() {
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.gamepadIndex];
        if (!gamepad)
            return;
        // Check buttons
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            const pressed = button.pressed;
            if (pressed !== this.lastButtonStates[i]) {
                const buttonName = this.buttonMap[i] || `Button${i}`;
                if (pressed && this.callbacks.onButtonPress) {
                    this.callbacks.onButtonPress(buttonName, button.value);
                }
                else if (!pressed && this.callbacks.onButtonRelease) {
                    this.callbacks.onButtonRelease(buttonName);
                }
                this.lastButtonStates[i] = pressed;
            }
        }
        // Report axis values
        if (this.callbacks.onAxisChange) {
            this.callbacks.onAxisChange({
                leftStickX: gamepad.axes[0],
                leftStickY: gamepad.axes[1],
                rightStickX: gamepad.axes[2],
                rightStickY: gamepad.axes[3],
                leftTrigger: gamepad.buttons[6].value,
                rightTrigger: gamepad.buttons[7].value
            });
        }
    }
    isConnected() {
        return this.connected;
    }
    getGamepad() {
        if (!this.connected || this.gamepadIndex === null)
            return null;
        const gamepads = navigator.getGamepads();
        return gamepads[this.gamepadIndex];
    }
    vibrate(duration = 200, weakMagnitude = 0.5, strongMagnitude = 1.0) {
        const gamepad = this.getGamepad();
        if (gamepad && gamepad.vibrationActuator) {
            gamepad.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: duration,
                weakMagnitude: weakMagnitude,
                strongMagnitude: strongMagnitude
            });
        }
    }
}
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: 0,
            latency: 0,
            memoryUsage: 0,
            lastUpdate: Date.now()
        };
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.callbacks = [];
        this.startMonitoring();
    }
    startMonitoring() {
        this.measureFPS();
        setInterval(() => this.updateMetrics(), APP_CONFIG.PERFORMANCE_MONITOR_INTERVAL);
    }
    measureFPS() {
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFrameTime >= 1000) {
            this.metrics.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
        requestAnimationFrame(() => this.measureFPS());
    }
    updateMetrics() {
        // Update memory usage if available
        if (performance.memory) {
            this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }
        this.metrics.lastUpdate = Date.now();
        this.notifyCallbacks();
    }
    onUpdate(callback) {
        this.callbacks.push(callback);
        return () => {
            this.callbacks = this.callbacks.filter(cb => cb !== callback);
        };
    }
    notifyCallbacks() {
        this.callbacks.forEach(callback => {
            try {
                callback(this.metrics);
            }
            catch (error) {
                console.error('Performance monitor callback error:', error);
            }
        });
    }
    updateLatency(latency) {
        this.metrics.latency = latency;
    }
}
// Core application classes
class RobotConfig {
    constructor(data = {}) {
        // Physical parameters
        this.axleTrack = data.axleTrack || 112.0;
        this.wheelDiameter = data.wheelDiameter || 56.0;
        // Motor ports
        this.leftMotorPort = data.leftMotorPort || "A";
        this.rightMotorPort = data.rightMotorPort || "B";
        this.arm1MotorPort = data.arm1MotorPort || "C";
        this.arm2MotorPort = data.arm2MotorPort || "D";
        // Movement settings
        this.straightSpeed = data.straightSpeed || 500.0;
        this.straightAcceleration = data.straightAcceleration || 250.0;
        this.turnRate = data.turnRate || 200.0;
        this.turnAcceleration = data.turnAcceleration || 300.0;
        // Advanced settings
        this.commandTimeout = data.commandTimeout || APP_CONFIG.DEFAULT_COMMAND_TIMEOUT;
        this.batteryWarning = data.batteryWarning || 20;
        this.autoSave = true;
        this.simulateConnected = data.simulateConnected || false;
        // Calibration data
        this.motorDelay = data.motorDelay || 0.0;
        this.motorDelayConfidence = data.motorDelayConfidence || 0.0;
        this.straightTrackingBias = data.straightTrackingBias || 0.0;
        this.straightTrackingConfidence = data.straightTrackingConfidence || 0.0;
        this.turnBias = data.turnBias || 0.0;
        this.turnConfidence = data.turnConfidence || 0.0;
        this.motorBalanceDifference = data.motorBalanceDifference || 0.0;
        this.motorBalanceConfidence = data.motorBalanceConfidence || 0.0;
        this.gyroDriftRate = data.gyroDriftRate || 0.0;
        this.gyroConfidence = data.gyroConfidence || 0.0;
    }
    toJSON() {
        return { ...this };
    }
    static fromJSON(json) {
        return new RobotConfig(json);
    }
    validate() {
        const errors = [];
        if (this.axleTrack < 50 || this.axleTrack > 300) {
            errors.push('Axle track must be between 50-300mm');
        }
        if (this.wheelDiameter < 20 || this.wheelDiameter > 100) {
            errors.push('Wheel diameter must be between 20-100mm');
        }
        if (this.straightSpeed < 100 || this.straightSpeed > 1000) {
            errors.push('Straight speed must be between 100-1000 deg/s');
        }
        // Check for duplicate motor ports
        const ports = [this.leftMotorPort, this.rightMotorPort, this.arm1MotorPort, this.arm2MotorPort];
        const uniquePorts = new Set(ports);
        if (uniquePorts.size !== ports.length) {
            errors.push('All motor ports must be unique');
        }
        return errors;
    }
}
class BLEController extends EventEmitter {
    constructor() {
        super();
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.connected = false;
        this.connecting = false;
        this.commandQueue = [];
        this.isProcessingQueue = false;
        this.lastCommandTime = 0;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.batteryLevel = null;
        this.hubInfo = null;
        this.isSimulatingConnection = false;
    }
    async connect() {
        if (this.connecting || this.connected) {
            return this.connected;
        }
        this.connecting = true;
        this.connectionAttempts++;
        try {
            // Check for Web Bluetooth API support (non-blocking). If unavailable, prompt alert via init and abort connection.
            if (!navigator.bluetooth || !window.isSecureContext) {
                throw new Error('Bluetooth unavailable in this browser or context. Use a compatible browser over HTTPS for real robot connectivity.');
            }
            this.emit('connecting');
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: APP_CONFIG.HUB_NAME_PREFIX }],
                optionalServices: [
                    APP_CONFIG.BLUETOOTH_SERVICE_UUID,
                    'c5f50001-8280-46da-89f4-6d8051e4aeef', // Pybricks service
                    '6e400001-b5a3-f393-e0a9-e50e24dcca9e' // Nordic UART service
                ]
            });
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });
            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService(APP_CONFIG.BLUETOOTH_SERVICE_UUID);
            this.characteristic = await this.service.getCharacteristic(APP_CONFIG.BLUETOOTH_SERVICE_UUID);
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleIncomingData(event);
            });
            this.connected = true;
            this.connecting = false;
            this.connectionAttempts = 0;
            // Get hub information
            await this.requestHubInfo();
            this.emit('connected', {
                deviceName: this.device.name,
                deviceId: this.device.id
            });
            // Start command queue processing
            this.processCommandQueue();
            return true;
        }
        catch (error) {
            this.connecting = false;
            this.connected = false;
            let errorMessage = error.message;
            // Handle specific Bluetooth errors with user-friendly messages
            if (error.name === 'NotFoundError') {
                errorMessage = 'No Pybricks hub found. Make sure your hub is powered on and in range.';
            }
            else if (error.name === 'NotAllowedError') {
                errorMessage = 'Bluetooth access was denied. Please allow Bluetooth access and try again.';
            }
            else if (error.name === 'SecurityError') {
                errorMessage = 'Bluetooth access requires HTTPS. Please use a secure connection.';
            }
            else if (error.name === 'NetworkError') {
                errorMessage = 'Failed to connect to the hub. Make sure it\'s in range and try again.';
            }
            else if (error.message.includes('User cancelled')) {
                errorMessage = 'Device selection was cancelled.';
            }
            this.emit('connectionError', {
                error: errorMessage,
                originalError: error.message,
                attempt: this.connectionAttempts,
                maxAttempts: this.maxConnectionAttempts
            });
            if (this.connectionAttempts < this.maxConnectionAttempts) {
                // Retry connection with exponential backoff
                const retryDelay = Math.min(2000 * Math.pow(2, this.connectionAttempts - 1), 10000);
                this.logger.log(`Retrying connection in ${retryDelay / 1000} seconds...`, 'info');
                setTimeout(() => this.connect(), retryDelay);
            }
            else {
                this.logger.log('Maximum connection attempts reached. Please try again manually.', 'error');
            }
            return false;
        }
    }
    async disconnect() {
        if (this.device && this.connected) {
            try {
                await this.device.gatt.disconnect();
            }
            catch (error) {
                console.error('Error during disconnect:', error);
            }
        }
        this.handleDisconnection();
    }
    handleDisconnection() {
        this.connected = false;
        this.connecting = false;
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.batteryLevel = null;
        this.hubInfo = null;
        this.emit('disconnected');
    }
    async sendCommand(command, priority = false) {
        if (!this.connected) {
            throw new Error('Not connected to hub');
        }
        const commandWithId = {
            ...command,
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            priority: priority || false
        };
        if (priority) {
            this.commandQueue.unshift(commandWithId);
        }
        else {
            this.commandQueue.push(commandWithId);
        }
        if (!this.isProcessingQueue) {
            this.processCommandQueue();
        }
        return commandWithId.id;
    }
    async processCommandQueue() {
        if (this.isProcessingQueue || !this.connected) {
            return;
        }
        this.isProcessingQueue = true;
        while (this.commandQueue.length > 0 && this.connected) {
            const command = this.commandQueue.shift();
            try {
                const startTime = Date.now();
                await this.sendRawCommand(command);
                const latency = Date.now() - startTime;
                this.emit('commandSent', { command, latency });
                // Update performance monitor
                if (window.app?.performanceMonitor) {
                    window.app.performanceMonitor.updateLatency(latency);
                }
                // Rate limiting
                const timeSinceLastCommand = Date.now() - this.lastCommandTime;
                const minInterval = 50; // Minimum 50ms between commands
                if (timeSinceLastCommand < minInterval) {
                    await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastCommand));
                }
                this.lastCommandTime = Date.now();
            }
            catch (error) {
                this.emit('commandError', { command, error: error.message });
            }
        }
        this.isProcessingQueue = false;
    }
    async sendRawCommand(command) {
        // Handle simulation mode
        if (this.isSimulatingConnection) {
            return this.simulateCommand(command);
        }
        if (!this.characteristic) {
            throw new Error('No characteristic available');
        }
        const commandStr = JSON.stringify(command);
        const encoder = new TextEncoder();
        const data = encoder.encode(commandStr);
        const buffer = new Uint8Array(data.length + 1);
        buffer[0] = 0x06; // Command type
        buffer.set(data, 1);
        await this.characteristic.writeValue(buffer);
    }
    simulateCommand(command) {
        // Simulate command execution with realistic delay
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate different command responses
                switch (command.type) {
                    case 'get_info':
                        this.emit('hubMessage', { message: 'Simulated Pybricks Hub v3.2.0' });
                        break;
                    case 'get_battery':
                        // Battery info is handled by the simulated battery monitoring
                        break;
                    case 'emergency_stop':
                        this.emit('hubMessage', { message: 'Emergency stop activated (simulated)' });
                        break;
                    case 'drive_straight':
                    case 'turn':
                    case 'stop':
                    case 'arm_move':
                        // Simulate movement commands with realistic execution time
                        const duration = command.distance ? Math.abs(command.distance) * 2 : 100;
                        setTimeout(() => {
                            this.emit('hubMessage', { message: 'ok' });
                        }, Math.min(duration, 3000)); // Cap at 3 seconds
                        break;
                    default:
                        this.emit('hubMessage', { message: 'ok' });
                        break;
                }
                resolve();
            }, 10 + Math.random() * 40); // 10-50ms delay to simulate network latency
        });
    }
    handleIncomingData(event) {
        try {
            const value = event.target.value;
            const data = new Uint8Array(value.buffer);
            if (data[0] === 0x01) { // Text response
                const payload = new TextDecoder().decode(data.slice(1));
                this.processHubMessage(payload);
            }
            else if (data[0] === 0x02) { // Battery info
                this.processBatteryInfo(data.slice(1));
            }
            else if (data[0] === 0x03) { // Hub info
                this.processHubInfo(data.slice(1));
            }
        }
        catch (error) {
            this.emit('dataError', { error: error.message });
        }
    }
    processHubMessage(message) {
        this.emit('hubMessage', { message });
        if (message === "ready") {
            this.emit('hubReady');
        }
        else if (message.startsWith("error:")) {
            this.emit('hubError', { error: message.substring(6) });
        }
        else if (message === "ok") {
            this.emit('commandAck');
        }
    }
    processBatteryInfo(data) {
        if (data.length >= 1) {
            this.batteryLevel = data[0];
            this.emit('batteryUpdate', { level: this.batteryLevel });
        }
    }
    processHubInfo(data) {
        try {
            const infoStr = new TextDecoder().decode(data);
            this.hubInfo = JSON.parse(infoStr);
            this.emit('hubInfo', this.hubInfo);
        }
        catch (error) {
            console.error('Error parsing hub info:', error);
        }
    }
    async requestHubInfo() {
        if (this.connected) {
            await this.sendCommand({ type: 'get_info' }, true);
        }
    }
    async requestBatteryLevel() {
        if (this.connected) {
            await this.sendCommand({ type: 'get_battery' }, true);
        }
    }
    emergencyStop() {
        if (this.connected) {
            // Clear command queue and send immediate stop
            this.commandQueue = [];
            this.sendCommand({ type: 'emergency_stop' }, true);
        }
    }
}
class RobotSimulator extends EventEmitter {
    constructor(canvas) {
        super();
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // Robot state
        const rect = this.canvas.getBoundingClientRect();
        this.robotX = rect.width / 2;
        this.robotY = rect.height / 2;
        this.robotAngle = 0;
        this.arm1Angle = 0;
        this.arm2Angle = 0;
        // Physics state
        this.velocity = { x: 0, y: 0, angular: 0 };
        this.acceleration = { x: 0, y: 0, angular: 0 };
        // Target commands
        this.targetSpeed = 0;
        this.targetTurn = 0;
        this.targetArm1Speed = 0;
        this.targetArm2Speed = 0;
        // Physics parameters - will be updated from robot config
        this.robotMass = 2.5;
        this.robotInertia = 0.12;
        this.friction = 0.03;
        this.straightAcceleration = 250; // Default from RobotConfig
        this.turnAcceleration = 300; // Default from RobotConfig
        // Pixels per millimeter scale factor for sim translation
        this.pixelsPerMm = 0.25;
        // Simulation settings
        this.dt = 0.016; // 60 FPS
        this.showTrail = false;
        this.trail = [];
        this.maxTrailLength = 100;
        // Background and obstacles
        this.backgroundMap = null;
        this.obstacles = [];
        // Animation
        this.animationFrame = null;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.setupControls();
        this.setupResizeHandler();
        this.updateCanvasSize();
        this.start();
    }
    setupControls() {
        // Mouse controls for camera
        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };
        this.mouseDownHandler = (e) => {
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        };
        this.mouseMoveHandler = (e) => {
            if (isDragging) {
                const dx = e.clientX - lastMousePos.x;
                const dy = e.clientY - lastMousePos.y;
                // Pan the view
                this.robotX += dx;
                this.robotY += dy;
                lastMousePos = { x: e.clientX, y: e.clientY };
            }
        };
        this.mouseUpHandler = () => {
            isDragging = false;
            this.canvas.style.cursor = 'default';
        };
        // Mouse drag should not move the robot; disable drag listeners
        this.wheelHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        this.touchHandler = (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };
        this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
        this.canvas.addEventListener('touchstart', this.touchHandler, { passive: false });
        this.canvas.addEventListener('touchmove', this.touchHandler, { passive: false });
    }
    setupResizeHandler() {
        this.resizeObserver = new ResizeObserver(() => {
            this.updateCanvasSize();
        });
        this.resizeObserver.observe(this.canvas);
    }
    updateCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const newWidth = Math.floor(rect.width * devicePixelRatio);
        const newHeight = Math.floor(rect.height * devicePixelRatio);
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(devicePixelRatio, devicePixelRatio);
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            this.ctx.textRenderingOptimization = 'optimizeQuality';
            this.pixelRatio = devicePixelRatio;
        }
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.animate();
    }
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
    updateConfig(config) {
        // Update acceleration settings from robot config
        if (config) {
            this.straightAcceleration = config.straightAcceleration || 250;
            this.turnAcceleration = config.turnAcceleration || 300;
        }
    }
    updateCommand(command) {
        // Apply calibration factors if available
        let calibratedCommand = { ...command };
        if (this.calibrationFactors) {
            if (command.type === 'drive') {
                // Apply speed and turn calibration
                calibratedCommand.speed = (command.speed || 0) * this.calibrationFactors.speedMultiplier;
                calibratedCommand.turn_rate = (command.turn_rate || 0) * this.calibrationFactors.turnMultiplier;
                // Apply drift compensation for straight movement
                if (command.turn_rate === 0 && command.speed !== 0) {
                    // Add slight turn to compensate for drift
                    const driftCompensation = this.calibrationFactors.driftCompensation;
                    if (driftCompensation && (driftCompensation.x !== 0 || driftCompensation.y !== 0)) {
                        // Calculate drift compensation angle
                        const driftAngle = Math.atan2(driftCompensation.y, driftCompensation.x) * 180 / Math.PI;
                        calibratedCommand.turn_rate = -driftAngle * 0.1; // Small compensation
                    }
                }
            }
        }
        // Update simulator targets based on command type
        if (calibratedCommand.type === 'drive') {
            this.targetSpeed = calibratedCommand.speed || 0;
            this.targetTurn = calibratedCommand.turn_rate || 0;
        }
        else if (calibratedCommand.type === 'arm1') {
            this.targetArm1Speed = calibratedCommand.speed || 0;
        }
        else if (calibratedCommand.type === 'arm2') {
            this.targetArm2Speed = calibratedCommand.speed || 0;
        }
        // Emit position update for recording/tracking
        this.emit('positionUpdate', {
            x: this.robotX,
            y: this.robotY,
            angle: this.robotAngle,
            command: calibratedCommand
        });
    }
    animate() {
        if (!this.isRunning)
            return;
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.033);
        this.lastTime = currentTime;
        this.updatePhysics(deltaTime);
        this.render();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    updatePhysics(dt) {
        // Update drive physics
        const speedError = this.targetSpeed - this.velocity.x;
        const turnError = this.targetTurn - this.velocity.angular;
        // Calculate desired acceleration based on error
        let desiredAccelX = speedError * 3;
        let desiredAccelAngular = turnError * 3;
        // Limit acceleration to match real robot's acceleration settings
        // The robot uses mm/s² for straight and deg/s² for turn
        this.acceleration.x = this.clamp(desiredAccelX, -this.straightAcceleration, this.straightAcceleration);
        this.acceleration.angular = this.clamp(desiredAccelAngular, -this.turnAcceleration, this.turnAcceleration);
        // Update velocities with acceleration
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.angular += this.acceleration.angular * dt;
        // Apply friction/damping
        this.velocity.x *= (1 - this.friction * dt);
        this.velocity.angular *= (1 - this.friction * dt);
        // Update robot position
        const angleRad = (this.robotAngle * Math.PI) / 180;
        const dx = this.velocity.x * Math.cos(angleRad) * dt * this.pixelsPerMm;
        const dy = this.velocity.x * Math.sin(angleRad) * dt * this.pixelsPerMm;
        this.robotX += dx;
        this.robotY += dy;
        this.robotAngle += this.velocity.angular * dt;
        // Update arm physics
        this.arm1Angle += this.targetArm1Speed * dt * 0.2; // Arm movement rate
        this.arm2Angle += this.targetArm2Speed * dt * 0.2;
        // Clamp arm angles to realistic limits
        this.arm1Angle = this.clamp(this.arm1Angle, -180, 180);
        this.arm2Angle = this.clamp(this.arm2Angle, -180, 180);
        // Keep robot in bounds
        const rect = this.canvas.getBoundingClientRect();
        this.robotX = this.clamp(this.robotX, 30, rect.width - 30);
        this.robotY = this.clamp(this.robotY, 30, rect.height - 30);
        // Clamp arm ranges
        this.arm1Angle = this.clamp(this.arm1Angle, -90, 90);
        this.arm2Angle = this.clamp(this.arm2Angle, -90, 90);
        // Add to trail
        if (this.showTrail) {
            this.trail.push({ x: this.robotX, y: this.robotY });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }
        // Emit position update
        this.emit('positionUpdate', {
            x: this.robotX,
            y: this.robotY,
            angle: this.robotAngle,
            arm1Angle: this.arm1Angle,
            arm2Angle: this.arm2Angle,
            velocity: { ...this.velocity }
        });
    }
    render() {
        if (!this.ctx || !this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0)
            return;
        // Clear with a slight performance optimization
        this.ctx.fillStyle = '#0f0f0f';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        this.ctx.save();
        // Draw background map with preserved aspect ratio (letterbox/pillarbox)
        if (this.backgroundMap) {
            this.ctx.globalAlpha = 1.0;
            const img = this.backgroundMap;
            const canvasW = rect.width;
            const canvasH = rect.height;
            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;
            if (imgW > 0 && imgH > 0) {
                const scale = Math.min(canvasW / imgW, canvasH / imgH);
                const drawW = Math.floor(imgW * scale);
                const drawH = Math.floor(imgH * scale);
                const offsetX = Math.floor((canvasW - drawW) / 2);
                const offsetY = Math.floor((canvasH - drawH) / 2);
                this.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            }
            else {
                this.ctx.drawImage(img, 0, 0, canvasW, canvasH);
            }
            this.ctx.globalAlpha = 1.0;
        }
        // Draw grid
        this.drawGrid();
        // Draw trail
        if (this.showTrail && this.trail.length > 1) {
            this.drawTrail();
        }
        // Draw obstacles
        if (this.obstacles.length > 0) {
            this.drawObstacles();
        }
        // Draw robot
        this.drawRobot();
        this.ctx.restore();
        // Info overlay removed per request
    }
    drawGrid() {
        const rect = this.canvas.getBoundingClientRect();
        const gridSize = 50;
        const pixelRatio = this.pixelRatio || 1;
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 168, 255, 0.08)';
        this.ctx.lineWidth = 0.5;
        this.ctx.globalCompositeOperation = 'multiply';
        this.ctx.beginPath();
        for (let x = 0.5; x <= rect.width; x += gridSize) {
            this.ctx.moveTo(Math.floor(x) + 0.5, 0);
            this.ctx.lineTo(Math.floor(x) + 0.5, rect.height);
        }
        for (let y = 0.5; y <= rect.height; y += gridSize) {
            this.ctx.moveTo(0, Math.floor(y) + 0.5);
            this.ctx.lineTo(rect.width, Math.floor(y) + 0.5);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }
    drawTrail() {
        if (this.trail.length < 2)
            return;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, 'rgba(0, 196, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 196, 255, 0.2)');
        this.ctx.strokeStyle = gradient;
        this.ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const x = Math.round(point.x);
            const y = Math.round(point.y);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            }
            else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
        this.ctx.restore();
    }
    drawObstacles() {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.lineWidth = 2;
        this.obstacles.forEach(obstacle => {
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        });
    }
    drawRobot() {
        this.ctx.save();
        this.ctx.translate(Math.round(this.robotX), Math.round(this.robotY));
        this.ctx.rotate((this.robotAngle * Math.PI) / 180);
        // Robot body shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(-19, -14, 38, 28, 5);
        }
        else {
            this.ctx.rect(-19, -14, 38, 28);
        }
        this.ctx.fill();
        // Robot body gradient
        const gradient = this.ctx.createLinearGradient(-20, -15, -20, 15);
        gradient.addColorStop(0, '#00c4ff');
        gradient.addColorStop(0.5, '#0099cc');
        gradient.addColorStop(1, '#006ba3');
        this.ctx.fillStyle = gradient;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(-20, -15, 40, 30, 6);
        }
        else {
            this.ctx.rect(-20, -15, 40, 30);
        }
        this.ctx.fill();
        this.ctx.stroke();
        // Direction indicator
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(16, -2.5, 6, 5, 1.5);
        }
        else {
            this.ctx.rect(16, -2.5, 6, 5);
        }
        this.ctx.fill();
        this.ctx.stroke();
        // Draw arms
        this.drawArm(-15, -10, this.arm1Angle, '#00e676');
        this.drawArm(-15, 10, this.arm2Angle, '#ff5252');
        // Robot center indicator
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 3, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        // Draw acceleration indicator
        if (Math.abs(this.acceleration.x) > 10 || Math.abs(this.acceleration.angular) > 10) {
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([2, 2]);
            // Draw acceleration vector
            const accelLength = Math.min(Math.abs(this.acceleration.x) * 0.05, 20);
            if (accelLength > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(-25, 0);
                this.ctx.lineTo(-25 - accelLength * Math.sign(this.acceleration.x), 0);
                this.ctx.stroke();
            }
            this.ctx.setLineDash([]);
        }
        this.ctx.restore();
    }
    drawArm(x, y, angle, color) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate((angle * Math.PI) / 180);
        // Arm base
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 5, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
        // Arm shaft with gradient
        const armGradient = this.ctx.createLinearGradient(0, -2, 0, 2);
        armGradient.addColorStop(0, color);
        armGradient.addColorStop(1, this.darkenColor(color, 0.7));
        this.ctx.strokeStyle = armGradient;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(3, 0);
        this.ctx.lineTo(18, 0);
        this.ctx.stroke();
        // Arm end effector
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(17, -3, 7, 6, 2);
        }
        else {
            this.ctx.rect(17, -3, 7, 6);
        }
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }
    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.floor(parseInt(hex.substr(0, 2), 16) * factor);
        const g = Math.floor(parseInt(hex.substr(2, 2), 16) * factor);
        const b = Math.floor(parseInt(hex.substr(4, 2), 16) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }
    drawInfo() {
        // Info panel background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, 10, 250, 140);
        // Info text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Inter';
        const lineHeight = 15;
        let y = 25;
        const info = [
            `Position: (${Math.round(this.robotX)}, ${Math.round(this.robotY)})`,
            `Angle: ${Math.round(this.robotAngle % 360)}°`,
            `Speed: ${Math.round(this.velocity.x)} (target: ${Math.round(this.targetSpeed)})`,
            `Turn Rate: ${Math.round(this.velocity.angular)} (target: ${Math.round(this.targetTurn)})`,
            `Acceleration: ${Math.round(this.acceleration.x)} mm/s²`,
            `Turn Accel: ${Math.round(this.acceleration.angular)} deg/s²`,
            `Arm 1: ${Math.round(this.arm1Angle)}°`,
            `Arm 2: ${Math.round(this.arm2Angle)}°`
        ];
        info.forEach(text => {
            this.ctx.fillText(text, 15, y);
            y += lineHeight;
        });
    }
    updateCommand(command) {
        const cmdType = command.type || "";
        if (cmdType === "drive") {
            this.targetSpeed = (command.speed || 0) * 2;
            this.targetTurn = (command.turn_rate || 0) * 1.5;
        }
        else if (cmdType === "arm1") {
            this.targetArm1Speed = (command.speed || 0) * 1.5;
        }
        else if (cmdType === "arm2") {
            this.targetArm2Speed = (command.speed || 0) * 1.5;
        }
        else if (cmdType === "emergency_stop") {
            this.targetSpeed = 0;
            this.targetTurn = 0;
            this.targetArm1Speed = 0;
            this.targetArm2Speed = 0;
            this.velocity.x = 0;
            this.velocity.angular = 0;
        }
    }
    setBackgroundMap(image) {
        this.backgroundMap = image;
        try {
            const imgW = image.naturalWidth || image.width || 0;
            const imgH = image.naturalHeight || image.height || 0;
            if (imgW > 0 && imgH > 0) {
                const aspect = imgW / imgH;
                // Hint layout to match the image aspect to avoid letterboxing
                this.canvas.style.aspectRatio = aspect.toString();
                // Remove any fixed min-heights to allow aspect to control height
                this.canvas.style.minHeight = '';
                this.canvas.style.height = '';
                // Trigger a resize/update for high-DPI and internal sizing
                if (this.updateCanvasSize) {
                    this.updateCanvasSize();
                }
            }
        }
        catch (e) {
            // no-op
        }
    }
    setPose(x, y, angle = 0, options = { clearTrail: true, resetMotion: true }) {
        const rect = this.canvas.getBoundingClientRect();
        const margin = 30;
        const clampedX = this.clamp(x, margin, Math.max(margin, rect.width - margin));
        const clampedY = this.clamp(y, margin, Math.max(margin, rect.height - margin));
        this.robotX = clampedX;
        this.robotY = clampedY;
        this.robotAngle = angle;
        if (options && options.resetMotion) {
            this.velocity = { x: 0, y: 0, angular: 0 };
            this.targetSpeed = 0;
            this.targetTurn = 0;
            this.targetArm1Speed = 0;
            this.targetArm2Speed = 0;
        }
        if (options && options.clearTrail) {
            this.trail = [];
        }
        this.emit('positionUpdate', {
            x: this.robotX,
            y: this.robotY,
            angle: this.robotAngle,
            arm1Angle: this.arm1Angle,
            arm2Angle: this.arm2Angle,
            velocity: { ...this.velocity }
        });
    }
    toggleTrail() {
        this.showTrail = !this.showTrail;
        if (!this.showTrail) {
            this.trail = [];
        }
    }
    addObstacle(x, y, width, height) {
        this.obstacles.push({ x, y, width, height });
    }
    clearObstacles() {
        this.obstacles = [];
    }
    reset() {
        // Default reset centers the robot; callers in app may reposition after
        this.robotX = this.canvas.clientWidth / 2;
        this.robotY = this.canvas.clientHeight / 2;
        this.robotAngle = 0;
        this.arm1Angle = 0;
        this.arm2Angle = 0;
        this.velocity = { x: 0, y: 0, angular: 0 };
        this.targetSpeed = 0;
        this.targetTurn = 0;
        this.targetArm1Speed = 0;
        this.targetArm2Speed = 0;
        this.trail = [];
    }
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    destroy() {
        this.stop();
        // Remove event listeners
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
            this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
            this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
            this.canvas.removeEventListener('wheel', this.wheelHandler);
            this.canvas.removeEventListener('touchstart', this.touchHandler);
            this.canvas.removeEventListener('touchmove', this.touchHandler);
        }
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}
// Main application class
class FLLRoboticsApp extends EventEmitter {
    constructor() {
        super();
        // Core components
        this.logger = new Logger();
        this.toastManager = new ToastManager();
        this.performanceMonitor = new PerformanceMonitor();
        this.bleController = new BLEController();
        this.xboxController = new XboxControllerHandler();
        this.robotSimulator = null;
        this.config = new RobotConfig();
        // Application state
        this.isCalibrated = false;
        this.isRecording = false;
        this.recordedCommands = [];
        this.recordingStartTime = 0;
        this.recordingTimer = null;
        this.savedRuns = new Map();
        // Control state
        this.pressedKeys = new Set();
        this.emergencyStopActive = false;
        this.xboxAxisValues = {
            leftStickX: 0,
            leftStickY: 0,
            rightStickX: 0,
            rightStickY: 0,
            leftTrigger: 0,
            rightTrigger: 0
        };
        this.xboxButtonsPressed = new Set();
        // Auto-save
        this.autoSaveTimer = null;
        // Simulation
        this.simulatedBatteryInterval = null;
        // Coordinate system
        this.startCorner = 'BL'; // 'BL' or 'BR'
        this.recordedPath = [];
        this.odom = { x: 0, y: 0, thetaDeg: 0 };
        this.lastOdomTimestamp = 0;
        this.simCanvasSize = { width: 0, height: 0 };
        this.lastDriveCmd = { speed: 0, turn_rate: 0 };
        this.odomTimer = null;
        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        this.playbackMode = null; // 'path' | 'commands'
        this.playbackIndex = 0;
        this.playbackTimerId = null; // setInterval for path mode
        this.playbackCurrentTimeout = null; // setTimeout for commands mode
        this.playbackStartEpoch = 0; // Date.now() at start/resume
        this.playbackElapsedBeforePause = 0; // ms accumulated before pause
        this.playbackRun = null; // currently playing run
        this.playbackCommands = null; // commands array if in commands mode
        // Note: init() will be called explicitly after construction
    }
    async init() {
        try {
            console.log('Starting application initialization...');
            // Removed showLoadingScreen() - app loads immediately
            console.log('Checking browser compatibility...');
            // Check browser compatibility
            this.checkBrowserCompatibility();
            console.log('Loading user data...');
            // Load saved data
            await this.loadUserData();
            console.log('Setting up event listeners...');
            // Setup event listeners
            this.setupEventListeners();
            console.log('Setting up robot simulator...');
            // Setup robot simulator
            this.setupRobotSimulator();
            console.log('Setting up BLE controller events...');
            // Setup BLE controller events
            this.setupBLEEvents();
            console.log('Setting up performance monitoring...');
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            console.log('Setting up auto-save...');
            // Setup auto-save
            this.setupAutoSave();
            console.log('Setting up keyboard controls...');
            // Setup keyboard controls
            this.setupKeyboardControls();
            // Setup Xbox controller
            this.setupXboxController();
            console.log('Updating UI...');
            // Initialize UI
            this.updateUI();
            // Removed hideLoadingScreen() - app is already visible
            // Setup robot simulator now that app is visible (delayed to ensure DOM is ready)
            if (!this.robotSimulator) {
                setTimeout(() => this.setupRobotSimulator(), 100);
            }
            console.log('Application initialized successfully!');
            this.logger.log('Application initialized successfully', 'success');
            this.toastManager.show('Welcome to CodLess™!', 'success');
        }
        catch (error) {
            console.error('Failed to initialize application:', error);
            // Show error message using toast or logger
            this.logger?.log(`Initialization failed: ${error.message}`, 'error');
            this.toastManager?.show(`Failed to initialize: ${error.message}`, 'error');
            // Show error in the app container
            const appContainer = document.getElementById('appContainer');
            if (appContainer && !this.logger) {
                // If logger isn't available, show error directly in app container
                appContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px;">
                        <div style="text-align: center;">
                            <i class="fas fa-exclamation-triangle" style="color: #ff4757; font-size: 48px; margin-bottom: 20px;"></i>
                            <h2 style="color: #ff4757; margin-bottom: 10px;">Initialization Failed</h2>
                            <p style="color: #666; margin-bottom: 20px;">
                                ${error.message}
                            </p>
                            <button onclick="location.reload()" style="
                                background: #00a8ff; 
                                color: white; 
                                border: none; 
                                padding: 10px 20px; 
                                border-radius: 5px; 
                                cursor: pointer;
                                font-size: 14px;
                            ">
                                Retry
                            </button>
                        </div>
                    </div>
                `;
            }
            // Re-throw the error so it can be caught by the DOMContentLoaded handler
            throw error;
        }
    }
    checkBrowserCompatibility() {
        const warnings = [];
        // Check for Web Bluetooth API
        if (!navigator.bluetooth) {
            warnings.push('Web Bluetooth API is not supported. Robot connectivity will not work. Please use Chrome 56+, Edge 79+, or another compatible browser.');
        }
        // Check for secure context (HTTPS)
        if (!window.isSecureContext) {
            warnings.push('This application requires HTTPS for full functionality. Some features may not work properly.');
        }
        // Check for Service Worker support
        if (!('serviceWorker' in navigator)) {
            warnings.push('Service Worker is not supported. Offline functionality will be limited.');
        }
        // Check for Web Serial API (optional, for future features)
        if (!('serial' in navigator)) {
            console.info('Web Serial API not supported - this is optional and does not affect current functionality.');
        }
        // Show warnings if any
        if (warnings.length > 0) {
            setTimeout(() => {
                warnings.forEach(warning => {
                    this.toastManager.show(warning, 'warning', 10000);
                    this.logger.log(`Compatibility Warning: ${warning}`, 'warning');
                });
            }, 3000); // Show after loading screen
        }
        // Log browser info
        const userAgent = navigator.userAgent;
        const isChrome = userAgent.includes('Chrome');
        const isEdge = userAgent.includes('Edge');
        const isFirefox = userAgent.includes('Firefox');
        const isSafari = userAgent.includes('Safari') && !isChrome;
        this.logger.log(`Browser: ${isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Unknown'}`, 'info');
        this.logger.log(`Secure Context: ${window.isSecureContext ? 'Yes' : 'No'}`, 'info');
        this.logger.log(`Bluetooth Support: ${navigator.bluetooth ? 'Yes' : 'No'}`, 'info');
    }
    async loadUserData() {
        try {
            // Load configuration
            try {
                const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
                if (savedConfig) {
                    this.config = RobotConfig.fromJSON(JSON.parse(savedConfig));
                }
            }
            catch (configError) {
                console.error('Error loading config:', configError);
                localStorage.removeItem(STORAGE_KEYS.CONFIG);
            }
            // Load saved runs
            const savedRuns = localStorage.getItem(STORAGE_KEYS.SAVED_RUNS);
            if (savedRuns) {
                try {
                    const runsData = JSON.parse(savedRuns);
                    if (runsData && typeof runsData === 'object') {
                        this.savedRuns = new Map(Object.entries(runsData));
                    }
                }
                catch (parseError) {
                    console.error('Error parsing saved runs:', parseError);
                    localStorage.removeItem(STORAGE_KEYS.SAVED_RUNS);
                    this.savedRuns = new Map();
                }
            }
            // Load calibration data
            try {
                const calibrationData = localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA);
                if (calibrationData) {
                    const data = JSON.parse(calibrationData);
                    Object.assign(this.config, data);
                    this.isCalibrated = true;
                }
            }
            catch (calibrationError) {
                console.error('Error loading calibration data:', calibrationError);
                localStorage.removeItem(STORAGE_KEYS.CALIBRATION_DATA);
            }
            // Load user preferences
            try {
                const preferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
                if (preferences) {
                    const prefs = JSON.parse(preferences);
                    this.startCorner = prefs.startCorner || 'BL';
                }
            }
            catch (prefsError) {
                console.error('Error loading user preferences:', prefsError);
                localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
            }
        }
        catch (error) {
            console.error('Error loading user data:', error);
            // If there's a critical error, offer to reset all data
            this.clearCorruptedData();
        }
        // Auto-enable simulation if Bluetooth is unavailable
        if (!navigator.bluetooth && !this.config.simulateConnected) {
            this.config.simulateConnected = true;
            try {
                localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
            }
            catch (e) { }
            this.logger.log('Bluetooth not supported; enabling simulated connection automatically.', 'warning');
            this.toastManager.show('Bluetooth not supported in this browser. Simulated connection has been enabled automatically.', 'warning', 8000);
        }
        // Apply simulation state after loading config
        console.log('Loading user data complete, applying simulation state...');
        this.applySimulationState();
    }
    applySimulationState() {
        // Apply simulation state based on current config
        console.log('Applying simulation state:', {
            simulateConnected: this.config.simulateConnected,
            bleConnected: this.bleController.connected,
            isSimulating: this.bleController.isSimulatingConnection
        });
        if (this.config.simulateConnected && !this.bleController.connected && !this.bleController.isSimulatingConnection) {
            // Start simulation
            this.bleController.isSimulatingConnection = true;
            this.bleController.connected = true;
            this.updateConnectionUI('connected', 'Simulated Robot');
            this.toastManager.show('🤖 Simulated connection enabled.', 'success', 4000);
            this.logger.log('Simulated connection enabled', 'info');
            this.startSimulatedBatteryMonitoring();
            this.updateSimulatorVisibility();
        }
        else if (!this.config.simulateConnected && this.bleController.isSimulatingConnection) {
            // Stop simulation
            this.bleController.isSimulatingConnection = false;
            this.bleController.connected = false;
            this.updateConnectionUI('disconnected');
            this.toastManager.show('Simulated connection disabled', 'info');
            this.logger.log('Simulated connection disabled', 'info');
            this.stopSimulatedBatteryMonitoring();
            this.updateSimulatorVisibility();
        }
        else if (this.config.simulateConnected && this.bleController.connected && !this.bleController.isSimulatingConnection) {
            this.toastManager.show('Disconnect from real robot first to enable simulated connection', 'warning');
        }
        else if (!this.config.simulateConnected && this.bleController.connected && !this.bleController.isSimulatingConnection) {
            this.updateConnectionUI('connected', this.bleController.device?.name || 'Pybricks Hub');
        }
        else {
            console.log('No simulation state change needed');
        }
    }
    startSimulatedBatteryMonitoring() {
        // Simulate battery updates - keep at 100% for testing purposes
        if (this.simulatedBatteryInterval) {
            clearInterval(this.simulatedBatteryInterval);
        }
        this.simulatedBatteryInterval = setInterval(() => {
            if (this.bleController.isSimulatingConnection) {
                // Emit battery update event - always 100% for testing
                this.bleController.emit('batteryUpdate', {
                    level: 100,
                    voltage: 8.4 // Full battery voltage
                });
            }
        }, 10000); // Update every 10 seconds
    }
    stopSimulatedBatteryMonitoring() {
        if (this.simulatedBatteryInterval) {
            clearInterval(this.simulatedBatteryInterval);
            this.simulatedBatteryInterval = null;
        }
    }
    // Helper method to clear potentially corrupted localStorage data
    clearCorruptedData() {
        try {
            console.warn('Clearing potentially corrupted localStorage data');
            localStorage.removeItem(STORAGE_KEYS.SAVED_RUNS);
            localStorage.removeItem(STORAGE_KEYS.CONFIG);
            localStorage.removeItem(STORAGE_KEYS.CALIBRATION_DATA);
            localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
            // Reinitialize with defaults
            this.savedRuns = new Map();
            this.config = new RobotConfig();
            this.isCalibrated = false;
        }
        catch (clearError) {
            console.error('Error clearing corrupted data:', clearError);
        }
    }
    // Helper function to get saved runs as array (handles both Map and array formats)
    getSavedRunsArray() {
        try {
            const savedRunsData = localStorage.getItem(STORAGE_KEYS.SAVED_RUNS);
            let savedRuns = [];
            if (savedRunsData) {
                try {
                    const parsedData = JSON.parse(savedRunsData);
                    // Handle both Map-like object structure and array structure
                    if (Array.isArray(parsedData)) {
                        savedRuns = parsedData;
                    }
                    else if (typeof parsedData === 'object' && parsedData !== null) {
                        // Convert object entries to array format
                        savedRuns = Object.values(parsedData);
                    }
                }
                catch (error) {
                    console.error('Error parsing saved runs data:', error);
                    // Clear corrupted data and return empty array
                    localStorage.removeItem(STORAGE_KEYS.SAVED_RUNS);
                    savedRuns = [];
                }
            }
            // Ensure we always return an array
            return Array.isArray(savedRuns) ? savedRuns : [];
        }
        catch (error) {
            console.error('Error in getSavedRunsArray:', error);
            return [];
        }
    }
    saveUserData() {
        try {
            localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
            // Use array format for consistency
            const savedRunsArray = this.getSavedRunsArray();
            localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(savedRunsArray));
            localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify({
                startCorner: this.startCorner
            }));
            if (this.isCalibrated) {
                const calibrationData = {
                    motorDelay: this.config.motorDelay,
                    motorDelayConfidence: this.config.motorDelayConfidence,
                    straightTrackingBias: this.config.straightTrackingBias,
                    straightTrackingConfidence: this.config.straightTrackingConfidence,
                    turnBias: this.config.turnBias,
                    turnConfidence: this.config.turnConfidence,
                    motorBalanceDifference: this.config.motorBalanceDifference,
                    motorBalanceConfidence: this.config.motorBalanceConfidence,
                    gyroDriftRate: this.config.gyroDriftRate,
                    gyroConfidence: this.config.gyroConfidence
                };
                localStorage.setItem(STORAGE_KEYS.CALIBRATION_DATA, JSON.stringify(calibrationData));
            }
        }
        catch (error) {
            console.error('Error saving user data:', error);
            this.toastManager.show('Failed to save user data', 'error');
        }
    }
    setupEventListeners() {
        // Hub connection
        document.getElementById('connectBtn')?.addEventListener('click', () => this.toggleConnection());
        document.getElementById('connectXboxBtn')?.addEventListener('click', () => this.connectXboxController());
        // Configuration
        document.getElementById('configBtn')?.addEventListener('click', () => this.openConfigModal());
        // Competition code
        document.getElementById('uploadToHubBtn')?.addEventListener('click', () => this.uploadToHub());
        // Start corner selection
        document.getElementById('cornerBLBtn')?.addEventListener('click', () => this.setStartCorner('BL'));
        document.getElementById('cornerBRBtn')?.addEventListener('click', () => this.setStartCorner('BR'));
        // Recording controls
        document.getElementById('recordBtn')?.addEventListener('click', () => this.toggleRecording());
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveCurrentRun());
        document.getElementById('pauseBtn')?.addEventListener('click', () => this.pauseRecording());
        // Run management
        document.getElementById('savedRunsList')?.addEventListener('change', (e) => this.selectRun(e.target.value));
        document.getElementById('playBtn')?.addEventListener('click', () => this.playSelectedRun());
        document.getElementById('deleteBtn')?.addEventListener('click', () => this.deleteSelectedRun());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportSelectedRun());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importRun());
        // Simulator controls removed (upload map, reset, fullscreen)
        // Emergency controls
        document.getElementById('emergencyStopBtn')?.addEventListener('click', () => this.emergencyStop());
        // Log controls
        document.getElementById('clearLogBtn')?.addEventListener('click', () => this.clearLog());
        document.getElementById('exportLogBtn')?.addEventListener('click', () => this.exportLog());
        // Window controls
        document.querySelector('.minimize-btn')?.addEventListener('click', () => this.minimizeWindow());
        document.querySelector('.maximize-btn')?.addEventListener('click', () => this.toggleMaximize());
        document.querySelector('.close-btn')?.addEventListener('click', () => this.closeWindow());
        // Modal click outside handlers
        document.addEventListener('click', (e) => {
            if (e.target.id === 'xboxConnectModal' && e.target.classList.contains('modal')) {
                this.cancelXboxConnection();
            }
        });
        // Logger events
        this.logger.onLog((entry) => this.displayLogEntry(entry));
    }
    setupRobotSimulator() {
        // Don't create a new simulator if one already exists
        if (this.robotSimulator) {
            return;
        }
        const canvas = document.getElementById('robotSimulator');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            this.simCanvasSize = { width: rect.width, height: rect.height };
            // Check if the canvas is visible and has dimensions
            // If not, we'll set it up later when the app container becomes visible
            if (rect.width === 0 || rect.height === 0) {
                console.log('Canvas not ready yet, will initialize simulator later');
                // Don't set up infinite retry loop during initialization
                // The simulator will be set up when the app becomes visible
                return;
            }
            this.setupHighDPICanvas(canvas);
            this.robotSimulator = new RobotSimulator(canvas);
            this.robotSimulator.updateConfig(this.config);
            this.robotSimulator.on('positionUpdate', (data) => this.onSimulatorUpdate(data));
            // Initialize robot pose to the selected start corner at simulator creation
            try {
                const rect2 = canvas.getBoundingClientRect();
                const margin = 30;
                const startX = this.startCorner === 'BL' ? margin : Math.max(margin, rect2.width - margin);
                const startY = Math.max(margin, rect2.height - margin);
                this.robotSimulator.setPose(startX, startY, 0, { clearTrail: true, resetMotion: true });
            }
            catch (e) {
                console.warn('Failed to set initial simulator pose:', e);
            }
            // Load default background map image for simulator
            try {
                const defaultMap = new Image();
                defaultMap.onload = () => {
                    this.robotSimulator.setBackgroundMap(defaultMap);
                };
                defaultMap.src = 'assets/images/Unearthed_Map.png';
            }
            catch (e) {
                console.warn('Failed to load default simulator map:', e);
            }
        }
    }
    setupHighDPICanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const width = Math.floor(rect.width * devicePixelRatio);
        const height = Math.floor(rect.height * devicePixelRatio);
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(devicePixelRatio, devicePixelRatio);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.textRenderingOptimization = 'optimizeQuality';
    }
    setupBLEEvents() {
        this.bleController.on('connecting', () => {
            this.updateConnectionUI('connecting');
            this.toastManager.show('Connecting to hub...', 'info');
        });
        this.bleController.on('connected', (data) => {
            this.updateConnectionUI('connected', data.deviceName);
            this.toastManager.show(`Connected to ${data.deviceName}`, 'success');
            this.logger.log(`Connected to ${data.deviceName}`, 'success');
            this.startBatteryMonitoring();
        });
        this.bleController.on('disconnected', () => {
            this.updateConnectionUI('disconnected');
            this.toastManager.show('Hub disconnected', 'warning');
            this.logger.log('Hub disconnected', 'warning');
            // Stop recording if in progress when disconnected
            if (this.isRecording) {
                this.stopRecording();
                this.toastManager.show('Recording stopped due to disconnection', 'warning');
            }
        });
        this.bleController.on('connectionError', (data) => {
            this.updateConnectionUI('error');
            this.toastManager.show(`Connection failed: ${data.error}`, 'error');
            this.logger.log(`Connection failed: ${data.error}`, 'error');
            // Stop recording if in progress when connection fails
            if (this.isRecording) {
                this.stopRecording();
                this.toastManager.show('Recording stopped due to connection error', 'warning');
            }
            // Show troubleshooting help after multiple failed attempts
            if (data.attempt >= 3) {
                setTimeout(() => {
                    this.showTroubleshootingHelp();
                }, 2000);
            }
        });
        this.bleController.on('batteryUpdate', (data) => {
            this.updateBatteryUI(data.level);
            if (data.level <= this.config.batteryWarning) {
                this.toastManager.show(`Low battery: ${data.level}%`, 'warning');
            }
        });
        this.bleController.on('hubMessage', (data) => {
            this.logger.log(`Hub: ${data.message}`, 'info');
        });
        this.bleController.on('hubError', (data) => {
            this.logger.log(`Hub Error: ${data.error}`, 'error');
            this.toastManager.show(`Hub Error: ${data.error}`, 'error');
        });
    }
    setupPerformanceMonitoring() {
        this.performanceMonitor.onUpdate((metrics) => {
            this.updatePerformanceUI(metrics);
        });
    }
    setupAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            this.saveUserData();
        }, APP_CONFIG.AUTO_SAVE_INTERVAL);
    }
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        // Prevent default for game keys when not in input fields
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                const gameKeys = ['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', ' '];
                if (gameKeys.includes(e.key.toLowerCase())) {
                    e.preventDefault();
                }
            }
        });
    }
    setupXboxController() {
        // Set up callbacks
        this.xboxController.callbacks.onConnect = (gamepad) => {
            // Update modal to success state
            const modal = document.getElementById('xboxConnectModal');
            if (modal && modal.style.display === 'block') {
                const modalContent = modal.querySelector('.xbox-modal-content');
                const title = modal.querySelector('#xboxModalTitle');
                const statusText = modal.querySelector('.xbox-status-text');
                modalContent.classList.add('success');
                title.textContent = 'Controller Connected!';
                statusText.textContent = gamepad.id;
                // Hide modal after success animation
                setTimeout(() => {
                    this.hideXboxConnectModal();
                }, 1500);
            }
            this.updateXboxControllerUI('connected', gamepad.id);
            this.toastManager.show('Xbox Controller connected!', 'success');
            this.logger.log(`Xbox Controller connected: ${gamepad.id}`, 'info');
        };
        this.xboxController.callbacks.onDisconnect = () => {
            this.updateXboxControllerUI('disconnected');
            this.toastManager.show('Xbox Controller disconnected', 'info');
            this.logger.log('Xbox Controller disconnected', 'info');
        };
        this.xboxController.callbacks.onButtonPress = (button, value) => {
            this.handleXboxButtonPress(button, value);
        };
        this.xboxController.callbacks.onButtonRelease = (button) => {
            this.handleXboxButtonRelease(button);
        };
        this.xboxController.callbacks.onAxisChange = (axes) => {
            this.xboxAxisValues = axes;
            this.processXboxMovement();
            // Update trigger display bars
            const leftTriggerBar = document.getElementById('leftTriggerBar');
            const rightTriggerBar = document.getElementById('rightTriggerBar');
            if (leftTriggerBar) {
                leftTriggerBar.style.width = `${axes.leftTrigger * 100}%`;
            }
            if (rightTriggerBar) {
                rightTriggerBar.style.width = `${axes.rightTrigger * 100}%`;
            }
        };
    }
    connectXboxController() {
        if (this.xboxController.isConnected()) {
            this.toastManager.show('Xbox Controller already connected', 'info');
            return;
        }
        // Show the modal
        this.showXboxConnectModal();
        this.logger.log('Waiting for Xbox controller connection...', 'info');
    }
    showXboxConnectModal() {
        const modal = document.getElementById('xboxConnectModal');
        if (modal) {
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
            // Reset modal state
            const modalContent = modal.querySelector('.xbox-modal-content');
            modalContent.classList.remove('success');
            const title = modal.querySelector('#xboxModalTitle');
            const statusText = modal.querySelector('.xbox-status-text');
            title.textContent = 'Searching for Xbox Controller';
            statusText.textContent = 'Press any button on your Xbox controller to connect...';
            // Reset the 3D model auto-rotation
            const modelViewer = modal.querySelector('#xboxController3D');
            if (modelViewer) {
                // Remove and re-add the auto-rotate attribute to restart the animation
                modelViewer.removeAttribute('auto-rotate');
                // Use setTimeout to ensure the attribute removal is processed before re-adding
                setTimeout(() => {
                    modelViewer.setAttribute('auto-rotate', '');
                }, 10);
            }
            // Set a timeout to close the modal if no controller connects
            this.xboxConnectionTimeout = setTimeout(() => {
                if (!this.xboxController.isConnected()) {
                    this.hideXboxConnectModal();
                    this.toastManager.show('No Xbox controller found. Make sure your controller is connected via Bluetooth and try again.', 'warning');
                }
            }, 30000); // 30 seconds timeout
        }
    }
    hideXboxConnectModal() {
        const modal = document.getElementById('xboxConnectModal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
        // Clear the timeout if it exists
        if (this.xboxConnectionTimeout) {
            clearTimeout(this.xboxConnectionTimeout);
            this.xboxConnectionTimeout = null;
        }
    }
    cancelXboxConnection() {
        this.hideXboxConnectModal();
        this.toastManager.show('Xbox controller connection cancelled', 'info');
    }
    handleXboxButtonPress(button, value) {
        this.xboxButtonsPressed.add(button);
        // Emergency stop with Menu button
        if (button === 'Menu') {
            this.emergencyStop();
            return;
        }
        // Process movement for buttons that affect it
        if (['A', 'B', 'X', 'Y'].includes(button)) {
            this.processXboxMovement();
        }
        // Record button press if recording
        if (this.isRecording) {
            this.recordXboxEvent('buttonPress', button, value);
        }
    }
    handleXboxButtonRelease(button) {
        this.xboxButtonsPressed.delete(button);
        // Process movement for buttons that affect it
        if (['A', 'B', 'X', 'Y'].includes(button)) {
            this.processXboxMovement();
        }
        // Record button release if recording
        if (this.isRecording) {
            this.recordXboxEvent('buttonRelease', button);
        }
    }
    applySmoothCurve(value) {
        // Apply a quadratic curve for smoother control
        // This gives more precision at low speeds and full speed at max
        // You can adjust the curve by changing the exponent (2.0 = quadratic, 3.0 = cubic, etc.)
        const deadzone = 0.05; // Small deadzone to prevent drift
        if (Math.abs(value) < deadzone)
            return 0;
        // Apply quadratic curve
        const sign = Math.sign(value);
        const magnitude = Math.abs(value);
        const curved = Math.pow(magnitude, 2.0);
        return sign * curved;
    }
    processXboxMovement() {
        if (this.emergencyStopActive)
            return;
        // Get maximum speed from config (default 500)
        const maxSpeed = this.config.straightSpeed || 500;
        const maxTurnRate = this.config.turnRate || 200;
        // Calculate proportional drive command from triggers
        // Apply a smooth curve for better control feel (quadratic for more precision at low speeds)
        const rightTriggerValue = this.applySmoothCurve(this.xboxAxisValues.rightTrigger);
        const leftTriggerValue = this.applySmoothCurve(this.xboxAxisValues.leftTrigger);
        const forwardSpeed = rightTriggerValue * maxSpeed;
        const reverseSpeed = leftTriggerValue * maxSpeed;
        const speed = forwardSpeed - reverseSpeed;
        // Calculate proportional turn from left stick (already -1 to 1)
        // Apply a small deadzone to prevent drift
        const stickX = Math.abs(this.xboxAxisValues.leftStickX) < 0.1 ? 0 : this.xboxAxisValues.leftStickX;
        const turn = -stickX * maxTurnRate;
        this.sendRobotCommand({ type: 'drive', speed, turn_rate: turn });
        // Update speed display
        const speedDisplay = document.getElementById('xboxSpeedDisplay');
        if (speedDisplay) {
            speedDisplay.textContent = Math.round(speed);
        }
        // Calculate arm commands
        // Use right stick Y for arm1 (up/down on right stick)
        // Use buttons for arm2 (or could use right stick X)
        let arm1Speed = 0;
        let arm2Speed = 0;
        // Right stick Y-axis for smooth arm1 control
        const stickY = Math.abs(this.xboxAxisValues.rightStickY) < 0.1 ? 0 : this.xboxAxisValues.rightStickY;
        if (stickY !== 0) {
            arm1Speed = -stickY * 200; // Negative because stick up is negative
        }
        else if (this.xboxButtonsPressed.has('A')) {
            arm1Speed = 200;
        }
        else if (this.xboxButtonsPressed.has('B')) {
            arm1Speed = -200;
        }
        // Buttons for arm2 (could also use right stick X for smooth control)
        if (this.xboxButtonsPressed.has('X'))
            arm2Speed = 200;
        if (this.xboxButtonsPressed.has('Y'))
            arm2Speed = -200;
        this.sendRobotCommand({ type: 'arm1', speed: arm1Speed });
        this.sendRobotCommand({ type: 'arm2', speed: arm2Speed });
    }
    updateXboxControllerUI(status, deviceName = null) {
        const statusDiv = document.getElementById('xboxStatus');
        const helpDiv = document.getElementById('xboxControllerHelp');
        if (!statusDiv)
            return;
        const statusIndicator = statusDiv.parentElement;
        if (status === 'connected') {
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            statusDiv.querySelector('span').textContent = `Xbox Controller Connected${deviceName ? ': ' + deviceName : ''}`;
            if (helpDiv)
                helpDiv.style.display = 'block';
        }
        else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusDiv.querySelector('span').textContent = 'Xbox Controller Disconnected';
            if (helpDiv)
                helpDiv.style.display = 'none';
            // Reset trigger displays
            const leftTriggerBar = document.getElementById('leftTriggerBar');
            const rightTriggerBar = document.getElementById('rightTriggerBar');
            const speedDisplay = document.getElementById('xboxSpeedDisplay');
            if (leftTriggerBar)
                leftTriggerBar.style.width = '0%';
            if (rightTriggerBar)
                rightTriggerBar.style.width = '0%';
            if (speedDisplay)
                speedDisplay.textContent = '0';
        }
    }
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
            return;
        const key = e.key.toLowerCase();
        // Emergency stop
        if (key === ' ') {
            this.emergencyStop();
            return;
        }
        if (!this.pressedKeys.has(key)) {
            this.pressedKeys.add(key);
            this.processMovementKeys();
            // Record the keydown event
            if (this.isRecording) {
                this.recordKeyEvent('keydown', key);
            }
        }
    }
    handleKeyUp(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
            return;
        const key = e.key.toLowerCase();
        if (this.pressedKeys.has(key)) {
            this.pressedKeys.delete(key);
            this.processMovementKeys();
            // Record the keyup event
            if (this.isRecording) {
                this.recordKeyEvent('keyup', key);
            }
        }
    }
    recordKeyEvent(type, key) {
        if (!this.isRecording)
            return;
        this.recordedCommands.push({
            timestamp: Date.now() - this.recordingStartTime,
            type,
            key,
            eventType: 'keyboard'
        });
    }
    recordXboxEvent(type, button, value = null) {
        if (!this.isRecording)
            return;
        const event = {
            timestamp: Date.now() - this.recordingStartTime,
            type,
            button,
            eventType: 'xbox'
        };
        if (value !== null) {
            event.value = value;
        }
        // Also record axis values for movement
        if (type === 'buttonPress' || type === 'buttonRelease') {
            event.axes = { ...this.xboxAxisValues };
        }
        this.recordedCommands.push(event);
    }
    processMovementKeys() {
        if (this.emergencyStopActive)
            return;
        // Calculate drive command
        let speed = 0;
        let turn = 0;
        if (this.pressedKeys.has('w'))
            speed += 200;
        if (this.pressedKeys.has('s'))
            speed -= 200;
        if (this.pressedKeys.has('a'))
            turn -= 100;
        if (this.pressedKeys.has('d'))
            turn += 100;
        // Send drive command - robot will accelerate/decelerate to target speed
        this.sendRobotCommand({ type: 'drive', speed, turn_rate: turn });
        // Calculate arm commands
        let arm1Speed = 0;
        let arm2Speed = 0;
        if (this.pressedKeys.has('q'))
            arm1Speed = 200;
        if (this.pressedKeys.has('e'))
            arm1Speed = -200;
        if (this.pressedKeys.has('r'))
            arm2Speed = 200;
        if (this.pressedKeys.has('f'))
            arm2Speed = -200;
        this.sendRobotCommand({ type: 'arm1', speed: arm1Speed });
        this.sendRobotCommand({ type: 'arm2', speed: arm2Speed });
    }
    async sendRobotCommand(command) {
        try {
            // Apply calibration compensation
            const compensatedCommand = this.applyCalibrationCompensation(command);
            // Send to appropriate controller
            if (this.bleController.connected && !this.bleController.isSimulatingConnection) {
                await this.bleController.sendCommand(compensatedCommand);
            }
            else if (this.bleController.isSimulatingConnection) {
                // Send to visual simulator if available
                this.robotSimulator?.updateCommand(compensatedCommand);
                this.logger.log(`SIMULATED: ${this.formatCommandForLog(compensatedCommand)}`, 'info');
            }
            // Record if recording
            if (this.isRecording) {
                this.recordCommand(compensatedCommand);
            }
            // Keep last drive command for odometry if not in simulator
            if (compensatedCommand.type === 'drive') {
                this.lastDriveCmd = { speed: compensatedCommand.speed || 0, turn_rate: compensatedCommand.turn_rate || 0 };
                this.startOdomIntegration();
            }
        }
        catch (error) {
            this.logger.log(`Command error: ${error.message}`, 'error');
        }
    }
    applyCalibrationCompensation(command) {
        if (!this.isCalibrated || !this.calibrationData)
            return command;
        const compensated = { ...command };
        if (command.type === 'drive') {
            // Apply speed calibration
            if (this.calibrationData.speedAccuracy !== 1.0) {
                compensated.speed = (command.speed || 0) * this.calibrationData.speedAccuracy;
            }
            // Apply turn calibration
            if (this.calibrationData.turnAccuracy !== 1.0) {
                compensated.turn_rate = (command.turn_rate || 0) * this.calibrationData.turnAccuracy;
            }
            // Apply drift compensation for straight movement
            if (Math.abs(command.speed || 0) > 0 && Math.abs(command.turn_rate || 0) === 0) {
                const drift = this.calibrationData.straightDrift;
                if (drift && (drift.x !== 0 || drift.y !== 0)) {
                    // Calculate compensation turn rate to counteract drift
                    const driftAngle = Math.atan2(drift.y, drift.x) * 180 / Math.PI;
                    compensated.turn_rate = -driftAngle * 0.1; // Small compensation
                }
            }
            // Fallback to old calibration system if new data not available
            if (!this.calibrationData.speedAccuracy && this.config) {
                // Apply straight tracking compensation
                if (Math.abs(command.speed || 0) > 0 && Math.abs(command.turn_rate || 0) === 0) {
                    if (this.config.straightTrackingConfidence > 0.5) {
                        compensated.turn_rate = -this.config.straightTrackingBias * (command.speed || 0) * 0.1;
                    }
                }
                // Apply turn bias compensation
                if (Math.abs(command.turn_rate || 0) > 0 && this.config.turnConfidence > 0.5) {
                    compensated.turn_rate = (command.turn_rate || 0) * (1 + this.config.turnBias);
                }
                // Apply motor balance compensation
                if (this.config.motorBalanceConfidence > 0.5) {
                    const balanceCompensation = this.config.motorBalanceDifference * (command.speed || 0) * 0.05;
                    compensated.turn_rate = (compensated.turn_rate || 0) + balanceCompensation;
                }
            }
        }
        return compensated;
    }
    formatCommandForLog(command) {
        switch (command.type) {
            case 'drive':
                const speed = command.speed || 0;
                const turn = command.turn_rate || 0;
                if (speed === 0 && turn === 0)
                    return 'Drive: Stop';
                const actions = [];
                if (speed > 0)
                    actions.push('Forward');
                if (speed < 0)
                    actions.push('Backward');
                if (turn > 0)
                    actions.push('Turn Right');
                if (turn < 0)
                    actions.push('Turn Left');
                return `Drive: ${actions.join(' + ')} (${speed}, ${turn})`;
            case 'arm1':
            case 'arm2':
                const armSpeed = command.speed || 0;
                if (armSpeed === 0)
                    return `${command.type}: Stop`;
                return `${command.type}: ${armSpeed > 0 ? 'Up' : 'Down'} (${armSpeed})`;
            default:
                return `${command.type}: ${JSON.stringify(command)}`;
        }
    }
    async toggleConnection() {
        // Check if we should simulate connection instead of real connection
        if (this.config.simulateConnected && !this.bleController.connected && !this.bleController.isSimulatingConnection) {
            // Start simulating connection
            this.bleController.isSimulatingConnection = true;
            this.bleController.connected = true;
            this.updateConnectionUI('connected', 'Simulated Robot');
            this.startSimulatedBatteryMonitoring();
            this.toastManager.show('Simulated connection established', 'success');
            this.logger.log('Simulated connection established', 'success');
            return;
        }
        else if (this.config.simulateConnected && this.bleController.isSimulatingConnection) {
            // Stop simulating connection
            this.bleController.isSimulatingConnection = false;
            this.bleController.connected = false;
            this.updateConnectionUI('disconnected');
            this.stopSimulatedBatteryMonitoring();
            this.toastManager.show('Simulated connection terminated', 'info');
            this.logger.log('Simulated connection terminated', 'info');
            return;
        }
        // Normal BLE connection logic
        if (this.bleController.connected) {
            await this.bleController.disconnect();
        }
        else {
            await this.bleController.connect();
        }
    }
    isRobotConnected() {
        return this.bleController.connected || this.bleController.isSimulatingConnection;
    }
    showTroubleshootingHelp() {
        const troubleshootingSteps = [
            "🔧 Troubleshooting Connection Issues:",
            "",
            "1. Make sure your hub is powered on and running the Pybricks code",
            "2. Check that you're using Chrome, Edge, or another compatible browser",
            "3. Ensure you're accessing the app via HTTPS (required for Bluetooth)",
            "4. Move closer to your hub (Bluetooth range ~10 meters)",
            "5. Try restarting your hub and refreshing this page",
            "6. Check if another app is connected to your hub",
            "",
            "💡 Tips:",
            "- The hub LED should be solid blue when ready to connect",
            "- Make sure the hub name starts with 'Pybricks'",
            "- Try the simulator mode if physical connection isn't working"
        ];
        // Show in both logger and as a long-lasting toast
        troubleshootingSteps.forEach(step => {
            if (step.trim()) {
                this.logger.log(step, 'info');
            }
        });
        this.toastManager.show('Connection issues? Check the log for troubleshooting steps or try simulator mode.', 'info', 8000);
    }
    emergencyStop() {
        this.emergencyStopActive = true;
        this.pressedKeys.clear();
        // Send emergency stop command
        this.sendRobotCommand({ type: 'emergency_stop' });
        // Stop any active playback
        if (this.isPlaying) {
            if (this.playbackTimerId)
                clearInterval(this.playbackTimerId);
            if (this.playbackCurrentTimeout)
                clearTimeout(this.playbackCurrentTimeout);
            this.playbackTimerId = null;
            this.playbackCurrentTimeout = null;
            this.isPlaying = false;
            this.isPaused = false;
            this.playbackMode = null;
            this.playbackIndex = 0;
            this.playbackRun = null;
            this.playbackCommands = null;
            this.playbackElapsedBeforePause = 0;
            this.updatePlayButtonUI();
        }
        // Reset emergency stop after brief delay
        setTimeout(() => {
            this.emergencyStopActive = false;
        }, 1000);
        this.logger.log('EMERGENCY STOP ACTIVATED', 'warning');
        this.toastManager.show('Emergency Stop Activated!', 'warning');
    }
    // ... [Additional methods for recording, playback, configuration, etc. would continue here]
    updateUI() {
        this.updateConnectionUI();
        this.updateRunsList();
        this.updateSimulatorVisibility();
        this.updateConfigurationUI();
        // Initialize recording controls based on current connection status
        this.enableRecordingControls(this.isRobotConnected());
        // Update corner button active state
        const bl = document.getElementById('cornerBLBtn');
        const br = document.getElementById('cornerBRBtn');
        if (bl && br) {
            if (this.startCorner === 'BL') {
                bl.classList.add('btn-primary');
                bl.classList.remove('btn-secondary');
                br.classList.add('btn-secondary');
                br.classList.remove('btn-primary');
            }
            else {
                br.classList.add('btn-primary');
                br.classList.remove('btn-secondary');
                bl.classList.add('btn-secondary');
                bl.classList.remove('btn-primary');
            }
        }
    }
    updateConnectionUI(status = 'disconnected', deviceName = '') {
        console.log('updateConnectionUI called with:', { status, deviceName, isSimulating: this.bleController?.isSimulatingConnection });
        const connectBtn = document.getElementById('connectBtn');
        const hubStatus = document.getElementById('hubStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        if (!connectBtn || !hubStatus)
            return;
        // If Bluetooth unavailable, keep app interactive but disable connect button with debug message
        if ((!navigator.bluetooth || !window.isSecureContext) && !this.bleController.isSimulatingConnection && !this.config.simulateConnected) {
            connectBtn.innerHTML = '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Bluetooth Unavailable';
            connectBtn.disabled = true;
            hubStatus.className = 'status-indicator error';
            const reason = !navigator.bluetooth ? 'No Web Bluetooth' : 'HTTPS required';
            hubStatus.innerHTML = `<div class=\"status-dot\" aria-hidden=\"true\"></div><span>Bluetooth Unavailable - ${reason}. Debug-only mode.</span>`;
            if (connectionStatus)
                connectionStatus.textContent = `Bluetooth Unavailable - ${reason}. Debug-only mode.`;
            this.enableRecordingControls(false);
            return;
        }
        switch (status) {
            case 'connecting':
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Connecting...';
                connectBtn.disabled = true;
                hubStatus.className = 'status-indicator connecting';
                hubStatus.innerHTML = '<div class="status-dot" aria-hidden="true"></div><span>Connecting...</span>';
                if (connectionStatus)
                    connectionStatus.textContent = 'Connecting';
                this.enableRecordingControls(false);
                break;
            case 'connected':
                // Show different button text for simulation vs real connection
                if (this.bleController.isSimulatingConnection) {
                    connectBtn.innerHTML = '<i class="fas fa-robot" aria-hidden="true"></i> Stop Simulation';
                }
                else {
                    connectBtn.innerHTML = '<i class="fas fa-bluetooth" aria-hidden="true"></i> Disconnect Hub';
                }
                connectBtn.disabled = false;
                // Use simulation styling if in simulation mode
                if (this.bleController.isSimulatingConnection) {
                    hubStatus.className = 'status-indicator connected simulated';
                }
                else {
                    hubStatus.className = 'status-indicator connected';
                }
                hubStatus.innerHTML = `<div class="status-dot" aria-hidden="true"></div><span>Connected${deviceName ? ` - ${deviceName}` : ''}</span>`;
                if (connectionStatus)
                    connectionStatus.textContent = `Connected${deviceName ? ` - ${deviceName}` : ''}`;
                this.enableRecordingControls(true);
                break;
            case 'error':
            case 'disconnected':
            default:
                // Show different button text based on simulation config
                if (this.config.simulateConnected) {
                    connectBtn.innerHTML = '<i class="fas fa-robot" aria-hidden="true"></i> Start Simulation';
                }
                else {
                    connectBtn.innerHTML = 'Connect to Pybricks Hub';
                }
                connectBtn.disabled = false;
                hubStatus.className = 'status-indicator disconnected';
                hubStatus.innerHTML = '<div class="status-dot" aria-hidden="true"></div><span>Hub Disconnected</span>';
                if (connectionStatus)
                    connectionStatus.textContent = 'Disconnected';
                this.enableRecordingControls(false);
                break;
        }
    }
    enableRecordingControls(enabled) {
        const recordBtn = document.getElementById('recordBtn');
        const runNameInput = document.getElementById('runNameInput');
        if (recordBtn) {
            recordBtn.disabled = !enabled;
        }
        if (runNameInput) {
            runNameInput.disabled = !enabled;
        }
        // Note: saveBtn is managed separately based on recording state
        // pauseBtn is managed separately and is hidden by default
    }
    updateRunsList() {
        try {
            const runsList = document.getElementById('savedRunsList');
            if (!runsList)
                return;
            const savedRuns = this.getSavedRunsArray();
            runsList.innerHTML = '<option value="">Select a saved run...</option>';
            // Safety check: ensure savedRuns is an array and not null/undefined
            if (Array.isArray(savedRuns) && savedRuns.length > 0) {
                savedRuns.forEach(run => {
                    // Additional safety check for run object
                    if (run && run.id && run.name && run.createdAt) {
                        const option = document.createElement('option');
                        option.value = run.id;
                        option.textContent = `${run.name} (${new Date(run.createdAt).toLocaleDateString()})`;
                        runsList.appendChild(option);
                    }
                });
            }
        }
        catch (error) {
            console.error('Error updating runs list:', error);
            // Clear any corrupted data and try to reinitialize
            localStorage.removeItem(STORAGE_KEYS.SAVED_RUNS);
            this.savedRuns = new Map();
        }
    }
    updateSimulatorVisibility() {
        const simulatorSection = document.getElementById('simulatorSection');
        if (!simulatorSection)
            return;
        // Show simulator only when simulated connection is active
        if (this.bleController.isSimulatingConnection) {
            simulatorSection.classList.remove('hidden');
            // Give the DOM time to update before starting simulator
            setTimeout(() => {
                // Always destroy and recreate the simulator to ensure it works properly
                // after being hidden and shown again
                if (this.robotSimulator) {
                    this.robotSimulator.destroy();
                    this.robotSimulator = null;
                }
                // Setup and start the simulator
                this.setupRobotSimulator();
            }, 10);
        }
        else {
            simulatorSection.classList.add('hidden');
            if (this.robotSimulator) {
                this.robotSimulator.stop();
                this.robotSimulator.destroy();
                this.robotSimulator = null;
            }
            // controls removed
        }
    }
    enableSimulatorControls(enabled) { }
    updateConfigurationUI() {
        // Update form values with current config
        Object.keys(this.config).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.config[key];
                }
                else {
                    element.value = this.config[key];
                }
            }
        });
    }
    updateBatteryUI(level) {
        const batteryStatus = document.getElementById('batteryStatus');
        if (batteryStatus) {
            batteryStatus.textContent = `${level}%`;
            // Update color based on level
            if (level <= this.config.batteryWarning) {
                batteryStatus.style.color = '#dc3545';
            }
            else if (level <= 50) {
                batteryStatus.style.color = '#ffc107';
            }
            else {
                batteryStatus.style.color = '#28a745';
            }
        }
    }
    updatePerformanceUI(metrics) {
        const fpsCounter = document.getElementById('fpsCounter');
        const latencyCounter = document.getElementById('latencyCounter');
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${metrics.fps}`;
        }
        if (latencyCounter) {
            latencyCounter.textContent = `Latency: ${metrics.latency}ms`;
        }
    }
    displayLogEntry(entry) {
        const statusDisplay = document.getElementById('statusDisplay');
        if (!statusDisplay)
            return;
        const timestamp = entry.timestamp.toLocaleTimeString();
        const colorMap = {
            info: '#ffffff',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545'
        };
        const color = colorMap[entry.level] || '#ffffff';
        const logLine = document.createElement('div');
        logLine.style.color = color;
        logLine.style.marginBottom = '4px';
        logLine.textContent = `[${timestamp}] ${entry.message}`;
        statusDisplay.appendChild(logLine);
        statusDisplay.scrollTop = statusDisplay.scrollHeight;
        // Update status label
        const statusLabel = document.getElementById('statusLabel');
        if (statusLabel) {
            statusLabel.textContent = entry.message;
        }
    }
    startBatteryMonitoring() {
        // Request battery level every 30 seconds
        setInterval(() => {
            if (this.bleController.connected) {
                this.bleController.requestBatteryLevel();
            }
        }, 30000);
        // Request initial battery level
        setTimeout(() => {
            if (this.bleController.connected) {
                this.bleController.requestBatteryLevel();
            }
        }, 1000);
    }
    recordCommand(command) {
        if (!this.isRecording)
            return;
        this.recordedCommands.push({
            timestamp: Date.now() - this.recordingStartTime,
            type: 'command',
            command,
            eventType: 'robot'
        });
    }
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        }
        else {
            this.startRecording();
        }
    }
    startRecording() {
        this.isRecording = true;
        this.recordedCommands = [];
        this.recordingStartTime = Date.now();
        this.recordedPath = [];
        this.lastOdomTimestamp = this.recordingStartTime;
        // Reset odom to origin based on startCorner
        this.odom = { x: 0, y: 0, thetaDeg: 0 };
        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-stop" aria-hidden="true"></i> Stop Recording';
            recordBtn.classList.remove('btn-danger');
            recordBtn.classList.add('btn-primary');
        }
        // Keep save button disabled until recording stops with commands
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn)
            saveBtn.disabled = true;
        this.toastManager.show('🔴 Recording started - all robot movements will be captured', 'info');
        this.logger.log('Recording started');
    }
    stopRecording() {
        this.isRecording = false;
        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-circle" aria-hidden="true"></i> Record Run';
            recordBtn.classList.remove('btn-primary');
            recordBtn.classList.add('btn-danger');
        }
        // Enable save button only if there are commands to save
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = this.recordedCommands.length === 0;
        }
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        this.toastManager.show(`⏹️ Recording stopped - captured ${this.recordedCommands.length} commands in ${duration.toFixed(1)}s`, 'success');
        this.logger.log(`Recording stopped: ${this.recordedCommands.length} commands in ${duration.toFixed(1)}s`);
        // Automatically save run if any commands were recorded
        if (this.recordedCommands.length > 0) {
            this.saveCurrentRun();
        }
    }
    saveCurrentRun() {
        if (!this.recordedCommands || this.recordedCommands.length === 0) {
            this.toastManager.show('No recorded commands to save', 'warning');
            return;
        }
        // Get name from input field instead of prompt
        const runNameInput = document.getElementById('runNameInput');
        if (!runNameInput) {
            this.toastManager.show('Run name input not found', 'error');
            return;
        }
        const name = runNameInput.value.trim();
        if (!name) {
            this.toastManager.show('Please enter a run name', 'warning');
            runNameInput.focus();
            return;
        }
        // Check for duplicate names
        const savedRuns = this.getSavedRunsArray();
        const isDuplicate = savedRuns.some(run => run.name.toLowerCase() === name.toLowerCase());
        if (isDuplicate) {
            this.toastManager.show(`A run named "${name}" already exists. Please choose a different name.`, 'warning');
            runNameInput.focus();
            runNameInput.select();
            return;
        }
        const run = {
            id: Date.now().toString(),
            name: name,
            commands: this.recordedCommands.map(cmd => {
                if (cmd.eventType === 'keyboard') {
                    // Handle keyboard events
                    return {
                        command_type: cmd.type, // 'keydown' or 'keyup'
                        parameters: {
                            key: cmd.key,
                            eventType: cmd.eventType,
                            duration: cmd.timestamp / 1000 // Convert to seconds
                        }
                    };
                }
                else if (cmd.eventType === 'robot') {
                    // Handle robot commands
                    return {
                        command_type: cmd.command.type,
                        parameters: {
                            ...cmd.command,
                            duration: cmd.timestamp / 1000 // Convert to seconds
                        }
                    };
                }
                else {
                    // Fallback for unknown types
                    console.warn('Unknown event type:', cmd);
                    return {
                        command_type: cmd.type || 'unknown',
                        parameters: {
                            ...cmd,
                            duration: cmd.timestamp / 1000 // Convert to seconds
                        }
                    };
                }
            }),
            path: this.recordedPath,
            startCorner: this.startCorner,
            createdAt: new Date().toISOString(),
            duration: this.recordedCommands.length > 0 ?
                this.recordedCommands[this.recordedCommands.length - 1].timestamp / 1000 : 0
        };
        // Save to localStorage
        try {
            savedRuns.push(run);
            localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(savedRuns));
        }
        catch (error) {
            console.error('Error saving to localStorage:', error);
            this.toastManager.show('Failed to save run - storage error', 'error');
            return;
        }
        // Update UI
        this.updateRunsList();
        this.recordedCommands = [];
        // Disable save button until next recording
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn)
            saveBtn.disabled = true;
        // Generate next run name
        const nextRunNumber = savedRuns.length + 1;
        runNameInput.value = `Run ${nextRunNumber}`;
        this.toastManager.show(`✅ Run "${name}" saved successfully!`, 'success');
        this.logger.log(`Run saved: ${name}`);
    }
    pauseRecording() {
        if (!this.isRecording) {
            this.toastManager.show('No recording in progress to pause', 'warning');
            return;
        }
        this.isRecording = false;
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            if (pauseBtn.textContent.includes('Pause')) {
                pauseBtn.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i> Resume';
                this.toastManager.show('⏸️ Recording paused', 'info');
            }
            else {
                pauseBtn.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i> Pause';
                this.isRecording = true;
                this.toastManager.show('▶️ Recording resumed', 'info');
            }
        }
    }
    generateCalibrationCode(calibrationData) {
        if (!calibrationData) {
            return [
                "# --- CALIBRATION CONSTANTS (No calibration data available) ---",
                "SPEED_CALIBRATION = 1.0",
                "TURN_CALIBRATION = 1.0",
                "DRIFT_COMPENSATION = 0.0",
                ""
            ];
        }
        const speedCal = calibrationData.speedAccuracy || 1.0;
        const turnCal = calibrationData.turnAccuracy || 1.0;
        const drift = calibrationData.straightDrift || { x: 0, y: 0 };
        const driftComp = drift.x !== 0 || drift.y !== 0 ?
            -Math.atan2(drift.y, drift.x) * 180 / Math.PI * 0.1 : 0.0;
        return [
            "# --- CALIBRATION CONSTANTS (Auto-generated from calibration) ---",
            `SPEED_CALIBRATION = ${speedCal.toFixed(4)}  # Speed accuracy factor`,
            `TURN_CALIBRATION = ${turnCal.toFixed(4)}   # Turn accuracy factor`,
            `DRIFT_COMPENSATION = ${driftComp.toFixed(4)}  # Drift compensation (degrees)`,
            `# Calibration date: ${new Date().toISOString()}`,
            ""
        ];
    }
    openConfigModal() {
        const modal = document.getElementById('configModal');
        if (modal) {
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
            this.updateConfigurationUI();
        }
    }
    generateHubCode() {
        // Get saved runs for competition code generation
        const savedRuns = this.getSavedRunsArray();
        // Get calibration data
        const calibrationData = this.calibrationData || JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA) || 'null');
        if (!Array.isArray(savedRuns) || savedRuns.length === 0) {
            // Generate basic hub control code if no saved runs
            return `from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Color
from pybricks.robotics import DriveBase
from pybricks.tools import wait
from usys import stdin, stdout
from uselect import poll
import ujson

hub = PrimeHub()

hub.display.icon([
    [100, 100, 100, 100, 100],
    [100, 0, 100, 0, 100], 
    [100, 100, 100, 100, 100],
    [100, 0, 0, 0, 100],
    [100, 100, 100, 100, 100]
])

motors = {}
drive_base = None

left_motor_port = Port.${this.config.leftMotorPort}
right_motor_port = Port.${this.config.rightMotorPort}
arm1_motor_port = Port.${this.config.arm1MotorPort}
arm2_motor_port = Port.${this.config.arm2MotorPort}

try:
    left_motor = Motor(left_motor_port)
    right_motor = Motor(right_motor_port)
    drive_base = DriveBase(left_motor, right_motor, wheel_diameter=${this.config.wheelDiameter}, axle_track=${this.config.axleTrack})
    
    drive_base.settings(
        straight_speed=${this.config.straightSpeed},
        straight_acceleration=${this.config.straightAcceleration},
        turn_rate=${this.config.turnRate},
        turn_acceleration=${this.config.turnAcceleration}
    )
    
    hub.light.on(Color.GREEN)
except:
    hub.light.on(Color.YELLOW)

try:
    motors['arm1'] = Motor(arm1_motor_port)
except:
    pass

try:
    motors['arm2'] = Motor(arm2_motor_port)
except:
    pass

keyboard = poll()
keyboard.register(stdin)

hub.display.icon([
    [0, 100, 0, 100, 0],
    [100, 100, 100, 100, 100],
    [0, 100, 100, 100, 0],
    [0, 0, 100, 0, 0],
    [0, 0, 100, 0, 0]
])

while True:
    stdout.buffer.write(b"rdy")
    
    while not keyboard.poll(10):
        wait(1)
    
    try:
        data = stdin.buffer.read()
        if data:
            command_str = data.decode('utf-8')
            command = ujson.loads(command_str)
            
            cmd_type = command.get('type', '')
            
            if cmd_type == 'drive' and drive_base:
                speed = command.get('speed', 0)
                turn_rate = command.get('turn_rate', 0)
                drive_base.drive(speed, turn_rate)
                stdout.buffer.write(b"DRIVE_OK")
                
            elif cmd_type in ['arm1', 'arm2'] and cmd_type in motors:
                motor = motors[cmd_type]
                speed = command.get('speed', 0)
                if speed == 0:
                    motor.stop()
                else:
                    motor.run(speed)
                stdout.buffer.write(b"ARM_OK")
                
            elif cmd_type == 'config':
                try:
                    axle_track = command.get('axle_track', ${this.config.axleTrack})
                    wheel_diameter = command.get('wheel_diameter', ${this.config.wheelDiameter})
                    if drive_base:
                        drive_base = DriveBase(left_motor, right_motor, 
                                             wheel_diameter=wheel_diameter, 
                                             axle_track=axle_track)
                        
                        straight_speed = command.get('straight_speed', ${this.config.straightSpeed})
                        straight_acceleration = command.get('straight_acceleration', ${this.config.straightAcceleration})
                        turn_rate = command.get('turn_rate', ${this.config.turnRate})
                        turn_acceleration = command.get('turn_acceleration', ${this.config.turnAcceleration})
                        
                        drive_base.settings(
                            straight_speed=straight_speed,
                            straight_acceleration=straight_acceleration,
                            turn_rate=turn_rate,
                            turn_acceleration=turn_acceleration
                        )
                        
                    stdout.buffer.write(b"CONFIG_OK")
                except:
                    stdout.buffer.write(b"CONFIG_ERROR")
            else:
                stdout.buffer.write(b"UNKNOWN_CMD")
                
    except Exception as e:
        stdout.buffer.write(b"ERROR")
    
    wait(10)`;
        }
        // Generate competition code with saved runs
        const codeLines = [
            "from pybricks.hubs import PrimeHub",
            "from pybricks.pupdevices import Motor",
            "from pybricks.parameters import Port, Color, Button",
            "from pybricks.robotics import DriveBase",
            "from pybricks.tools import wait",
            "",
            "# --- ROBOT SETUP ---",
            "hub = PrimeHub()",
            "",
            "# Initialize motors and drive base",
            `left_motor = Motor(Port.${this.config.leftMotorPort})`,
            `right_motor = Motor(Port.${this.config.rightMotorPort})`,
            `drive_base = DriveBase(left_motor, right_motor, wheel_diameter=${this.config.wheelDiameter}, axle_track=${this.config.axleTrack})`,
            "",
            "# Configure drive base settings",
            "drive_base.settings(",
            `    straight_speed=${this.config.straightSpeed},`,
            `    straight_acceleration=${this.config.straightAcceleration},`,
            `    turn_rate=${this.config.turnRate},`,
            `    turn_acceleration=${this.config.turnAcceleration}`,
            ")",
            "",
            "# Initialize arm motors",
            `arm1_motor = Motor(Port.${this.config.arm1MotorPort})`,
            `arm2_motor = Motor(Port.${this.config.arm2MotorPort})`,
            "",
            ...this.generateCalibrationCode(calibrationData),
            "# --- HELPER FUNCTIONS ---",
            "def apply_calibration(speed, turn_rate):",
            "    \"\"\"Apply calibration compensation to drive commands\"\"\"",
            "    calibrated_speed = speed * SPEED_CALIBRATION",
            "    calibrated_turn = turn_rate * TURN_CALIBRATION",
            "    ",
            "    # Apply drift compensation for straight movement",
            "    if turn_rate == 0 and speed != 0:",
            "        calibrated_turn += DRIFT_COMPENSATION",
            "    ",
            "    return calibrated_speed, calibrated_turn",
            "",
            "def move_forward(speed, duration_ms):",
            "    cal_speed, cal_turn = apply_calibration(speed, 0)",
            "    drive_base.drive(cal_speed, cal_turn)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def move_backward(speed, duration_ms):",
            "    cal_speed, cal_turn = apply_calibration(-speed, 0)",
            "    drive_base.drive(cal_speed, cal_turn)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def turn_left(angle, duration_ms):",
            "    cal_speed, cal_turn = apply_calibration(0, -angle)",
            "    drive_base.drive(cal_speed, cal_turn)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def turn_right(angle, duration_ms):",
            "    cal_speed, cal_turn = apply_calibration(0, angle)",
            "    drive_base.drive(cal_speed, cal_turn)",
            "    wait(duration_ms)",
            "    drive_base.stop()",
            "",
            "def arm1_up(speed, duration_ms):",
            "    arm1_motor.run(speed)",
            "    wait(duration_ms)",
            "    arm1_motor.stop()",
            "",
            "def arm1_down(speed, duration_ms):",
            "    arm1_motor.run(-speed)",
            "    wait(duration_ms)",
            "    arm1_motor.stop()",
            "",
            "def arm2_up(speed, duration_ms):",
            "    arm2_motor.run(speed)",
            "    wait(duration_ms)",
            "    arm2_motor.stop()",
            "",
            "def arm2_down(speed, duration_ms):",
            "    arm2_motor.run(-speed)",
            "    wait(duration_ms)",
            "    arm2_motor.stop()",
            "",
            "# --- RUN FUNCTIONS ---"
        ];
        // Generate run functions from saved runs
        const runFunctions = [];
        const runsDict = [];
        // Safety check: ensure savedRuns is an array
        if (Array.isArray(savedRuns)) {
            savedRuns.forEach((run, index) => {
                const funcName = `run_${index + 1}`;
                const funcLines = [`def ${funcName}():`];
                funcLines.push(`    # ${run.name}`);
                if (Array.isArray(run.path) && run.path.length > 1) {
                    funcLines.push("    # Follow recorded coordinate path using dead-reckoning");
                    const waypoints = run.path.map(p => `(${Math.round(p.x)}, ${Math.round(p.y)})`).join(', ');
                    funcLines.push(`    waypoints = [${waypoints}]`);
                    funcLines.push("    mm_per_unit = 1.0  # scale recorded units to mm");
                    funcLines.push("    cur_x, cur_y, cur_heading = 0.0, 0.0, 0.0  # deg");
                    funcLines.push("    def normalize_deg(a):\n        while a > 180: a -= 360\n        while a < -180: a += 360\n        return a");
                    funcLines.push("    for tx, ty in waypoints:");
                    funcLines.push("        dx = (tx - cur_x) * mm_per_unit");
                    funcLines.push("        dy = (ty - cur_y) * mm_per_unit");
                    funcLines.push("        import math");
                    funcLines.push("        target = math.degrees(math.atan2(dy, dx))");
                    funcLines.push("        turn = normalize_deg(target - cur_heading)");
                    funcLines.push("        dist = int(round((dx*dx + dy*dy) ** 0.5))");
                    funcLines.push("        if abs(turn) > 1: drive_base.turn(turn)");
                    funcLines.push("        if dist != 0: drive_base.straight(dist)");
                    funcLines.push("        cur_heading = target\n        cur_x, cur_y = tx, ty");
                }
                else if (run.commands && run.commands.length > 0) {
                    run.commands.forEach(cmd => {
                        const cmdType = cmd.command_type || cmd.type;
                        const params = cmd.parameters || cmd;
                        const duration = params.duration ? Math.round(params.duration * 1000) : 0;
                        if (cmdType === "drive") {
                            const speed = params.speed || 0;
                            const turnRate = params.turn_rate || 0;
                            if (speed !== 0 || turnRate !== 0) {
                                funcLines.push(`    drive_base.drive(${speed}, ${turnRate})`);
                                if (duration > 0)
                                    funcLines.push(`    wait(${duration})`);
                                funcLines.push("    drive_base.stop()");
                            }
                            else {
                                funcLines.push("    drive_base.stop()");
                            }
                        }
                        else if (cmdType === "arm1") {
                            const speed = params.speed || 0;
                            if (speed !== 0) {
                                funcLines.push(`    arm1_motor.run(${speed})`);
                                if (duration > 0)
                                    funcLines.push(`    wait(${duration})`);
                                funcLines.push("    arm1_motor.stop()");
                            }
                            else {
                                funcLines.push("    arm1_motor.stop()");
                            }
                        }
                        else if (cmdType === "arm2") {
                            const speed = params.speed || 0;
                            if (speed !== 0) {
                                funcLines.push(`    arm2_motor.run(${speed})`);
                                if (duration > 0)
                                    funcLines.push(`    wait(${duration})`);
                                funcLines.push("    arm2_motor.stop()");
                            }
                            else {
                                funcLines.push("    arm2_motor.stop()");
                            }
                        }
                    });
                }
                else {
                    funcLines.push("    # No commands recorded for this run");
                    funcLines.push("    pass");
                }
                funcLines.push("    wait(100)");
                runFunctions.push(...funcLines, "");
                runsDict.push(`    ${index + 1}: ${funcName},  # ${run.name}`);
            });
        }
        codeLines.push(...runFunctions);
        codeLines.push("# --- MAIN EXECUTION ---", "", "runs = {", ...runsDict, "}", "", `# Use hub buttons to run missions (${Array.isArray(savedRuns) ? savedRuns.length : 0} runs available)`, (Array.isArray(savedRuns) && savedRuns.length <= 3) ?
            `# LEFT=Run1, CENTER=Run2, RIGHT=Run3` :
            `# LEFT=Previous, RIGHT=Next, CENTER=Execute (hub shows selected run number)`, "hub.light.on(Color.WHITE)", "", "while True:", "    pressed_buttons = hub.buttons.pressed()", "");
        // Add button selection logic
        if (Array.isArray(savedRuns) && savedRuns.length <= 3) {
            // Simple button mapping for 1-3 runs
            savedRuns.forEach((run, index) => {
                const runNumber = index + 1;
                let buttonCheck;
                if (runNumber === 1) {
                    buttonCheck = "if Button.LEFT in pressed_buttons:";
                }
                else if (runNumber === 2) {
                    buttonCheck = "elif Button.CENTER in pressed_buttons:";
                }
                else if (runNumber === 3) {
                    buttonCheck = "elif Button.RIGHT in pressed_buttons:";
                }
                codeLines.push(`    ${buttonCheck}`, `        hub.light.on(Color.BLUE)`, `        runs[${runNumber}]()  # ${run.name}`, `        hub.light.on(Color.GREEN)`, `        wait(1000)  # Prevent multiple runs`, "");
            });
        }
        else {
            // Simple menu system for 4+ runs - much more reliable
            codeLines.push("    # Menu navigation system for multiple runs", "    if not hasattr(hub, '_selected_run'):", "        hub._selected_run = 1", "        hub._last_button_time = 0", "    ", "    current_time = hub.system.time()", "    ", "    # Only process button presses if enough time has passed (debounce)", "    if current_time - hub._last_button_time > 300:", "        if Button.LEFT in pressed_buttons:", "            # Previous run", `            hub._selected_run = max(1, hub._selected_run - 1)`, "            hub.display.number(hub._selected_run)", "            hub._last_button_time = current_time", "            hub.light.on(Color.YELLOW)", "            wait(200)", "            hub.light.on(Color.WHITE)", "        ", "        elif Button.RIGHT in pressed_buttons:", "            # Next run", `            hub._selected_run = min(${Array.isArray(savedRuns) ? savedRuns.length : 0}, hub._selected_run + 1)`, "            hub.display.number(hub._selected_run)", "            hub._last_button_time = current_time", "            hub.light.on(Color.YELLOW)", "            wait(200)", "            hub.light.on(Color.WHITE)", "        ", "        elif Button.CENTER in pressed_buttons:", "            # Execute selected run", "            hub.light.on(Color.BLUE)", "            runs[hub._selected_run]()", "            hub.light.on(Color.GREEN)", "            wait(1000)", "            hub._last_button_time = current_time", "");
        }
        codeLines.push("    wait(50)  # Small delay for button polling", "", "# --- END OF COMPETITION CODE ---");
        return codeLines.join('\n');
    }
    async uploadToHub() {
        if (!this.bleController.connected && !this.bleController.isSimulatingConnection) {
            this.toastManager.show('Please connect to your hub first before uploading code', 'warning');
            return;
        }
        // If simulating connection, just show success message
        if (this.bleController.isSimulatingConnection) {
            this.toastManager.show('Code upload simulated successfully', 'success');
            this.logger.log('Simulated code upload completed', 'info');
            return;
        }
        // Prevent multiple uploads at the same time
        const uploadBtn = document.getElementById('uploadToHubBtn');
        if (uploadBtn && uploadBtn.disabled) {
            this.toastManager.show('Upload already in progress...', 'info');
            return;
        }
        try {
            // Disable the button and update UI
            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Uploading...';
            }
            this.toastManager.show('Preparing to upload code to hub...', 'info');
            // Generate the competition code
            const code = this.generateHubCode();
            // Upload and run the code directly on the hub
            await this.uploadAndRunCode(code);
            this.toastManager.show('Code uploaded and running on hub successfully! 🚀', 'success');
            this.logger.log('Code uploaded to hub successfully');
        }
        catch (error) {
            this.toastManager.show(`Failed to upload code: ${error.message}`, 'error');
            this.logger.log(`Hub upload failed: ${error.message}`, 'error');
        }
        finally {
            // Re-enable the button and restore UI
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-rocket" aria-hidden="true"></i> Upload & Run on Hub';
            }
        }
    }
    async uploadAndRunCode(code) {
        if (!this.bleController.device || (!this.bleController.connected && !this.bleController.isSimulatingConnection)) {
            throw new Error('Hub not connected');
        }
        // If simulating connection, just log the action
        if (this.bleController.isSimulatingConnection) {
            this.logger.log('Simulated code upload and run', 'info');
            return;
        }
        try {
            // Get the Pybricks command/event characteristic for program upload
            const service = await this.bleController.server.getPrimaryService('c5f50001-8280-46da-89f4-6d8051e4aeef');
            const commandCharacteristic = await service.getCharacteristic('c5f50002-8280-46da-89f4-6d8051e4aeef');
            // Stop any currently running program
            await this.sendPybricksCommand(commandCharacteristic, 'stop');
            // Wait a moment for the hub to stop
            await new Promise(resolve => setTimeout(resolve, 500));
            // Send the code to the hub
            await this.sendPybricksProgram(commandCharacteristic, code);
            // Wait a moment for the program to load
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Start the program
            await this.sendPybricksCommand(commandCharacteristic, 'run');
        }
        catch (error) {
            throw new Error(`Failed to upload program: ${error.message}`);
        }
    }
    async sendPybricksCommand(characteristic, command) {
        const encoder = new TextEncoder();
        let payload;
        if (command === 'stop') {
            // Stop program command
            payload = new Uint8Array([0x00]); // Stop command
        }
        else if (command === 'run') {
            // Run program command  
            payload = new Uint8Array([0x01]); // Run command
        }
        else {
            throw new Error(`Unknown command: ${command}`);
        }
        await characteristic.writeValue(payload);
    }
    async sendPybricksProgram(characteristic, code) {
        const encoder = new TextEncoder();
        const codeBytes = encoder.encode(code);
        // Send program upload command (0x02) followed by code length
        const header = new Uint8Array(5);
        header[0] = 0x02; // Program upload command
        header[1] = (codeBytes.length) & 0xFF;
        header[2] = (codeBytes.length >> 8) & 0xFF;
        header[3] = (codeBytes.length >> 16) & 0xFF;
        header[4] = (codeBytes.length >> 24) & 0xFF;
        await characteristic.writeValue(header);
        // Send the code in chunks (BLE has MTU limitations)
        const chunkSize = 20; // Conservative chunk size for BLE
        for (let i = 0; i < codeBytes.length; i += chunkSize) {
            const chunk = codeBytes.slice(i, i + chunkSize);
            await characteristic.writeValue(chunk);
            // Small delay between chunks to avoid overwhelming the hub
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
    exportSelectedRun() {
        const runsList = document.getElementById('savedRunsList');
        if (!runsList || !runsList.value) {
            this.toastManager.show('Please select a run to export', 'warning');
            return;
        }
        const savedRuns = this.getSavedRunsArray();
        const selectedRun = savedRuns.find(run => run.id === runsList.value);
        if (!selectedRun) {
            this.toastManager.show('Selected run not found', 'error');
            return;
        }
        const exportData = {
            name: selectedRun.name,
            description: selectedRun.description || '',
            commands: selectedRun.commands,
            duration: selectedRun.duration,
            createdAt: selectedRun.createdAt,
            exportedAt: new Date().toISOString(),
            version: APP_CONFIG.VERSION
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codless-run-${selectedRun.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toastManager.show(`Run "${selectedRun.name}" exported successfully!`, 'success');
    }
    deleteSelectedRun() {
        const runsList = document.getElementById('savedRunsList');
        if (!runsList || !runsList.value) {
            this.toastManager.show('Please select a run to delete', 'warning');
            return;
        }
        const savedRuns = this.getSavedRunsArray();
        const selectedRun = savedRuns.find(run => run.id === runsList.value);
        if (!selectedRun) {
            this.toastManager.show('Selected run not found', 'error');
            return;
        }
        if (confirm(`Are you sure you want to delete the run "${selectedRun.name}"? This action cannot be undone.`)) {
            const updatedRuns = savedRuns.filter(run => run.id !== runsList.value);
            localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(updatedRuns));
            // Update the UI
            this.updateRunsList();
            runsList.value = '';
            // Disable action buttons
            document.getElementById('playBtn').disabled = true;
            document.getElementById('deleteBtn').disabled = true;
            document.getElementById('exportBtn').disabled = true;
            this.toastManager.show(`Run "${selectedRun.name}" deleted successfully`, 'success');
        }
    }
    importRun() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    // Validate the imported data
                    if (!importData.name || !importData.commands || !Array.isArray(importData.commands)) {
                        throw new Error('Invalid run file format');
                    }
                    const savedRuns = this.getSavedRunsArray();
                    // Generate a unique name for the imported run
                    let importedName = importData.name + ' (Imported)';
                    let counter = 1;
                    // Check for duplicates and increment counter if needed
                    while (savedRuns.some(run => run.name.toLowerCase() === importedName.toLowerCase())) {
                        counter++;
                        importedName = `${importData.name} (Imported ${counter})`;
                    }
                    // Create a new run with imported data
                    const newRun = {
                        id: 'run_' + Date.now(),
                        name: importedName,
                        description: importData.description || '',
                        commands: importData.commands,
                        duration: importData.duration || 0,
                        createdAt: new Date().toISOString(),
                        importedAt: new Date().toISOString(),
                        originalCreatedAt: importData.createdAt
                    };
                    savedRuns.push(newRun);
                    localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(savedRuns));
                    // Update the UI
                    this.updateRunsList();
                    this.toastManager.show(`Run "${newRun.name}" imported successfully!`, 'success');
                }
                catch (error) {
                    console.error('Import error:', error);
                    this.toastManager.show('Failed to import run: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    selectRun(runId) {
        const playBtn = document.getElementById('playBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const exportBtn = document.getElementById('exportBtn');
        if (runId) {
            playBtn.disabled = false;
            deleteBtn.disabled = false;
            exportBtn.disabled = false;
        }
        else {
            playBtn.disabled = true;
            deleteBtn.disabled = true;
            exportBtn.disabled = true;
        }
    }
    playSelectedRun() {
        const runsList = document.getElementById('savedRunsList');
        if (!this.isPlaying) {
            if (!runsList || !runsList.value) {
                this.toastManager.show('Please select a run to play', 'warning');
                return;
            }
            const savedRuns = this.getSavedRunsArray();
            const selectedRun = savedRuns.find(run => run.id === runsList.value);
            if (!selectedRun) {
                this.toastManager.show('Selected run not found', 'error');
                return;
            }
            this.startRunPlayback(selectedRun);
        }
        else if (!this.isPaused) {
            this.pausePlayback();
        }
        else {
            this.resumePlayback();
        }
    }
    startRunPlayback(selectedRun) {
        try {
            this.playbackRun = selectedRun;
            // Initialize pose
            this.initializePlaybackPose(selectedRun);
            // Decide mode
            if (Array.isArray(selectedRun.path) && selectedRun.path.length > 1) {
                this.playbackMode = 'path';
                this.playbackIndex = 0;
                this.isPlaying = true;
                this.isPaused = false;
                this.playbackElapsedBeforePause = 0;
                this.playbackStartEpoch = Date.now();
                this.toastManager.show(`Playing run "${selectedRun.name}" (path)`, 'info');
                this.logger.log(`Playing run (path): ${selectedRun.name}`, 'info');
                this.startPathInterval();
            }
            else {
                const commands = Array.isArray(selectedRun.commands) ? selectedRun.commands : [];
                this.playbackMode = 'commands';
                this.playbackCommands = commands;
                this.playbackIndex = 0;
                this.isPlaying = true;
                this.isPaused = false;
                this.playbackElapsedBeforePause = 0;
                this.playbackStartEpoch = Date.now();
                this.toastManager.show(`Playing run "${selectedRun.name}"`, 'info');
                this.logger.log(`Playing run: ${selectedRun.name} (${commands.length} commands)`, 'info');
                this.scheduleNextCommand();
            }
            this.updatePlayButtonUI();
        }
        catch (e) {
            this.toastManager.show('Failed to start playback', 'error');
        }
    }
    initializePlaybackPose(run) {
        if (!this.robotSimulator || !run)
            return;
        const rect = this.robotSimulator.canvas.getBoundingClientRect();
        const margin = 30;
        const corner = run.startCorner || this.startCorner || 'BL';
        const startXCorner = corner === 'BL' ? margin : Math.max(margin, rect.width - margin);
        const startYCorner = Math.max(margin, rect.height - margin);
        this.robotSimulator.setPose(startXCorner, startYCorner, 0, { clearTrail: true, resetMotion: true });
        if (Array.isArray(run.path) && run.path.length >= 1) {
            const width = this.simCanvasSize.width || rect.width || 0;
            const height = this.simCanvasSize.height || rect.height || 0;
            const startWorld = run.path[0];
            const simX = corner === 'BL' ? startWorld.x : Math.max(0, width - startWorld.x);
            const simY = Math.max(0, height - startWorld.y);
            this.robotSimulator.setPose(simX, simY, startWorld.theta || 0, { clearTrail: true, resetMotion: true });
            this.odom = { x: startWorld.x, y: startWorld.y, thetaDeg: startWorld.theta || 0 };
        }
    }
    startPathInterval() {
        if (!this.playbackRun || !Array.isArray(this.playbackRun.path))
            return;
        const path = this.playbackRun.path;
        const prevCorner = this.startCorner;
        this.startCorner = this.playbackRun.startCorner || 'BL';
        // Ensure robot stopped before starting tick
        this.sendRobotCommand({ type: 'drive', speed: 0, turn_rate: 0 });
        const tickMs = 50;
        if (this.playbackTimerId)
            clearInterval(this.playbackTimerId);
        this.playbackTimerId = setInterval(() => {
            if (!this.isPlaying || this.isPaused)
                return;
            if (this.playbackIndex >= path.length) {
                clearInterval(this.playbackTimerId);
                this.playbackTimerId = null;
                this.sendRobotCommand({ type: 'drive', speed: 0, turn_rate: 0 });
                this.startCorner = prevCorner;
                this.onPlaybackComplete();
                return;
            }
            const target = path[this.playbackIndex];
            const current = this.odom;
            const dx = (target.x) - current.x;
            const dy = (target.y) - current.y;
            const distance = Math.hypot(dx, dy);
            const heading = Math.atan2(dy, dx) * 180 / Math.PI;
            let errHeading = heading - current.thetaDeg;
            while (errHeading > 180)
                errHeading -= 360;
            while (errHeading < -180)
                errHeading += 360;
            const maxSpeed = this.config.straightSpeed || 500;
            const maxTurn = this.config.turnRate || 200;
            const speed = Math.max(Math.min(distance * 3, maxSpeed), -maxSpeed);
            const turn = Math.max(Math.min(errHeading * 3, maxTurn), -maxTurn);
            this.sendRobotCommand({ type: 'drive', speed, turn_rate: turn });
            this.playbackIndex++;
        }, tickMs);
    }
    scheduleNextCommand() {
        if (!this.isPlaying || this.isPaused)
            return;
        if (!Array.isArray(this.playbackCommands)) {
            this.onPlaybackComplete();
            return;
        }
        // Execute any overdue commands immediately
        while (this.playbackIndex < this.playbackCommands.length) {
            const cmd = this.playbackCommands[this.playbackIndex];
            const elapsed = (Date.now() - this.playbackStartEpoch) + this.playbackElapsedBeforePause;
            const delay = Math.max(0, (cmd.timestamp || 0) - elapsed);
            if (delay === 0) {
                this.executeCommand(cmd);
                this.playbackIndex++;
                continue;
            }
            if (this.playbackCurrentTimeout)
                clearTimeout(this.playbackCurrentTimeout);
            this.playbackCurrentTimeout = setTimeout(() => {
                if (!this.isPlaying || this.isPaused)
                    return;
                this.executeCommand(cmd);
                this.playbackIndex++;
                if (this.playbackIndex >= this.playbackCommands.length) {
                    this.onPlaybackComplete();
                }
                else {
                    this.scheduleNextCommand();
                }
            }, delay);
            break;
        }
        if (this.playbackIndex >= this.playbackCommands.length) {
            this.onPlaybackComplete();
        }
    }
    pausePlayback() {
        if (!this.isPlaying || this.isPaused)
            return;
        this.isPaused = true;
        // Stop timers
        if (this.playbackTimerId) {
            clearInterval(this.playbackTimerId);
            this.playbackTimerId = null;
        }
        if (this.playbackCurrentTimeout) {
            clearTimeout(this.playbackCurrentTimeout);
            this.playbackCurrentTimeout = null;
        }
        // Accumulate elapsed
        this.playbackElapsedBeforePause += (Date.now() - this.playbackStartEpoch);
        // Send stop motion to robot
        this.sendRobotCommand({ type: 'drive', speed: 0, turn_rate: 0 });
        this.toastManager.show('⏸️ Run paused', 'info');
        this.updatePlayButtonUI();
    }
    resumePlayback() {
        if (!this.isPlaying || !this.isPaused)
            return;
        this.isPaused = false;
        this.playbackStartEpoch = Date.now();
        if (this.playbackMode === 'path') {
            this.startPathInterval();
        }
        else if (this.playbackMode === 'commands') {
            this.scheduleNextCommand();
        }
        this.toastManager.show('▶️ Run resumed', 'info');
        this.updatePlayButtonUI();
    }
    onPlaybackComplete() {
        this.isPlaying = false;
        this.isPaused = false;
        this.playbackMode = null;
        this.playbackIndex = 0;
        this.playbackRun = null;
        this.playbackCommands = null;
        this.playbackElapsedBeforePause = 0;
        if (this.playbackTimerId)
            clearInterval(this.playbackTimerId);
        if (this.playbackCurrentTimeout)
            clearTimeout(this.playbackCurrentTimeout);
        this.playbackTimerId = null;
        this.playbackCurrentTimeout = null;
        this.sendRobotCommand({ type: 'drive', speed: 0, turn_rate: 0 });
        this.toastManager.show('Playback completed', 'success');
        this.logger.log('Run playback completed', 'info');
        this.updatePlayButtonUI();
    }
    updatePlayButtonUI() {
        const playBtn = document.getElementById('playBtn');
        if (!playBtn)
            return;
        if (!this.isPlaying) {
            playBtn.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i> Play';
        }
        else if (this.isPaused) {
            playBtn.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i> Resume';
        }
        else {
            playBtn.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i> Pause';
        }
    }
    async followPath(run) {
        // Move the robot by sending continuous drive commands to steer towards successive path points
        const path = run.path;
        const corner = run.startCorner || 'BL';
        // Temporarily use the run's start corner for coordinate transforms
        const prevCorner = this.startCorner;
        this.startCorner = corner;
        // Initialize simulator pose to the recorded starting point
        if (this.robotSimulator && Array.isArray(path) && path.length > 0) {
            // Path coordinates are in world space (bottom origin with corner transform)
            const width = this.simCanvasSize.width || this.robotSimulator.canvas.getBoundingClientRect().width || 0;
            const height = this.simCanvasSize.height || this.robotSimulator.canvas.getBoundingClientRect().height || 0;
            const startWorld = path[0];
            // Convert world coords back to simulator canvas coords
            const simX = corner === 'BL' ? startWorld.x : Math.max(0, width - startWorld.x);
            const simY = Math.max(0, height - startWorld.y);
            this.robotSimulator.setPose(simX, simY, startWorld.theta || 0, { clearTrail: true, resetMotion: true });
            // Also sync odom immediately
            this.odom = { x: startWorld.x, y: startWorld.y, thetaDeg: startWorld.theta || 0 };
        }
        // Reset internal pressed keys and stop
        this.pressedKeys.clear();
        await this.sendRobotCommand({ type: 'drive', speed: 0, turn_rate: 0 });
        let idx = 0;
        const tickMs = 50;
        return new Promise((resolve) => {
            const timer = setInterval(() => {
                if (idx >= path.length) {
                    clearInterval(timer);
                    // stop robot
                    this.sendRobotCommand({ type: 'drive', speed: 0, turn_rate: 0 });
                    // Restore previous corner preference
                    this.startCorner = prevCorner;
                    resolve();
                    return;
                }
                // Desired target point in world coords for this path tick
                const target = path[idx];
                // Compute current world odom (already kept up to date by onSimulatorUpdate)
                const current = this.odom;
                const dx = (target.x) - current.x;
                const dy = (target.y) - current.y;
                const distance = Math.hypot(dx, dy);
                // Heading to target in degrees, convert to turn command
                const heading = Math.atan2(dy, dx) * 180 / Math.PI;
                let errHeading = heading - current.thetaDeg;
                while (errHeading > 180)
                    errHeading -= 360;
                while (errHeading < -180)
                    errHeading += 360;
                // Simple P controller
                const maxSpeed = this.config.straightSpeed || 500;
                const maxTurn = this.config.turnRate || 200;
                const speed = Math.max(Math.min(distance * 3, maxSpeed), -maxSpeed);
                const turn = Math.max(Math.min(errHeading * 3, maxTurn), -maxTurn);
                this.sendRobotCommand({ type: 'drive', speed, turn_rate: turn });
                idx++;
            }, tickMs);
        });
    }
    executeCommand(cmd) {
        if (cmd.eventType === 'keyboard') {
            // Handle keyboard events
            if (cmd.type === 'keydown') {
                this.pressedKeys.add(cmd.key);
            }
            else if (cmd.type === 'keyup') {
                this.pressedKeys.delete(cmd.key);
            }
            this.processMovementKeys();
        }
        else if (cmd.eventType === 'xbox') {
            // Handle Xbox controller events
            if (cmd.type === 'buttonPress') {
                this.xboxButtonsPressed.add(cmd.button);
                if (cmd.axes) {
                    this.xboxAxisValues = cmd.axes;
                }
            }
            else if (cmd.type === 'buttonRelease') {
                this.xboxButtonsPressed.delete(cmd.button);
                if (cmd.axes) {
                    this.xboxAxisValues = cmd.axes;
                }
            }
            this.processXboxMovement();
        }
        else if (cmd.eventType === 'robot') {
            // Handle direct robot commands
            this.sendRobotCommand(cmd.command);
        }
    }
    clearLog() {
        this.logger.clear();
        const statusDisplay = document.getElementById('statusDisplay');
        if (statusDisplay) {
            statusDisplay.innerHTML = '';
        }
        this.toastManager.show('Log cleared', 'info');
    }
    exportLog() {
        const logData = this.logger.exportLogs();
        const blob = new Blob([logData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codless-robotics-log-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toastManager.show('Log exported', 'success');
    }
    minimizeWindow() {
        this.toastManager.show('Minimize functionality requires desktop app', 'info');
    }
    toggleMaximize() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        else {
            document.documentElement.requestFullscreen();
        }
    }
    toggleSimulatorFullscreen() { }
    resetSimulator() { }
    closeWindow() {
        if (confirm('Close CodLess™?')) {
            this.cleanup();
            window.close();
        }
    }
    cleanup() {
        // Save data before closing
        this.saveUserData();
        // Clean up intervals
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        // Disconnect from hub
        if (this.bleController.connected) {
            this.bleController.disconnect();
        }
        // Clean up simulator
        if (this.robotSimulator) {
            this.robotSimulator.destroy();
        }
        this.logger.log('Application shutting down', 'info');
    }
    setStartCorner(corner) {
        this.startCorner = corner;
        this.saveUserData();
        this.toastManager.show(`Start corner set to ${corner}`, 'success');
        const bl = document.getElementById('cornerBLBtn');
        const br = document.getElementById('cornerBRBtn');
        if (bl && br) {
            if (corner === 'BL') {
                bl.classList.add('btn-primary');
                bl.classList.remove('btn-secondary');
                br.classList.add('btn-secondary');
                br.classList.remove('btn-primary');
            }
            else {
                br.classList.add('btn-primary');
                br.classList.remove('btn-secondary');
                bl.classList.add('btn-secondary');
                bl.classList.remove('btn-primary');
            }
        }
        // Move current simulator pose to the selected corner
        if (this.robotSimulator && this.robotSimulator.canvas) {
            const rect = this.robotSimulator.canvas.getBoundingClientRect();
            const margin = 30;
            const x = corner === 'BL' ? margin : Math.max(margin, rect.width - margin);
            const y = Math.max(margin, rect.height - margin);
            this.robotSimulator.setPose(x, y, 0, { clearTrail: true, resetMotion: true });
        }
    }
    onSimulatorUpdate(data) {
        // Track coordinates with origin at bottom-left or bottom-right
        const { x: simX, y: simY, angle } = data;
        const width = this.simCanvasSize.width || this.robotSimulator?.canvas?.getBoundingClientRect()?.width || 0;
        const height = this.simCanvasSize.height || this.robotSimulator?.canvas?.getBoundingClientRect()?.height || 0;
        // Convert simulator coordinates (origin top-left) to bottom origin with selected corner
        const worldY = Math.max(0, height - simY);
        const worldX = this.startCorner === 'BL' ? simX : Math.max(0, width - simX);
        this.odom = { x: worldX, y: worldY, thetaDeg: angle };
        const now = Date.now();
        this.lastOdomTimestamp = now;
        if (this.isRecording) {
            this.recordedPath.push({ t: now - this.recordingStartTime, x: worldX, y: worldY, theta: angle });
        }
    }
    startOdomIntegration() {
        if (this.robotSimulator)
            return; // simulator provides position updates
        if (this.odomTimer)
            return;
        this.lastOdomTimestamp = Date.now();
        this.odomTimer = setInterval(() => {
            const now = Date.now();
            const dt = (now - this.lastOdomTimestamp) / 1000;
            this.lastOdomTimestamp = now;
            const speed = this.lastDriveCmd.speed || 0; // mm/s
            const turn = this.lastDriveCmd.turn_rate || 0; // deg/s
            const angleRad = (this.odom.thetaDeg * Math.PI) / 180;
            this.odom.x += Math.cos(angleRad) * speed * dt;
            this.odom.y += Math.sin(angleRad) * speed * dt;
            this.odom.thetaDeg += turn * dt;
        }, 50);
    }
}
// Global functions
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    const targetTab = document.getElementById(tabName + 'Tab');
    const targetBtn = event.target;
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-hidden', 'false');
    }
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.setAttribute('aria-selected', 'true');
    }
}
function closeConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}
function saveConfiguration() {
    if (!window.app)
        return;
    const config = window.app.config;
    const errors = [];
    // Validate and update configuration
    try {
        // Physical parameters
        const axleTrack = parseFloat(document.getElementById('axleTrack')?.value || 0);
        const wheelDiameter = parseFloat(document.getElementById('wheelDiameter')?.value || 0);
        if (axleTrack >= 50 && axleTrack <= 300) {
            config.axleTrack = axleTrack;
        }
        else {
            errors.push('Axle track must be between 50-300mm');
        }
        if (wheelDiameter >= 20 && wheelDiameter <= 100) {
            config.wheelDiameter = wheelDiameter;
        }
        else {
            errors.push('Wheel diameter must be between 20-100mm');
        }
        // Motor ports
        config.leftMotorPort = document.getElementById('leftMotorPort')?.value || 'A';
        config.rightMotorPort = document.getElementById('rightMotorPort')?.value || 'B';
        config.arm1MotorPort = document.getElementById('arm1MotorPort')?.value || 'C';
        config.arm2MotorPort = document.getElementById('arm2MotorPort')?.value || 'D';
        // Movement settings
        config.straightSpeed = parseFloat(document.getElementById('straightSpeed')?.value || 500);
        config.straightAcceleration = parseFloat(document.getElementById('straightAccel')?.value || 250);
        config.turnRate = parseFloat(document.getElementById('turnRate')?.value || 200);
        config.turnAcceleration = parseFloat(document.getElementById('turnAccel')?.value || 300);
        // Advanced settings
        config.commandTimeout = parseInt(document.getElementById('commandTimeout')?.value || 1000);
        config.batteryWarning = parseInt(document.getElementById('batteryWarning')?.value || 20);
        config.autoSave = true;
        const simulateConnectedEl = document.getElementById('simulateConnected');
        if (simulateConnectedEl) {
            config.simulateConnected = simulateConnectedEl.checked;
            console.log('Simulate Connected checkbox value:', simulateConnectedEl.checked);
        }
        else {
            console.error('simulateConnected checkbox element not found');
            config.simulateConnected = false;
        }
        // Validate configuration
        const validationErrors = config.validate();
        errors.push(...validationErrors);
        if (errors.length === 0) {
            window.app.saveUserData();
            // Apply simulation state immediately after saving config
            window.app.applySimulationState();
            // Update the UI to reflect changes immediately
            window.app.updateUI();
            // Update the robot simulator with new acceleration settings
            if (window.app.robotSimulator) {
                window.app.robotSimulator.updateConfig(config);
            }
            closeConfigModal();
            window.app.toastManager.show('Configuration saved successfully', 'success');
            window.app.logger.log(`Configuration updated - simulateConnected: ${config.simulateConnected}`, 'success');
            // Debug log to help troubleshoot
            console.log('Configuration saved:', {
                simulateConnected: config.simulateConnected,
                bleConnected: window.app.bleController.connected,
                isSimulating: window.app.bleController.isSimulatingConnection
            });
        }
        else {
            window.app.toastManager.show(`Configuration errors: ${errors.join(', ')}`, 'error');
        }
    }
    catch (error) {
        window.app.toastManager.show(`Failed to save configuration: ${error.message}`, 'error');
    }
}
function resetConfigToDefaults() {
    if (!window.app)
        return;
    if (confirm('Reset all configuration to defaults? This cannot be undone.')) {
        window.app.config = new RobotConfig();
        window.app.updateConfigurationUI();
        window.app.toastManager.show('Configuration reset to defaults', 'info');
    }
}
function resetAllData() {
    // Confirm destructive action
    const message = 'Are you sure? Your settings and runs WILL be deleted. This will reset the app to first-run state.';
    if (!confirm(message))
        return;
    try {
        // Prefer using existing helper to clear app data and reset in-memory state
        if (window.app && typeof window.app.clearCorruptedData === 'function') {
            window.app.clearCorruptedData();
        }
        else {
            // Fallback: remove known storage keys
            try {
                localStorage.removeItem(STORAGE_KEYS.SAVED_RUNS);
            }
            catch (e) { }
            try {
                localStorage.removeItem(STORAGE_KEYS.CONFIG);
            }
            catch (e) { }
            try {
                localStorage.removeItem(STORAGE_KEYS.CALIBRATION_DATA);
            }
            catch (e) { }
            try {
                localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
            }
            catch (e) { }
        }
    }
    catch (e) {
        console.error('Error clearing app data:', e);
    }
    // Attempt to clear caches and unregister service workers for a truly fresh start
    const clearCaches = (async () => {
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                await Promise.all(names.map((name) => caches.delete(name)));
            }
            catch (err) {
                console.warn('Failed to clear caches:', err);
            }
        }
    })();
    const unregisterSW = (async () => {
        if ('serviceWorker' in navigator) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((reg) => reg.unregister()));
            }
            catch (err) {
                console.warn('Failed to unregister service workers:', err);
            }
        }
    })();
    // Close the modal to avoid showing stale UI during reload
    try {
        closeConfigModal();
    }
    catch (e) { }
    Promise.allSettled([clearCaches, unregisterSW]).finally(() => {
        try {
            sessionStorage.clear();
        }
        catch (e) { }
        // Full reload to ensure fresh app state
        location.reload();
    });
}
function minimizeWindow() {
    window.app?.minimizeWindow();
}
function toggleMaximize() {
    window.app?.toggleMaximize();
}
function closeWindow() {
    window.app?.closeWindow();
}
// Browser compatibility check
function checkBrowserCompatibility() {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edge');
    const isEdge = userAgent.includes('Edge');
    const isChromiumBased = isChrome || isEdge;
    // Check for required features - STRICT check for Bluetooth API
    const hasBluetoothSupport = !!navigator.bluetooth;
    const isSecureContext = window.isSecureContext;
    // Bluetooth API is absolutely required - no exceptions
    const isSupported = hasBluetoothSupport && isSecureContext;
    return {
        isSupported,
        browserName: isChrome ? 'Chrome' : isEdge ? 'Edge' : 'Unknown',
        hasBluetoothSupport,
        isSecureContext
    };
}
function showBrowserNotSupportedMessage() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        const loadingContent = loadingScreen.querySelector('.loading-content');
        if (loadingContent) {
            loadingContent.innerHTML = `
                <div class="loading-logo">
                    <i class="fas fa-exclamation-triangle" style="color: #ff4757; font-size: 48px;"></i>
                </div>
                <h2 style="color: #ff4757; margin: 20px 0;">Browser Not Supported</h2>
                <p style="color: #666; margin: 20px 0; max-width: 400px; text-align: center; line-height: 1.5;">
                    This application requires Chrome or Microsoft Edge with Bluetooth support.
                </p>
                <p style="color: #333; margin: 20px 0; font-weight: 500;">
                    Please visit this app using:
                </p>
                <div style="margin: 20px 0;">
                    <div style="display: inline-block; margin: 0 10px; text-align: center;">
                        <i class="fab fa-chrome" style="font-size: 32px; color: #4285f4; display: block; margin-bottom: 8px;"></i>
                        <span style="color: #333; font-size: 14px;">Google Chrome</span>
                    </div>
                    <div style="display: inline-block; margin: 0 10px; text-align: center;">
                        <i class="fab fa-edge" style="font-size: 32px; color: #0078d4; display: block; margin-bottom: 8px;"></i>
                        <span style="color: #333; font-size: 14px;">Microsoft Edge</span>
                    </div>
                </div>
                <button onclick="location.reload()" style="
                    background: #00a8ff; 
                    color: white; 
                    border: none; 
                    padding: 12px 24px; 
                    border-radius: 6px; 
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 20px;
                ">
                    Retry
                </button>
            `;
        }
    }
}
// Application initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Non-blocking warning for browsers without Bluetooth or insecure context
    const browserCheck = checkBrowserCompatibility();
    if (!browserCheck.isSupported || window.BT_UNAVAILABLE) {
        console.warn('Bluetooth unavailable or insecure context. Continuing in debug mode.');
        try {
            alert('Bluetooth is not available in this browser or context. Robot connectivity will not work. This setup is only for debugging.');
        }
        catch (e) { }
    }
    // Preload the 3D model for faster loading
    try {
        const modelViewer = document.querySelector('#xboxController3D');
        if (modelViewer) {
            // Set up model viewer for optimal performance
            modelViewer.addEventListener('load', () => {
                console.log('3D model loaded successfully');
            });
            modelViewer.addEventListener('error', (event) => {
                console.error('Error loading 3D model:', event);
            });
            // Preload the model
            const modelUrl = modelViewer.getAttribute('src');
            if (modelUrl) {
                fetch(modelUrl, { priority: 'high' })
                    .then(response => response.blob())
                    .then(() => console.log('3D model preloaded'))
                    .catch(err => console.error('Failed to preload 3D model:', err));
            }
        }
    }
    catch (error) {
        console.error('Error setting up 3D model:', error);
    }
    try {
        window.app = new FLLRoboticsApp();
        await window.app.init();
    }
    catch (error) {
        console.error('Failed to initialize application:', error);
        // Show error message in app container
        const appContainer = document.getElementById('appContainer');
        if (appContainer) {
            appContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px;">
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="color: #ff4757; font-size: 48px; margin-bottom: 20px;"></i>
                        <h2 style="color: #ff4757; margin-bottom: 10px;">Initialization Failed</h2>
                        <p style="color: #666; margin-bottom: 20px;">
                            Failed to load the application: ${error.message}
                        </p>
                        <button onclick="location.reload()" style="
                            background: #00a8ff; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-size: 14px;
                        ">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }
});
window.addEventListener('beforeunload', (e) => {
    if (window.app) {
        window.app.cleanup();
    }
});
// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.app) {
        if (document.hidden) {
            // Page is hidden, reduce performance
            window.app.robotSimulator?.stop();
        }
        else {
            // Page is visible, resume
            if (window.app.bleController?.isSimulatingConnection) {
                window.app.robotSimulator?.start();
            }
        }
    }
});
// Add CSS for loading animations
const style = document.createElement('style');
style.textContent = `
@keyframes slideOutToast {
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);
console.log(`%cCodLess™ v${APP_CONFIG.VERSION}`, 'color: #00a8ff; font-size: 16px; font-weight: bold;');
console.log('🤖 Professional robotics control and simulation platform');
console.log('📖 Documentation: https://github.com/codless-robotics/fll-control-center');
console.log('%cIf you encounter "savedRuns.forEach is not a function" error, try: window.app?.clearCorruptedData()', 'color: #ff9800; font-size: 12px;');
//# sourceMappingURL=app.js.map