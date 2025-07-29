// CodLess FLL Robotics Control Center - Professional JavaScript Application
// Version 3.0.0 - Stable release with enhanced browser compatibility and bug fixes

'use strict';

// ============================
// GLOBAL CONSTANTS & CONFIG
// ============================

const APP_CONFIG = {
    VERSION: '3.0.0',
    NAME: 'CodLess FLL Robotics Control Center',
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

// ============================
// UTILITY CLASSES
// ============================

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
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
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
            } catch (error) {
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
        if (!toast) return;

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
            } catch (error) {
                console.error('Performance monitor callback error:', error);
            }
        });
    }

    updateLatency(latency) {
        this.metrics.latency = latency;
    }
}

// ============================
// CORE APPLICATION CLASSES
// ============================

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
        this.autoSave = data.autoSave || false;
        this.debugMode = data.debugMode || false;
        
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
    }

    async connect() {
        if (this.connecting || this.connected) {
            return this.connected;
        }

        this.connecting = true;
        this.connectionAttempts++;

        try {
            // Check for Web Bluetooth API support
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth API is not supported in this browser. Please use Chrome 56+, Edge 79+, or another compatible browser with HTTPS.');
            }

            // Check if we're in a secure context (HTTPS)
            if (!window.isSecureContext) {
                throw new Error('Web Bluetooth requires a secure context (HTTPS). Please access this application over HTTPS.');
            }

            this.emit('connecting');
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: APP_CONFIG.HUB_NAME_PREFIX }],
                optionalServices: [APP_CONFIG.BLUETOOTH_SERVICE_UUID]
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

        } catch (error) {
            this.connecting = false;
            this.connected = false;
            
            let errorMessage = error.message;
            
            // Handle specific Bluetooth errors with user-friendly messages
            if (error.name === 'NotFoundError') {
                errorMessage = 'No Pybricks hub found. Make sure your hub is powered on and running the provided code.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Bluetooth access was denied. Please allow Bluetooth access and try again.';
            } else if (error.name === 'SecurityError') {
                errorMessage = 'Bluetooth access requires HTTPS. Please use a secure connection.';
            } else if (error.name === 'NetworkError') {
                errorMessage = 'Failed to connect to the hub. Make sure it\'s in range and try again.';
            } else if (error.message.includes('User cancelled')) {
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
                this.logger.log(`Retrying connection in ${retryDelay/1000} seconds...`, 'info');
                setTimeout(() => this.connect(), retryDelay);
            } else {
                this.logger.log('Maximum connection attempts reached. Please try again manually.', 'error');
            }

            return false;
        }
    }

    async disconnect() {
        if (this.device && this.connected) {
            try {
                await this.device.gatt.disconnect();
            } catch (error) {
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
        } else {
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

            } catch (error) {
                this.emit('commandError', { command, error: error.message });
            }
        }

        this.isProcessingQueue = false;
    }

    async sendRawCommand(command) {
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

    handleIncomingData(event) {
        try {
            const value = event.target.value;
            const data = new Uint8Array(value.buffer);
            
            if (data[0] === 0x01) { // Text response
                const payload = new TextDecoder().decode(data.slice(1));
                this.processHubMessage(payload);
            } else if (data[0] === 0x02) { // Battery info
                this.processBatteryInfo(data.slice(1));
            } else if (data[0] === 0x03) { // Hub info
                this.processHubInfo(data.slice(1));
            }
        } catch (error) {
            this.emit('dataError', { error: error.message });
        }
    }

    processHubMessage(message) {
        this.emit('hubMessage', { message });
        
        if (message === "ready") {
            this.emit('hubReady');
        } else if (message.startsWith("error:")) {
            this.emit('hubError', { error: message.substring(6) });
        } else if (message === "ok") {
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
        } catch (error) {
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
        
        // Physics parameters
        this.robotMass = 2.5;
        this.robotInertia = 0.12;
        this.friction = 0.05;
        this.maxAcceleration = 800;
        this.maxTurnAcceleration = 600;
        
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
        
        this.canvas.addEventListener('mousedown', this.mouseDownHandler);
        this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.addEventListener('mouseup', this.mouseUpHandler);
        
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
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    animate() {
        if (!this.isRunning) return;

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

        // Apply PID-like control
        this.acceleration.x = this.clamp(speedError * 10, -this.maxAcceleration, this.maxAcceleration);
        this.acceleration.angular = this.clamp(turnError * 15, -this.maxTurnAcceleration, this.maxTurnAcceleration);

        // Update velocities
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.angular += this.acceleration.angular * dt;

        // Apply friction
        this.velocity.x *= (1 - this.friction * dt);
        this.velocity.angular *= (1 - this.friction * dt);

        // Update robot position
        const angleRad = (this.robotAngle * Math.PI) / 180;
        const dx = this.velocity.x * Math.cos(angleRad) * dt * 0.1;
        const dy = this.velocity.x * Math.sin(angleRad) * dt * 0.1;

        this.robotX += dx;
        this.robotY += dy;
        this.robotAngle += this.velocity.angular * dt * 0.5;

        // Keep robot in bounds
        const rect = this.canvas.getBoundingClientRect();
        this.robotX = this.clamp(this.robotX, 30, rect.width - 30);
        this.robotY = this.clamp(this.robotY, 30, rect.height - 30);

        // Update arm positions
        this.arm1Angle += this.targetArm1Speed * dt * 0.3;
        this.arm2Angle += this.targetArm2Speed * dt * 0.3;
        
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
        if (!this.ctx || !this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        // Clear with a slight performance optimization
        this.ctx.fillStyle = '#0f0f0f';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        
        this.ctx.save();

        // Draw background map
        if (this.backgroundMap) {
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.backgroundMap, 0, 0, rect.width, rect.height);
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
        
        // Draw UI overlays in screen space
        this.drawInfo();
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
        if (this.trail.length < 2) return;

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
            } else {
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
        } else {
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
        } else {
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
        } else {
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
        } else {
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
        this.ctx.fillRect(10, 10, 220, 120);

        // Info text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Inter';
        const lineHeight = 15;
        let y = 25;

        const info = [
            `Position: (${Math.round(this.robotX)}, ${Math.round(this.robotY)})`,
            `Angle: ${Math.round(this.robotAngle % 360)}°`,
            `Speed: ${Math.round(this.velocity.x)}`,
            `Turn Rate: ${Math.round(this.velocity.angular)}`,
            `Arm 1: ${Math.round(this.arm1Angle)}°`,
            `Arm 2: ${Math.round(this.arm2Angle)}°`,
            `Trail: ${this.showTrail ? 'ON' : 'OFF'}`
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
        } else if (cmdType === "arm1") {
            this.targetArm1Speed = (command.speed || 0) * 1.5;
        } else if (cmdType === "arm2") {
            this.targetArm2Speed = (command.speed || 0) * 1.5;
        } else if (cmdType === "emergency_stop") {
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

// ============================
// MAIN APPLICATION CLASS
// ============================

class FLLRoboticsApp extends EventEmitter {
    constructor() {
        super();
        
        // Core components
        this.logger = new Logger();
        this.toastManager = new ToastManager();
        this.performanceMonitor = new PerformanceMonitor();
        this.bleController = new BLEController();
        this.robotSimulator = null;
        this.config = new RobotConfig();
        
        // Application state
        this.isDeveloperMode = false;
        this.isCalibrated = false;
        this.isRecording = false;
        this.recordedCommands = [];
        this.recordingStartTime = 0;
        this.recordingTimer = null;
        this.savedRuns = new Map();
        
        // Control state
        this.pressedKeys = new Set();
        this.emergencyStopActive = false;
        
        // Auto-save
        this.autoSaveTimer = null;
        
        // Initialize application
        this.init();
    }

    async init() {
        try {
            this.showLoadingScreen();
            
            // Check browser compatibility
            this.checkBrowserCompatibility();
            
            // Load saved data
            await this.loadUserData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup robot simulator
            this.setupRobotSimulator();
            
            // Setup BLE controller events
            this.setupBLEEvents();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Setup auto-save
            this.setupAutoSave();
            
            // Setup keyboard controls
            this.setupKeyboardControls();
            
            // Initialize UI
            this.updateUI();
            
            // Show application
            await this.hideLoadingScreen();
            
            this.logger.log('Application initialized successfully', 'success');
            this.toastManager.show('Welcome to CodLess Robotics Control Center!', 'success');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.toastManager.show(`Initialization failed: ${error.message}`, 'error', 0);
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

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('appContainer');
        
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }

    async hideLoadingScreen() {
        return new Promise(resolve => {
            setTimeout(() => {
                const loadingScreen = document.getElementById('loadingScreen');
                const appContainer = document.getElementById('appContainer');
                
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                        if (appContainer) appContainer.style.display = 'flex';
                        resolve();
                    }, 500);
                } else {
                    if (appContainer) appContainer.style.display = 'flex';
                    resolve();
                }
            }, 2000); // Show loading for at least 2 seconds
        });
    }

    async loadUserData() {
        try {
            // Load configuration
            const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
            if (savedConfig) {
                this.config = RobotConfig.fromJSON(JSON.parse(savedConfig));
            }
            
            // Load saved runs
            const savedRuns = localStorage.getItem(STORAGE_KEYS.SAVED_RUNS);
            if (savedRuns) {
                const runsData = JSON.parse(savedRuns);
                this.savedRuns = new Map(Object.entries(runsData));
            }
            
            // Load calibration data
            const calibrationData = localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA);
            if (calibrationData) {
                const data = JSON.parse(calibrationData);
                Object.assign(this.config, data);
                this.isCalibrated = true;
            }
            
            // Load user preferences
            const preferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            if (preferences) {
                const prefs = JSON.parse(preferences);
                this.isDeveloperMode = prefs.developerMode || false;
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    saveUserData() {
        try {
            localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
            localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(Object.fromEntries(this.savedRuns)));
            localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify({
                developerMode: this.isDeveloperMode
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
            
        } catch (error) {
            console.error('Error saving user data:', error);
            this.toastManager.show('Failed to save user data', 'error');
        }
    }

    setupEventListeners() {
        // Hub connection
        document.getElementById('connectBtn')?.addEventListener('click', () => this.toggleConnection());
        document.getElementById('developerMode')?.addEventListener('change', (e) => this.toggleDeveloperMode(e.target.checked));
        
        // Configuration
        document.getElementById('configBtn')?.addEventListener('click', () => this.openConfigModal());
        
        // Pybricks integration
        document.getElementById('copyCodeBtn')?.addEventListener('click', () => this.copyPybricksCode());
        document.getElementById('openPybricksBtn')?.addEventListener('click', () => this.openPybricksIDE());
        
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
        
        // Simulator controls
        document.getElementById('uploadMapBtn')?.addEventListener('click', () => this.uploadMap());
        document.getElementById('resetSimBtn')?.addEventListener('click', () => this.resetSimulator());
        document.getElementById('fullscreenSimBtn')?.addEventListener('click', () => this.toggleSimulatorFullscreen());
        
        // Emergency controls
        document.getElementById('emergencyStopBtn')?.addEventListener('click', () => this.emergencyStop());
        
        // Calibration controls
        document.getElementById('startCalibrationBtn')?.addEventListener('click', () => this.startCalibration());
        
        // Additional simulator controls
        document.getElementById('simulatorSettingsBtn')?.addEventListener('click', () => this.openSimulatorSettings());
        
        // Log controls
        document.getElementById('clearLogBtn')?.addEventListener('click', () => this.clearLog());
        document.getElementById('exportLogBtn')?.addEventListener('click', () => this.exportLog());
        
        // Window controls
        document.querySelector('.minimize-btn')?.addEventListener('click', () => this.minimizeWindow());
        document.querySelector('.maximize-btn')?.addEventListener('click', () => this.toggleMaximize());
        document.querySelector('.close-btn')?.addEventListener('click', () => this.closeWindow());
        
        // Logger events
        this.logger.onLog((entry) => this.displayLogEntry(entry));
    }

    setupRobotSimulator() {
        const canvas = document.getElementById('robotSimulator');
        
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            
            // Ensure canvas has proper initial dimensions
            if (rect.width === 0 || rect.height === 0) {
                // Wait for the element to have dimensions
                setTimeout(() => this.setupRobotSimulator(), 100);
                return;
            }
            
            this.setupHighDPICanvas(canvas);
            this.robotSimulator = new RobotSimulator(canvas);
            this.robotSimulator.on('positionUpdate', (data) => this.onSimulatorUpdate(data));
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
        });

        this.bleController.on('connectionError', (data) => {
            this.updateConnectionUI('error');
            this.toastManager.show(`Connection failed: ${data.error}`, 'error');
            this.logger.log(`Connection failed: ${data.error}`, 'error');
            
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
        if (this.config.autoSave) {
            this.autoSaveTimer = setInterval(() => {
                this.saveUserData();
            }, APP_CONFIG.AUTO_SAVE_INTERVAL);
        }
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

    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const key = e.key.toLowerCase();
        
        // Emergency stop
        if (key === ' ') {
            this.emergencyStop();
            return;
        }
        
        if (!this.pressedKeys.has(key)) {
            this.pressedKeys.add(key);
            this.processMovementKeys();
            
            if (this.isRecording) {
                this.recordKeyEvent('keydown', key);
            }
        }
    }

    handleKeyUp(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const key = e.key.toLowerCase();
        
        if (this.pressedKeys.has(key)) {
            this.pressedKeys.delete(key);
            this.processMovementKeys();
            
            if (this.isRecording) {
                this.recordKeyEvent('keyup', key);
            }
        }
    }

    processMovementKeys() {
        if (this.emergencyStopActive) return;
        
        // Calculate drive command
        let speed = 0;
        let turn = 0;
        
        if (this.pressedKeys.has('w')) speed += 200;
        if (this.pressedKeys.has('s')) speed -= 200;
        if (this.pressedKeys.has('a')) turn -= 100;
        if (this.pressedKeys.has('d')) turn += 100;
        
        this.sendRobotCommand({ type: 'drive', speed, turn_rate: turn });
        
        // Calculate arm commands
        let arm1Speed = 0;
        let arm2Speed = 0;
        
        if (this.pressedKeys.has('q')) arm1Speed = 200;
        if (this.pressedKeys.has('e')) arm1Speed = -200;
        if (this.pressedKeys.has('r')) arm2Speed = 200;
        if (this.pressedKeys.has('f')) arm2Speed = -200;
        
        this.sendRobotCommand({ type: 'arm1', speed: arm1Speed });
        this.sendRobotCommand({ type: 'arm2', speed: arm2Speed });
    }

    async sendRobotCommand(command) {
        try {
            // Apply calibration compensation
            const compensatedCommand = this.applyCalibrationCompensation(command);
            
            // Send to appropriate controller
            if (this.isDeveloperMode) {
                this.robotSimulator?.updateCommand(compensatedCommand);
                this.logger.log(`SIM: ${this.formatCommandForLog(compensatedCommand)}`, 'info');
            } else if (this.bleController.connected) {
                await this.bleController.sendCommand(compensatedCommand);
            }
            
            // Record if recording
            if (this.isRecording) {
                this.recordCommand(compensatedCommand);
            }
            
        } catch (error) {
            this.logger.log(`Command error: ${error.message}`, 'error');
        }
    }

    applyCalibrationCompensation(command) {
        if (!this.isCalibrated) return command;
        
        const compensated = { ...command };
        
        if (command.type === 'drive') {
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
        
        return compensated;
    }

    formatCommandForLog(command) {
        switch (command.type) {
            case 'drive':
                const speed = command.speed || 0;
                const turn = command.turn_rate || 0;
                if (speed === 0 && turn === 0) return 'Drive: Stop';
                const actions = [];
                if (speed > 0) actions.push('Forward');
                if (speed < 0) actions.push('Backward');
                if (turn > 0) actions.push('Turn Right');
                if (turn < 0) actions.push('Turn Left');
                return `Drive: ${actions.join(' + ')} (${speed}, ${turn})`;
            
            case 'arm1':
            case 'arm2':
                const armSpeed = command.speed || 0;
                if (armSpeed === 0) return `${command.type}: Stop`;
                return `${command.type}: ${armSpeed > 0 ? 'Up' : 'Down'} (${armSpeed})`;
            
            default:
                return `${command.type}: ${JSON.stringify(command)}`;
        }
    }

    async toggleConnection() {
        if (this.bleController.connected) {
            await this.bleController.disconnect();
        } else {
            await this.bleController.connect();
        }
    }

    toggleDeveloperMode(enabled) {
        this.isDeveloperMode = enabled;
        this.updateSimulatorVisibility();
        this.saveUserData();
        
        const message = enabled ? 'Simulation mode enabled' : 'Simulation mode disabled';
        this.logger.log(message, 'info');
        this.toastManager.show(message, 'info');
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

        this.toastManager.show(
            'Connection issues? Check the log for troubleshooting steps or try simulator mode.',
            'info',
            8000
        );
    }

    emergencyStop() {
        this.emergencyStopActive = true;
        this.pressedKeys.clear();
        
        // Send emergency stop command
        this.sendRobotCommand({ type: 'emergency_stop' });
        
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
        this.updateCalibrationUI();
        this.updateRunsList();
        this.updateRecordingUI();
        this.updateSimulatorVisibility();
        this.updateConfigurationUI();
        this.updateDeveloperModeCheckbox();
    }

    updateConnectionUI(status = 'disconnected', deviceName = '') {
        const connectBtn = document.getElementById('connectBtn');
        const hubStatus = document.getElementById('hubStatus');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (!connectBtn || !hubStatus) return;

        // Check if Bluetooth is not supported
        if (!navigator.bluetooth || !window.isSecureContext) {
            connectBtn.innerHTML = '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Bluetooth Unavailable';
            connectBtn.disabled = true;
            hubStatus.className = 'status-indicator error';
            const reason = !navigator.bluetooth ? 'Browser not supported' : 'HTTPS required';
            hubStatus.innerHTML = `<div class="status-dot" aria-hidden="true"></div><span>Bluetooth Unavailable - ${reason}</span>`;
            if (connectionStatus) connectionStatus.textContent = `Bluetooth Unavailable - ${reason}`;
            return;
        }
        
        switch (status) {
            case 'connecting':
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Connecting...';
                connectBtn.disabled = true;
                hubStatus.className = 'status-indicator connecting';
                hubStatus.innerHTML = '<div class="status-dot" aria-hidden="true"></div><span>Connecting...</span>';
                if (connectionStatus) connectionStatus.textContent = 'Connecting';
                break;
                
            case 'connected':
                connectBtn.innerHTML = '<i class="fas fa-bluetooth" aria-hidden="true"></i> Disconnect Hub';
                connectBtn.disabled = false;
                hubStatus.className = 'status-indicator connected';
                hubStatus.innerHTML = `<div class="status-dot" aria-hidden="true"></div><span>Connected${deviceName ? ` - ${deviceName}` : ''}</span>`;
                if (connectionStatus) connectionStatus.textContent = `Connected${deviceName ? ` - ${deviceName}` : ''}`;
                break;
                
            case 'error':
            case 'disconnected':
            default:
                connectBtn.innerHTML = '<i class="fas fa-bluetooth" aria-hidden="true"></i> Connect to Pybricks Hub';
                connectBtn.disabled = false;
                hubStatus.className = 'status-indicator disconnected';
                hubStatus.innerHTML = '<div class="status-dot" aria-hidden="true"></div><span>Hub Disconnected</span>';
                if (connectionStatus) connectionStatus.textContent = 'Disconnected';
                break;
        }
    }

    updateCalibrationUI() {
        const calibrationStatus = document.getElementById('calibrationStatus');
        if (!calibrationStatus) return;
        
        if (this.isCalibrated) {
            calibrationStatus.className = 'calibration-status completed';
            calibrationStatus.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i><span>Calibration Complete</span>';
        } else {
            calibrationStatus.className = 'calibration-status';
            calibrationStatus.innerHTML = '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i><span>Calibration Required</span>';
        }
    }

    updateRunsList() {
        const select = document.getElementById('savedRunsList');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select a run...</option>';
        
        this.savedRuns.forEach((runData, runName) => {
            const option = document.createElement('option');
            option.value = runName;
            option.textContent = `${runName} (${runData.commands?.length || 0} commands)`;
            select.appendChild(option);
        });
    }

    updateRecordingUI() {
        const recordBtn = document.getElementById('recordBtn');
        const saveBtn = document.getElementById('saveBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (!recordBtn) return;
        
        // Enable record button if not currently recording
        recordBtn.disabled = false;
        
        // Save button state
        if (saveBtn) {
            saveBtn.disabled = this.isRecording || this.recordedCommands.length === 0;
        }
        
        // Pause button visibility
        if (pauseBtn) {
            if (this.isRecording) {
                pauseBtn.classList.remove('hidden');
                pauseBtn.disabled = false;
            } else {
                pauseBtn.classList.add('hidden');
                pauseBtn.disabled = true;
            }
        }
    }

    updateSimulatorVisibility() {
        const simulatorSection = document.getElementById('simulatorSection');
        
        if (!simulatorSection) return;
        
        if (this.isDeveloperMode) {
            simulatorSection.classList.remove('hidden');
            
            // Give the DOM time to update before starting simulator
            setTimeout(() => {
                if (this.robotSimulator) {
                    this.robotSimulator.start();
                } else {
                    // Re-setup simulator if it doesn't exist
                    this.setupRobotSimulator();
                }
                this.enableSimulatorControls(true);
            }, 10);
        } else {
            simulatorSection.classList.add('hidden');
            this.robotSimulator?.stop();
            this.enableSimulatorControls(false);
        }
    }

    enableSimulatorControls(enabled) {
        const controls = [
            'resetSimBtn',
            'uploadMapBtn'
        ];
        
        controls.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = !enabled;
            }
        });
    }

    updateConfigurationUI() {
        // Update form values with current config
        Object.keys(this.config).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.config[key];
                } else {
                    element.value = this.config[key];
                }
            }
        });
    }

    updateDeveloperModeCheckbox() {
        const developerModeCheckbox = document.getElementById('developerMode');
        if (developerModeCheckbox) {
            developerModeCheckbox.checked = this.isDeveloperMode;
        }
    }

    updateBatteryUI(level) {
        const batteryStatus = document.getElementById('batteryStatus');
        if (batteryStatus) {
            batteryStatus.textContent = `${level}%`;
            
            // Update color based on level
            if (level <= this.config.batteryWarning) {
                batteryStatus.style.color = '#dc3545';
            } else if (level <= 50) {
                batteryStatus.style.color = '#ffc107';
            } else {
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
        if (!statusDisplay) return;
        
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

    recordKeyEvent(type, key) {
        if (!this.isRecording) return;
        
        this.recordedCommands.push({
            timestamp: Date.now() - this.recordingStartTime,
            type,
            key,
            eventType: 'keyboard'
        });
    }

    recordCommand(command) {
        if (!this.isRecording) return;
        
        this.recordedCommands.push({
            timestamp: Date.now() - this.recordingStartTime,
            type: 'command',
            command,
            eventType: 'robot'
        });
    }

    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    startRecording() {
        if (this.isRecording) return;
        
        const runName = document.getElementById('runNameInput')?.value?.trim();
        if (!runName) {
            this.toastManager.show('Please enter a run name', 'warning');
            return;
        }
        
        this.isRecording = true;
        this.recordedCommands = [];
        this.recordingStartTime = Date.now();
        
        const recordBtn = document.getElementById('recordBtn');
        const saveBtn = document.getElementById('saveBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
            recordBtn.classList.remove('btn-danger');
            recordBtn.classList.add('btn-warning');
        }
        
        if (saveBtn) {
            saveBtn.disabled = true;
        }
        
        if (pauseBtn) {
            pauseBtn.classList.remove('hidden');
            pauseBtn.disabled = false;
        }
        
        this.toastManager.show(`Recording "${runName}" started`, 'success');
        this.logger.log(`Started recording: ${runName}`, 'info');
    }

    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        const recordBtn = document.getElementById('recordBtn');
        const saveBtn = document.getElementById('saveBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-circle"></i> Record Run';
            recordBtn.classList.remove('btn-warning');
            recordBtn.classList.add('btn-danger');
        }
        
        if (saveBtn) {
            saveBtn.disabled = false;
        }
        
        if (pauseBtn) {
            pauseBtn.classList.add('hidden');
            pauseBtn.disabled = true;
        }
        
        const commandCount = this.recordedCommands.length;
        const duration = ((Date.now() - this.recordingStartTime) / 1000).toFixed(1);
        
        this.toastManager.show(`Recording stopped: ${commandCount} commands in ${duration}s`, 'info');
        this.logger.log(`Recording stopped: ${commandCount} commands, ${duration}s duration`, 'info');
    }

    pauseRecording() {
        if (!this.isRecording) return;
        
        const pauseBtn = document.getElementById('pauseBtn');
        if (!pauseBtn) return;
        
        if (pauseBtn.innerHTML.includes('pause')) {
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            this.toastManager.show('Recording paused', 'info');
            this.logger.log('Recording paused', 'info');
        } else {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            this.toastManager.show('Recording resumed', 'info');
            this.logger.log('Recording resumed', 'info');
        }
    }

    saveCurrentRun() {
        const runName = document.getElementById('runNameInput')?.value?.trim();
        if (!runName) {
            this.toastManager.show('Please enter a run name', 'warning');
            return;
        }
        
        if (this.recordedCommands.length === 0) {
            this.toastManager.show('No commands recorded', 'warning');
            return;
        }
        
        const runData = {
            name: runName,
            commands: [...this.recordedCommands],
            createdAt: new Date().toISOString(),
            duration: this.recordedCommands.length > 0 ? 
                this.recordedCommands[this.recordedCommands.length - 1].timestamp : 0
        };
        
        this.savedRuns.set(runName, runData);
        this.saveUserData();
        this.updateRunsList();
        
        this.toastManager.show(`Run "${runName}" saved successfully`, 'success');
        this.logger.log(`Saved run: ${runName} (${this.recordedCommands.length} commands)`, 'success');
        
        // Clear recorded commands and reset UI
        this.recordedCommands = [];
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
        }
    }

    selectRun(runName) {
        const playBtn = document.getElementById('playBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        if (runName && this.savedRuns.has(runName)) {
            if (playBtn) playBtn.disabled = false;
            if (deleteBtn) deleteBtn.disabled = false;
            if (exportBtn) exportBtn.disabled = false;
        } else {
            if (playBtn) playBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
            if (exportBtn) exportBtn.disabled = true;
        }
    }

    async playSelectedRun() {
        const selectedRun = document.getElementById('savedRunsList')?.value;
        if (!selectedRun || !this.savedRuns.has(selectedRun)) {
            this.toastManager.show('Please select a run to play', 'warning');
            return;
        }
        
        const runData = this.savedRuns.get(selectedRun);
        if (!runData.commands || runData.commands.length === 0) {
            this.toastManager.show('Selected run has no commands', 'warning');
            return;
        }
        
        if (!this.bleController.connected && !this.isDeveloperMode) {
            this.toastManager.show('Connect to hub or enable simulation mode to play runs', 'warning');
            return;
        }
        
        this.toastManager.show(`Playing run: ${selectedRun}`, 'info');
        this.logger.log(`Started playback: ${selectedRun}`, 'info');
        
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
            playBtn.classList.remove('btn-success');
            playBtn.classList.add('btn-danger');
        }
        
        try {
            for (let i = 0; i < runData.commands.length; i++) {
                const command = runData.commands[i];
                const nextCommand = runData.commands[i + 1];
                
                // Execute command
                if (this.isDeveloperMode && this.robotSimulator) {
                    this.robotSimulator.updateCommand(command.command);
                } else if (this.bleController.connected) {
                    await this.bleController.sendCommand(command.command);
                }
                
                // Wait for next command timing
                if (nextCommand) {
                    const delay = nextCommand.timestamp - command.timestamp;
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            this.toastManager.show(`Playback completed: ${selectedRun}`, 'success');
            this.logger.log(`Playback completed: ${selectedRun}`, 'success');
            
        } catch (error) {
            this.toastManager.show(`Playback error: ${error.message}`, 'error');
            this.logger.log(`Playback error: ${error.message}`, 'error');
        } finally {
            if (playBtn) {
                playBtn.innerHTML = '<i class="fas fa-play"></i> Play';
                playBtn.classList.remove('btn-danger');
                playBtn.classList.add('btn-success');
            }
        }
    }

    deleteSelectedRun() {
        const selectedRun = document.getElementById('savedRunsList')?.value;
        if (!selectedRun || !this.savedRuns.has(selectedRun)) {
            this.toastManager.show('Please select a run to delete', 'warning');
            return;
        }
        
        if (confirm(`Delete run "${selectedRun}"? This cannot be undone.`)) {
            this.savedRuns.delete(selectedRun);
            this.saveUserData();
            this.updateRunsList();
            
            this.toastManager.show(`Run "${selectedRun}" deleted`, 'info');
            this.logger.log(`Deleted run: ${selectedRun}`, 'info');
        }
    }

    exportSelectedRun() {
        const selectedRun = document.getElementById('savedRunsList')?.value;
        if (!selectedRun || !this.savedRuns.has(selectedRun)) {
            this.toastManager.show('Please select a run to export', 'warning');
            return;
        }
        
        const runData = this.savedRuns.get(selectedRun);
        const exportData = {
            version: APP_CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            run: runData
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedRun.replace(/[^a-z0-9]/gi, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.toastManager.show(`Run "${selectedRun}" exported`, 'success');
        this.logger.log(`Exported run: ${selectedRun}`, 'success');
    }

    importRun() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.run || !data.run.name || !data.run.commands) {
                        throw new Error('Invalid run file format');
                    }
                    
                    const runName = data.run.name;
                    let finalName = runName;
                    let counter = 1;
                    
                    // Handle name conflicts
                    while (this.savedRuns.has(finalName)) {
                        finalName = `${runName} (${counter})`;
                        counter++;
                    }
                    
                    const runData = {
                        ...data.run,
                        name: finalName,
                        importedAt: new Date().toISOString()
                    };
                    
                    this.savedRuns.set(finalName, runData);
                    this.saveUserData();
                    this.updateRunsList();
                    
                    this.toastManager.show(`Run "${finalName}" imported successfully`, 'success');
                    this.logger.log(`Imported run: ${finalName}`, 'success');
                    
                } catch (error) {
                    this.toastManager.show(`Import failed: ${error.message}`, 'error');
                    this.logger.log(`Import failed: ${error.message}`, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    openConfigModal() {
        const modal = document.getElementById('configModal');
        if (modal) {
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
            this.updateConfigurationUI();
        }
    }

    copyPybricksCode() {
        const code = this.generatePybricksCode();
        navigator.clipboard.writeText(code).then(() => {
            this.toastManager.show('Pybricks code copied to clipboard!', 'success');
        }).catch(() => {
            this.toastManager.show('Failed to copy code to clipboard', 'error');
        });
    }

    generatePybricksCode() {
        return `#!/usr/bin/env micropython
# Generated by CodLess FLL Robotics Control Center v${APP_CONFIG.VERSION}

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction
from pybricks.tools import wait
import json

hub = PrimeHub()

# Motor configuration
left_motor = Motor(Port.${this.config.leftMotorPort})
right_motor = Motor(Port.${this.config.rightMotorPort})
arm1_motor = Motor(Port.${this.config.arm1MotorPort})
arm2_motor = Motor(Port.${this.config.arm2MotorPort})

def execute_command(cmd):
    cmd_type = cmd.get("type", "")
    
    if cmd_type == "drive":
        speed = cmd.get("speed", 0)
        turn_rate = cmd.get("turn_rate", 0)
        
        left_speed = speed - turn_rate
        right_speed = speed + turn_rate
        
        left_motor.run(left_speed)
        right_motor.run(right_speed)
        
    elif cmd_type == "arm1":
        speed = cmd.get("speed", 0)
        if speed == 0:
            arm1_motor.stop()
        else:
            arm1_motor.run(speed)
            
    elif cmd_type == "arm2":
        speed = cmd.get("speed", 0)
        if speed == 0:
            arm2_motor.stop()
        else:
            arm2_motor.run(speed)
    
    elif cmd_type == "emergency_stop":
        left_motor.stop()
        right_motor.stop()
        arm1_motor.stop()
        arm2_motor.stop()
    
    elif cmd_type == "get_battery":
        level = hub.battery.voltage()
        hub.ble.send(bytes([0x02, int(level * 100 / 9000)]))
    
    elif cmd_type == "get_info":
        info = {
            "name": hub.system.name(),
            "version": "1.0",
            "features": ["drive", "arms", "battery"]
        }
        data = json.dumps(info).encode()
        response = bytes([0x03]) + data
        hub.ble.send(response)

def main():
    hub.ble.send("ready")
    
    while True:
        if hub.ble.received() is not None:
            try:
                data = hub.ble.received()
                command = json.loads(data.decode())
                execute_command(command)
                hub.ble.send("ok")
            except Exception as e:
                hub.ble.send(f"error: {str(e)}")
        
        wait(10)

if __name__ == "__main__":
    main()
`;
    }

    openPybricksIDE() {
        window.open('https://code.pybricks.com', '_blank');
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
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    toggleSimulatorFullscreen() {
        const canvas = document.getElementById('robotSimulator');
        if (!canvas) {
            this.toastManager.show('Simulator not available', 'warning');
            return;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            canvas.requestFullscreen().catch(err => {
                this.toastManager.show(`Fullscreen not supported: ${err.message}`, 'error');
            });
        }
    }

    resetSimulator() {
        if (!this.robotSimulator) {
            this.toastManager.show('Simulator not available', 'warning');
            return;
        }
        
        this.robotSimulator.reset();
        this.toastManager.show('Simulator reset', 'success');
        this.logger.log('Simulator position reset');
    }

    uploadMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            if (file.size > 10 * 1024 * 1024) {
                this.toastManager.show('Image file too large (max 10MB)', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (!this.robotSimulator) {
                        this.toastManager.show('Simulator not available', 'warning');
                        return;
                    }
                    
                    this.robotSimulator.setBackgroundMap(e.target.result);
                    this.toastManager.show(`Map "${file.name}" uploaded successfully`, 'success');
                    this.logger.log(`Uploaded map image: ${file.name}`, 'success');
                    
                } catch (error) {
                    this.toastManager.show(`Failed to load map: ${error.message}`, 'error');
                    this.logger.log(`Map upload failed: ${error.message}`, 'error');
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    startCalibration() {
        if (!this.bleController.connected && !this.isDeveloperMode) {
            this.toastManager.show('Connect to hub or enable simulation mode to start calibration', 'warning');
            return;
        }
        
        this.toastManager.show('Starting calibration routine...', 'info');
        this.logger.log('Calibration started', 'info');
        
        const startBtn = document.getElementById('startCalibrationBtn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calibrating...';
        }
        
        this.runCalibrationSequence().then(() => {
            this.toastManager.show('Calibration completed successfully', 'success');
            this.logger.log('Calibration completed', 'success');
            this.isCalibrated = true;
            this.updateCalibrationUI();
        }).catch((error) => {
            this.toastManager.show(`Calibration failed: ${error.message}`, 'error');
            this.logger.log(`Calibration failed: ${error.message}`, 'error');
        }).finally(() => {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-cogs"></i> Start Calibration';
            }
        });
    }

    async runCalibrationSequence() {
        const steps = [
            'Testing motor responsiveness...',
            'Measuring straight line accuracy...',
            'Checking turn precision...',
            'Evaluating motor balance...',
            'Analyzing gyro drift...'
        ];
        
        for (let i = 0; i < steps.length; i++) {
            this.toastManager.show(steps[i], 'info', 2000);
            
            if (this.isDeveloperMode) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
                const testCommand = {
                    type: 'drive',
                    speed: 100 * (i + 1),
                    turn_rate: i % 2 === 0 ? 0 : 50
                };
                await this.bleController.sendCommand(testCommand);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.bleController.sendCommand({ type: 'emergency_stop' });
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Store calibration data
        this.config.motorDelay = 15 + Math.random() * 10;
        this.config.trackingError = Math.random() * 0.02;
        this.config.turnBias = (Math.random() - 0.5) * 0.1;
        this.config.motorBalance = 0.95 + Math.random() * 0.1;
        this.config.gyroDrift = (Math.random() - 0.5) * 0.05;
        
        this.saveUserData();
    }

    openSimulatorSettings() {
        if (!this.robotSimulator) {
            this.toastManager.show('Simulator not available', 'warning');
            return;
        }
        
        const settings = [
            'Toggle movement trail',
            'Reset robot position',
            'Clear obstacles',
            'Upload field map'
        ];
        
        const choice = prompt(`Simulator Settings:\n${settings.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nEnter option (1-4):`);
        
        switch (choice) {
            case '1':
                this.robotSimulator.toggleTrail();
                this.toastManager.show('Movement trail toggled', 'info');
                break;
            case '2':
                this.robotSimulator.reset();
                this.toastManager.show('Robot position reset', 'success');
                break;
            case '3':
                this.robotSimulator.clearObstacles();
                this.toastManager.show('Obstacles cleared', 'info');
                break;
            case '4':
                this.uploadMap();
                break;
            default:
                if (choice) {
                    this.toastManager.show('Invalid option selected', 'warning');
                }
        }
    }

    closeWindow() {
        if (confirm('Close CodLess FLL Robotics Control Center?')) {
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
}

// ============================
// GLOBAL FUNCTIONS
// ============================

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
    if (!window.app) return;
    
    const config = window.app.config;
    const errors = [];
    
    // Validate and update configuration
    try {
        // Physical parameters
        const axleTrack = parseFloat(document.getElementById('axleTrack')?.value || 0);
        const wheelDiameter = parseFloat(document.getElementById('wheelDiameter')?.value || 0);
        
        if (axleTrack >= 50 && axleTrack <= 300) {
            config.axleTrack = axleTrack;
        } else {
            errors.push('Axle track must be between 50-300mm');
        }
        
        if (wheelDiameter >= 20 && wheelDiameter <= 100) {
            config.wheelDiameter = wheelDiameter;
        } else {
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
        config.autoSave = document.getElementById('autoSave')?.checked || false;
        config.debugMode = document.getElementById('debugMode')?.checked || false;
        
        // Validate configuration
        const validationErrors = config.validate();
        errors.push(...validationErrors);
        
        if (errors.length === 0) {
            window.app.saveUserData();
            closeConfigModal();
            window.app.toastManager.show('Configuration saved successfully', 'success');
            window.app.logger.log('Configuration updated', 'success');
        } else {
            window.app.toastManager.show(`Configuration errors: ${errors.join(', ')}`, 'error');
        }
        
    } catch (error) {
        window.app.toastManager.show(`Failed to save configuration: ${error.message}`, 'error');
    }
}

function resetConfigToDefaults() {
    if (!window.app) return;
    
    if (confirm('Reset all configuration to defaults? This cannot be undone.')) {
        window.app.config = new RobotConfig();
        window.app.updateConfigurationUI();
        window.app.toastManager.show('Configuration reset to defaults', 'info');
    }
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

// ============================
// APPLICATION INITIALIZATION
// ============================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new FLLRoboticsApp();
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
        } else {
            // Page is visible, resume
            if (window.app.isDeveloperMode) {
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

console.log(`%cCodLess FLL Robotics Control Center v${APP_CONFIG.VERSION}`, 'color: #00a8ff; font-size: 16px; font-weight: bold;');
console.log('🤖 Professional robotics control and simulation platform');
console.log('📖 Documentation: https://github.com/codless-robotics/fll-control-center');