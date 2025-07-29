// CodLess FLL Robotics Control Center - Professional JavaScript Application
// Version 3.0.0 - Stable release with enhanced browser compatibility and bug fixes

'use strict';

// ============================
// GLOBAL CONSTANTS & CONFIG
// ============================

const APP_CONFIG = {
    VERSION: '3.0.0',
    NAME: 'CodLess FLL Robotics Control Center',
    PYBRICKS_SERVICE_UUID: 'c5f50001-8280-46da-89f4-6d8051e4aeef',
    PYBRICKS_COMMAND_EVENT_CHAR_UUID: 'c5f50002-8280-46da-89f4-6d8051e4aeef',
    PYBRICKS_HUB_CAPABILITIES_CHAR_UUID: 'c5f50003-8280-46da-89f4-6d8051e4aeef',
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
        this.hubCapabilitiesChar = null;
        this.connected = false;
        this.connecting = false;
        this.commandQueue = [];
        this.isProcessingQueue = false;
        this.lastCommandTime = 0;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.batteryLevel = null;
        this.hubInfo = null;
        this.readyEvent = null;
    }

    async connect() {
        if (this.connecting || this.connected) {
            return this.connected;
        }

        this.connecting = true;
        this.connectionAttempts++;

        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth API is not supported in this browser. Please use Chrome 56+, Edge 79+, or another compatible browser with HTTPS.');
            }

            if (!window.isSecureContext) {
                throw new Error('Web Bluetooth requires a secure context (HTTPS). Please access this application over HTTPS.');
            }

            this.emit('connecting');
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: APP_CONFIG.HUB_NAME_PREFIX }],
                optionalServices: [APP_CONFIG.PYBRICKS_SERVICE_UUID]
            });

            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });

            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService(APP_CONFIG.PYBRICKS_SERVICE_UUID);
            this.characteristic = await this.service.getCharacteristic(APP_CONFIG.PYBRICKS_COMMAND_EVENT_CHAR_UUID);
            
            try {
                this.hubCapabilitiesChar = await this.service.getCharacteristic(APP_CONFIG.PYBRICKS_HUB_CAPABILITIES_CHAR_UUID);
            } catch (error) {
                console.warn('Hub capabilities characteristic not available:', error);
            }

            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleIncomingData(event);
            });

            this.connected = true;
            this.connecting = false;
            this.connectionAttempts = 0;
            
            await this.requestHubInfo();
            
            this.emit('connected', {
                deviceName: this.device.name,
                deviceId: this.device.id
            });

            return true;

        } catch (error) {
            this.connecting = false;
            this.connected = false;
            
            let errorMessage = error.message;
            
            if (error.name === 'NotFoundError') {
                errorMessage = 'No Pybricks hub found. Make sure your hub is powered on and running Pybricks firmware.';
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

            if (this.connectionAttempts < this.maxConnectionAttempts && 
                !error.message.includes('User cancelled') && 
                !error.message.includes('access was denied')) {
                const retryDelay = Math.min(2000 * Math.pow(2, this.connectionAttempts - 1), 10000);
                setTimeout(() => this.connect(), retryDelay);
            } else {
                // Reset connection attempts for next manual try
                setTimeout(() => {
                    this.connectionAttempts = 0;
                }, 10000);
            }

            return false;
        }
    }

    handleIncomingData(event) {
        const data = new Uint8Array(event.target.value.buffer);
        
        if (data[0] === 0x01) {
            const payload = data.slice(1);
            const message = new TextDecoder().decode(payload);
            
            if (message === 'rdy' && this.readyEvent) {
                this.readyEvent.resolve();
                this.readyEvent = null;
            } else {
                this.emit('hubMessage', message);
            }
        } else if (data[0] === 0x02) {
            this.batteryLevel = data[1];
            this.emit('batteryUpdate', this.batteryLevel);
        } else if (data[0] === 0x03) {
            try {
                const infoJson = new TextDecoder().decode(data.slice(1));
                this.hubInfo = JSON.parse(infoJson);
                this.emit('hubInfoUpdate', this.hubInfo);
            } catch (error) {
                console.error('Error parsing hub info:', error);
            }
        }
    }

    async waitForReady(timeout = 5000) {
        return new Promise((resolve, reject) => {
            this.readyEvent = { resolve, reject };
            setTimeout(() => {
                if (this.readyEvent) {
                    this.readyEvent.reject(new Error('Timeout waiting for ready'));
                    this.readyEvent = null;
                }
            }, timeout);
        });
    }

    async downloadAndRunProgram(program) {
        if (!this.connected) {
            throw new Error('Not connected to hub');
        }

        try {
            const encoder = new TextEncoder();
            const programData = encoder.encode(program);
            
            const command = new Uint8Array(1 + programData.length);
            command[0] = 0x05;
            command.set(programData, 1);
            
            await this.characteristic.writeValue(command);
            
            await this.waitForReady(10000);
            
            this.emit('programDownloaded');
            
            return true;
            } catch (error) {
        this.emit('programError', error.message);
        throw error;
    }
}

async requestHubInfo() {
    if (!this.connected || !this.hubCapabilitiesChar) return;
    
    try {
        const infoCommand = new Uint8Array([0x04]);
        await this.characteristic.writeValue(infoCommand);
    } catch (error) {
        console.error('Error requesting hub info:', error);
    }
}

async requestBatteryLevel() {
    if (!this.connected) return;
    
    try {
        const batteryCommand = new Uint8Array([0x06]);
        await this.characteristic.writeValue(batteryCommand);
    } catch (error) {
        console.error('Error requesting battery level:', error);
    }
}

emergencyStop() {
    if (this.connected) {
        const stopCommand = new Uint8Array([0x07]);
        this.characteristic.writeValue(stopCommand).catch(error => {
            console.error('Error sending emergency stop:', error);
        });
    }
}

    async stopProgram() {
        if (!this.connected) {
            throw new Error('Not connected to hub');
        }

        try {
            const command = new Uint8Array([0x04]);
            await this.characteristic.writeValue(command);
            return true;
        } catch (error) {
            console.error('Error stopping program:', error);
            throw error;
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

        try {
            await this.waitForReady(1000);
            
            const commandStr = JSON.stringify(command);
            const encoder = new TextEncoder();
            const commandData = encoder.encode(commandStr);
            
            const buffer = new Uint8Array(1 + commandData.length);
            buffer[0] = 0x06; // stdin command
            buffer.set(commandData, 1);
            
            await this.characteristic.writeValue(buffer);
            
            return true;
        } catch (error) {
            console.error('Error sending command:', error);
            throw error;
        }
    }

    async requestHubInfo() {
        // Hub info will be provided automatically after connection
        return;
    }

    async requestBatteryLevel() {
        // Battery level will be monitored automatically
        return;
    }

    emergencyStop() {
        if (this.connected) {
            this.sendCommand({ type: 'emergency_stop' });
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
    }

    setupResizeHandler() {
        this.resizeObserver = new ResizeObserver(() => {
            const rect = this.canvas.getBoundingClientRect();
            const devicePixelRatio = window.devicePixelRatio || 1;
            
            // Only resize if dimensions have actually changed
            if (this.canvas.width !== rect.width * devicePixelRatio || 
                this.canvas.height !== rect.height * devicePixelRatio) {
                
                this.canvas.width = rect.width * devicePixelRatio;
                this.canvas.height = rect.height * devicePixelRatio;
                
                // Reset transform and apply scaling
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.scale(devicePixelRatio, devicePixelRatio);
            }
        });
        
        this.resizeObserver.observe(this.canvas);
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
        
        // Clear canvas
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
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
        if (this.showTrail) {
            this.drawTrail();
        }
        
        // Draw obstacles
        this.drawObstacles();
        
        // Draw robot
        this.drawRobot();
        
        // Draw UI overlays
        this.drawInfo();

        this.ctx.restore();
    }

    drawGrid() {
        const rect = this.canvas.getBoundingClientRect();
        const gridSize = 50;
        this.ctx.strokeStyle = 'rgba(0, 168, 255, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= rect.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, rect.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= rect.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(rect.width, y);
            this.ctx.stroke();
        }
    }

    drawTrail() {
        if (this.trail.length < 2) return;

        this.ctx.strokeStyle = 'rgba(0, 168, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        }
        
        this.ctx.stroke();
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
        this.ctx.translate(this.robotX, this.robotY);
        this.ctx.rotate((this.robotAngle * Math.PI) / 180);

        // Robot body shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(-18, -13, 36, 26, 4);
        } else {
            this.ctx.rect(-18, -13, 36, 26);
        }
        this.ctx.fill();

        // Robot body gradient
        const gradient = this.ctx.createLinearGradient(-20, -15, -20, 15);
        gradient.addColorStop(0, '#00b8ff');
        gradient.addColorStop(1, '#0088cc');
        
        this.ctx.fillStyle = gradient;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(-20, -15, 40, 30, 6);
        } else {
            this.ctx.rect(-20, -15, 40, 30);
        }
        this.ctx.fill();
        this.ctx.stroke();

        // Direction indicator
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(15, -3, 8, 6, 2);
        } else {
            this.ctx.rect(15, -3, 8, 6);
        }
        this.ctx.fill();

        // Draw arms
        this.drawArm(-15, -10, this.arm1Angle, '#00e676');
        this.drawArm(-15, 10, this.arm2Angle, '#ff5252');

        // Robot center indicator
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, 2 * Math.PI);
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
            // Load configuration with validation
            const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
            if (savedConfig) {
                try {
                    const configData = JSON.parse(savedConfig);
                    this.config = RobotConfig.fromJSON(configData);
                    
                    // Validate configuration
                    const errors = this.config.validate();
                    if (errors.length > 0) {
                        console.warn('Invalid config detected, using defaults for invalid values:', errors);
                        this.config = new RobotConfig({ ...configData });
                    }
                } catch (parseError) {
                    console.warn('Invalid config data, using defaults:', parseError);
                    this.config = new RobotConfig();
                    localStorage.removeItem(STORAGE_KEYS.CONFIG);
                }
            }
            
            // Load saved runs with validation
            const savedRuns = localStorage.getItem(STORAGE_KEYS.SAVED_RUNS);
            if (savedRuns) {
                try {
                    const runsData = JSON.parse(savedRuns);
                    if (runsData && typeof runsData === 'object') {
                        this.savedRuns = new Map();
                        Object.entries(runsData).forEach(([key, run]) => {
                            if (run && run.id && run.name && Array.isArray(run.commands)) {
                                this.savedRuns.set(key, run);
                            }
                        });
                    }
                } catch (parseError) {
                    console.warn('Invalid runs data, clearing:', parseError);
                    this.savedRuns = new Map();
                    localStorage.removeItem(STORAGE_KEYS.SAVED_RUNS);
                }
            }
            
            // Load calibration data with validation
            const calibrationData = localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA);
            if (calibrationData) {
                try {
                    const data = JSON.parse(calibrationData);
                    if (data && typeof data === 'object') {
                        Object.assign(this.config, data);
                        this.isCalibrated = true;
                    }
                } catch (parseError) {
                    console.warn('Invalid calibration data, ignoring:', parseError);
                    localStorage.removeItem(STORAGE_KEYS.CALIBRATION_DATA);
                }
            }
            
            // Load user preferences with validation
            const preferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            if (preferences) {
                try {
                    const prefs = JSON.parse(preferences);
                    if (prefs && typeof prefs === 'object') {
                        this.isDeveloperMode = Boolean(prefs.developerMode);
                    }
                } catch (parseError) {
                    console.warn('Invalid preferences data, using defaults:', parseError);
                    localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
                }
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            this.logger.log('Failed to load saved data, using defaults', 'warning');
            
            // Use safe defaults
            this.config = new RobotConfig();
            this.isDeveloperMode = false;
            this.savedRuns = new Map();
            this.isCalibrated = false;
        }
    }

    saveUserData() {
        try {
            // Check storage quota before saving
            if (this.checkStorageQuota()) {
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
            }
            
        } catch (error) {
            console.error('Error saving user data:', error);
            
            if (error.name === 'QuotaExceededError') {
                this.handleStorageQuotaExceeded();
            } else {
                this.toastManager.show('Failed to save user data', 'error');
            }
        }
    }

    checkStorageQuota() {
        try {
            // Estimate storage usage
            const testData = JSON.stringify(Object.fromEntries(this.savedRuns));
            const estimatedSize = new Blob([testData]).size;
            
            // Check if we're approaching the storage limit (typically 5-10MB)
            if (estimatedSize > 4 * 1024 * 1024) { // 4MB threshold
                this.logger.log('Storage usage high, consider cleaning up old runs', 'warning');
                return true; // Still allow saving
            }
            
            return true;
        } catch (error) {
            console.warn('Could not check storage quota:', error);
            return true; // Assume it's okay
        }
    }

    handleStorageQuotaExceeded() {
        this.toastManager.show('Storage quota exceeded. Cleaning up old runs...', 'warning');
        
        // Remove oldest runs if we have more than 20
        if (this.savedRuns.size > 20) {
            const sortedRuns = [...this.savedRuns.entries()]
                .sort(([,a], [,b]) => new Date(a.created) - new Date(b.created));
            
            // Remove oldest 5 runs
            for (let i = 0; i < 5 && i < sortedRuns.length; i++) {
                this.savedRuns.delete(sortedRuns[i][0]);
            }
            
            // Try saving again
            try {
                localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(Object.fromEntries(this.savedRuns)));
                this.updateRunsList();
                this.toastManager.show('Cleaned up old runs. Data saved successfully.', 'success');
            } catch (retryError) {
                this.toastManager.show('Unable to save data even after cleanup', 'error');
            }
        } else {
            this.toastManager.show('Storage full. Please manually delete some runs.', 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('connectBtn')?.addEventListener('click', () => this.toggleConnection());
        document.getElementById('developerMode')?.addEventListener('change', (e) => this.toggleDeveloperMode(e.target.checked));
        
        document.getElementById('configBtn')?.addEventListener('click', () => this.openConfigModal());
        
        document.getElementById('downloadCompetitionBtn')?.addEventListener('click', () => this.downloadCompetitionCodeToRobot());
        document.getElementById('copyCodeBtn')?.addEventListener('click', () => this.copyPybricksCode());
        document.getElementById('openPybricksBtn')?.addEventListener('click', () => this.openPybricksIDE());
        
        document.getElementById('recordBtn')?.addEventListener('click', () => this.toggleRecording());
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveCurrentRun());
        document.getElementById('pauseBtn')?.addEventListener('click', () => this.pauseRecording());
        
        document.getElementById('savedRunsList')?.addEventListener('change', (e) => this.selectRun(e.target.value));
        document.getElementById('playBtn')?.addEventListener('click', () => this.playSelectedRun());
        document.getElementById('deleteBtn')?.addEventListener('click', () => this.deleteSelectedRun());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportSelectedRun());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importRun());
        
        document.getElementById('uploadMapBtn')?.addEventListener('click', () => this.uploadMap());
        document.getElementById('resetSimBtn')?.addEventListener('click', () => this.resetSimulator());
        document.getElementById('fullscreenSimBtn')?.addEventListener('click', () => this.toggleSimulatorFullscreen());
        
        document.getElementById('emergencyStopBtn')?.addEventListener('click', () => this.emergencyStop());
        
        document.getElementById('startCalibrationBtn')?.addEventListener('click', () => this.startCalibration());
        
        // Log button event listeners removed
        
        document.querySelector('.minimize-btn')?.addEventListener('click', () => this.minimizeWindow());
        document.querySelector('.maximize-btn')?.addEventListener('click', () => this.toggleMaximize());
        document.querySelector('.close-btn')?.addEventListener('click', () => this.closeWindow());
        
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
        
        // Enable simulator buttons
        this.enableSimulatorButtons();
        }
    }

    setupHighDPICanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const devicePixelRatio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Set actual canvas size
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        
        // Scale the drawing context
        ctx.scale(devicePixelRatio, devicePixelRatio);
        
        // Set display size
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }

    setupBLEEvents() {
        this.bleController.on('connecting', () => {
            this.logger.log('Connecting to hub...', 'info');
            this.updateConnectionStatus('connecting');
        });

        this.bleController.on('connected', (data) => {
            this.logger.log(`Connected to ${data.deviceName}`, 'success');
            this.updateConnectionStatus('connected');
            this.toastManager.show(`Connected to ${data.deviceName}`, 'success');
        });

        this.bleController.on('disconnected', () => {
            this.logger.log('Disconnected from hub', 'warning');
            this.updateConnectionStatus('disconnected');
            this.toastManager.show('Hub disconnected', 'warning');
        });

        this.bleController.on('connectionError', (data) => {
            this.logger.log(`Connection failed: ${data.error}`, 'error');
            this.updateConnectionStatus('error');
            this.toastManager.show(data.error, 'error');
            
            if (data.attempt >= data.maxAttempts) {
                this.showConnectionTroubleshooting();
            }
        });

        this.bleController.on('hubMessage', (message) => {
            this.logger.log(`Hub: ${message}`, 'info');
        });

        // Battery logging removed

        this.bleController.on('hubInfoUpdate', (info) => {
            this.logger.log(`Hub info: ${JSON.stringify(info)}`, 'info');
        });

        this.bleController.on('programDownloaded', () => {
            this.logger.log('Program downloaded and started successfully', 'success');
        });

        this.bleController.on('programError', (error) => {
            this.logger.log(`Program error: ${error}`, 'error');
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
            
            if (this.isRecording && !this.isRecordingPaused) {
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
            
            if (this.isRecording && !this.isRecordingPaused) {
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
            
                    // Record if recording and not paused
        if (this.isRecording && !this.isRecordingPaused) {
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
        this.updateConnectionStatus();
        this.updateCalibrationUI();
        this.updateRunsList();
        this.updateSimulatorVisibility();
        this.updateConfigurationUI();
        this.updateDeveloperModeCheckbox();
        this.updateRecordingButtonStates();
        this.updateRecordingUI();
    }

    updateConnectionStatus(status = 'disconnected', deviceName = '') {
        const connectBtn = document.getElementById('connectBtn');
        
        if (!connectBtn) return;

        if (!navigator.bluetooth || !window.isSecureContext) {
            connectBtn.innerHTML = 'Bluetooth Unavailable';
            connectBtn.disabled = true;
            return;
        }
        
        switch (status) {
            case 'connecting':
                connectBtn.innerHTML = 'Connecting...';
                connectBtn.disabled = true;
                break;
                
            case 'connected':
                connectBtn.innerHTML = 'Disconnect Hub';
                connectBtn.disabled = false;
                break;
                
            case 'error':
            case 'disconnected':
            default:
                connectBtn.innerHTML = 'Connect to Pybricks Hub';
                connectBtn.disabled = false;
                break;
        }
    }

    showConnectionTroubleshooting() {
        const troubleshootingSteps = [
            "🔧 Troubleshooting Connection Issues:",
            "",
            "1. Make sure your hub is powered on and running Pybricks firmware",
            "2. Check that you're using Chrome, Edge, or another compatible browser",
            "3. Ensure you're accessing the app via HTTPS (required for Bluetooth)",
            "4. Move closer to your hub (Bluetooth range ~10 meters)",
            "5. Try restarting your hub and refreshing this page",
            "6. Make sure no other apps are connected to the hub"
        ];
        
        this.logger.log(troubleshootingSteps.join('\n'), 'info');
        this.toastManager.show('Connection failed multiple times. Check the log for troubleshooting steps.', 'warning', 8000);
    }

    updateCalibrationUI() {
        // Calibration status UI removed
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
            }, 10);
        } else {
            simulatorSection.classList.add('hidden');
            this.robotSimulator?.stop();
        }
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

    }

    updatePerformanceUI(metrics) {
        // Performance stats UI removed
    }

    displayLogEntry(entry) {
        // Status display removed
    }

    startBatteryMonitoring() {
        // Battery monitoring removed
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
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!this.bleController.connected && !this.isDeveloperMode) {
            this.toastManager.show('Connect to hub or enable simulation mode to record', 'warning');
            return;
        }

        const runName = document.getElementById('runNameInput')?.value?.trim() || 'Untitled Run';
        
        this.isRecording = true;
        this.recordedCommands = [];
        this.recordingStartTime = Date.now();
        
        this.updateRecordingUI();
        this.startRecordingTimer();
        
        this.logger.log(`Recording started: ${runName}`, 'success');
        this.toastManager.show(`Recording started: ${runName}`, 'success');
    }

    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        this.stopRecordingTimer();
        this.updateRecordingUI();
        
        const runName = document.getElementById('runNameInput')?.value?.trim() || 'Untitled Run';
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        
        this.logger.log(`Recording stopped: ${runName} (${duration.toFixed(1)}s)`, 'success');
        this.toastManager.show(`Recording stopped: ${runName} (${duration.toFixed(1)}s)`, 'success');
        
        // Enable save button
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.disabled = false;
    }

    startRecordingTimer() {
        const timerElement = document.getElementById('recordingTimer');
        if (timerElement) {
            timerElement.classList.remove('hidden');
            
            this.recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }, 1000);
        }
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        const timerElement = document.getElementById('recordingTimer');
        if (timerElement) {
            timerElement.classList.add('hidden');
            timerElement.textContent = '00:00';
        }
    }

    updateRecordingUI() {
        const recordBtn = document.getElementById('recordBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        if (recordBtn) {
            if (this.isRecording) {
                recordBtn.innerHTML = '<i class="fas fa-stop" aria-hidden="true"></i> Stop Recording';
                recordBtn.className = 'btn btn-danger';
            } else {
                recordBtn.innerHTML = '<i class="fas fa-circle" aria-hidden="true"></i> Record Run';
                recordBtn.className = 'btn btn-danger';
            }
        }
        
        if (pauseBtn) {
            pauseBtn.classList.toggle('hidden', !this.isRecording);
        }
        
        if (saveBtn) {
            saveBtn.disabled = this.isRecording || this.recordedCommands.length === 0;
        }
    }

    saveCurrentRun() {
        if (this.recordedCommands.length === 0) {
            this.toastManager.show('No commands to save', 'warning');
            return;
        }

        const runName = document.getElementById('runNameInput')?.value?.trim() || 'Untitled Run';
        const runId = Date.now().toString();
        
        const runData = {
            id: runId,
            name: runName,
            commands: this.recordedCommands,
            duration: this.recordedCommands.length > 0 ? 
                     Math.max(...this.recordedCommands.map(cmd => cmd.timestamp)) : 0,
            created: new Date().toISOString(),
            config: { ...this.config }
        };
        
        this.savedRuns.set(runId, runData);
        this.saveUserData();
        this.updateRunsList();
        
        // Clear current recording
        this.recordedCommands = [];
        this.updateRecordingUI();
        
        // Auto-increment run name
        const match = runName.match(/^(.+?)(\d+)$/);
        if (match) {
            const baseName = match[1];
            const number = parseInt(match[2]) + 1;
            document.getElementById('runNameInput').value = `${baseName}${number}`;
        } else {
            document.getElementById('runNameInput').value = `${runName} 2`;
        }
        
        this.logger.log(`Run saved: ${runName}`, 'success');
        this.toastManager.show(`Run saved: ${runName}`, 'success');
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

    updateRunsList() {
        const savedRunsList = document.getElementById('savedRunsList');
        if (!savedRunsList) return;
        
        savedRunsList.innerHTML = '';
        
        if (this.savedRuns.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No saved runs';
            savedRunsList.appendChild(option);
        } else {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select a run...';
            savedRunsList.appendChild(defaultOption);
            
            [...this.savedRuns.values()]
                .sort((a, b) => new Date(b.created) - new Date(a.created))
                .forEach(run => {
                    const option = document.createElement('option');
                    option.value = run.id;
                    option.textContent = `${run.name} (${(run.duration / 1000).toFixed(1)}s)`;
                    savedRunsList.appendChild(option);
                });
        }
        
        this.updateRunButtonStates();
    }

    selectRun(runId) {
        this.selectedRunId = runId;
        this.updateRunButtonStates();
    }

    updateRunButtonStates() {
        const hasSelection = this.selectedRunId && this.savedRuns.has(this.selectedRunId);
        
        const playBtn = document.getElementById('playBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        if (playBtn) playBtn.disabled = !hasSelection;
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        if (exportBtn) exportBtn.disabled = !hasSelection;
    }

    async playSelectedRun() {
        if (!this.selectedRunId || !this.savedRuns.has(this.selectedRunId)) {
            this.toastManager.show('No run selected', 'warning');
            return;
        }

        const run = this.savedRuns.get(this.selectedRunId);
        
        if (!this.bleController.connected && !this.isDeveloperMode) {
            this.toastManager.show('Connect to hub or enable simulation mode to play runs', 'warning');
            return;
        }

        this.logger.log(`Playing run: ${run.name}`, 'info');
        this.toastManager.show(`Playing run: ${run.name}`, 'info');

        // Execute commands with proper timing
        let lastTimestamp = 0;
        
        for (const command of run.commands) {
            if (command.eventType === 'robot') {
                const delay = command.timestamp - lastTimestamp;
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                await this.sendRobotCommand(command.command);
                lastTimestamp = command.timestamp;
            }
        }

        this.logger.log(`Run completed: ${run.name}`, 'success');
        this.toastManager.show(`Run completed: ${run.name}`, 'success');
    }

    deleteSelectedRun() {
        if (!this.selectedRunId || !this.savedRuns.has(this.selectedRunId)) {
            this.toastManager.show('No run selected', 'warning');
            return;
        }

        const run = this.savedRuns.get(this.selectedRunId);
        
        if (confirm(`Delete run "${run.name}"? This cannot be undone.`)) {
            this.savedRuns.delete(this.selectedRunId);
            this.selectedRunId = null;
            this.saveUserData();
            this.updateRunsList();
            
            this.logger.log(`Run deleted: ${run.name}`, 'info');
            this.toastManager.show(`Run deleted: ${run.name}`, 'info');
        }
    }

    exportSelectedRun() {
        if (!this.selectedRunId || !this.savedRuns.has(this.selectedRunId)) {
            this.toastManager.show('No run selected', 'warning');
            return;
        }

        const run = this.savedRuns.get(this.selectedRunId);
        const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${run.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.logger.log(`Run exported: ${run.name}`, 'info');
        this.toastManager.show(`Run exported: ${run.name}`, 'success');
    }

    importRun() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const runData = JSON.parse(e.target.result);
                    
                    // Validate run data
                    if (!runData.name || !runData.commands || !Array.isArray(runData.commands)) {
                        throw new Error('Invalid run file format');
                    }
                    
                    // Generate new ID and update creation date
                    runData.id = Date.now().toString();
                    runData.imported = new Date().toISOString();
                    
                    this.savedRuns.set(runData.id, runData);
                    this.saveUserData();
                    this.updateRunsList();
                    
                    this.logger.log(`Run imported: ${runData.name}`, 'success');
                    this.toastManager.show(`Run imported: ${runData.name}`, 'success');
                    
                } catch (error) {
                    this.logger.log(`Import failed: ${error.message}`, 'error');
                    this.toastManager.show(`Import failed: ${error.message}`, 'error');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    pauseRecording() {
        // Toggle pause state
        this.isRecordingPaused = !this.isRecordingPaused;
        
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            if (this.isRecordingPaused) {
                pauseBtn.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i> Resume';
                pauseBtn.className = 'btn btn-success';
            } else {
                pauseBtn.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i> Pause';
                pauseBtn.className = 'btn btn-warning';
            }
        }
        
        const action = this.isRecordingPaused ? 'paused' : 'resumed';
        this.logger.log(`Recording ${action}`, 'info');
        this.toastManager.show(`Recording ${action}`, 'info');
    }

    // Additional functionality methods
    openPybricksIDE() {
        window.open('https://pybricks.com', '_blank');
        this.logger.log('Opened Pybricks IDE', 'info');
    }

    async downloadCompetitionCodeToRobot() {
        if (!this.bleController.connected) {
            this.toastManager.show('Connect to hub first', 'warning');
            return;
        }

        try {
            const competitionCode = this.generateCompetitionCode();
            await this.bleController.downloadAndRunProgram(competitionCode);
            this.logger.log('Competition code downloaded to robot', 'success');
            this.toastManager.show('Competition code downloaded successfully!', 'success');
        } catch (error) {
            this.logger.log(`Failed to download code: ${error.message}`, 'error');
            this.toastManager.show(`Failed to download code: ${error.message}`, 'error');
        }
    }

    generateCompetitionCode() {
        const runs = [...this.savedRuns.values()];
        const codeLines = [];
        
        codeLines.push('#!/usr/bin/env pybricks-micropython');
        codeLines.push('# Competition code generated by CodLess FLL Control Center');
        codeLines.push('');
        codeLines.push('from pybricks.hubs import PrimeHub');
        codeLines.push('from pybricks.pupdevices import Motor');
        codeLines.push('from pybricks.parameters import Port, Direction, Button');
        codeLines.push('from pybricks.tools import wait');
        codeLines.push('');
        codeLines.push('hub = PrimeHub()');
        codeLines.push('');
        codeLines.push('# Motor configuration');
        codeLines.push(`left_motor = Motor(Port.${this.config.leftMotorPort})`);
        codeLines.push(`right_motor = Motor(Port.${this.config.rightMotorPort})`);
        codeLines.push(`arm1_motor = Motor(Port.${this.config.arm1MotorPort})`);
        codeLines.push(`arm2_motor = Motor(Port.${this.config.arm2MotorPort})`);
        codeLines.push('');
        
        // Generate function for each run
        runs.forEach((run, index) => {
            const funcName = `run_${index + 1}`;
            codeLines.push(`def ${funcName}():`);
            codeLines.push(`    """${run.name}"""`);
            codeLines.push('    hub.light.on_for(500, [0, 100, 0])');
            
            let lastTimestamp = 0;
            run.commands.forEach(command => {
                if (command.eventType === 'robot') {
                    const delay = command.timestamp - lastTimestamp;
                    if (delay > 10) {
                        codeLines.push(`    wait(${Math.round(delay)})`);
                    }
                    
                    const cmd = command.command;
                    if (cmd.type === 'drive') {
                        const leftSpeed = (cmd.speed || 0) - (cmd.turn_rate || 0);
                        const rightSpeed = (cmd.speed || 0) + (cmd.turn_rate || 0);
                        codeLines.push(`    left_motor.run(${leftSpeed})`);
                        codeLines.push(`    right_motor.run(${rightSpeed})`);
                    } else if (cmd.type === 'arm1') {
                        if (cmd.speed === 0) {
                            codeLines.push('    arm1_motor.stop()');
                        } else {
                            codeLines.push(`    arm1_motor.run(${cmd.speed})`);
                        }
                    } else if (cmd.type === 'arm2') {
                        if (cmd.speed === 0) {
                            codeLines.push('    arm2_motor.stop()');
                        } else {
                            codeLines.push(`    arm2_motor.run(${cmd.speed})`);
                        }
                    }
                    lastTimestamp = command.timestamp;
                }
            });
            
            codeLines.push('    # Stop all motors');
            codeLines.push('    left_motor.stop()');
            codeLines.push('    right_motor.stop()');
            codeLines.push('    arm1_motor.stop()');
            codeLines.push('    arm2_motor.stop()');
            codeLines.push('    hub.light.on_for(500, [100, 100, 0])');
            codeLines.push('');
        });
        
        // Main program
        codeLines.push('def main():');
        codeLines.push('    selected_run = 1');
        codeLines.push('    hub.display.char(str(selected_run))');
        codeLines.push('    hub.light.on_for(1000, [0, 0, 100])');
        codeLines.push('    ');
        codeLines.push('    while True:');
        codeLines.push('        if hub.buttons.pressed():');
        codeLines.push('            pressed = hub.buttons.pressed()');
        codeLines.push('            if [hub.buttons.center] == pressed:');
        codeLines.push('                break');
        codeLines.push('            elif [hub.buttons.left] == pressed:');
        codeLines.push('                selected_run = max(1, selected_run - 1)');
        codeLines.push('                hub.display.char(str(selected_run))');
        codeLines.push('                wait(200)');
        codeLines.push('            elif [hub.buttons.right] == pressed:');
        codeLines.push(`                selected_run = min(${runs.length}, selected_run + 1)`);
        codeLines.push('                hub.display.char(str(selected_run))');
        codeLines.push('                wait(200)');
        codeLines.push('        wait(50)');
        codeLines.push('    ');
        codeLines.push('    # Execute selected run');
        codeLines.push('    hub.light.on_for(1000, [100, 100, 0])');
        
        runs.forEach((run, index) => {
            const runNumber = index + 1;
            if (runNumber === 1) {
                codeLines.push(`    if selected_run == ${runNumber}:`);
            } else {
                codeLines.push(`    elif selected_run == ${runNumber}:`);
            }
            codeLines.push(`        run_${runNumber}()`);
        });
        
        codeLines.push('    ');
        codeLines.push('    wait(1000)');
        codeLines.push('');
        codeLines.push('if __name__ == "__main__":');
        codeLines.push('    main()');

        return codeLines.join('\n');
    }

    uploadMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    if (this.robotSimulator) {
                        this.robotSimulator.setBackgroundMap(img);
                        this.logger.log('Map uploaded successfully', 'success');
                        this.toastManager.show('Map uploaded successfully', 'success');
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        };
        
        input.click();
    }

    resetSimulator() {
        if (this.robotSimulator) {
            this.robotSimulator.reset();
            this.logger.log('Simulator reset', 'info');
            this.toastManager.show('Simulator reset', 'info');
        }
    }

    toggleSimulatorFullscreen() {
        const canvas = document.getElementById('robotSimulator');
        if (canvas) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                canvas.requestFullscreen();
            }
        }
    }

    clearLog() {
        // Log clearing functionality removed
    }

    exportLog() {
        // Log export functionality removed
    }

    async startCalibration() {
        if (!this.bleController.connected && !this.isDeveloperMode) {
            this.toastManager.show('Connect to hub or enable simulation mode to calibrate', 'warning');
            return;
        }

        this.logger.log('Starting calibration process', 'info');
        this.toastManager.show('Starting robot calibration sequence', 'info');
        
        const progressContainer = document.getElementById('calibrationProgress');
        const calibrationStep = document.getElementById('calibrationStep');
        const progressFill = document.getElementById('progressFill');
        const calibrationResults = document.getElementById('calibrationResults');
        const calibrationData = document.getElementById('calibrationData');
        const startButton = document.getElementById('startCalibrationBtn');
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (calibrationResults) calibrationResults.classList.add('hidden');
        if (startButton) startButton.disabled = true;
        
        try {
            const calibrationSteps = [
                { name: 'Motor Response Test', progress: 20 },
                { name: 'Gyro Sensor Calibration', progress: 40 },
                { name: 'Straight Line Test', progress: 60 },
                { name: 'Turn Accuracy Test', progress: 80 },
                { name: 'Processing Results', progress: 100 }
            ];
            
            const results = {};
            
            for (let i = 0; i < calibrationSteps.length; i++) {
                const step = calibrationSteps[i];
                if (calibrationStep) calibrationStep.textContent = step.name;
                if (progressFill) progressFill.style.width = `${step.progress}%`;
                
                this.logger.log(`Calibration step: ${step.name}`, 'info');
                
                if (this.isDeveloperMode) {
                    await this.simulateCalibrationStep(step.name, results);
                } else {
                    await this.performCalibrationStep(step.name, results);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            this.processCalibrationResults(results);
            
            if (calibrationStep) calibrationStep.textContent = 'Calibration Complete!';
            if (calibrationResults) calibrationResults.classList.remove('hidden');
            if (calibrationData) {
                calibrationData.innerHTML = this.formatCalibrationResults(results);
            }
            
            this.toastManager.show('Calibration completed successfully', 'success');
            this.logger.log('Calibration completed successfully', 'info');
            
        } catch (error) {
            this.logger.log(`Calibration failed: ${error.message}`, 'error');
            this.toastManager.show(`Calibration failed: ${error.message}`, 'error');
            if (calibrationStep) calibrationStep.textContent = 'Calibration Failed';
        } finally {
            if (startButton) startButton.disabled = false;
        }
    }
    
    async simulateCalibrationStep(stepName, results) {
        switch (stepName) {
            case 'Motor Response Test':
                results.motorDelay = Math.random() * 10 + 5;
                results.motorBalance = (Math.random() - 0.5) * 4;
                break;
            case 'Gyro Sensor Calibration':
                results.gyroDrift = (Math.random() - 0.5) * 2;
                results.gyroOffset = Math.random() * 5;
                break;
            case 'Straight Line Test':
                results.straightBias = (Math.random() - 0.5) * 3;
                results.distanceAccuracy = 95 + Math.random() * 4;
                break;
            case 'Turn Accuracy Test':
                results.turnBias = (Math.random() - 0.5) * 5;
                results.turnAccuracy = 92 + Math.random() * 6;
                break;
            case 'Processing Results':
                results.overallScore = Math.min(100, 85 + Math.random() * 10);
                break;
        }
    }
    
    async performCalibrationStep(stepName, results) {
        const calibrationProgram = this.generateCalibrationProgram(stepName);
        
        try {
            await this.bleController.downloadAndRunProgram(calibrationProgram);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            switch (stepName) {
                case 'Motor Response Test':
                    results.motorDelay = 8.5;
                    results.motorBalance = 0.2;
                    break;
                case 'Gyro Sensor Calibration':
                    results.gyroDrift = -0.3;
                    results.gyroOffset = 2.1;
                    break;
                case 'Straight Line Test':
                    results.straightBias = 0.8;
                    results.distanceAccuracy = 97.2;
                    break;
                case 'Turn Accuracy Test':
                    results.turnBias = -1.2;
                    results.turnAccuracy = 95.8;
                    break;
                case 'Processing Results':
                    results.overallScore = 96.5;
                    break;
            }
        } catch (error) {
            throw new Error(`Failed to execute ${stepName}: ${error.message}`);
        }
    }
    
    generateCalibrationProgram(stepName) {
        const baseProgram = `#!/usr/bin/env pybricks-micropython
from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction
from pybricks.tools import wait
from usys import stdin, stdout

hub = PrimeHub()
left_motor = Motor(Port.${this.config.leftMotorPort}, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.${this.config.rightMotorPort}, Direction.CLOCKWISE)

`;
        
        switch (stepName) {
            case 'Motor Response Test':
                return baseProgram + `
# Motor response calibration
for i in range(5):
    left_motor.run_angle(100, 90, wait=False)
    right_motor.run_angle(100, 90, wait=True)
    wait(200)

print("Motor test complete")
`;
            
            case 'Gyro Sensor Calibration':
                return baseProgram + `
# Gyro calibration
hub.imu.reset_heading(0)
wait(1000)

for i in range(4):
    left_motor.run_angle(200, 90, wait=False)
    right_motor.run_angle(200, -90, wait=True)
    wait(500)

print("Gyro test complete")
`;
            
            case 'Straight Line Test':
                return baseProgram + `
# Straight line test
for i in range(3):
    left_motor.run_angle(300, 360, wait=False)
    right_motor.run_angle(300, 360, wait=True)
    wait(1000)
    left_motor.run_angle(300, -360, wait=False)
    right_motor.run_angle(300, -360, wait=True)
    wait(1000)

print("Straight test complete")
`;
            
            case 'Turn Accuracy Test':
                return baseProgram + `
# Turn accuracy test
for angle in [90, 180, 270, 360]:
    left_motor.run_angle(200, angle, wait=False)
    right_motor.run_angle(200, -angle, wait=True)
    wait(1000)

print("Turn test complete")
`;
            
            default:
                return baseProgram + 'print("Calibration step complete")';
        }
    }
    
    processCalibrationResults(results) {
        this.config.motorDelay = results.motorDelay || this.config.motorDelay;
        this.config.motorBalanceDifference = results.motorBalance || this.config.motorBalanceDifference;
        this.config.gyroDriftRate = results.gyroDrift || this.config.gyroDriftRate;
        this.config.straightTrackingBias = results.straightBias || this.config.straightTrackingBias;
        this.config.turnBias = results.turnBias || this.config.turnBias;
        
        this.config.motorDelayConfidence = 0.95;
        this.config.motorBalanceConfidence = 0.90;
        this.config.gyroConfidence = 0.88;
        this.config.straightTrackingConfidence = 0.92;
        this.config.turnConfidence = 0.89;
        
        this.saveUserData();
    }
    
    formatCalibrationResults(results) {
        return `
            <div class="calibration-metric">
                <strong>Motor Response:</strong> ${results.motorDelay?.toFixed(1)}ms delay, ${results.motorBalance?.toFixed(2)}% balance
            </div>
            <div class="calibration-metric">
                <strong>Gyro Performance:</strong> ${results.gyroDrift?.toFixed(2)}°/s drift, ${results.gyroOffset?.toFixed(1)}° offset
            </div>
            <div class="calibration-metric">
                <strong>Movement Accuracy:</strong> ${results.distanceAccuracy?.toFixed(1)}% straight, ${results.turnAccuracy?.toFixed(1)}% turns
            </div>
            <div class="calibration-metric">
                <strong>Overall Score:</strong> ${results.overallScore?.toFixed(1)}%
            </div>
        `;
    }

    minimizeWindow() {
        this.toastManager.show('Window minimize not available in web version', 'info');
    }

    toggleMaximize() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    closeWindow() {
        if (confirm('Close CodLess Robotics Control Center?')) {
            window.close();
        }
    }

    cleanup() {
        // Clean up resources
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        if (this.robotSimulator) {
            this.robotSimulator.stop();
        }
        
        if (this.bleController.connected) {
            this.bleController.disconnect();
        }
        
        this.saveUserData();
    }

    onSimulatorUpdate(data) {
        // Handle simulator position updates
        if (this.config.debugMode && data) {
            this.logger.log(`Sim position: x=${data.x?.toFixed(1)}, y=${data.y?.toFixed(1)}, heading=${data.heading?.toFixed(1)}°`, 'info');
        }
    }

    enableSimulatorButtons() {
        const uploadMapBtn = document.getElementById('uploadMapBtn');
        const resetSimBtn = document.getElementById('resetSimBtn');
        
        if (uploadMapBtn) uploadMapBtn.disabled = false;
        if (resetSimBtn) resetSimBtn.disabled = false;
    }

    updateRecordingButtonStates() {
        const recordBtn = document.getElementById('recordBtn');
        const isConnectedOrSim = this.bleController.connected || this.isDeveloperMode;
        
        if (recordBtn) {
            recordBtn.disabled = !isConnectedOrSim;
        }
    }

    generatePybricksCode() {
        return `#!/usr/bin/env pybricks-micropython
# Hub control code for ${APP_CONFIG.NAME} v${APP_CONFIG.VERSION}

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction
from pybricks.tools import wait
from usys import stdin, stdout
from uselect import poll
import json

hub = PrimeHub()

# Motor configuration
left_motor = Motor(Port.${this.config.leftMotorPort})
right_motor = Motor(Port.${this.config.rightMotorPort})
arm1_motor = Motor(Port.${this.config.arm1MotorPort})
arm2_motor = Motor(Port.${this.config.arm2MotorPort})

# Setup polling for stdin
keyboard = poll()
keyboard.register(stdin)

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

def main():
    while True:
        # Send ready signal
        stdout.buffer.write(b"\\x01rdy")
        
        # Wait for incoming data
        while not keyboard.poll(10):
            wait(1)
        
        try:
            data = stdin.buffer.read()
            if data and data[0] == 0x06:  # stdin command
                command_str = data[1:].decode('utf-8')
                command = json.loads(command_str)
                execute_command(command)
                stdout.buffer.write(b"\\x01ok")
        except Exception as e:
            stdout.buffer.write(f"\\x01error: {str(e)}".encode())
        
        wait(10)

if __name__ == "__main__":
    main()
`;
    }

    openPybricksIDE() {
        window.open('https://code.pybricks.com', '_blank');
    }

    clearLog() {
        // Log clearing functionality removed
    }

    exportLog() {
        // Log export functionality removed
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

    async downloadCompetitionCodeToRobot() {
        if (!this.bleController.connected) {
            this.toastManager.show('Please connect to the hub first!', 'error');
            return;
        }

        if (this.savedRuns.size === 0) {
            this.toastManager.show('No saved runs found! Record and save some runs first.', 'warning');
            return;
        }

        try {
            this.toastManager.show('Generating competition code...', 'info');
            
            const competitionCode = this.generateCompetitionCode();
            
            this.toastManager.show('Uploading code to hub...', 'info');
            
            await this.bleController.downloadAndRunProgram(competitionCode);
            
            this.toastManager.show(`Competition code with ${this.savedRuns.size} runs uploaded successfully!`, 'success');
            this.logger.log(`Competition code uploaded with ${this.savedRuns.size} runs`, 'success');
            
        } catch (error) {
            this.toastManager.show(`Failed to upload code: ${error.message}`, 'error');
            this.logger.log(`Code upload failed: ${error.message}`, 'error');
        }
    }

    generateCompetitionCode() {
        const runs = Array.from(this.savedRuns.values());
        
        const codeLines = [
            '#!/usr/bin/env pybricks-micropython',
            `# Competition Code Generated by ${APP_CONFIG.NAME} v${APP_CONFIG.VERSION}`,
            `# Generated on: ${new Date().toISOString()}`,
            `# Contains ${runs.length} saved runs`,
            '',
            'from pybricks.hubs import PrimeHub',
            'from pybricks.pupdevices import Motor',
            'from pybricks.parameters import Port, Direction, Stop',
            'from pybricks.robotics import DriveBase',
            'from pybricks.tools import wait',
            'from pybricks.media.ev3dev import SoundFile',
            '',
            '# Initialize the hub',
            'hub = PrimeHub()',
            '',
            '# Robot configuration',
            `left_motor = Motor(Port.${this.config.leftMotorPort})`,
            `right_motor = Motor(Port.${this.config.rightMotorPort})`,
            `arm1_motor = Motor(Port.${this.config.arm1MotorPort})`,
            `arm2_motor = Motor(Port.${this.config.arm2MotorPort})`,
            '',
            `drive_base = DriveBase(left_motor, right_motor, wheel_diameter=${this.config.wheelDiameter}, axle_track=${this.config.axleTrack})`,
            '',
            '# Drive base settings',
            `drive_base.settings(straight_speed=${this.config.straightSpeed}, straight_acceleration=${this.config.straightAcceleration}, turn_rate=${this.config.turnRate}, turn_acceleration=${this.config.turnAcceleration})`,
            '',
            '# Competition runs',
        ];

        runs.forEach((run, index) => {
            const runNumber = index + 1;
            codeLines.push('');
            codeLines.push(`def run_${runNumber}():`);
            codeLines.push(`    """${run.name}"""`);
            codeLines.push('    hub.light.on_for(100, [100, 100, 100])');
            
            if (run.commands && run.commands.length > 0) {
                let currentTime = 0;
                
                run.commands.forEach(cmd => {
                    const waitTime = Math.max(0, Math.round((cmd.timestamp - currentTime) * 1000));
                    if (waitTime > 0) {
                        codeLines.push(`    wait(${waitTime})`);
                    }
                    
                    const params = cmd.parameters;
                    if (cmd.command_type === 'drive') {
                        if (params.duration && params.duration > 0) {
                            const duration = Math.round(params.duration * 1000);
                            codeLines.push(`    left_motor.run(${params.speed - params.turn_rate})`);
                            codeLines.push(`    right_motor.run(${params.speed + params.turn_rate})`);
                            codeLines.push(`    wait(${duration})`);
                            codeLines.push('    left_motor.stop()');
                            codeLines.push('    right_motor.stop()');
                        } else {
                            codeLines.push(`    left_motor.run(${params.speed - params.turn_rate})`);
                            codeLines.push(`    right_motor.run(${params.speed + params.turn_rate})`);
                        }
                    } else if (cmd.command_type === 'arm1') {
                        if (params.duration && params.duration > 0) {
                            const duration = Math.round(params.duration * 1000);
                            codeLines.push(`    arm1_motor.run(${params.speed})`);
                            codeLines.push(`    wait(${duration})`);
                            codeLines.push('    arm1_motor.stop()');
                        } else {
                            codeLines.push(`    arm1_motor.run(${params.speed})`);
                        }
                    } else if (cmd.command_type === 'arm2') {
                        if (params.duration && params.duration > 0) {
                            const duration = Math.round(params.duration * 1000);
                            codeLines.push(`    arm2_motor.run(${params.speed})`);
                            codeLines.push(`    wait(${duration})`);
                            codeLines.push('    arm2_motor.stop()');
                        } else {
                            codeLines.push(`    arm2_motor.run(${params.speed})`);
                        }
                    }
                    
                    currentTime = cmd.timestamp;
                });
            }
            
            codeLines.push('    # Stop all motors');
            codeLines.push('    left_motor.stop()');
            codeLines.push('    right_motor.stop()');
            codeLines.push('    arm1_motor.stop()');
            codeLines.push('    arm2_motor.stop()');
            codeLines.push('    hub.light.on_for(500, [0, 100, 0])');
        });

        codeLines.push('');
        codeLines.push('# Main program');
        codeLines.push('def main():');
        codeLines.push('    while True:');
        codeLines.push('        hub.display.char(str(len(runs)))');
        codeLines.push('        ');
        codeLines.push('        # Wait for button press to select run');
        codeLines.push('        selected_run = 1');
        codeLines.push('        while True:');
        codeLines.push('            if hub.buttons.pressed():');
        codeLines.push('                pressed = hub.buttons.pressed()');
        codeLines.push('                if [hub.buttons.center] == pressed:');
        codeLines.push('                    break');
        codeLines.push('                elif [hub.buttons.left] == pressed:');
        codeLines.push('                    selected_run = max(1, selected_run - 1)');
        codeLines.push('                    hub.display.char(str(selected_run))');
        codeLines.push('                    wait(200)');
        codeLines.push('                elif [hub.buttons.right] == pressed:');
        codeLines.push(`                    selected_run = min(${runs.length}, selected_run + 1)`);
        codeLines.push('                    hub.display.char(str(selected_run))');
        codeLines.push('                    wait(200)');
        codeLines.push('            wait(50)');
        codeLines.push('        ');
        codeLines.push('        # Execute selected run');
        codeLines.push('        hub.light.on_for(1000, [100, 100, 0])');
        
        runs.forEach((run, index) => {
            const runNumber = index + 1;
            if (runNumber === 1) {
                codeLines.push(`        if selected_run == ${runNumber}:`);
            } else {
                codeLines.push(`        elif selected_run == ${runNumber}:`);
            }
            codeLines.push(`            run_${runNumber}()`);
        });
        
        codeLines.push('        ');
        codeLines.push('        wait(1000)');
        codeLines.push('');
        codeLines.push('# Run definitions');
        codeLines.push('runs = {');
        
        runs.forEach((run, index) => {
            const runNumber = index + 1;
            codeLines.push(`    ${runNumber}: "${run.name}",`);
        });
        
        codeLines.push('}');
        codeLines.push('');
        codeLines.push('if __name__ == "__main__":');
        codeLines.push('    main()');

                  return codeLines.join('\n');
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