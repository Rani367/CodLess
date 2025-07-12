#include "gui/config_dialog.h"
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
{
    setWindowTitle("Robot Configuration");
    setModal(true);
    setFixedSize(500, 600);
    
    setAttribute(Qt::WA_DeleteOnClose);
    setWindowFlags(Qt::Dialog | Qt::MSWindowsFixedSizeDialogHint);
    
    setupUi();
    setupDialogStyle();
    loadConfigValues();
    connectSignals();
    
    QRect parentGeometry = parent->geometry();
    int x = parentGeometry.x() + (parentGeometry.width() - width()) / 2;
    int y = parentGeometry.y() + (parentGeometry.height() - height()) / 2;
    move(x, y);
    
    setWindowOpacity(0.0);
    
    QPropertyAnimation* fadeIn = new QPropertyAnimation(this, "windowOpacity");
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

void ConfigDialog::setupUi() {
    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(20, 20, 20, 20);
    mainLayout->setSpacing(20);
    
    auto* titleLabel = new QLabel("Robot Configuration");
    titleLabel->setObjectName("dialogTitle");
    titleLabel->setAlignment(Qt::AlignCenter);
    titleLabel->setFont(QFont("Arial", 16, QFont::Bold));
    
    tabWidget = new QTabWidget();
    tabWidget->setObjectName("configTabs");
    
    setupBasicTab();
    setupAdvancedTab();
    setupMotorsTab();
    
    tabWidget->addTab(basicTab, "Basic Settings");
    tabWidget->addTab(motorsTab, "Motor Ports");
    tabWidget->addTab(advancedTab, "Advanced");
    
    advancedCheckBox = new QCheckBox("Show Advanced Options");
    advancedCheckBox->setObjectName("advancedCheckBox");
    
    buttonBox = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel);
    buttonBox->setObjectName("dialogButtonBox");
    
    resetButton = new QPushButton("Reset to Defaults");
    resetButton->setObjectName("resetButton");
    buttonBox->addButton(resetButton, QDialogButtonBox::ResetRole);
    
    previewButton = new QPushButton("Preview Changes");
    previewButton->setObjectName("previewButton");
    buttonBox->addButton(previewButton, QDialogButtonBox::ActionRole);
    
    mainLayout->addWidget(titleLabel);
    mainLayout->addWidget(tabWidget);
    mainLayout->addWidget(advancedCheckBox);
    mainLayout->addWidget(buttonBox);
    
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
    
    previewLabel = new QLabel("Configuration Preview:\nNo changes made");
    previewLabel->setObjectName("configPreview");
    previewLabel->setWordWrap(true);
    
    infoLayout->addWidget(infoLabel);
    infoLayout->addWidget(previewLabel);
    
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

void ConfigDialog::setupDialogStyle() {
    setStyleSheet(R"(
        QDialog {
            background-color: #2d2d30;
            color: #ffffff;
            font-family: Arial, sans-serif;
        }
        
        QLabel#dialogTitle {
            color: #ffffff;
            font-size: 16px;
            font-weight: bold;
            padding: 10px;
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
        
        QLabel#configPreview {
            color: #cccccc;
            font-size: 10px;
            font-family: Consolas, monospace;
            background-color: #1e1e1e;
            border: 1px solid #4a4a4a;
            border-radius: 3px;
            padding: 10px;
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
        
        QPushButton#previewButton {
            background-color: #0e639c;
            border-color: #0e639c;
        }
        
        QPushButton#previewButton:hover {
            background-color: #1177bb;
            border-color: #1177bb;
        }
    )");
}

void ConfigDialog::loadConfigValues() {
    axleTrackSpinBox->setValue(currentConfig.axleTrack);
    wheelDiameterSpinBox->setValue(currentConfig.wheelDiameter);
    straightSpeedSpinBox->setValue(currentConfig.straightSpeed);
    straightAccelSpinBox->setValue(currentConfig.straightAcceleration);
    turnRateSpinBox->setValue(currentConfig.turnRate);
    turnAccelSpinBox->setValue(currentConfig.turnAcceleration);
    
    leftMotorCombo->setCurrentText(currentConfig.leftMotorPort);
    rightMotorCombo->setCurrentText(currentConfig.rightMotorPort);
    arm1MotorCombo->setCurrentText(currentConfig.arm1MotorPort);
    arm2MotorCombo->setCurrentText(currentConfig.arm2MotorPort);
}

void ConfigDialog::connectSignals() {
    connect(buttonBox, &QDialogButtonBox::accepted, this, &ConfigDialog::onAccepted);
    connect(buttonBox, &QDialogButtonBox::rejected, this, &ConfigDialog::onRejected);
    connect(resetButton, &QPushButton::clicked, this, &ConfigDialog::resetToDefaults);
    connect(previewButton, &QPushButton::clicked, this, &ConfigDialog::validateInputs);
    connect(advancedCheckBox, &QCheckBox::toggled, this, &ConfigDialog::toggleAdvancedOptions);
    
    connect(axleTrackSpinBox, QOverload<double>::of(&QDoubleSpinBox::valueChanged),
            this, &ConfigDialog::validateInputs);
    connect(wheelDiameterSpinBox, QOverload<double>::of(&QDoubleSpinBox::valueChanged),
            this, &ConfigDialog::validateInputs);
}

void ConfigDialog::onAccepted() {
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
    
    accept();
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
    QString preview = QString("Configuration Preview:\n"
                            "Axle Track: %1 mm\n"
                            "Wheel Diameter: %2 mm\n"
                            "Straight Speed: %3 mm/s\n"
                            "Straight Accel: %4 mm/s²\n"
                            "Turn Rate: %5 °/s\n"
                            "Turn Accel: %6 °/s²\n"
                            "Motors: L=%7, R=%8, A1=%9, A2=%10")
                    .arg(axleTrackSpinBox->value(), 0, 'f', 1)
                    .arg(wheelDiameterSpinBox->value(), 0, 'f', 1)
                    .arg(straightSpeedSpinBox->value(), 0, 'f', 0)
                    .arg(straightAccelSpinBox->value(), 0, 'f', 0)
                    .arg(turnRateSpinBox->value(), 0, 'f', 0)
                    .arg(turnAccelSpinBox->value(), 0, 'f', 0)
                    .arg(leftMotorCombo->currentText())
                    .arg(rightMotorCombo->currentText())
                    .arg(arm1MotorCombo->currentText())
                    .arg(arm2MotorCombo->currentText());
    
    previewLabel->setText(preview);
}

void ConfigDialog::onConfigChanged() {
    validateInputs();
}

void ConfigDialog::onPreviewRequested() {
    validateInputs();
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