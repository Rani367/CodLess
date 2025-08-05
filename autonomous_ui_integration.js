/**
 * Autonomous UI Integration for CodLess
 * Adds autonomous mode controls to the web app interface
 */

class AutonomousUIIntegration {
    constructor(app) {
        this.app = app;
        this.currentMode = 'teleop'; // teleop, replay, autonomous
        this.autonomousSubMode = 'waypoint'; // waypoint, pathplan, recorded, demo
        this.isAutonomousRunning = false;
        
        // Add autonomous-specific properties to app config
        this.setupAutonomousConfig();
    }
    
    setupAutonomousConfig() {
        // Extend the app config with autonomous settings
        if (!this.app.config.autonomousEnabled) {
            this.app.config.autonomousEnabled = false;
            this.app.config.colorSensorPort = 'E';
            this.app.config.distanceSensorPort = 'F';
            this.app.config.includeAutonomous = true;
            this.app.config.particleCount = 50;
            this.app.config.gridSize = 50;
        }
    }
    
    injectAutonomousUI() {
        // Add mode selector to the main UI
        this.addModeSelector();
        
        // Add autonomous control panel
        this.addAutonomousPanel();
        
        // Add autonomous settings to config dialog
        this.addAutonomousSettings();
        
        // Update status display
        this.updateStatusDisplay();
    }
    
    addModeSelector() {
        // Find the recording controls section
        const recordingSection = document.querySelector('.recording-controls');
        
        if (recordingSection) {
            // Create mode selector HTML
            const modeSelectorHTML = `
                <div class="mode-selector-section" style="margin-bottom: 20px;">
                    <div class="section-header">
                        <i class="fas fa-robot" aria-hidden="true"></i>
                        <h3>Operation Mode</h3>
                    </div>
                    <div class="mode-selector">
                        <button id="teleopModeBtn" class="mode-btn active" data-mode="teleop">
                            <i class="fas fa-gamepad"></i>
                            <span>Teleop</span>
                            <small>Manual control</small>
                        </button>
                        <button id="replayModeBtn" class="mode-btn" data-mode="replay">
                            <i class="fas fa-play-circle"></i>
                            <span>Replay</span>
                            <small>Run saved paths</small>
                        </button>
                        <button id="autonomousModeBtn" class="mode-btn" data-mode="autonomous">
                            <i class="fas fa-brain"></i>
                            <span>Autonomous</span>
                            <small>Smart navigation</small>
                        </button>
                    </div>
                </div>
            `;
            
            // Insert before recording controls
            recordingSection.insertAdjacentHTML('beforebegin', modeSelectorHTML);
            
            // Add event listeners
            this.setupModeButtons();
        }
    }
    
    addAutonomousPanel() {
        // Find the main content area
        const mainContent = document.querySelector('.main-content');
        
        if (mainContent) {
            // Create autonomous panel HTML
            const autonomousPanelHTML = `
                <div id="autonomousPanel" class="content-section hidden">
                    <div class="section-header">
                        <i class="fas fa-brain" aria-hidden="true"></i>
                        <h3>Autonomous Navigation</h3>
                        <div class="section-actions">
                            <button id="autonomousHelpBtn" class="btn-icon" aria-label="Autonomous help">
                                <i class="fas fa-question-circle" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="autonomous-controls">
                        <!-- Sub-mode selector -->
                        <div class="autonomous-mode-selector">
                            <h4>Navigation Mode</h4>
                            <div class="button-group">
                                <button id="waypointModeBtn" class="btn btn-secondary active" data-submode="waypoint">
                                    <i class="fas fa-map-marker-alt"></i>
                                    Waypoint
                                </button>
                                <button id="pathplanModeBtn" class="btn btn-secondary" data-submode="pathplan">
                                    <i class="fas fa-route"></i>
                                    Path Planning
                                </button>
                                <button id="recordedModeBtn" class="btn btn-secondary" data-submode="recorded">
                                    <i class="fas fa-history"></i>
                                    Follow Recorded
                                </button>
                                <button id="demoModeBtn" class="btn btn-secondary" data-submode="demo">
                                    <i class="fas fa-magic"></i>
                                    Demo
                                </button>
                            </div>
                        </div>
                        
                        <!-- Waypoint input -->
                        <div id="waypointControls" class="autonomous-subpanel">
                            <h4>Target Position</h4>
                            <div class="input-row">
                                <div class="input-group">
                                    <label for="targetX">X (mm):</label>
                                    <input type="number" id="targetX" class="input-field" value="600" min="0" max="1200">
                                </div>
                                <div class="input-group">
                                    <label for="targetY">Y (mm):</label>
                                    <input type="number" id="targetY" class="input-field" value="600" min="0" max="1200">
                                </div>
                                <div class="input-group">
                                    <label for="targetHeading">Heading (°):</label>
                                    <input type="number" id="targetHeading" class="input-field" value="0" min="0" max="360">
                                </div>
                            </div>
                            <button id="goToWaypointBtn" class="btn btn-primary">
                                <i class="fas fa-location-arrow"></i>
                                Go to Position
                            </button>
                        </div>
                        
                        <!-- Path planning controls -->
                        <div id="pathPlanControls" class="autonomous-subpanel hidden">
                            <h4>Obstacle Avoidance</h4>
                            <p class="info-text">Navigate to target while avoiding obstacles</p>
                            <div class="checkbox-container">
                                <input type="checkbox" id="usePathPlanning" class="checkbox" checked>
                                <label for="usePathPlanning">Enable path planning</label>
                            </div>
                            <button id="addObstacleBtn" class="btn btn-secondary">
                                <i class="fas fa-cube"></i>
                                Add Obstacle
                            </button>
                            <button id="clearObstaclesBtn" class="btn btn-warning">
                                <i class="fas fa-trash"></i>
                                Clear Obstacles
                            </button>
                        </div>
                        
                        <!-- Recorded path controls -->
                        <div id="recordedPathControls" class="autonomous-subpanel hidden">
                            <h4>Follow Recorded Path</h4>
                            <select id="recordedPathSelect" class="select-box">
                                <option value="">Select a recorded run...</option>
                            </select>
                            <div class="checkbox-container">
                                <input type="checkbox" id="useWaypoints" class="checkbox" checked>
                                <label for="useWaypoints">Convert to waypoints</label>
                            </div>
                            <button id="followRecordedBtn" class="btn btn-primary">
                                <i class="fas fa-play"></i>
                                Follow Path
                            </button>
                        </div>
                        
                        <!-- Demo controls -->
                        <div id="demoControls" class="autonomous-subpanel hidden">
                            <h4>Autonomous Demos</h4>
                            <div class="button-group-vertical">
                                <button id="squarePatternBtn" class="btn btn-secondary">
                                    <i class="fas fa-square"></i>
                                    Square Pattern
                                </button>
                                <button id="figure8Btn" class="btn btn-secondary">
                                    <i class="fas fa-infinity"></i>
                                    Figure 8
                                </button>
                                <button id="obstacleNavBtn" class="btn btn-secondary">
                                    <i class="fas fa-project-diagram"></i>
                                    Obstacle Navigation
                                </button>
                                <button id="fullMissionBtn" class="btn btn-secondary">
                                    <i class="fas fa-flag-checkered"></i>
                                    Full Mission Demo
                                </button>
                            </div>
                        </div>
                        
                        <!-- Status and controls -->
                        <div class="autonomous-status">
                            <div class="status-row">
                                <span>Position:</span>
                                <span id="currentPosition">X: 0, Y: 0, θ: 0°</span>
                            </div>
                            <div class="status-row">
                                <span>Confidence:</span>
                                <span id="localizationConfidence">0%</span>
                            </div>
                            <div class="button-group">
                                <button id="calibrateBtn" class="btn btn-warning">
                                    <i class="fas fa-crosshairs"></i>
                                    Calibrate on Line
                                </button>
                                <button id="resetPositionBtn" class="btn btn-secondary">
                                    <i class="fas fa-undo"></i>
                                    Reset Position
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert after recording controls
            const recordingSection = mainContent.querySelector('.content-section:nth-child(2)');
            if (recordingSection) {
                recordingSection.insertAdjacentHTML('afterend', autonomousPanelHTML);
            }
            
            // Setup event listeners
            this.setupAutonomousControls();
        }
    }
    
    addAutonomousSettings() {
        // Find the robot configuration form
        const configForm = document.getElementById('configForm');
        
        if (configForm) {
            // Find the last fieldset
            const lastFieldset = configForm.querySelector('fieldset:last-child');
            
            // Create autonomous settings HTML
            const autonomousSettingsHTML = `
                <fieldset>
                    <legend>Autonomous Navigation</legend>
                    
                    <div class="form-group">
                        <label for="includeAutonomous">
                            <input type="checkbox" id="includeAutonomous" checked>
                            Include Autonomous Navigation
                        </label>
                        <small class="help-text">Enable autonomous navigation features in hub code</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="colorSensorPort">Color Sensor Port:</label>
                        <select id="colorSensorPort" class="input-field">
                            <option value="A">Port A</option>
                            <option value="B">Port B</option>
                            <option value="C">Port C</option>
                            <option value="D">Port D</option>
                            <option value="E" selected>Port E</option>
                            <option value="F">Port F</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="distanceSensorPort">Distance Sensor Port:</label>
                        <select id="distanceSensorPort" class="input-field">
                            <option value="A">Port A</option>
                            <option value="B">Port B</option>
                            <option value="C">Port C</option>
                            <option value="D">Port D</option>
                            <option value="E">Port E</option>
                            <option value="F" selected>Port F</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="particleCount">Particle Count:</label>
                        <input type="number" id="particleCount" class="input-field" value="50" min="30" max="100">
                        <small class="help-text">Number of particles for localization (30-100)</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="gridSize">Grid Size (mm):</label>
                        <input type="number" id="gridSize" class="input-field" value="50" min="25" max="100">
                        <small class="help-text">Resolution for path planning (25-100mm)</small>
                    </div>
                </fieldset>
            `;
            
            // Insert after last fieldset
            lastFieldset.insertAdjacentHTML('afterend', autonomousSettingsHTML);
        }
    }
    
    setupModeButtons() {
        // Mode button event listeners
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = btn.dataset.mode;
                this.switchMode(mode);
            });
        });
    }
    
    setupAutonomousControls() {
        // Sub-mode buttons
        document.querySelectorAll('[data-submode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchAutonomousSubMode(btn.dataset.submode);
            });
        });
        
        // Waypoint navigation
        const goToWaypointBtn = document.getElementById('goToWaypointBtn');
        if (goToWaypointBtn) {
            goToWaypointBtn.addEventListener('click', () => this.goToWaypoint());
        }
        
        // Path planning
        const addObstacleBtn = document.getElementById('addObstacleBtn');
        if (addObstacleBtn) {
            addObstacleBtn.addEventListener('click', () => this.showObstacleDialog());
        }
        
        const clearObstaclesBtn = document.getElementById('clearObstaclesBtn');
        if (clearObstaclesBtn) {
            clearObstaclesBtn.addEventListener('click', () => this.clearObstacles());
        }
        
        // Recorded path
        const followRecordedBtn = document.getElementById('followRecordedBtn');
        if (followRecordedBtn) {
            followRecordedBtn.addEventListener('click', () => this.followRecordedPath());
        }
        
        // Demo buttons
        document.getElementById('squarePatternBtn')?.addEventListener('click', () => this.runDemo('square'));
        document.getElementById('figure8Btn')?.addEventListener('click', () => this.runDemo('figure8'));
        document.getElementById('obstacleNavBtn')?.addEventListener('click', () => this.runDemo('obstacle'));
        document.getElementById('fullMissionBtn')?.addEventListener('click', () => this.runDemo('mission'));
        
        // Calibration
        document.getElementById('calibrateBtn')?.addEventListener('click', () => this.calibrateOnLine());
        document.getElementById('resetPositionBtn')?.addEventListener('click', () => this.resetPosition());
        
        // Help button
        document.getElementById('autonomousHelpBtn')?.addEventListener('click', () => this.showHelp());
        
        // Update recorded paths dropdown
        this.updateRecordedPathsList();
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        // Update button states
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Show/hide panels
        const recordingControls = document.querySelector('.recording-controls').parentElement;
        const autonomousPanel = document.getElementById('autonomousPanel');
        
        if (mode === 'autonomous') {
            recordingControls.classList.add('hidden');
            autonomousPanel.classList.remove('hidden');
        } else {
            recordingControls.classList.remove('hidden');
            autonomousPanel.classList.add('hidden');
        }
        
        // Send mode change to hub
        this.sendModeCommand(mode);
        
        // Update UI state
        this.updateUIForMode(mode);
        
        // Log mode change
        this.app.logger.log(`Switched to ${mode} mode`, 'info');
    }
    
    switchAutonomousSubMode(submode) {
        this.autonomousSubMode = submode;
        
        // Update button states
        document.querySelectorAll('[data-submode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.submode === submode);
        });
        
        // Show/hide subpanels
        document.querySelectorAll('.autonomous-subpanel').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        const panels = {
            'waypoint': 'waypointControls',
            'pathplan': 'pathPlanControls',
            'recorded': 'recordedPathControls',
            'demo': 'demoControls'
        };
        
        const panelId = panels[submode];
        if (panelId) {
            document.getElementById(panelId).classList.remove('hidden');
        }
    }
    
    sendModeCommand(mode) {
        if (this.app.bleController.connected || this.app.bleController.isSimulatingConnection) {
            const command = {
                type: 'mode',
                mode: mode
            };
            
            this.app.bleController.sendCommand(command);
        }
    }
    
    updateUIForMode(mode) {
        // Update various UI elements based on mode
        const emergencyStopBtn = document.getElementById('emergencyStopBtn');
        const recordBtn = document.getElementById('recordBtn');
        const playBtn = document.getElementById('playBtn');
        
        if (mode === 'teleop') {
            emergencyStopBtn.textContent = 'Emergency Stop';
            recordBtn.disabled = false;
            playBtn.disabled = true;
        } else if (mode === 'replay') {
            emergencyStopBtn.textContent = 'Stop Replay';
            recordBtn.disabled = true;
            playBtn.disabled = false;
        } else if (mode === 'autonomous') {
            emergencyStopBtn.textContent = 'Stop Autonomous';
            recordBtn.disabled = true;
            playBtn.disabled = true;
        }
    }
    
    async goToWaypoint() {
        const x = parseFloat(document.getElementById('targetX').value);
        const y = parseFloat(document.getElementById('targetY').value);
        const heading = parseFloat(document.getElementById('targetHeading').value);
        const usePathPlanning = document.getElementById('usePathPlanning')?.checked ?? false;
        
        if (isNaN(x) || isNaN(y)) {
            this.app.toastManager.show('Invalid target position', 'error');
            return;
        }
        
        const command = {
            type: 'autonomous',
            action: 'navigate',
            x: x,
            y: y,
            heading: isNaN(heading) ? null : heading,
            usePathPlanning: usePathPlanning
        };
        
        this.app.logger.log(`Navigating to (${x}, ${y}, ${heading}°)`, 'info');
        this.sendAutonomousCommand(command);
    }
    
    async followRecordedPath() {
        const select = document.getElementById('recordedPathSelect');
        const runId = select.value;
        const useWaypoints = document.getElementById('useWaypoints').checked;
        
        if (!runId) {
            this.app.toastManager.show('Please select a recorded run', 'warning');
            return;
        }
        
        const run = this.app.savedRuns.get(runId);
        if (!run) {
            this.app.toastManager.show('Run not found', 'error');
            return;
        }
        
        const command = {
            type: 'autonomous',
            action: 'followPath',
            commands: run.commands,
            useWaypoints: useWaypoints
        };
        
        this.app.logger.log(`Following recorded path: ${run.name}`, 'info');
        this.sendAutonomousCommand(command);
    }
    
    runDemo(demoType) {
        const command = {
            type: 'autonomous',
            action: 'demo',
            demoType: demoType
        };
        
        this.app.logger.log(`Running ${demoType} demo`, 'info');
        this.sendAutonomousCommand(command);
    }
    
    calibrateOnLine() {
        const command = {
            type: 'autonomous',
            action: 'calibrate',
            expectedColor: 'BLACK'
        };
        
        this.app.logger.log('Calibrating on line...', 'info');
        this.sendAutonomousCommand(command);
    }
    
    resetPosition() {
        const x = parseFloat(prompt('Reset X position (mm):', '100'));
        const y = parseFloat(prompt('Reset Y position (mm):', '100'));
        const heading = parseFloat(prompt('Reset heading (degrees):', '0'));
        
        if (isNaN(x) || isNaN(y) || isNaN(heading)) {
            this.app.toastManager.show('Invalid position values', 'error');
            return;
        }
        
        const command = {
            type: 'autonomous',
            action: 'resetPosition',
            x: x,
            y: y,
            heading: heading
        };
        
        this.app.logger.log(`Reset position to (${x}, ${y}, ${heading}°)`, 'info');
        this.sendAutonomousCommand(command);
    }
    
    showObstacleDialog() {
        // Simple obstacle input dialog
        const x = parseFloat(prompt('Obstacle X position (mm):', '500'));
        const y = parseFloat(prompt('Obstacle Y position (mm):', '500'));
        const width = parseFloat(prompt('Obstacle width (mm):', '200'));
        const height = parseFloat(prompt('Obstacle height (mm):', '200'));
        
        if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
            this.app.toastManager.show('Invalid obstacle dimensions', 'error');
            return;
        }
        
        const command = {
            type: 'autonomous',
            action: 'addObstacle',
            x: x,
            y: y,
            width: width,
            height: height
        };
        
        this.app.logger.log(`Added obstacle at (${x}, ${y}) size ${width}x${height}`, 'info');
        this.sendAutonomousCommand(command);
    }
    
    clearObstacles() {
        const command = {
            type: 'autonomous',
            action: 'clearObstacles'
        };
        
        this.app.logger.log('Cleared all obstacles', 'info');
        this.sendAutonomousCommand(command);
    }
    
    sendAutonomousCommand(command) {
        if (this.app.bleController.connected || this.app.bleController.isSimulatingConnection) {
            this.app.bleController.sendCommand(command);
            this.isAutonomousRunning = true;
        } else {
            this.app.toastManager.show('Please connect to hub first', 'warning');
        }
    }
    
    updateRecordedPathsList() {
        const select = document.getElementById('recordedPathSelect');
        if (!select) return;
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a recorded run...</option>';
        
        // Add saved runs
        this.app.savedRuns.forEach((run, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = run.name;
            select.appendChild(option);
        });
    }
    
    updateStatus(status) {
        // Update position display
        if (status.position) {
            const positionEl = document.getElementById('currentPosition');
            if (positionEl) {
                positionEl.textContent = `X: ${status.position.x.toFixed(0)}, Y: ${status.position.y.toFixed(0)}, θ: ${status.position.heading.toFixed(0)}°`;
            }
        }
        
        // Update confidence
        if (status.confidence !== undefined) {
            const confidenceEl = document.getElementById('localizationConfidence');
            if (confidenceEl) {
                confidenceEl.textContent = `${(status.confidence * 100).toFixed(0)}%`;
            }
        }
    }
    
    showHelp() {
        const helpContent = `
            <h3>Autonomous Navigation Help</h3>
            
            <h4>Navigation Modes:</h4>
            <ul>
                <li><strong>Waypoint:</strong> Navigate directly to specific positions</li>
                <li><strong>Path Planning:</strong> Navigate around obstacles using A* algorithm</li>
                <li><strong>Follow Recorded:</strong> Convert and follow your recorded teleop paths</li>
                <li><strong>Demo:</strong> Pre-programmed demonstration patterns</li>
            </ul>
            
            <h4>Key Features:</h4>
            <ul>
                <li>Odometry tracking using wheel encoders and gyro</li>
                <li>Monte Carlo Localization with particle filter</li>
                <li>Landmark detection using color sensor</li>
                <li>Dynamic obstacle avoidance</li>
            </ul>
            
            <h4>Tips:</h4>
            <ul>
                <li>Calibrate on black lines when possible for better accuracy</li>
                <li>Start with simple waypoint navigation before using path planning</li>
                <li>Record teleop paths first, then replay them autonomously</li>
                <li>Use lower particle counts (30-50) for better performance</li>
            </ul>
        `;
        
        // Show help in a modal or toast
        this.app.toastManager.show(helpContent, 'info', 10000);
    }
    
    updateStatusDisplay() {
        // Add autonomous status to the main status display
        const statusDisplay = document.getElementById('statusDisplay');
        if (statusDisplay && this.currentMode === 'autonomous') {
            // This would be called periodically to update status
            // Implementation depends on how status updates are received from hub
        }
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutonomousUIIntegration;
} else {
    window.AutonomousUIIntegration = AutonomousUIIntegration;
}