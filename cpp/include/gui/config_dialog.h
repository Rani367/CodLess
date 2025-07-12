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
#include <memory>

#include "core/robot_config.h"

class ConfigDialog : public QDialog {
    Q_OBJECT

public:
    explicit ConfigDialog(QWidget* parent, const RobotConfig& config);
    ~ConfigDialog() override;
    
    RobotConfig getConfig() const;

private slots:
    void onConfigChanged();
    void onPreviewRequested();
    void onResetRequested();
    void onOkClicked();
    void onCancelClicked();
    void onAccepted();
    void onRejected();
    void toggleAdvancedOptions(bool checked);
    void resetToDefaults();
    void validateInputs();

private:
    void setupBasicTab();
    void setupAdvancedTab();
    void setupMotorsTab();
    void setupConnections();
    void updatePreview();
    void loadConfig();
    void saveConfig();
    void setupUi();
    void setupDialogStyle();
    void loadConfigValues();
    void connectSignals();
    
    QTabWidget *tabWidget;
    QWidget *basicTab;
    QWidget *motorsTab;
    QWidget *advancedTab;
    QPushButton *okButton;
    QPushButton *cancelButton;
    QPushButton *previewButton;
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
    QLabel* previewLabel;
    
    QCheckBox* advancedCheckBox;
    
    QDialogButtonBox* buttonBox;
    
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