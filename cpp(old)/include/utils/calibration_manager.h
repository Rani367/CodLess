#pragma once

#include <QObject>
#include <QTimer>
#include <QElapsedTimer>
#include <QVariantHash>
#include <QQueue>
#include <memory>
#include "core/robot_config.h"

class BLEController;
class RobotSimulator;

class CalibrationManager : public QObject {
    Q_OBJECT
    
public:
    enum CalibrationStep {
        StepNotStarted,
        StepMotorResponseTime,
        StepStraightTracking,
        StepTurnAccuracy,
        StepGyroscopeCalibration,
        StepMotorBalance,
        StepFinalization,
        StepCompleted
    };
    
    struct CalibrationResult {
        bool success = false;
        QString stepName;
        double measuredValue = 0.0;
        QString units;
        QString description;
        double confidence = 0.0;  // 0-1 confidence in measurement
    };
    
    explicit CalibrationManager(QObject* parent = nullptr);
    ~CalibrationManager() override;
    
    // Configuration
    void setBLEController(BLEController* controller);
    void setRobotSimulator(RobotSimulator* simulator);
    void setDeveloperMode(bool enabled);
    
    // Calibration control
    void startCalibration();
    void stopCalibration();
    bool isCalibrating() const { return calibrationRunning; }
    bool canCalibrate() const;
    
    // Results
    RobotConfig getCalibrationResult() const { return calibratedConfig; }
    QList<CalibrationResult> getDetailedResults() const { return calibrationResults; }
    
signals:
    void calibrationStarted();
    void calibrationStepChanged(CalibrationStep step, const QString& description);
    void calibrationProgress(int percentage);
    void calibrationStepCompleted(const CalibrationResult& result);
    void calibrationCompleted(const RobotConfig& config);
    void calibrationFailed(const QString& reason);
    
private slots:
    void processCalibrationStep();
    void handleRobotResponse(const QVariantHash& response);
    void onCalibrationTimeout();
    
private:
    // Core calibration routines
    void calibrateMotorResponseTime();
    void calibrateStraightTracking();
    void calibrateTurnAccuracy();
    void calibrateGyroscope();
    void calibrateMotorBalance();
    void finalizeCalibration();
    
    // Helper methods
    void sendCalibrationCommand(const QVariantHash& command);
    void completeCurrentStep(bool success, double measuredValue, const QString& description);
    void nextStep();
    void resetCalibration();
    double calculateConfidence(double value, double expectedRange);
    
    // Data collection
    void collectMotorPositions();
    void collectGyroscopeReading();
    void collectTimestamp();
    
    // Analysis
    void analyzeMotorResponse();
    void analyzeStraightTracking();
    void analyzeTurnAccuracy();
    void analyzeGyroscopeData();
    void analyzeMotorBalance();
    
    // State management
    BLEController* bleController = nullptr;
    RobotSimulator* robotSimulator = nullptr;
    bool isDeveloperMode = false;
    bool calibrationRunning = false;
    
    // Calibration process
    CalibrationStep currentStep = StepNotStarted;
    QTimer* stepTimer = nullptr;
    QTimer* timeoutTimer = nullptr;
    QElapsedTimer stepElapsedTimer;
    
    // Data collection
    QQueue<QVariantHash> pendingCommands;
    QList<QVariantHash> collectedData;
    QList<CalibrationResult> calibrationResults;
    
    // Configuration
    RobotConfig calibratedConfig;
    int maxRetries = 3;
    int currentRetry = 0;
    int timeoutDuration = 10000; // 10 seconds per step
    
    // Measurement data
    struct MeasurementData {
        QList<double> timestamps;
        QList<double> motorPositions;
        QList<double> gyroscopeReadings;
        QList<QPointF> robotPositions;
        double startTime = 0.0;
        double endTime = 0.0;
    } measurementData;
    
    // Calibration parameters
    static constexpr double MOTOR_RESPONSE_TEST_SPEED = 200.0;
    static constexpr double STRAIGHT_TEST_DISTANCE = 500.0; // mm
    static constexpr double TURN_TEST_ANGLE = 90.0; // degrees
    static constexpr int MEASUREMENT_SAMPLES = 10;
    static constexpr double QUALITY_THRESHOLD = 75.0; // Minimum quality score
}; 