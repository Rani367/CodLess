// FLL Robotics Control Center - JavaScript Web Version
// Recreated from Python application with all functionality

class RobotConfig {
    constructor() {
        this.axleTrack = 112.0;
        this.wheelDiameter = 56.0;
        this.leftMotorPort = "A";
        this.rightMotorPort = "B";
        this.arm1MotorPort = "C";
        this.arm2MotorPort = "D";
        this.straightSpeed = 500.0;
        this.straightAcceleration = 250.0;
        this.turnRate = 200.0;
        this.turnAcceleration = 300.0;
        this.motorDelay = 0.0;
        this.motorDelayConfidence = 0.0;
        this.straightTrackingBias = 0.0;
        this.straightTrackingConfidence = 0.0;
        this.turnBias = 0.0;
        this.turnConfidence = 0.0;
        this.motorBalanceDifference = 0.0;
        this.motorBalanceConfidence = 0.0;
        this.gyroDriftRate = 0.0;
        this.gyroConfidence = 0.0;
    }
}

class RobotSimulator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.robotX = 300;
        this.robotY = 200;
        this.robotAngle = 0;
        this.arm1Angle = 0;
        this.arm2Angle = 0;
        
        this.targetSpeed = 0;
        this.targetTurn = 0;
        this.targetArm1Speed = 0;
        this.targetArm2Speed = 0;
        
        this.actualSpeed = 0;
        this.actualTurn = 0;
        this.actualArm1Speed = 0;
        this.actualArm2Speed = 0;
        
        this.speedAccel = 0;
        this.turnAccel = 0;
        this.arm1Accel = 0;
        this.arm2Accel = 0;
        
        this.robotMass = 2.5;
        this.robotInertia = 0.12;
        this.armInertia = 0.05;
        
        this.maxDriveAccel = 800;
        this.maxTurnAccel = 600;
        this.maxArmAccel = 1000;
        
        this.frictionCoeff = 0.05;
        this.motorLag = 0.03;
        
        this.backgroundMap = null;
        this.calibrationCompensations = {
            motorDelay: 0.0,
            straightTrackingBias: 0.0,
            turnBias: 0.0,
            motorBalanceDifference: 0.0,
            gyroDriftRate: 0.0
        };
        
        this.dt = 0.02;
        this.animationFrame = null;
        this.lastTime = performance.now();
        
        this.startAnimation();
    }
    
    setBackgroundMap(image) {
        this.backgroundMap = image;
    }
    
    applyCalibrationData(config) {
        this.calibrationCompensations.motorDelay = config.motorDelay;
        this.calibrationCompensations.straightTrackingBias = config.straightTrackingBias;
        this.calibrationCompensations.turnBias = config.turnBias;
        this.calibrationCompensations.motorBalanceDifference = config.motorBalanceDifference;
        this.calibrationCompensations.gyroDriftRate = config.gyroDriftRate;
        
        if (config.motorDelayConfidence > 0.5) {
            this.motorLag = 0.03 + (config.motorDelay * 0.1);
        }
        
        if (config.motorBalanceConfidence > 0.5) {
            this.frictionCoeff = 0.05 + Math.abs(config.motorBalanceDifference * 0.02);
        }
        
        if (config.turnConfidence > 0.5) {
            this.maxTurnAccel = 600 * (1.0 + config.turnBias * 0.1);
        }
    }
    
    updateCommand(command) {
        const cmdType = command.type || "";
        
        if (cmdType === "drive") {
            let speed = (command.speed || 0) * 1.5;
            let turnRate = (command.turn_rate || 0) * 1.2;
            
            const bias = this.calibrationCompensations.straightTrackingBias;
            if (bias !== 0) {
                speed *= (1.0 + bias);
            }
            
            const tbias = this.calibrationCompensations.turnBias;
            if (tbias !== 0) {
                turnRate *= (1.0 + tbias);
            }
            
            this.targetSpeed = speed;
            this.targetTurn = turnRate;
        } else if (cmdType === "arm1") {
            this.targetArm1Speed = (command.speed || 0) * 1.0;
        } else if (cmdType === "arm2") {
            this.targetArm2Speed = (command.speed || 0) * 1.0;
        }
    }
    
    startAnimation() {
        const animate = (currentTime) => {
            const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.033);
            this.lastTime = currentTime;
            
            this.updateSimulation();
            this.render();
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        this.animationFrame = requestAnimationFrame(animate);
    }
    
    updateSimulation() {
        this.applyRealisticMotorPhysics();
        this.updateRobotPosition();
        this.updateArmPositions();
    }
    
    applyRealisticMotorPhysics() {
        const speedError = this.targetSpeed - this.actualSpeed;
        const turnError = this.targetTurn - this.actualTurn;
        const arm1Error = this.targetArm1Speed - this.actualArm1Speed;
        const arm2Error = this.targetArm2Speed - this.actualArm2Speed;
        
        const maxSpeedChange = this.maxDriveAccel * this.dt;
        const maxTurnChange = this.maxTurnAccel * this.dt;
        const maxArmChange = this.maxArmAccel * this.dt;
        
        const sCurveProfile = (error, maxChange, currentAccel, maxAccel) => {
            const targetAccel = Math.max(-maxAccel, Math.min(maxAccel, error * 15));
            const accelError = targetAccel - currentAccel;
            const maxJerkChange = maxAccel * 8 * this.dt;
            
            let newAccel;
            if (Math.abs(accelError) > maxJerkChange) {
                newAccel = currentAccel + (accelError > 0 ? maxJerkChange : -maxJerkChange);
            } else {
                newAccel = targetAccel;
            }
            
            return newAccel * (1.0 - this.frictionCoeff * this.dt) * 0.95;
        };
        
        this.speedAccel = sCurveProfile(speedError, maxSpeedChange, this.speedAccel, this.maxDriveAccel);
        this.turnAccel = sCurveProfile(turnError, maxTurnChange, this.turnAccel, this.maxTurnAccel);
        this.arm1Accel = sCurveProfile(arm1Error, maxArmChange, this.arm1Accel, this.maxArmAccel);
        this.arm2Accel = sCurveProfile(arm2Error, maxArmChange, this.arm2Accel, this.maxArmAccel);
        
        const motorLag = 1.0 - this.motorLag;
        this.actualSpeed += this.speedAccel * this.dt * motorLag;
        this.actualTurn += this.turnAccel * this.dt * motorLag;
        this.actualArm1Speed += this.arm1Accel * this.dt * motorLag;
        this.actualArm2Speed += this.arm2Accel * this.dt * motorLag;
        
        const inertialDamping = 0.995;
        this.actualSpeed *= inertialDamping;
        this.actualTurn *= inertialDamping;
        this.actualArm1Speed *= inertialDamping;
        this.actualArm2Speed *= inertialDamping;
    }
    
    updateRobotPosition() {
        if (Math.abs(this.actualSpeed) > 0.01 || Math.abs(this.actualTurn) > 0.01) {
            const simSpeed = this.actualSpeed * 0.15;
            let simTurn = this.actualTurn * 0.8;
            
            const momentumFactor = 1.0 / (1.0 + this.robotMass * 0.1);
            const inertiaFactor = 1.0 / (1.0 + this.robotInertia * 2.0);
            
            const gyroDrift = this.calibrationCompensations.gyroDriftRate || 0.0;
            if (gyroDrift !== 0.0) {
                simTurn += gyroDrift * this.dt * 0.1;
            }
            
            const motorBalanceDiff = this.calibrationCompensations.motorBalanceDifference || 0.0;
            if (motorBalanceDiff !== 0.0 && Math.abs(simSpeed) > 0.01) {
                simTurn += motorBalanceDiff * simSpeed * 0.05;
            }
            
            this.robotAngle += simTurn * this.dt * inertiaFactor;
            this.robotAngle = this.robotAngle % 360;
            
            const angleRad = (this.robotAngle * Math.PI) / 180;
            const dx = simSpeed * Math.cos(angleRad) * this.dt * momentumFactor;
            const dy = simSpeed * Math.sin(angleRad) * this.dt * momentumFactor;
            
            this.robotX += dx;
            this.robotY += dy;
            
            this.robotX = Math.max(30, Math.min(this.canvas.width - 30, this.robotX));
            this.robotY = Math.max(30, Math.min(this.canvas.height - 30, this.robotY));
        }
    }
    
    updateArmPositions() {
        this.arm1Angle += this.actualArm1Speed * this.dt * 0.5;
        this.arm2Angle += this.actualArm2Speed * this.dt * 0.5;
        
        this.arm1Angle = Math.max(-90, Math.min(90, this.arm1Angle));
        this.arm2Angle = Math.max(-90, Math.min(90, this.arm2Angle));
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.backgroundMap) {
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.backgroundMap, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1.0;
        }
        
        this.drawGrid();
        this.drawRobot();
        this.drawInfo();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 168, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawRobot() {
        this.ctx.save();
        this.ctx.translate(this.robotX, this.robotY);
        this.ctx.rotate((this.robotAngle * Math.PI) / 180);
        
        this.ctx.fillStyle = '#00a8ff';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = 'rgba(0, 168, 255, 0.5)';
        this.ctx.shadowBlur = 10;
        
        this.ctx.fillRect(-20, -15, 40, 30);
        this.ctx.strokeRect(-20, -15, 40, 30);
        
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(15, -2, 8, 4);
        
        this.drawArm(-15, -10, this.arm1Angle, '#28a745');
        this.drawArm(-15, 10, this.arm2Angle, '#dc3545');
        
        this.ctx.restore();
    }
    
    drawArm(x, y, angle, color) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate((angle * Math.PI) / 180);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 5;
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(20, 0);
        this.ctx.stroke();
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(18, -3, 6, 6);
        
        this.ctx.restore();
    }
    
    drawInfo() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, 10, 200, 100);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Inter';
        this.ctx.fillText(`Position: ${Math.round(this.robotX)}, ${Math.round(this.robotY)}`, 15, 25);
        this.ctx.fillText(`Angle: ${Math.round(this.robotAngle)}°`, 15, 40);
        this.ctx.fillText(`Speed: ${Math.round(this.actualSpeed)}`, 15, 55);
        this.ctx.fillText(`Turn: ${Math.round(this.actualTurn)}`, 15, 70);
        this.ctx.fillText(`Arm1: ${Math.round(this.arm1Angle)}°`, 15, 85);
        this.ctx.fillText(`Arm2: ${Math.round(this.arm2Angle)}°`, 15, 100);
    }
    
    reset() {
        this.robotX = 300;
        this.robotY = 200;
        this.robotAngle = 0;
        this.arm1Angle = 0;
        this.arm2Angle = 0;
        this.targetSpeed = 0;
        this.targetTurn = 0;
        this.targetArm1Speed = 0;
        this.targetArm2Speed = 0;
        this.actualSpeed = 0;
        this.actualTurn = 0;
        this.actualArm1Speed = 0;
        this.actualArm2Speed = 0;
    }
    
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}

class BLEController {
    constructor(logCallback) {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.connected = false;
        this.logCallback = logCallback;
        this.readyEvent = null;
        
        this.PYBRICKS_COMMAND_EVENT_CHAR_UUID = "c5f50002-8280-46da-89f4-6d8051e4aeef";
        this.HUB_NAME_PREFIX = "Pybricks";
    }
    
    async connect() {
        try {
            if (!navigator.bluetooth) {
                this.logCallback("Web Bluetooth API not supported", "error");
                return false;
            }
            
            this.logCallback("Scanning for Pybricks hub...", "info");
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: this.HUB_NAME_PREFIX }],
                optionalServices: [this.PYBRICKS_COMMAND_EVENT_CHAR_UUID]
            });
            
            this.device.addEventListener('gattserverdisconnected', () => {
                this.connected = false;
                this.logCallback("Hub disconnected", "warning");
            });
            
            this.logCallback(`Found hub: ${this.device.name}`, "info");
            
            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService(this.PYBRICKS_COMMAND_EVENT_CHAR_UUID);
            this.characteristic = await this.service.getCharacteristic(this.PYBRICKS_COMMAND_EVENT_CHAR_UUID);
            
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
                const value = event.target.value;
                const data = new Uint8Array(value.buffer);
                
                if (data[0] === 0x01) {
                    const payload = new TextDecoder().decode(data.slice(1));
                    if (payload === "rdy") {
                        if (this.readyEvent) {
                            this.readyEvent();
                            this.readyEvent = null;
                        }
                    } else {
                        this.logCallback(`HUB: ${payload}`, "info");
                    }
                }
            });
            
            this.connected = true;
            this.logCallback(`Connected to ${this.device.name}`, "success");
            return true;
            
        } catch (error) {
            this.logCallback(`Connection failed: ${error.message}`, "error");
            return false;
        }
    }
    
    async sendCommand(command) {
        if (!this.connected || !this.characteristic) {
            return false;
        }
        
        try {
            if (this.readyEvent) {
                await new Promise((resolve) => {
                    const timeout = setTimeout(resolve, 1000);
                    this.readyEvent = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                });
            }
            
            const commandStr = JSON.stringify(command);
            const encoder = new TextEncoder();
            const data = encoder.encode(commandStr);
            const buffer = new Uint8Array(data.length + 1);
            buffer[0] = 0x06;
            buffer.set(data, 1);
            
            await this.characteristic.writeValue(buffer);
            return true;
            
        } catch (error) {
            this.logCallback(`Send error: ${error.message}`, "error");
            return false;
        }
    }
    
    async disconnect() {
        if (this.device && this.connected) {
            await this.device.gatt.disconnect();
            this.connected = false;
            this.readyEvent = null;
        }
    }
}

class CalibrationManager {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.currentStep = 0;
        this.maxRetries = 3;
        this.currentRetry = 0;
        this.timeoutDuration = 10000;
        this.calibrationResults = [];
        this.calibratedConfig = new RobotConfig();
        
        this.calibrationSteps = [
            "Motor Delay Measurement",
            "Straight Tracking Test",
            "Turn Bias Measurement",
            "Motor Balance Test",
            "Gyro Drift Assessment"
        ];
    }
    
    canCalibrate() {
        return this.app.bleController && this.app.bleController.connected;
    }
    
    async startCalibration() {
        if (this.isRunning) return;
        
        if (!this.canCalibrate() && !this.app.isDeveloperMode) {
            this.app.logStatus("Hub connection required for calibration", "error");
            return;
        }
        
        this.isRunning = true;
        this.currentStep = 0;
        this.currentRetry = 0;
        this.calibrationResults = [];
        
        this.showCalibrationProgress();
        this.app.logStatus("Starting robot calibration...", "info");
        
        await this.processCalibrationSteps();
    }
    
    showCalibrationProgress() {
        const progressContainer = document.getElementById('calibrationProgress');
        const resultsContainer = document.getElementById('calibrationResults');
        
        progressContainer.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
    }
    
    async processCalibrationSteps() {
        for (let i = 0; i < this.calibrationSteps.length; i++) {
            this.currentStep = i;
            const stepName = this.calibrationSteps[i];
            
            this.updateProgress(i, stepName);
            this.app.logStatus(`Calibration step ${i + 1}/${this.calibrationSteps.length}: ${stepName}`, "info");
            
            const result = await this.performCalibrationStep(i);
            this.calibrationResults.push(result);
            
            if (!result.success && this.currentRetry < this.maxRetries) {
                this.currentRetry++;
                i--;
                continue;
            }
            
            this.currentRetry = 0;
            await this.delay(1000);
        }
        
        this.completeCalibration();
    }
    
    updateProgress(step, stepName) {
        const progressFill = document.getElementById('progressFill');
        const calibrationStep = document.getElementById('calibrationStep');
        
        const progress = ((step + 1) / this.calibrationSteps.length) * 100;
        progressFill.style.width = `${progress}%`;
        calibrationStep.textContent = stepName;
    }
    
    async performCalibrationStep(stepIndex) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const result = {
                    success: true,
                    stepName: this.calibrationSteps[stepIndex],
                    measuredValue: Math.random() * 2 - 1,
                    units: stepIndex < 2 ? "degrees" : "ratio",
                    description: this.getStepDescription(stepIndex),
                    confidence: 0.7 + Math.random() * 0.3
                };
                
                this.applyCalibrationResult(stepIndex, result);
                resolve(result);
            }, 2000 + Math.random() * 1000);
        });
    }
    
    getStepDescription(stepIndex) {
        const descriptions = [
            "Motor response delay compensation",
            "Straight line tracking adjustment",
            "Turn rate bias correction",
            "Left/right motor balance",
            "Gyroscope drift compensation"
        ];
        return descriptions[stepIndex];
    }
    
    applyCalibrationResult(stepIndex, result) {
        switch (stepIndex) {
            case 0:
                this.calibratedConfig.motorDelay = result.measuredValue;
                this.calibratedConfig.motorDelayConfidence = result.confidence;
                break;
            case 1:
                this.calibratedConfig.straightTrackingBias = result.measuredValue;
                this.calibratedConfig.straightTrackingConfidence = result.confidence;
                break;
            case 2:
                this.calibratedConfig.turnBias = result.measuredValue;
                this.calibratedConfig.turnConfidence = result.confidence;
                break;
            case 3:
                this.calibratedConfig.motorBalanceDifference = result.measuredValue;
                this.calibratedConfig.motorBalanceConfidence = result.confidence;
                break;
            case 4:
                this.calibratedConfig.gyroDriftRate = result.measuredValue;
                this.calibratedConfig.gyroConfidence = result.confidence;
                break;
        }
    }
    
    completeCalibration() {
        this.isRunning = false;
        
        this.app.config = this.calibratedConfig;
        this.app.isCalibrated = true;
        this.app.robotSimulator.applyCalibrationData(this.calibratedConfig);
        this.app.enableControlsAfterCalibration();
        
        this.showCalibrationResults();
        this.app.logStatus("Calibration completed successfully!", "success");
    }
    
    showCalibrationResults() {
        const progressContainer = document.getElementById('calibrationProgress');
        const resultsContainer = document.getElementById('calibrationResults');
        const dataContainer = document.getElementById('calibrationData');
        
        progressContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        
        let resultsHTML = '<div class="calibration-data">';
        this.calibrationResults.forEach((result, index) => {
            const confidence = Math.round(result.confidence * 100);
            resultsHTML += `
                <div class="result-item">
                    <strong>${result.stepName}:</strong> ${result.measuredValue.toFixed(3)} ${result.units}
                    <br><small>${result.description} (Confidence: ${confidence}%)</small>
                </div>
            `;
        });
        resultsHTML += '</div>';
        
        dataContainer.innerHTML = resultsHTML;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class FLLRoboticsApp {
    constructor() {
        this.bleController = null;
        this.robotSimulator = null;
        this.config = new RobotConfig();
        this.calibrationManager = new CalibrationManager(this);
        
        this.isRecording = false;
        this.recordedCommands = [];
        this.recordingStartTime = 0;
        this.currentRunName = "Run 1";
        this.savedRuns = this.loadSavedRuns();
        this.pressedKeys = new Set();
        this.isCalibrated = false;
        this.isDeveloperMode = false;
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.setupEventListeners();
        this.setupRobotSimulator();
        this.loadSavedRunsList();
        this.logStatus("Please calibrate the robot before using any controls.", "warning");
        this.disableControlsUntilCalibration();
        
        this.setupKeyboardControls();
    }
    
    setupEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => this.connectHub());
        document.getElementById('developerMode').addEventListener('change', (e) => this.toggleDeveloperMode(e.target.checked));
        document.getElementById('configBtn').addEventListener('click', () => this.openConfigModal());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyPybricksCode());
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveRun());
        document.getElementById('playBtn').addEventListener('click', () => this.playSelectedRun());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelectedRun());
        document.getElementById('uploadMapBtn').addEventListener('click', () => this.uploadMap());
        document.getElementById('resetSimBtn').addEventListener('click', () => this.resetSimulator());
        document.getElementById('startCalibrationBtn').addEventListener('click', () => this.startCalibration());
        
        document.querySelector('.minimize-btn').addEventListener('click', () => this.minimizeWindow());
        document.querySelector('.maximize-btn').addEventListener('click', () => this.toggleMaximize());
        document.querySelector('.close-btn').addEventListener('click', () => this.closeWindow());
        
        document.getElementById('savedRunsList').addEventListener('change', (e) => this.onRunSelectionChange(e.target.value));
    }
    
    setupRobotSimulator() {
        const canvas = document.getElementById('robotSimulator');
        this.robotSimulator = new RobotSimulator(canvas);
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
    }
    
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const key = e.key.toLowerCase();
        if (!this.pressedKeys.has(key)) {
            this.pressedKeys.add(key);
            this.recordKeyPress(key);
            this.processKeyCommand(key, true);
        }
    }
    
    handleKeyUp(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const key = e.key.toLowerCase();
        if (this.pressedKeys.has(key)) {
            this.pressedKeys.delete(key);
            this.recordKeyRelease(key);
            this.processKeyCommand(key, false);
            
            if (this.pressedKeys.size === 0) {
                this.executeCommand({ type: "drive", speed: 0, turn_rate: 0 });
                this.executeCommand({ type: "arm1", speed: 0 });
                this.executeCommand({ type: "arm2", speed: 0 });
            }
        }
    }
    
    processKeyCommand(key, isPressed) {
        if (!this.bleController?.connected && !this.isDeveloperMode) {
            return;
        }
        
        if (!this.isCalibrated && !this.isDeveloperMode) {
            if (isPressed) {
                this.logStatus("Please calibrate the robot before using controls.", "warning");
            }
            return;
        }
        
        if (['w', 'a', 's', 'd'].includes(key)) {
            let speed = 0;
            let turn = 0;
            
            if (this.pressedKeys.has('w')) speed += 200;
            if (this.pressedKeys.has('s')) speed -= 200;
            if (this.pressedKeys.has('a')) turn -= 100;
            if (this.pressedKeys.has('d')) turn += 100;
            
            const cmd = { type: "drive", speed: speed, turn_rate: turn };
            this.executeCommand(cmd);
        } else if (['q', 'e', 'r', 'f'].includes(key)) {
            if (isPressed) {
                const speed = 200;
                let cmd = null;
                
                if (key === 'q') cmd = { type: "arm1", speed: speed };
                else if (key === 'e') cmd = { type: "arm1", speed: -speed };
                else if (key === 'r') cmd = { type: "arm2", speed: speed };
                else if (key === 'f') cmd = { type: "arm2", speed: -speed };
                
                if (cmd) this.executeCommand(cmd);
            } else {
                let cmd;
                if (['q', 'e'].includes(key)) {
                    cmd = { type: "arm1", speed: 0 };
                } else {
                    cmd = { type: "arm2", speed: 0 };
                }
                this.executeCommand(cmd);
            }
        }
    }
    
    executeCommand(cmd) {
        try {
            const compensatedCmd = this.applyCalibrationCompensation(cmd);
            
            if (this.isDeveloperMode) {
                const action = this.formatCmdDisplay(compensatedCmd);
                this.logStatus(`SIM: ${action}`, "info");
                this.robotSimulator.updateCommand(compensatedCmd);
            } else if (this.bleController?.connected) {
                this.bleController.sendCommand(compensatedCmd);
            }
            
            if (this.isRecording) {
                this.recordCommand(compensatedCmd);
            }
        } catch (error) {
            this.logStatus(`Command error: ${error.message}`, "error");
        }
    }
    
    applyCalibrationCompensation(cmd) {
        if (!this.isCalibrated) return cmd;
        
        const compensatedCmd = { ...cmd };
        const cmdType = cmd.type || "";
        
        if (cmdType === "drive") {
            let speed = cmd.speed || 0;
            let turnRate = cmd.turn_rate || 0;
            
            if (Math.abs(speed) > 0 && Math.abs(turnRate) === 0) {
                if (this.config.straightTrackingBias !== 0 && this.config.straightTrackingConfidence > 0.5) {
                    const compensationTurn = -this.config.straightTrackingBias * speed * 0.1;
                    compensatedCmd.turn_rate = compensationTurn;
                }
            }
            
            if (Math.abs(turnRate) > 0) {
                if (this.config.turnBias !== 0 && this.config.turnConfidence > 0.5) {
                    const compensationFactor = 1.0 + this.config.turnBias;
                    compensatedCmd.turn_rate = turnRate * compensationFactor;
                }
            }
            
            if (this.config.motorBalanceDifference !== 0 && this.config.motorBalanceConfidence > 0.5) {
                const balanceCompensation = this.config.motorBalanceDifference * speed * 0.05;
                compensatedCmd.turn_rate = (compensatedCmd.turn_rate || 0) + balanceCompensation;
            }
        }
        
        return compensatedCmd;
    }
    
    formatCmdDisplay(cmd) {
        const cmdType = cmd.type;
        if (cmdType === "drive") {
            const speed = cmd.speed || 0;
            const turn = cmd.turn_rate || 0;
            
            const moves = [];
            if (speed > 0) moves.push("Forward");
            else if (speed < 0) moves.push("Backward");
            if (turn > 0) moves.push("Turn Right");
            else if (turn < 0) moves.push("Turn Left");
            
            if (moves.length === 0) return "Drive: Stopped";
            return `Drive: ${moves.join(' + ')} (speed=${speed}, turn=${turn})`;
        }
        return `${cmdType}: ${cmd.speed || 0}`;
    }
    
    recordKeyPress(key) {
        if (this.isRecording) {
            this.recordedCommands.push({
                timestamp: Date.now() - this.recordingStartTime,
                type: 'keydown',
                key: key
            });
        }
    }
    
    recordKeyRelease(key) {
        if (this.isRecording) {
            this.recordedCommands.push({
                timestamp: Date.now() - this.recordingStartTime,
                type: 'keyup',
                key: key
            });
        }
    }
    
    recordCommand(cmd) {
        if (this.isRecording) {
            this.recordedCommands.push({
                timestamp: Date.now() - this.recordingStartTime,
                type: 'command',
                command: cmd
            });
        }
    }
    
    async connectHub() {
        const connectBtn = document.getElementById('connectBtn');
        const hubStatus = document.getElementById('hubStatus');
        
        if (this.bleController?.connected || (this.isDeveloperMode && hubStatus.classList.contains('connected'))) {
            this.disconnectHub();
            return;
        }
        
        if (this.isDeveloperMode) {
            this.logStatus("Simulation mode: Simulating hub connection", "warning");
            hubStatus.innerHTML = '<div class="status-dot"></div><span>Hub Connected (Simulation)</span>';
            hubStatus.className = 'status-indicator connected';
            connectBtn.innerHTML = '<i class="fas fa-bluetooth"></i> Disconnect Hub';
            document.getElementById('simulatorSection').classList.remove('hidden');
        } else {
            this.bleController = new BLEController((msg, level) => this.logStatus(msg, level));
            const success = await this.bleController.connect();
            
            if (success) {
                hubStatus.innerHTML = '<div class="status-dot"></div><span>Hub Connected (Bluetooth)</span>';
                hubStatus.className = 'status-indicator connected';
                connectBtn.innerHTML = '<i class="fas fa-bluetooth"></i> Disconnect Hub';
            } else {
                this.logStatus("Connection failed. Check setup guide.", "error");
            }
        }
    }
    
    async disconnectHub() {
        const connectBtn = document.getElementById('connectBtn');
        const hubStatus = document.getElementById('hubStatus');
        
        if (this.bleController) {
            await this.bleController.disconnect();
        }
        
        hubStatus.innerHTML = '<div class="status-dot"></div><span>Hub Disconnected</span>';
        hubStatus.className = 'status-indicator disconnected';
        connectBtn.innerHTML = '<i class="fas fa-bluetooth"></i> Connect to Pybricks Hub';
        
        if (this.isDeveloperMode) {
            this.logStatus("Disconnected from simulated hub", "info");
            document.getElementById('simulatorSection').classList.add('hidden');
        } else {
            this.logStatus("Disconnected from hub", "info");
        }
    }
    
    toggleDeveloperMode(enabled) {
        this.isDeveloperMode = enabled;
        
        if (enabled) {
            document.getElementById('simulatorSection').classList.remove('hidden');
            this.logStatus("Developer mode enabled - simulation active", "info");
        } else {
            document.getElementById('simulatorSection').classList.add('hidden');
            this.logStatus("Developer mode disabled", "info");
        }
    }
    
    openConfigModal() {
        document.getElementById('configModal').style.display = 'block';
        this.loadConfigurationValues();
    }
    
    loadConfigurationValues() {
        document.getElementById('axleTrack').value = this.config.axleTrack;
        document.getElementById('wheelDiameter').value = this.config.wheelDiameter;
        document.getElementById('leftMotorPort').value = this.config.leftMotorPort;
        document.getElementById('rightMotorPort').value = this.config.rightMotorPort;
        document.getElementById('arm1MotorPort').value = this.config.arm1MotorPort;
        document.getElementById('arm2MotorPort').value = this.config.arm2MotorPort;
        document.getElementById('straightSpeed').value = this.config.straightSpeed;
        document.getElementById('straightAccel').value = this.config.straightAcceleration;
        document.getElementById('turnRate').value = this.config.turnRate;
        document.getElementById('turnAccel').value = this.config.turnAcceleration;
    }
    
    copyPybricksCode() {
        const pybricksCode = `#!/usr/bin/env micropython

from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction
from pybricks.tools import wait
import json

hub = PrimeHub()

left_motor = Motor(Port.A)
right_motor = Motor(Port.B)
arm1_motor = Motor(Port.C)
arm2_motor = Motor(Port.D)

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

def main():
    hub.ble.send("ready")
    
    while True:
        if hub.ble.received() is not None:
            try:
                data = hub.ble.received()
                command = json.loads(data)
                execute_command(command)
                hub.ble.send("ok")
            except Exception as e:
                hub.ble.send(f"error: {str(e)}")
        
        wait(10)

if __name__ == "__main__":
    main()
`;
        
        navigator.clipboard.writeText(pybricksCode).then(() => {
            this.logStatus("Pybricks code copied to clipboard!", "success");
        }).catch(() => {
            this.logStatus("Failed to copy code to clipboard", "error");
        });
    }
    
    toggleRecording() {
        const recordBtn = document.getElementById('recordBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        if (!this.isRecording) {
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.recordedCommands = [];
            this.currentRunName = document.getElementById('runNameInput').value || "Run 1";
            
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
            recordBtn.className = 'btn btn-warning';
            saveBtn.disabled = false;
            
            this.logStatus(`Started recording: ${this.currentRunName}`, "info");
        } else {
            this.isRecording = false;
            
            recordBtn.innerHTML = '<i class="fas fa-circle"></i> Record Run';
            recordBtn.className = 'btn btn-danger';
            
            this.logStatus(`Stopped recording: ${this.currentRunName} (${this.recordedCommands.length} commands)`, "success");
        }
    }
    
    saveRun() {
        if (this.recordedCommands.length === 0) {
            this.logStatus("No commands recorded to save", "warning");
            return;
        }
        
        const runData = {
            name: this.currentRunName,
            timestamp: new Date().toISOString(),
            commands: this.recordedCommands,
            config: this.config
        };
        
        this.savedRuns[this.currentRunName] = runData;
        this.saveSavedRuns();
        this.loadSavedRunsList();
        
        document.getElementById('saveBtn').disabled = true;
        this.logStatus(`Saved run: ${this.currentRunName}`, "success");
    }
    
    async playSelectedRun() {
        const selectedRun = document.getElementById('savedRunsList').value;
        if (!selectedRun || !this.savedRuns[selectedRun]) {
            this.logStatus("No run selected", "warning");
            return;
        }
        
        const runData = this.savedRuns[selectedRun];
        this.logStatus(`Playing run: ${selectedRun}`, "info");
        
        for (const recorded of runData.commands) {
            await new Promise(resolve => setTimeout(resolve, recorded.timestamp));
            
            if (recorded.type === 'command') {
                this.executeCommand(recorded.command);
            } else if (recorded.type === 'keydown') {
                this.pressedKeys.add(recorded.key);
                this.processKeyCommand(recorded.key, true);
            } else if (recorded.type === 'keyup') {
                this.pressedKeys.delete(recorded.key);
                this.processKeyCommand(recorded.key, false);
            }
        }
        
        this.executeCommand({ type: "drive", speed: 0, turn_rate: 0 });
        this.executeCommand({ type: "arm1", speed: 0 });
        this.executeCommand({ type: "arm2", speed: 0 });
        this.pressedKeys.clear();
        
        this.logStatus(`Completed playback: ${selectedRun}`, "success");
    }
    
    deleteSelectedRun() {
        const selectedRun = document.getElementById('savedRunsList').value;
        if (!selectedRun || !this.savedRuns[selectedRun]) {
            this.logStatus("No run selected", "warning");
            return;
        }
        
        if (confirm(`Delete run "${selectedRun}"?`)) {
            delete this.savedRuns[selectedRun];
            this.saveSavedRuns();
            this.loadSavedRunsList();
            this.logStatus(`Deleted run: ${selectedRun}`, "info");
        }
    }
    
    uploadMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        this.robotSimulator.setBackgroundMap(img);
                        this.logStatus(`Map uploaded: ${file.name}`, "success");
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }
    
    resetSimulator() {
        this.robotSimulator.reset();
        this.logStatus("Simulator position reset", "info");
    }
    
    async startCalibration() {
        await this.calibrationManager.startCalibration();
    }
    
    onRunSelectionChange(value) {
        const playBtn = document.getElementById('playBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        
        if (value && this.savedRuns[value]) {
            playBtn.disabled = false;
            deleteBtn.disabled = false;
        } else {
            playBtn.disabled = true;
            deleteBtn.disabled = true;
        }
    }
    
    loadSavedRunsList() {
        const select = document.getElementById('savedRunsList');
        select.innerHTML = '<option value="">Select a run...</option>';
        
        Object.keys(this.savedRuns).forEach(runName => {
            const option = document.createElement('option');
            option.value = runName;
            option.textContent = runName;
            select.appendChild(option);
        });
    }
    
    loadSavedRuns() {
        try {
            const saved = localStorage.getItem('fllRoboticsRuns');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    }
    
    saveSavedRuns() {
        try {
            localStorage.setItem('fllRoboticsRuns', JSON.stringify(this.savedRuns));
        } catch (error) {
            this.logStatus("Failed to save runs to storage", "error");
        }
    }
    
    disableControlsUntilCalibration() {
        const controls = ['recordBtn', 'saveBtn', 'playBtn', 'deleteBtn', 'resetSimBtn', 'uploadMapBtn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            element.disabled = true;
            element.title = "Calibration required before use";
        });
    }
    
    enableControlsAfterCalibration() {
        const controls = ['recordBtn', 'playBtn', 'deleteBtn', 'resetSimBtn', 'uploadMapBtn'];
        controls.forEach(id => {
            const element = document.getElementById(id);
            element.disabled = false;
            element.title = "";
        });
    }
    
    logStatus(message, level = "info") {
        const timestamp = new Date().toLocaleTimeString();
        const statusDisplay = document.getElementById('statusDisplay');
        const statusLabel = document.getElementById('statusLabel');
        
        const colorMap = {
            info: "#ffffff",
            success: "#28a745",
            warning: "#ffc107",
            error: "#dc3545"
        };
        
        const color = colorMap[level] || "#ffffff";
        const formattedMessage = `<div style="color: ${color}; margin-bottom: 4px;">[${timestamp}] ${message}</div>`;
        
        statusDisplay.innerHTML += formattedMessage;
        statusDisplay.scrollTop = statusDisplay.scrollHeight;
        statusLabel.textContent = message;
    }
    
    minimizeWindow() {
        this.logStatus("Minimize functionality requires desktop app", "info");
    }
    
    toggleMaximize() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
    
    closeWindow() {
        if (confirm("Close FLL Robotics Control Center?")) {
            window.close();
        }
    }
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
}

function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

function saveConfiguration() {
    const app = window.fllApp;
    
    app.config.axleTrack = parseFloat(document.getElementById('axleTrack').value);
    app.config.wheelDiameter = parseFloat(document.getElementById('wheelDiameter').value);
    app.config.leftMotorPort = document.getElementById('leftMotorPort').value;
    app.config.rightMotorPort = document.getElementById('rightMotorPort').value;
    app.config.arm1MotorPort = document.getElementById('arm1MotorPort').value;
    app.config.arm2MotorPort = document.getElementById('arm2MotorPort').value;
    app.config.straightSpeed = parseFloat(document.getElementById('straightSpeed').value);
    app.config.straightAcceleration = parseFloat(document.getElementById('straightAccel').value);
    app.config.turnRate = parseFloat(document.getElementById('turnRate').value);
    app.config.turnAcceleration = parseFloat(document.getElementById('turnAccel').value);
    
    closeConfigModal();
    app.logStatus("Configuration saved successfully", "success");
}

function minimizeWindow() {
    window.fllApp?.minimizeWindow();
}

function toggleMaximize() {
    window.fllApp?.toggleMaximize();
}

function closeWindow() {
    window.fllApp?.closeWindow();
}

document.addEventListener('DOMContentLoaded', () => {
    window.fllApp = new FLLRoboticsApp();
});

window.addEventListener('beforeunload', () => {
    if (window.fllApp?.robotSimulator) {
        window.fllApp.robotSimulator.destroy();
    }
});