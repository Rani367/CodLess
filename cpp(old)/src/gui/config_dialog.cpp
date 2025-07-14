#include "gui/config_dialog.h"
#include "utils/calibration_manager.h"
#include "hardware/ble_controller.h"
#include "sim/robot_simulator.h"
#include <QApplication>
#include <QMessageBox>
#include <QScreen>
#include <QGraphicsDropShadowEffect>
#include <QPropertyAnimation>
#include <QParallelAnimationGroup>
#include <QEasingCurve>

ConfigDialog::ConfigDialog(QWidget* parent, const RobotConfig& config)
    : QDialog(parent)
    , currentConfig(config)
    , calibrationManager(new CalibrationManager(this))
{
    setWindowTitle("Robot Configuration");
    setModal(true);
    setFixedSize(650, 600);
    
    // Use custom title bar to match main window styling
    setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    
    setupUi();
    setupDialogStyle();
    loadConfigValues();
    connectSignals();
    
    // Setup calibration connections
    connect(calibrationManager, &CalibrationManager::calibrationStarted,
            this, &ConfigDialog::onCalibrationStarted);
    connect(calibrationManager, &CalibrationManager::calibrationStepChanged,
            this, &ConfigDialog::onCalibrationStepChanged);
    connect(calibrationManager, &CalibrationManager::calibrationProgress,
            this, &ConfigDialog::onCalibrationProgress);
    connect(calibrationManager, &CalibrationManager::calibrationCompleted,
            this, &ConfigDialog::onCalibrationCompleted);
    connect(calibrationManager, &CalibrationManager::calibrationFailed,
            this, &ConfigDialog::onCalibrationFailed);
    
    QRect parentGeometry = parent->geometry();
    int x = parentGeometry.x() + (parentGeometry.width() - width()) / 2;
    int y = parentGeometry.y() + (parentGeometry.height() - height()) / 2;
    move(x, y);
    
    setWindowOpacity(0.0);
    
    // Use smart pointer to manage animation memory and set proper parent
    auto* fadeIn = new QPropertyAnimation(this, "windowOpacity", this);
    fadeIn->setDuration(200);
    fadeIn->setStartValue(0.0);
    fadeIn->setEndValue(1.0);
    fadeIn->setEasingCurve(QEasingCurve::OutCubic);
    fadeIn->start(QPropertyAnimation::DeleteWhenStopped);
}

ConfigDialog::~ConfigDialog() = default;

RobotConfig ConfigDialog::getConfig() const {
    return currentConfig;
}

void ConfigDialog::setBLEController(BLEController* controller) {
    bleController = controller;
    if (calibrationManager) {
        calibrationManager->setBLEController(controller);
    }
}

void ConfigDialog::setRobotSimulator(RobotSimulator* simulator) {
    robotSimulator = simulator;
    if (calibrationManager) {
        calibrationManager->setRobotSimulator(simulator);
    }
}

void ConfigDialog::setDeveloperMode(bool enabled) {
    isDeveloperMode = enabled;
    if (calibrationManager) {
        calibrationManager->setDeveloperMode(enabled);
    }
}

void ConfigDialog::setupUi() {
    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);
    
    // Create custom title bar
    auto* titleBar = new QWidget(this);
    titleBar->setFixedHeight(40);
    titleBar->setObjectName("dialogTitleBar");
    
    auto* titleLayout = new QHBoxLayout(titleBar);
    titleLayout->setContentsMargins(15, 0, 15, 0);
    titleLayout->setSpacing(10);
    
    auto* titleLabel = new QLabel("Robot Configuration", titleBar);
    titleLabel->setObjectName("dialogTitle");
    titleLabel->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(titleLabel);
    titleLayout->addStretch();
    
    auto* closeButton = new QPushButton("X", titleBar);
    closeButton->setObjectName("dialogCloseBtn");
    closeButton->setFixedSize(30, 30);
    closeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(closeButton);
    
    connect(closeButton, &QPushButton::clicked, this, &QDialog::reject);
    
    // Content area
    auto* contentWidget = new QWidget(this);
    auto* contentLayout = new QVBoxLayout(contentWidget);
    contentLayout->setContentsMargins(20, 20, 20, 20);
    contentLayout->setSpacing(20);
    
    tabWidget = new QTabWidget();
    tabWidget->setObjectName("configTabs");
    
    setupBasicTab();
    setupAdvancedTab();
    setupMotorsTab();
    setupCalibrationTab();
    
    tabWidget->addTab(basicTab, "Basic Settings");
    tabWidget->addTab(motorsTab, "Motor Ports");
    tabWidget->addTab(advancedTab, "Advanced");
    tabWidget->addTab(calibrationTab, "Calibration");
    
    advancedCheckBox = new QCheckBox("Show Advanced Options");
    advancedCheckBox->setObjectName("advancedCheckBox");
    
    buttonBox = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel);
    buttonBox->setObjectName("dialogButtonBox");
    
    resetButton = new QPushButton("Reset to Defaults");
    resetButton->setObjectName("resetButton");
    buttonBox->addButton(resetButton, QDialogButtonBox::ResetRole);
    
    contentLayout->addWidget(tabWidget);
    contentLayout->addWidget(advancedCheckBox);
    contentLayout->addWidget(buttonBox);
    
    mainLayout->addWidget(titleBar);
    mainLayout->addWidget(contentWidget);
    
    toggleAdvancedOptions(false);
}

void ConfigDialog::setupBasicTab() {
    basicTab = new QWidget();
    auto* layout = new QVBoxLayout(basicTab);
    layout->setContentsMargins(20, 20, 20, 20);
    layout->setSpacing(20);
    
    auto* robotGroup = new QGroupBox("Robot Physical Properties");
    robotGroup->setObjectName("configGroup");
    auto* robotLayout = new QFormLayout(robotGroup);
    robotLayout->setSpacing(15);
    
    axleTrackSpinBox = new QDoubleSpinBox();
    axleTrackSpinBox->setObjectName("configSpinBox");
    axleTrackSpinBox->setRange(MIN_AXLE_TRACK, MAX_AXLE_TRACK);
    axleTrackSpinBox->setSuffix(" mm");
    axleTrackSpinBox->setDecimals(1);
    axleTrackSpinBox->setSingleStep(1.0);
    
    wheelDiameterSpinBox = new QDoubleSpinBox();
    wheelDiameterSpinBox->setObjectName("configSpinBox");
    wheelDiameterSpinBox->setRange(MIN_WHEEL_DIAMETER, MAX_WHEEL_DIAMETER);
    wheelDiameterSpinBox->setSuffix(" mm");
    wheelDiameterSpinBox->setDecimals(1);
    wheelDiameterSpinBox->setSingleStep(1.0);
    
    axleTrackLabel = new QLabel("Distance between left and right wheels");
    axleTrackLabel->setObjectName("configDescription");
    wheelDiameterLabel = new QLabel("Diameter of the drive wheels");
    wheelDiameterLabel->setObjectName("configDescription");
    
    robotLayout->addRow("Axle Track:", axleTrackSpinBox);
    robotLayout->addRow("", axleTrackLabel);
    robotLayout->addRow("Wheel Diameter:", wheelDiameterSpinBox);
    robotLayout->addRow("", wheelDiameterLabel);
    
    auto* movementGroup = new QGroupBox("Movement Settings");
    movementGroup->setObjectName("configGroup");
    auto* movementLayout = new QFormLayout(movementGroup);
    movementLayout->setSpacing(15);
    
    straightSpeedSpinBox = new QDoubleSpinBox();
    straightSpeedSpinBox->setObjectName("configSpinBox");
    straightSpeedSpinBox->setRange(MIN_SPEED, MAX_SPEED);
    straightSpeedSpinBox->setSuffix(" mm/s");
    straightSpeedSpinBox->setDecimals(0);
    straightSpeedSpinBox->setSingleStep(10.0);
    
    straightAccelSpinBox = new QDoubleSpinBox();
    straightAccelSpinBox->setObjectName("configSpinBox");
    straightAccelSpinBox->setRange(MIN_ACCELERATION, MAX_ACCELERATION);
    straightAccelSpinBox->setSuffix(" mm/s²");
    straightAccelSpinBox->setDecimals(0);
    straightAccelSpinBox->setSingleStep(10.0);
    
    movementLayout->addRow("Straight Speed:", straightSpeedSpinBox);
    movementLayout->addRow("Straight Acceleration:", straightAccelSpinBox);
    
    layout->addWidget(robotGroup);
    layout->addWidget(movementGroup);
    layout->addStretch();
}

void ConfigDialog::setupAdvancedTab() {
    advancedTab = new QWidget();
    auto* layout = new QVBoxLayout(advancedTab);
    layout->setContentsMargins(20, 20, 20, 20);
    layout->setSpacing(20);
    
    auto* turnGroup = new QGroupBox("Turning Settings");
    turnGroup->setObjectName("configGroup");
    auto* turnLayout = new QFormLayout(turnGroup);
    turnLayout->setSpacing(15);
    
    turnRateSpinBox = new QDoubleSpinBox();
    turnRateSpinBox->setObjectName("configSpinBox");
    turnRateSpinBox->setRange(MIN_TURN_RATE, MAX_TURN_RATE);
    turnRateSpinBox->setSuffix(" °/s");
    turnRateSpinBox->setDecimals(0);
    turnRateSpinBox->setSingleStep(10.0);
    
    turnAccelSpinBox = new QDoubleSpinBox();
    turnAccelSpinBox->setObjectName("configSpinBox");
    turnAccelSpinBox->setRange(MIN_TURN_ACCEL, MAX_TURN_ACCEL);
    turnAccelSpinBox->setSuffix(" °/s²");
    turnAccelSpinBox->setDecimals(0);
    turnAccelSpinBox->setSingleStep(10.0);
    
    turnLayout->addRow("Turn Rate:", turnRateSpinBox);
    turnLayout->addRow("Turn Acceleration:", turnAccelSpinBox);
    
    auto* infoGroup = new QGroupBox("Information");
    infoGroup->setObjectName("configGroup");
    auto* infoLayout = new QVBoxLayout(infoGroup);
    
    auto* infoLabel = new QLabel("Advanced settings allow fine-tuning of robot movement characteristics. "
                                "Higher values result in faster, more aggressive movements. "
                                "Lower values provide smoother, more controlled motion.");
    infoLabel->setObjectName("configDescription");
    infoLabel->setWordWrap(true);
    
    infoLayout->addWidget(infoLabel);
    
    layout->addWidget(turnGroup);
    layout->addWidget(infoGroup);
    layout->addStretch();
}

void ConfigDialog::setupMotorsTab() {
    motorsTab = new QWidget();
    auto* layout = new QVBoxLayout(motorsTab);
    layout->setContentsMargins(20, 20, 20, 20);
    layout->setSpacing(20);
    
    auto* motorsGroup = new QGroupBox("Motor Port Assignment");
    motorsGroup->setObjectName("configGroup");
    auto* motorsLayout = new QFormLayout(motorsGroup);
    motorsLayout->setSpacing(15);
    
    QStringList motorPorts = {"A", "B", "C", "D", "E", "F"};
    
    leftMotorCombo = new QComboBox();
    leftMotorCombo->setObjectName("configCombo");
    leftMotorCombo->addItems(motorPorts);
    
    rightMotorCombo = new QComboBox();
    rightMotorCombo->setObjectName("configCombo");
    rightMotorCombo->addItems(motorPorts);
    
    arm1MotorCombo = new QComboBox();
    arm1MotorCombo->setObjectName("configCombo");
    arm1MotorCombo->addItems(motorPorts);
    
    arm2MotorCombo = new QComboBox();
    arm2MotorCombo->setObjectName("configCombo");
    arm2MotorCombo->addItems(motorPorts);
    
    motorsLayout->addRow("Left Drive Motor:", leftMotorCombo);
    motorsLayout->addRow("Right Drive Motor:", rightMotorCombo);
    motorsLayout->addRow("Arm 1 Motor:", arm1MotorCombo);
    motorsLayout->addRow("Arm 2 Motor:", arm2MotorCombo);
    
    auto* motorInfoGroup = new QGroupBox("Motor Information");
    motorInfoGroup->setObjectName("configGroup");
    auto* motorInfoLayout = new QVBoxLayout(motorInfoGroup);
    
    auto* motorInfoLabel = new QLabel("Assign motor ports according to your robot's physical wiring. "
                                     "Left and Right motors control the drive base. "
                                     "Arm motors control additional mechanisms. "
                                     "Make sure each motor is assigned to a unique port.");
    motorInfoLabel->setObjectName("configDescription");
    motorInfoLabel->setWordWrap(true);
    
    motorInfoLayout->addWidget(motorInfoLabel);
    
    layout->addWidget(motorsGroup);
    layout->addWidget(motorInfoGroup);
    layout->addStretch();
}

void ConfigDialog::setupCalibrationTab() {
    calibrationTab = new QWidget();
    auto* layout = new QVBoxLayout(calibrationTab);
    layout->setContentsMargins(20, 20, 20, 20);
    layout->setSpacing(20);
    
    // Calibration Status Group
    calibrationStatusGroup = new QGroupBox("Calibration Status");
    calibrationStatusGroup->setObjectName("configGroup");
    auto* statusLayout = new QFormLayout(calibrationStatusGroup);
    statusLayout->setSpacing(15);
    
    calibrationStatusLabel = new QLabel("Not Calibrated");
    calibrationStatusLabel->setObjectName("calibrationStatus");
    
    calibrationDateLabel = new QLabel("Never");
    calibrationDateLabel->setObjectName("configDescription");
    
    calibrationQualityLabel = new QLabel("N/A");
    calibrationQualityLabel->setObjectName("configDescription");
    
    statusLayout->addRow("Status:", calibrationStatusLabel);
    statusLayout->addRow("Last Calibrated:", calibrationDateLabel);
    statusLayout->addRow("Quality Score:", calibrationQualityLabel);
    
    // Calibration Control Group
    calibrationControlGroup = new QGroupBox("Calibration Control");
    calibrationControlGroup->setObjectName("configGroup");
    auto* controlLayout = new QVBoxLayout(calibrationControlGroup);
    controlLayout->setSpacing(15);
    
    auto* buttonLayout = new QHBoxLayout();
    
    startCalibrationButton = new QPushButton("Start Calibration");
    startCalibrationButton->setObjectName("primaryButton");
    startCalibrationButton->setMinimumHeight(35);
    
    stopCalibrationButton = new QPushButton("Stop");
    stopCalibrationButton->setObjectName("secondaryButton");
    stopCalibrationButton->setMinimumHeight(35);
    stopCalibrationButton->setEnabled(false);
    
    clearCalibrationButton = new QPushButton("Clear Data");
    clearCalibrationButton->setObjectName("dangerButton");
    clearCalibrationButton->setMinimumHeight(35);
    
    buttonLayout->addWidget(startCalibrationButton);
    buttonLayout->addWidget(stopCalibrationButton);
    buttonLayout->addWidget(clearCalibrationButton);
    buttonLayout->addStretch();
    
    calibrationProgressBar = new QProgressBar();
    calibrationProgressBar->setObjectName("calibrationProgress");
    calibrationProgressBar->setVisible(false);
    calibrationProgressBar->setMinimumHeight(25);
    
    calibrationStepLabel = new QLabel("Ready to calibrate");
    calibrationStepLabel->setObjectName("configDescription");
    
    controlLayout->addLayout(buttonLayout);
    controlLayout->addWidget(calibrationProgressBar);
    controlLayout->addWidget(calibrationStepLabel);
    
    // Calibration Results Group
    calibrationResultsGroup = new QGroupBox("Calibration Results");
    calibrationResultsGroup->setObjectName("configGroup");
    auto* resultsLayout = new QVBoxLayout(calibrationResultsGroup);
    resultsLayout->setSpacing(10);
    
    calibrationResultsText = new QTextEdit();
    calibrationResultsText->setObjectName("calibrationResults");
    calibrationResultsText->setReadOnly(true);
    calibrationResultsText->setMinimumHeight(150);
    calibrationResultsText->setMaximumHeight(200);
    calibrationResultsText->setPlainText("No calibration data available");
    
    resultsLayout->addWidget(calibrationResultsText);
    
    // Connect signals
    connect(startCalibrationButton, &QPushButton::clicked, this, &ConfigDialog::startCalibration);
    connect(stopCalibrationButton, &QPushButton::clicked, this, &ConfigDialog::stopCalibration);
    connect(clearCalibrationButton, &QPushButton::clicked, this, &ConfigDialog::clearCalibrationData);
    
    // Layout
    layout->addWidget(calibrationStatusGroup);
    layout->addWidget(calibrationControlGroup);
    layout->addWidget(calibrationResultsGroup);
    layout->addStretch();
    
    // Update initial status
    updateCalibrationStatus();
}

void ConfigDialog::setupDialogStyle() {
    setStyleSheet(R"(
        QDialog {
            background-color: #2d2d30;
            color: #ffffff;
            font-family: Arial, sans-serif;
        }
        
        QWidget#dialogTitleBar {
            background-color: #1e1e1e;
            border-bottom: 1px solid #4a4a4a;
        }
        
        QLabel#dialogTitle {
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
        }
        
        QPushButton#dialogCloseBtn {
            background-color: #d83b01;
            border: none;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogCloseBtn:hover {
            background-color: #e74c3c;
        }
        
        QTabWidget#configTabs {
            background-color: #2d2d30;
            border: none;
        }
        
        QTabWidget#configTabs::pane {
            background-color: #2d2d30;
            border: 1px solid #4a4a4a;
            border-radius: 5px;
        }
        
        QTabWidget#configTabs::tab-bar {
            alignment: center;
        }
        
        QTabBar::tab {
            background-color: #3c3c3c;
            color: #ffffff;
            padding: 8px 16px;
            margin-right: 2px;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-size: 11px;
        }
        
        QTabBar::tab:selected {
            background-color: #0e639c;
            color: #ffffff;
        }
        
        QTabBar::tab:hover {
            background-color: #4a4a4a;
        }
        
        QGroupBox#configGroup {
            font-size: 12px;
            font-weight: bold;
            color: #ffffff;
            border: 1px solid #4a4a4a;
            border-radius: 5px;
            margin-top: 10px;
            padding-top: 10px;
        }
        
        QGroupBox#configGroup::title {
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 5px;
            color: #cccccc;
        }
        
        QLabel#configDescription {
            color: #b0b0b0;
            font-size: 10px;
            font-style: italic;
            margin-left: 10px;
        }
        

        
        QDoubleSpinBox#configSpinBox {
            background-color: #1e1e1e;
            border: 1px solid #4a4a4a;
            border-radius: 3px;
            padding: 5px;
            color: #ffffff;
            font-size: 11px;
        }
        
        QDoubleSpinBox#configSpinBox:focus {
            border-color: #0e639c;
        }
        
        QComboBox#configCombo {
            background-color: #1e1e1e;
            border: 1px solid #4a4a4a;
            border-radius: 3px;
            padding: 5px;
            color: #ffffff;
            font-size: 11px;
        }
        
        QComboBox#configCombo:focus {
            border-color: #0e639c;
        }
        
        QComboBox#configCombo::drop-down {
            subcontrol-origin: padding;
            subcontrol-position: top right;
            width: 20px;
            border: none;
        }
        
        QComboBox#configCombo::down-arrow {
            image: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+);
        }
        
        QComboBox#configCombo QAbstractItemView {
            background-color: #1e1e1e;
            border: 1px solid #4a4a4a;
            color: #ffffff;
            selection-background-color: #0e639c;
        }
        
        QCheckBox#advancedCheckBox {
            color: #ffffff;
            font-size: 11px;
        }
        
        QCheckBox#advancedCheckBox::indicator {
            width: 16px;
            height: 16px;
            border: 1px solid #4a4a4a;
            border-radius: 3px;
            background-color: #1e1e1e;
        }
        
        QCheckBox#advancedCheckBox::indicator:checked {
            background-color: #0e639c;
            border-color: #0e639c;
        }
        
        QDialogButtonBox#dialogButtonBox {
            background-color: transparent;
        }
        
        QPushButton {
            background-color: #3c3c3c;
            border: 1px solid #5a5a5a;
            color: #ffffff;
            font-size: 11px;
            border-radius: 3px;
            padding: 8px 16px;
            min-width: 80px;
        }
        
        QPushButton:hover {
            background-color: #4a4a4a;
            border-color: #6a6a6a;
        }
        
        QPushButton:pressed {
            background-color: #2a2a2a;
            border-color: #4a4a4a;
        }
        
        QPushButton#resetButton {
            background-color: #d83b01;
            border-color: #d83b01;
        }
        
        QPushButton#resetButton:hover {
            background-color: #e74c3c;
            border-color: #e74c3c;
        }
        
        QTextEdit#calibrationResults {
            background-color: #1e1e1e;
            border: 1px solid #4a4a4a;
            border-radius: 3px;
            color: #ffffff;
            font-family: 'Monaco', 'Menlo', 'Liberation Mono', 'Courier New', monospace;
            font-size: 10px;
            padding: 8px;
        }
        
        QTextEdit#calibrationResults:focus {
            border-color: #0e639c;
        }
        

    )");
}

void ConfigDialog::loadConfigValues() {
    // Safety checks to prevent crashes
    if (!axleTrackSpinBox || !wheelDiameterSpinBox || !straightSpeedSpinBox || 
        !straightAccelSpinBox || !turnRateSpinBox || !turnAccelSpinBox) {
        return;
    }
    
    if (!leftMotorCombo || !rightMotorCombo || !arm1MotorCombo || !arm2MotorCombo) {
        return;
    }

    axleTrackSpinBox->setValue(currentConfig.axleTrack);
    wheelDiameterSpinBox->setValue(currentConfig.wheelDiameter);
    straightSpeedSpinBox->setValue(currentConfig.straightSpeed);
    straightAccelSpinBox->setValue(currentConfig.straightAcceleration);
    turnRateSpinBox->setValue(currentConfig.turnRate);
    turnAccelSpinBox->setValue(currentConfig.turnAcceleration);
    
    // Use findText() with setCurrentIndex() for more reliable combo box selection
    int leftIndex = leftMotorCombo->findText(currentConfig.leftMotorPort);
    if (leftIndex >= 0) {
        leftMotorCombo->setCurrentIndex(leftIndex);
    }
    
    int rightIndex = rightMotorCombo->findText(currentConfig.rightMotorPort);
    if (rightIndex >= 0) {
        rightMotorCombo->setCurrentIndex(rightIndex);
    }
    
    int arm1Index = arm1MotorCombo->findText(currentConfig.arm1MotorPort);
    if (arm1Index >= 0) {
        arm1MotorCombo->setCurrentIndex(arm1Index);
    }
    
    int arm2Index = arm2MotorCombo->findText(currentConfig.arm2MotorPort);
    if (arm2Index >= 0) {
        arm2MotorCombo->setCurrentIndex(arm2Index);
    }
}

void ConfigDialog::connectSignals() {
    connect(buttonBox, &QDialogButtonBox::accepted, this, &ConfigDialog::onAccepted);
    connect(buttonBox, &QDialogButtonBox::rejected, this, &ConfigDialog::onRejected);
    connect(resetButton, &QPushButton::clicked, this, &ConfigDialog::resetToDefaults);

    connect(advancedCheckBox, &QCheckBox::toggled, this, &ConfigDialog::toggleAdvancedOptions);
}

void ConfigDialog::onAccepted() {
    // Safety checks to prevent crashes
    if (!axleTrackSpinBox || !wheelDiameterSpinBox || !straightSpeedSpinBox || 
        !straightAccelSpinBox || !turnRateSpinBox || !turnAccelSpinBox) {
        return;
    }
    
    if (!leftMotorCombo || !rightMotorCombo || !arm1MotorCombo || !arm2MotorCombo) {
        return;
    }

    currentConfig.axleTrack = axleTrackSpinBox->value();
    currentConfig.wheelDiameter = wheelDiameterSpinBox->value();
    currentConfig.straightSpeed = straightSpeedSpinBox->value();
    currentConfig.straightAcceleration = straightAccelSpinBox->value();
    currentConfig.turnRate = turnRateSpinBox->value();
    currentConfig.turnAcceleration = turnAccelSpinBox->value();
    
    currentConfig.leftMotorPort = leftMotorCombo->currentText();
    currentConfig.rightMotorPort = rightMotorCombo->currentText();
    currentConfig.arm1MotorPort = arm1MotorCombo->currentText();
    currentConfig.arm2MotorPort = arm2MotorCombo->currentText();
    
    QStringList usedPorts;
    usedPorts << currentConfig.leftMotorPort << currentConfig.rightMotorPort
              << currentConfig.arm1MotorPort << currentConfig.arm2MotorPort;
    
    QSet<QString> usedPortsSet(usedPorts.begin(), usedPorts.end());
    if (usedPortsSet.size() != usedPorts.size()) {
        QMessageBox::warning(this, "Configuration Error",
                           "Each motor must be assigned to a unique port. "
                           "Please check your motor port assignments.");
        return;
    }
    
    QDialog::accept();
}

void ConfigDialog::onRejected() {
    reject();
}

void ConfigDialog::toggleAdvancedOptions(bool checked) {
    tabWidget->setTabEnabled(2, checked);
    if (!checked && tabWidget->currentIndex() == 2) {
        tabWidget->setCurrentIndex(0);
    }
}

void ConfigDialog::resetToDefaults() {
    int ret = QMessageBox::question(this, "Reset Configuration",
                                   "Are you sure you want to reset all settings to default values?",
                                   QMessageBox::Yes | QMessageBox::No,
                                   QMessageBox::No);
    
    if (ret == QMessageBox::Yes) {
        RobotConfig defaults;
        currentConfig = defaults;
        loadConfigValues();
        validateInputs();
    }
}

void ConfigDialog::validateInputs() {
    // This method is kept for potential future validation needs
    // but the preview functionality has been removed
}

void ConfigDialog::onConfigChanged() {
    // Config change handling removed since preview is no longer needed
}

void ConfigDialog::onResetRequested() {
    resetToDefaults();
}

void ConfigDialog::onOkClicked() {
    onAccepted();
}

void ConfigDialog::onCancelClicked() {
    onRejected();
}

// Calibration Methods
void ConfigDialog::startCalibration() {
    if (!calibrationManager) {
        QMessageBox::warning(this, "Calibration Error", "Calibration manager not initialized");
        return;
    }
    
    if (calibrationManager->isCalibrating()) {
        showCalibrationInfoDialog("Calibration", "Calibration already in progress");
        return;
    }
    
    // Check if we can perform calibration
    bool canCalibrate = false;
    QString message;
    QString title = "Start Calibration";
    
    if (isDeveloperMode) {
        // Developer mode - can perform simulated calibration
        canCalibrate = true;
        message = "SIMULATED CALIBRATION MODE\n\n"
                 "This will perform a simulated calibration for testing the interface.\n"
                 "No real robot measurements will be performed.\n\n"
                 "To perform real calibration:\n"
                 "1. Connect to a real robot\n"
                 "2. Disable developer mode\n"
                 "3. Run calibration again\n\n"
                 "Continue with simulated calibration?";
    } else if (bleController && bleController->isConnected()) {
        // Real robot connected - can perform real calibration
        canCalibrate = true;
        // No warning dialog for real robot - start calibration immediately
        calibrationManager->startCalibration();
        return;
    } else {
        // No robot connected and not in developer mode - CANNOT calibrate
        showCalibrationInfoDialog("Cannot Start Calibration",
                               "Please enable developer mode or connect a robot to perform calibration.");
        return;
    }
    
    if (canCalibrate) {
        int ret = QMessageBox::question(this, title, message,
                                       QMessageBox::Yes | QMessageBox::No,
                                       QMessageBox::No);
        
        if (ret == QMessageBox::Yes) {
            calibrationManager->startCalibration();
        }
    }
}

void ConfigDialog::stopCalibration() {
    if (calibrationManager) {
        calibrationManager->stopCalibration();
    }
}

void ConfigDialog::clearCalibrationData() {
    int ret = QMessageBox::question(this, "Clear Calibration Data",
                                   "Are you sure you want to clear all calibration data?\n"
                                   "This will reset the robot to uncalibrated state.",
                                   QMessageBox::Yes | QMessageBox::No,
                                   QMessageBox::No);
    
    if (ret == QMessageBox::Yes) {
        currentConfig.clearCalibration();
        updateCalibrationStatus();
        updateCalibrationResults();
    }
}

void ConfigDialog::onCalibrationStarted() {
    enableCalibrationControls(false);
    calibrationProgressBar->setVisible(true);
    calibrationProgressBar->setValue(0);
    calibrationStepLabel->setText("Initializing calibration...");
    calibrationResultsText->clear();
    calibrationResultsText->append("=== Calibration Started ===\n");
}

void ConfigDialog::onCalibrationStepChanged(int step, const QString& description) {
    Q_UNUSED(step)
    calibrationStepLabel->setText(description);
    calibrationResultsText->append(QString("Step: %1").arg(description));
}

void ConfigDialog::onCalibrationProgress(int percentage) {
    calibrationProgressBar->setValue(percentage);
}

void ConfigDialog::onCalibrationCompleted(const RobotConfig& config) {
    currentConfig = config;
    
    enableCalibrationControls(true);
    calibrationProgressBar->setVisible(false);
    calibrationStepLabel->setText("Calibration completed successfully!");
    
    updateCalibrationStatus();
    updateCalibrationResults();
    
    // Show results
    QString results = config.getCalibrationSummary();
    calibrationResultsText->append("\n=== Calibration Completed ===\n");
    calibrationResultsText->append(results);
    
    QString message;
    if (isDeveloperMode) {
        message = QString("SIMULATED Calibration Completed!\n\n"
                         "Quality Score: %1%\n\n"
                         "⚠️  This was a SIMULATED calibration for testing.\n"
                         "No real robot measurements were performed.\n\n"
                         "To perform real calibration:\n"
                         "• Connect to a real robot\n"
                         "• Disable developer mode\n"
                         "• Run calibration again")
                 .arg(config.calibrationQuality, 0, 'f', 1);
    } else {
        message = QString("REAL Robot Calibration Completed!\n\n"
                         "Quality Score: %1%\n"
                         "The robot is now calibrated and ready for precision control.\n\n"
                         "Calibration data has been saved and will be applied\n"
                         "to all robot movements for improved accuracy.")
                 .arg(config.calibrationQuality, 0, 'f', 1);
    }
    
    showCalibrationResultsDialog(message);
}

void ConfigDialog::onCalibrationFailed(const QString& reason) {
    enableCalibrationControls(true);
    calibrationProgressBar->setVisible(false);
    calibrationStepLabel->setText("Calibration failed");
    
    calibrationResultsText->append(QString("\n=== Calibration Failed ===\n%1").arg(reason));
    
    showCalibrationFailedDialog(reason);
}

void ConfigDialog::updateCalibrationStatus() {
    if (currentConfig.hasValidCalibration()) {
        if (isDeveloperMode) {
            calibrationStatusLabel->setText("✓ Simulated");
            calibrationStatusLabel->setStyleSheet("color: #4CAF50; font-weight: bold;");
        } else {
            calibrationStatusLabel->setText("✓ Calibrated");
            calibrationStatusLabel->setStyleSheet("color: #4CAF50; font-weight: bold;");
        }
        calibrationDateLabel->setText(currentConfig.calibrationDate);
        calibrationQualityLabel->setText(QString("%1%").arg(currentConfig.calibrationQuality, 0, 'f', 1));
        
        // Enable clear button if calibrated
        clearCalibrationButton->setEnabled(true);
    } else {
        // Check if calibration is possible using the calibration manager
        bool canCalibrate = calibrationManager ? calibrationManager->canCalibrate() : false;
        
        if (canCalibrate) {
            calibrationStatusLabel->setText("✗ Not Calibrated");
            calibrationStatusLabel->setStyleSheet("color: #f44336; font-weight: bold;");
        } else {
            calibrationStatusLabel->setText("❌ Cannot Calibrate");
            calibrationStatusLabel->setStyleSheet("color: #9E9E9E; font-weight: bold;");
        }
        
        calibrationDateLabel->setText("Never");
        calibrationQualityLabel->setText("N/A");
        
        // Disable clear button if not calibrated
        clearCalibrationButton->setEnabled(false);
    }
}

void ConfigDialog::updateCalibrationResults() {
    if (currentConfig.hasValidCalibration()) {
        calibrationResultsText->setPlainText(currentConfig.getCalibrationSummary());
    } else {
        calibrationResultsText->setPlainText("No calibration data available");
    }
}

void ConfigDialog::enableCalibrationControls(bool enabled) {
    // Check if calibration is possible using the calibration manager
    bool canCalibrate = calibrationManager ? calibrationManager->canCalibrate() : false;
    
    startCalibrationButton->setEnabled(enabled && canCalibrate);
    stopCalibrationButton->setEnabled(!enabled);
    clearCalibrationButton->setEnabled(enabled && currentConfig.hasValidCalibration());
    
    // Update button text to indicate why calibration might be disabled
    if (!canCalibrate && enabled) {
        startCalibrationButton->setText("Start Calibration (Connect Robot)");
        startCalibrationButton->setToolTip("Connect to a robot or enable developer mode to calibrate");
    } else {
        startCalibrationButton->setText("Start Calibration");
        startCalibrationButton->setToolTip("");
    }
}

void ConfigDialog::showCalibrationResultsDialog(const QString& message) {
    // Create custom dialog with dark theme
    QDialog* resultsDialog = new QDialog(this);
    resultsDialog->setWindowTitle("Calibration Complete");
    resultsDialog->setModal(true);
    resultsDialog->setFixedSize(500, 400);
    resultsDialog->setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    
    auto* layout = new QVBoxLayout(resultsDialog);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);
    
    // Custom title bar
    auto* titleBar = new QWidget(resultsDialog);
    titleBar->setFixedHeight(40);
    titleBar->setObjectName("dialogTitleBar");
    
    auto* titleLayout = new QHBoxLayout(titleBar);
    titleLayout->setContentsMargins(15, 0, 15, 0);
    titleLayout->setSpacing(10);
    
    auto* titleLabel = new QLabel("Calibration Complete", titleBar);
    titleLabel->setObjectName("dialogTitle");
    titleLabel->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(titleLabel);
    titleLayout->addStretch();
    
    auto* closeButton = new QPushButton("X", titleBar);
    closeButton->setObjectName("dialogCloseBtn");
    closeButton->setFixedSize(30, 30);
    closeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(closeButton);
    
    connect(closeButton, &QPushButton::clicked, resultsDialog, &QDialog::accept);
    
    // Content area
    auto* contentWidget = new QWidget(resultsDialog);
    auto* contentLayout = new QVBoxLayout(contentWidget);
    contentLayout->setContentsMargins(20, 20, 20, 20);
    contentLayout->setSpacing(20);
    
    auto* messageLabel = new QLabel(message, contentWidget);
    messageLabel->setObjectName("dialogMessage");
    messageLabel->setWordWrap(true);
    messageLabel->setAlignment(Qt::AlignTop | Qt::AlignLeft);
    
    auto* okButton = new QPushButton("OK", contentWidget);
    okButton->setObjectName("dialogOkBtn");
    okButton->setFixedSize(80, 30);
    
    connect(okButton, &QPushButton::clicked, resultsDialog, &QDialog::accept);
    
    contentLayout->addWidget(messageLabel);
    contentLayout->addStretch();
    contentLayout->addWidget(okButton, 0, Qt::AlignCenter);
    
    layout->addWidget(titleBar);
    layout->addWidget(contentWidget);
    
    // Apply dark theme styling
    resultsDialog->setStyleSheet(R"(
        QDialog {
            background-color: #2d2d30;
            color: #ffffff;
            font-family: Arial, sans-serif;
        }
        
        QWidget#dialogTitleBar {
            background-color: #1e1e1e;
            border-bottom: 1px solid #4a4a4a;
        }
        
        QLabel#dialogTitle {
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
        }
        
        QLabel#dialogMessage {
            color: #ffffff;
            font-size: 11px;
            line-height: 1.4;
        }
        
        QPushButton#dialogCloseBtn {
            background-color: #d83b01;
            border: none;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogCloseBtn:hover {
            background-color: #e74c3c;
        }
        
        QPushButton#dialogOkBtn {
            background-color: #0e639c;
            border: none;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogOkBtn:hover {
            background-color: #1a7bb8;
        }
    )");
    
    resultsDialog->exec();
    resultsDialog->deleteLater();
}

void ConfigDialog::showCalibrationFailedDialog(const QString& reason) {
    // Create custom dialog with dark theme
    QDialog* failedDialog = new QDialog(this);
    failedDialog->setWindowTitle("Calibration Failed");
    failedDialog->setModal(true);
    failedDialog->setFixedSize(500, 300);
    failedDialog->setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    
    auto* layout = new QVBoxLayout(failedDialog);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);
    
    // Custom title bar
    auto* titleBar = new QWidget(failedDialog);
    titleBar->setFixedHeight(40);
    titleBar->setObjectName("dialogTitleBar");
    
    auto* titleLayout = new QHBoxLayout(titleBar);
    titleLayout->setContentsMargins(15, 0, 15, 0);
    titleLayout->setSpacing(10);
    
    auto* titleLabel = new QLabel("Calibration Failed", titleBar);
    titleLabel->setObjectName("dialogTitle");
    titleLabel->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(titleLabel);
    titleLayout->addStretch();
    
    auto* closeButton = new QPushButton("X", titleBar);
    closeButton->setObjectName("dialogCloseBtn");
    closeButton->setFixedSize(30, 30);
    closeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(closeButton);
    
    connect(closeButton, &QPushButton::clicked, failedDialog, &QDialog::accept);
    
    // Content area
    auto* contentWidget = new QWidget(failedDialog);
    auto* contentLayout = new QVBoxLayout(contentWidget);
    contentLayout->setContentsMargins(20, 20, 20, 20);
    contentLayout->setSpacing(20);
    
    QString message = QString("Calibration failed: %1\n\n"
                             "Please check the robot connection and try again.")
                     .arg(reason);
    
    auto* messageLabel = new QLabel(message, contentWidget);
    messageLabel->setObjectName("dialogMessage");
    messageLabel->setWordWrap(true);
    messageLabel->setAlignment(Qt::AlignTop | Qt::AlignLeft);
    
    auto* okButton = new QPushButton("OK", contentWidget);
    okButton->setObjectName("dialogOkBtn");
    okButton->setFixedSize(80, 30);
    
    connect(okButton, &QPushButton::clicked, failedDialog, &QDialog::accept);
    
    contentLayout->addWidget(messageLabel);
    contentLayout->addStretch();
    contentLayout->addWidget(okButton, 0, Qt::AlignCenter);
    
    layout->addWidget(titleBar);
    layout->addWidget(contentWidget);
    
    // Apply dark theme styling
    failedDialog->setStyleSheet(R"(
        QDialog {
            background-color: #2d2d30;
            color: #ffffff;
            font-family: Arial, sans-serif;
        }
        
        QWidget#dialogTitleBar {
            background-color: #1e1e1e;
            border-bottom: 1px solid #4a4a4a;
        }
        
        QLabel#dialogTitle {
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
        }
        
        QLabel#dialogMessage {
            color: #ffffff;
            font-size: 11px;
            line-height: 1.4;
        }
        
        QPushButton#dialogCloseBtn {
            background-color: #d83b01;
            border: none;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogCloseBtn:hover {
            background-color: #e74c3c;
        }
        
        QPushButton#dialogOkBtn {
            background-color: #0e639c;
            border: none;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogOkBtn:hover {
            background-color: #1a7bb8;
        }
    )");
    
    failedDialog->exec();
    failedDialog->deleteLater();
}

void ConfigDialog::showCalibrationInfoDialog(const QString& title, const QString& message) {
    // Create custom dialog with dark theme
    QDialog* infoDialog = new QDialog(this);
    infoDialog->setWindowTitle(title);
    infoDialog->setModal(true);
    infoDialog->setFixedSize(500, 300);
    infoDialog->setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    
    auto* layout = new QVBoxLayout(infoDialog);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);
    
    // Custom title bar
    auto* titleBar = new QWidget(infoDialog);
    titleBar->setFixedHeight(40);
    titleBar->setObjectName("dialogTitleBar");
    
    auto* titleLayout = new QHBoxLayout(titleBar);
    titleLayout->setContentsMargins(15, 0, 15, 0);
    titleLayout->setSpacing(10);
    
    auto* titleLabel = new QLabel(title, titleBar);
    titleLabel->setObjectName("dialogTitle");
    titleLabel->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(titleLabel);
    titleLayout->addStretch();
    
    auto* closeButton = new QPushButton("X", titleBar);
    closeButton->setObjectName("dialogCloseBtn");
    closeButton->setFixedSize(30, 30);
    closeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(closeButton);
    
    connect(closeButton, &QPushButton::clicked, infoDialog, &QDialog::accept);
    
    // Content area
    auto* contentWidget = new QWidget(infoDialog);
    auto* contentLayout = new QVBoxLayout(contentWidget);
    contentLayout->setContentsMargins(20, 20, 20, 20);
    contentLayout->setSpacing(20);
    
    auto* messageLabel = new QLabel(message, contentWidget);
    messageLabel->setObjectName("dialogMessage");
    messageLabel->setWordWrap(true);
    messageLabel->setAlignment(Qt::AlignTop | Qt::AlignLeft);
    
    auto* okButton = new QPushButton("OK", contentWidget);
    okButton->setObjectName("dialogOkBtn");
    okButton->setFixedSize(80, 30);
    
    connect(okButton, &QPushButton::clicked, infoDialog, &QDialog::accept);
    
    contentLayout->addWidget(messageLabel);
    contentLayout->addStretch();
    contentLayout->addWidget(okButton, 0, Qt::AlignCenter);
    
    layout->addWidget(titleBar);
    layout->addWidget(contentWidget);
    
    // Apply dark theme styling
    infoDialog->setStyleSheet(R"(
        QDialog {
            background-color: #2d2d30;
            color: #ffffff;
            font-family: Arial, sans-serif;
        }
        
        QWidget#dialogTitleBar {
            background-color: #1e1e1e;
            border-bottom: 1px solid #4a4a4a;
        }
        
        QLabel#dialogTitle {
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
        }
        
        QLabel#dialogMessage {
            color: #ffffff;
            font-size: 11px;
            line-height: 1.4;
        }
        
        QPushButton#dialogCloseBtn {
            background-color: #d83b01;
            border: none;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogCloseBtn:hover {
            background-color: #e74c3c;
        }
        
        QPushButton#dialogOkBtn {
            background-color: #0e639c;
            border: none;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
            border-radius: 3px;
        }
        
        QPushButton#dialogOkBtn:hover {
            background-color: #1a7bb8;
        }
    )");
    
    infoDialog->exec();
    infoDialog->deleteLater();
} 