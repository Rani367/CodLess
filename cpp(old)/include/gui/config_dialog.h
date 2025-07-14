#pragma once

#include <QDialog>
#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFormLayout>
#include <QLabel>
#include <QPushButton>
#include <QLineEdit>
#include <QDoubleSpinBox>
#include <QComboBox>
#include <QCheckBox>
#include <QGroupBox>
#include <QTabWidget>
#include <QDialogButtonBox>
#include <QProgressBar>
#include <QTextEdit>
#include <QScrollArea>
#include <QGridLayout>
#include <memory>

#include "core/robot_config.h"

class CalibrationManager;
class BLEController;
class RobotSimulator;

class ConfigDialog : public QDialog {
    Q_OBJECT

public:
    explicit ConfigDialog(QWidget* parent, const RobotConfig& config);
    ~ConfigDialog() override;
    
    RobotConfig getConfig() const;
    
    // Calibration setup
    void setBLEController(BLEController* controller);
    void setRobotSimulator(RobotSimulator* simulator);
    void setDeveloperMode(bool enabled);

private slots:
    void onConfigChanged();
    void onResetRequested();
    void onOkClicked();
    void onCancelClicked();
    void onAccepted();
    void onRejected();
    void toggleAdvancedOptions(bool checked);
    void resetToDefaults();
    void validateInputs();
    
    // Calibration slots
    void startCalibration();
    void stopCalibration();
    void clearCalibrationData();
    void onCalibrationStarted();
    void onCalibrationStepChanged(int step, const QString& description);
    void onCalibrationProgress(int percentage);
    void onCalibrationCompleted(const RobotConfig& config);
    void onCalibrationFailed(const QString& reason);

private:
    void setupBasicTab();
    void setupAdvancedTab();
    void setupMotorsTab();
    void setupCalibrationTab();
    void setupConnections();
    void loadConfig();
    void saveConfig();
    void setupUi();
    void setupDialogStyle();
    void loadConfigValues();
    void connectSignals();
    
    // Calibration methods
    void updateCalibrationStatus();
    void updateCalibrationResults();
    void enableCalibrationControls(bool enabled);
    void showCalibrationResultsDialog(const QString& message);
    void showCalibrationFailedDialog(const QString& reason);
    void showCalibrationInfoDialog(const QString& title, const QString& message);
    
    QTabWidget *tabWidget;
    QWidget *basicTab;
    QWidget *motorsTab;
    QWidget *advancedTab;
    QWidget *calibrationTab;
    QPushButton *okButton;
    QPushButton *cancelButton;
    QPushButton *resetButton;
    
    // Basic tab widgets
    QDoubleSpinBox *axleTrackSpinBox;
    QDoubleSpinBox *wheelDiameterSpinBox;
    QComboBox *leftMotorCombo;
    QComboBox *rightMotorCombo;
    QComboBox *arm1MotorCombo;
    QComboBox *arm2MotorCombo;
    QDoubleSpinBox *straightSpeedSpinBox;
    QDoubleSpinBox *straightAccelSpinBox;
    QDoubleSpinBox *turnRateSpinBox;
    QDoubleSpinBox *turnAccelSpinBox;
    
    // Advanced tab widgets
    QDoubleSpinBox *maxDriveSpeedSpinBox;
    QDoubleSpinBox *maxTurnSpeedSpinBox;
    QDoubleSpinBox *maxArmSpeedSpinBox;
    QDoubleSpinBox *maxDriveAccelSpinBox;
    QDoubleSpinBox *maxTurnAccelSpinBox;
    QDoubleSpinBox *maxArmAccelSpinBox;
    
    // Calibration tab widgets
    QLabel *calibrationStatusLabel;
    QLabel *calibrationDateLabel;
    QLabel *calibrationQualityLabel;
    QPushButton *startCalibrationButton;
    QPushButton *stopCalibrationButton;
    QPushButton *clearCalibrationButton;
    QProgressBar *calibrationProgressBar;
    QLabel *calibrationStepLabel;
    QTextEdit *calibrationResultsText;
    QScrollArea *calibrationScrollArea;
    QGroupBox *calibrationStatusGroup;
    QGroupBox *calibrationControlGroup;
    QGroupBox *calibrationResultsGroup;
    
    // Motors tab widgets
    QLineEdit *leftMotorPortLineEdit;
    QLineEdit *rightMotorPortLineEdit;
    QLineEdit *arm1MotorPortLineEdit;
    QLineEdit *arm2MotorPortLineEdit;
    QCheckBox *leftMotorReverseCheckBox;
    QCheckBox *rightMotorReverseCheckBox;
    QCheckBox *arm1MotorReverseCheckBox;
    QCheckBox *arm2MotorReverseCheckBox;
    
    RobotConfig config;
    RobotConfig originalConfig;
    RobotConfig currentConfig;
    
    QLabel* axleTrackLabel;
    QLabel* wheelDiameterLabel;
    
    QCheckBox* advancedCheckBox;
    
    QDialogButtonBox* buttonBox;
    
    // Calibration system
    CalibrationManager* calibrationManager;
    BLEController* bleController = nullptr;
    RobotSimulator* robotSimulator = nullptr;
    bool isDeveloperMode = false;
    
    static constexpr double MIN_AXLE_TRACK = 50.0;
    static constexpr double MAX_AXLE_TRACK = 300.0;
    static constexpr double MIN_WHEEL_DIAMETER = 20.0;
    static constexpr double MAX_WHEEL_DIAMETER = 100.0;
    static constexpr double MIN_SPEED = 100.0;
    static constexpr double MAX_SPEED = 1000.0;
    static constexpr double MIN_ACCELERATION = 50.0;
    static constexpr double MAX_ACCELERATION = 500.0;
    static constexpr double MIN_TURN_RATE = 50.0;
    static constexpr double MAX_TURN_RATE = 500.0;
    static constexpr double MIN_TURN_ACCEL = 50.0;
    static constexpr double MAX_TURN_ACCEL = 600.0;
}; 