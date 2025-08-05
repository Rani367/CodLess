# Autonomous Navigation Integration Guide

## How to Add Autonomous Navigation to CodLess

### 1. Include Required Files

Add these files to your project:
- `autonomous_ui_integration.js` - UI components and controls
- `autonomous_hub_code_generator.js` - Hub code generator with autonomous modules
- `autonomous_styles.css` - Styling for autonomous UI

### 2. Update index.html

Add the CSS file to the head section:
```html
<link rel="stylesheet" href="autonomous_styles.css">
```

Add the JavaScript files before the closing body tag:
```html
<script src="autonomous_hub_code_generator.js"></script>
<script src="autonomous_ui_integration.js"></script>
```

### 3. Update app.js

In the FLLRoboticsApp class constructor, add:
```javascript
// After other initializations
this.autonomousUI = null;
```

In the init() method, after setting up other components:
```javascript
// Setup autonomous navigation UI
this.setupAutonomousUI();
```

Add this new method to the FLLRoboticsApp class:
```javascript
setupAutonomousUI() {
    // Initialize autonomous UI integration
    this.autonomousUI = new AutonomousUIIntegration(this);
    
    // Inject autonomous UI components
    this.autonomousUI.injectAutonomousUI();
    
    // Use the autonomous hub code generator
    this.autonomousCodeGenerator = new AutonomousHubCodeGenerator();
}
```

### 4. Update the generateHubCode Method

Replace the existing generateHubCode method with:
```javascript
generateHubCode() {
    // Use the autonomous code generator if autonomous is enabled
    if (this.config.includeAutonomous && this.autonomousCodeGenerator) {
        return this.autonomousCodeGenerator.generateCompleteHubCode(
            this.config,
            this.getSavedRunsArray(),
            true // Include autonomous
        );
    }
    
    // Fall back to original code generation
    return this.originalGenerateHubCode();
}
```

### 5. Handle Hub Messages

Update the BLE message handler to process autonomous status updates:
```javascript
// In setupBLEEvents() method, add to the hubMessage handler:
this.bleController.on('hubMessage', (data) => {
    // Existing message handling...
    
    // Handle autonomous status updates
    if (data.message && typeof data.message === 'string') {
        try {
            const parsed = JSON.parse(data.message);
            if (parsed.type === 'status' && this.autonomousUI) {
                this.autonomousUI.updateStatus(parsed);
            }
        } catch (e) {
            // Not JSON, handle as regular message
        }
    }
});
```

### 6. Update Saved Runs List

When saved runs change, update the autonomous UI:
```javascript
// In updateSavedRunsList() method, add:
if (this.autonomousUI) {
    this.autonomousUI.updateRecordedPathsList();
}
```

## Usage

Once integrated, users can:

1. **Switch Modes**: Click the mode buttons to switch between Teleop, Replay, and Autonomous modes
2. **Navigate to Waypoints**: Enter target coordinates and click "Go to Position"
3. **Follow Recorded Paths**: Select a saved run and click "Follow Path"
4. **Run Demos**: Click demo buttons to see pre-programmed patterns
5. **Configure Settings**: In robot configuration, set sensor ports and navigation parameters

## Mode Control Flow

```
Web App (Mode Selection)
    ↓
Bluetooth Command → Hub
    ↓
Hub switches mode
    ↓
Hub sends status updates → Web App
    ↓
Web App updates UI
```

## Command Examples

### Switch to Autonomous Mode
```javascript
{
    type: 'mode',
    mode: 'autonomous'
}
```

### Navigate to Position
```javascript
{
    type: 'autonomous',
    action: 'navigate',
    x: 600,
    y: 300,
    heading: 90,
    usePathPlanning: true
}
```

### Follow Recorded Path
```javascript
{
    type: 'autonomous',
    action: 'followPath',
    commands: [...],  // Recorded commands
    useWaypoints: true
}
```

## Troubleshooting

1. **UI Not Appearing**: Check that autonomous_ui_integration.js is loaded and setupAutonomousUI() is called
2. **Styles Missing**: Ensure autonomous_styles.css is linked in index.html
3. **Commands Not Working**: Verify the hub code includes autonomous modules (config.includeAutonomous = true)
4. **Status Not Updating**: Check BLE message handler is parsing autonomous status messages

## Customization

- Modify `autonomous_styles.css` to match your app theme
- Edit landmark positions in `localization.py` for your FLL mat
- Adjust particle count and grid size in configuration for performance
- Add custom demos in the autonomous_mode function