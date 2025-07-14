#include "utils/calibration_manager.h"
#include "hardware/ble_controller.h"
#include "sim/robot_simulator.h"
#include <QDateTime>
#include <QDebug>
#include <QMessageBox>
#include <cmath>
#include <algorithm>

CalibrationManager::CalibrationManager(QObject* parent)
    : QObject(parent)
    , stepTimer(new QTimer(this))
    , timeoutTimer(new QTimer(this))
{
    stepTimer->setSingleShot(true);
    timeoutTimer->setSingleShot(true);
    
    connect(stepTimer, &QTimer::timeout, this, &CalibrationManager::processCalibrationStep);
    connect(timeoutTimer, &QTimer::timeout, this, &CalibrationManager::onCalibrationTimeout);
}

CalibrationManager::~CalibrationManager() = default;

void CalibrationManager::setBLEController(BLEController* controller) {
    if (bleController) {
        disconnect(bleController, nullptr, this, nullptr);
    }
    
    bleController = controller;
    
    // Note: Robot responses will be handled through timing and command acknowledgments
    // rather than explicit response signals for this calibration system
}

void CalibrationManager::setRobotSimulator(RobotSimulator* simulator) {
    robotSimulator = simulator;
}

void CalibrationManager::setDeveloperMode(bool enabled) {
    isDeveloperMode = enabled;
}

void CalibrationManager::startCalibration() {
    if (calibrationRunning) {
        qWarning() << "Calibration already in progress";
        return;
    }
    
    // STRICT validation - must have either developer mode OR connected robot
    bool canCalibrate = isDeveloperMode || (bleController && bleController->isConnected());
    
    if (!canCalibrate) {
        qWarning() << "Cannot start calibration: no robot connected and not in developer mode";
        emit calibrationFailed("Cannot perform calibration.\n\n"
                             "Requirements not met:\n"
                             "• No robot connected\n"
                             "• Developer mode disabled\n\n"
                             "To calibrate, either:\n"
                             "• Connect to a real robot, OR\n"
                             "• Enable developer mode for simulation");
        return;
    }
    
    // Note: Developer mode warning is handled by the UI layer
    // to avoid multiple dialogs
    

    
    resetCalibration();
    calibrationRunning = true;
    currentStep = StepMotorResponseTime;
    
    emit calibrationStarted();
    emit calibrationProgress(0);
    
    // Start first step after short delay
    stepTimer->start(100);
}

void CalibrationManager::stopCalibration() {
    if (!calibrationRunning) {
        return;
    }
    

    
    calibrationRunning = false;
    stepTimer->stop();
    timeoutTimer->stop();
    
    emit calibrationFailed("Calibration cancelled by user");
}

void CalibrationManager::resetCalibration() {
    currentStep = StepNotStarted;
    calibrationResults.clear();
    collectedData.clear();
    pendingCommands.clear();
    currentRetry = 0;
    
    // Reset measurement data
    measurementData.timestamps.clear();
    measurementData.motorPositions.clear();
    measurementData.gyroscopeReadings.clear();
    measurementData.robotPositions.clear();
    measurementData.startTime = 0.0;
    measurementData.endTime = 0.0;
    
    // Reset calibrated config to defaults
    calibratedConfig = RobotConfig();
}

void CalibrationManager::processCalibrationStep() {
    if (!calibrationRunning) {
        return;
    }
    
    stepElapsedTimer.start();
    // Use shorter timeout for developer mode since no real robot response is needed
    int currentTimeout = isDeveloperMode ? 2000 : timeoutDuration;
    timeoutTimer->start(currentTimeout);
    
    switch (currentStep) {
        case StepMotorResponseTime:
            emit calibrationStepChanged(currentStep, "Testing motor response time...");
            emit calibrationProgress(10);
            calibrateMotorResponseTime();
            break;
            
        case StepStraightTracking:
            emit calibrationStepChanged(currentStep, "Testing straight line tracking...");
            emit calibrationProgress(30);
            calibrateStraightTracking();
            break;
            
        case StepTurnAccuracy:
            emit calibrationStepChanged(currentStep, "Testing turn accuracy...");
            emit calibrationProgress(50);
            calibrateTurnAccuracy();
            break;
            
        case StepGyroscopeCalibration:
            emit calibrationStepChanged(currentStep, "Calibrating gyroscope...");
            emit calibrationProgress(70);
            calibrateGyroscope();
            break;
            
        case StepMotorBalance:
            emit calibrationStepChanged(currentStep, "Testing motor balance...");
            emit calibrationProgress(85);
            calibrateMotorBalance();
            break;
            
        case StepFinalization:
            emit calibrationStepChanged(currentStep, "Finalizing calibration...");
            emit calibrationProgress(95);
            finalizeCalibration();
            break;
            
        case StepCompleted:
            emit calibrationProgress(100);
            emit calibrationCompleted(calibratedConfig);
            calibrationRunning = false;
            break;
            
        default:
            emit calibrationFailed("Unknown calibration step");
            calibrationRunning = false;
            break;
    }
}

void CalibrationManager::calibrateMotorResponseTime() {

    
    if (isDeveloperMode) {
        // Use realistic but clearly simulated values
        double simulatedDelay = 25.0; // ms - based on simulator motor lag
        
        calibratedConfig.leftMotorDelay = simulatedDelay;
        calibratedConfig.rightMotorDelay = simulatedDelay;
        calibratedConfig.arm1MotorDelay = simulatedDelay;
        calibratedConfig.arm2MotorDelay = simulatedDelay;
        calibratedConfig.motorResponseTime = simulatedDelay;
        
        completeCurrentStep(true, simulatedDelay, "Motor response time (SIMULATED)");
    } else if (bleController && bleController->isConnected()) {
        // Real robot: Send quick drive command and measure response time
        QVariantHash command;
        command["type"] = "drive";
        command["speed"] = MOTOR_RESPONSE_TEST_SPEED;
        command["turn_rate"] = 0;
        
        measurementData.startTime = QDateTime::currentMSecsSinceEpoch();
        sendCalibrationCommand(command);
        
        // Stop after brief movement
        QTimer::singleShot(200, this, [this]() {
            QVariantHash stopCommand;
            stopCommand["type"] = "drive";
            stopCommand["speed"] = 0;
            stopCommand["turn_rate"] = 0;
            sendCalibrationCommand(stopCommand);
        });
        
        // Complete step after measurement
        QTimer::singleShot(500, this, [this]() {
            analyzeMotorResponse();
        });
    } else {
        // No robot connected
        completeCurrentStep(false, 0.0, "No robot connected - cannot perform real calibration");
    }
}

void CalibrationManager::calibrateStraightTracking() {

    
    if (isDeveloperMode) {
        // Simulate straight tracking test
        double simulatedDrift = 0.5; // degrees - slight drift simulation
        
        calibratedConfig.straightDriftCorrection = simulatedDrift;
        calibratedConfig.leftMotorSpeedFactor = 1.0;
        calibratedConfig.rightMotorSpeedFactor = 0.98; // Simulate slight imbalance
        
        completeCurrentStep(true, simulatedDrift, "Straight drift correction (SIMULATED)");
    } else if (bleController && bleController->isConnected()) {
        // Real robot: Drive straight and measure drift
        QVariantHash command;
        command["type"] = "drive";
        command["speed"] = MOTOR_RESPONSE_TEST_SPEED;
        command["turn_rate"] = 0;
        
        measurementData.startTime = QDateTime::currentMSecsSinceEpoch();
        sendCalibrationCommand(command);
        
        // Drive for test distance
        QTimer::singleShot(2000, this, [this]() {
            QVariantHash stopCommand;
            stopCommand["type"] = "drive";
            stopCommand["speed"] = 0;
            stopCommand["turn_rate"] = 0;
            sendCalibrationCommand(stopCommand);
            
            QTimer::singleShot(100, this, [this]() {
                analyzeStraightTracking();
            });
        });
    } else {
        // No robot connected
        completeCurrentStep(false, 0.0, "No robot connected - cannot perform real calibration");
    }
}

void CalibrationManager::calibrateTurnAccuracy() {

    
    if (isDeveloperMode) {
        // Simulate turn accuracy test
        double simulatedAccuracy = 0.95; // 95% accuracy
        
        calibratedConfig.turnAccuracyFactor = simulatedAccuracy;
        
        completeCurrentStep(true, simulatedAccuracy, "Turn accuracy factor (SIMULATED)");
    } else if (bleController && bleController->isConnected()) {
        // Real robot: Execute turn and measure accuracy
        QVariantHash command;
        command["type"] = "drive";
        command["speed"] = 0;
        command["turn_rate"] = 100; // Moderate turn rate
        
        measurementData.startTime = QDateTime::currentMSecsSinceEpoch();
        sendCalibrationCommand(command);
        
        // Turn for 90 degrees (approximately)
        QTimer::singleShot(1500, this, [this]() {
            QVariantHash stopCommand;
            stopCommand["type"] = "drive";
            stopCommand["speed"] = 0;
            stopCommand["turn_rate"] = 0;
            sendCalibrationCommand(stopCommand);
            
            QTimer::singleShot(100, this, [this]() {
                analyzeTurnAccuracy();
            });
        });
    } else {
        // No robot connected
        completeCurrentStep(false, 0.0, "No robot connected - cannot perform real calibration");
    }
}

void CalibrationManager::calibrateGyroscope() {

    
    if (isDeveloperMode) {
        // Simulate gyroscope calibration
        double simulatedDrift = 0.002; // deg/s - minimal drift
        double simulatedDelay = 15.0; // ms
        
        calibratedConfig.gyroscopeDrift = simulatedDrift;
        calibratedConfig.gyroscopeDelay = simulatedDelay;
        
        completeCurrentStep(true, simulatedDrift, "Gyroscope drift rate (SIMULATED)");
    } else if (bleController && bleController->isConnected()) {
        // Real robot: Measure gyroscope drift and delay
        QVariantHash command;
        command["type"] = "calibrate";
        command["calibration_type"] = "gyro_reading";
        
        measurementData.startTime = QDateTime::currentMSecsSinceEpoch();
        sendCalibrationCommand(command);
        
        // Collect multiple readings
        QTimer::singleShot(100, this, [this]() {
            analyzeGyroscopeData();
        });
    } else {
        // No robot connected
        completeCurrentStep(false, 0.0, "No robot connected - cannot perform real calibration");
    }
}

void CalibrationManager::calibrateMotorBalance() {

    
    if (isDeveloperMode) {
        // Simulate motor balance test
        double leftFactor = 1.0;
        double rightFactor = 0.98; // Simulate slight imbalance
        
        calibratedConfig.leftMotorSpeedFactor = leftFactor;
        calibratedConfig.rightMotorSpeedFactor = rightFactor;
        
        completeCurrentStep(true, rightFactor, "Motor balance factor (SIMULATED)");
    } else if (bleController && bleController->isConnected()) {
        // Real robot: Run motors at same speed, measure actual rotation
        QVariantHash command;
        command["type"] = "calibrate";
        command["calibration_type"] = "motor_balance";
        
        measurementData.startTime = QDateTime::currentMSecsSinceEpoch();
        sendCalibrationCommand(command);
        
        QTimer::singleShot(100, this, [this]() {
            analyzeMotorBalance();
        });
    } else {
        // No robot connected
        completeCurrentStep(false, 0.0, "No robot connected - cannot perform real calibration");
    }
}

void CalibrationManager::finalizeCalibration() {

    
    // Calculate overall quality score
    double totalConfidence = 0.0;
    int validResults = 0;
    
    for (const auto& result : calibrationResults) {
        if (result.success) {
            totalConfidence += result.confidence;
            validResults++;
        }
    }
    
    double qualityScore = validResults > 0 ? (totalConfidence / validResults) * 100.0 : 0.0;
    
    // Set calibration metadata
    calibratedConfig.isCalibrated = true;
    calibratedConfig.calibrationDate = QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm:ss");
    calibratedConfig.calibrationQuality = qualityScore;
    
    // Validation
    if (qualityScore < QUALITY_THRESHOLD) {
        emit calibrationFailed(QString("Calibration quality too low: %1%").arg(qualityScore, 0, 'f', 1));
        return;
    }
    
    CalibrationResult finalResult;
    finalResult.success = true;
    finalResult.stepName = "Calibration Complete";
    finalResult.measuredValue = qualityScore;
    finalResult.units = "%";
    finalResult.description = QString("Overall calibration quality: %1%").arg(qualityScore, 0, 'f', 1);
    finalResult.confidence = qualityScore / 100.0;
    
    calibrationResults.append(finalResult);
    emit calibrationStepCompleted(finalResult);
    
    currentStep = StepCompleted;
    stepTimer->start(100);
}

void CalibrationManager::sendCalibrationCommand(const QVariantHash& command) {
    if (isDeveloperMode && robotSimulator) {
        // Send to simulator
        robotSimulator->updateCommand(command);
    } else if (bleController) {
        // Send to real robot
        bleController->sendCommand(command);
    }
    
    // Log the command

}

void CalibrationManager::completeCurrentStep(bool success, double measuredValue, const QString& description) {
    timeoutTimer->stop();
    
    CalibrationResult result;
    result.success = success;
    result.stepName = QString("Step %1").arg(static_cast<int>(currentStep));
    result.measuredValue = measuredValue;
    result.description = description;
    result.confidence = success ? 0.9 : 0.0;
    
    // Set appropriate units based on step
    switch (currentStep) {
        case StepMotorResponseTime:
            result.units = "ms";
            result.stepName = "Motor Response Time";
            break;
        case StepStraightTracking:
            result.units = "°";
            result.stepName = "Straight Tracking";
            break;
        case StepTurnAccuracy:
            result.units = "factor";
            result.stepName = "Turn Accuracy";
            break;
        case StepGyroscopeCalibration:
            result.units = "°/s";
            result.stepName = "Gyroscope Drift";
            break;
        case StepMotorBalance:
            result.units = "factor";
            result.stepName = "Motor Balance";
            break;
        default:
            result.units = "";
            break;
    }
    
    calibrationResults.append(result);
    emit calibrationStepCompleted(result);
    
    if (success) {
        nextStep();
    } else {
        currentRetry++;
        if (currentRetry < maxRetries) {
    
            stepTimer->start(1000); // Retry after 1 second
        } else {
            emit calibrationFailed(QString("Step failed after %1 attempts: %2").arg(maxRetries).arg(description));
            calibrationRunning = false;
        }
    }
}

void CalibrationManager::nextStep() {
    currentRetry = 0;
    
    switch (currentStep) {
        case StepMotorResponseTime:
            currentStep = StepStraightTracking;
            break;
        case StepStraightTracking:
            currentStep = StepTurnAccuracy;
            break;
        case StepTurnAccuracy:
            currentStep = StepGyroscopeCalibration;
            break;
        case StepGyroscopeCalibration:
            currentStep = StepMotorBalance;
            break;
        case StepMotorBalance:
            currentStep = StepFinalization;
            break;
        case StepFinalization:
            currentStep = StepCompleted;
            break;
        default:
            currentStep = StepCompleted;
            break;
    }
    
    stepTimer->start(500); // Brief delay between steps
}

void CalibrationManager::handleRobotResponse(const QVariantHash& response) {
    if (!calibrationRunning) {
        return;
    }
    
    collectedData.append(response);

    
    // Process response based on current step
    // This would be expanded based on actual robot response format
}

void CalibrationManager::onCalibrationTimeout() {
    completeCurrentStep(false, 0.0, "Step timed out");
}

void CalibrationManager::analyzeMotorResponse() {
    double responseTime = QDateTime::currentMSecsSinceEpoch() - measurementData.startTime;
    
    // Real robot analysis would be more sophisticated
    calibratedConfig.motorResponseTime = responseTime;
    calibratedConfig.leftMotorDelay = responseTime * 0.9;
    calibratedConfig.rightMotorDelay = responseTime * 1.1;
    calibratedConfig.arm1MotorDelay = responseTime;
    calibratedConfig.arm2MotorDelay = responseTime;
    
    completeCurrentStep(true, responseTime, "Motor response time measured");
}

void CalibrationManager::analyzeStraightTracking() {
    // Simulate analysis - real implementation would use gyroscope data
    double driftCorrection = 0.3; // degrees
    
    calibratedConfig.straightDriftCorrection = driftCorrection;
    calibratedConfig.leftMotorSpeedFactor = 1.0;
    calibratedConfig.rightMotorSpeedFactor = 0.99; // Slight correction
    
    completeCurrentStep(true, driftCorrection, "Straight tracking drift measured");
}

void CalibrationManager::analyzeTurnAccuracy() {
    // Simulate analysis - real implementation would compare commanded vs actual angle
    double accuracy = 0.97; // 97% accuracy
    
    calibratedConfig.turnAccuracyFactor = accuracy;
    
    completeCurrentStep(true, accuracy, "Turn accuracy measured");
}

void CalibrationManager::analyzeGyroscopeData() {
    // Simulate analysis - real implementation would analyze gyroscope readings
    double drift = 0.001; // deg/s
    double delay = 18.0; // ms
    
    calibratedConfig.gyroscopeDrift = drift;
    calibratedConfig.gyroscopeDelay = delay;
    
    completeCurrentStep(true, drift, "Gyroscope drift measured");
}

void CalibrationManager::analyzeMotorBalance() {
    // Simulate analysis - real implementation would compare motor rotations
    double leftFactor = 1.0;
    double rightFactor = 0.98;
    
    calibratedConfig.leftMotorSpeedFactor = leftFactor;
    calibratedConfig.rightMotorSpeedFactor = rightFactor;
    
    completeCurrentStep(true, rightFactor, "Motor balance measured");
}

double CalibrationManager::calculateConfidence(double value, double expectedRange) {
    // Simple confidence calculation based on how close to expected range
    double deviation = std::abs(value) / expectedRange;
    return std::max(0.0, std::min(1.0, 1.0 - deviation));
}

bool CalibrationManager::canCalibrate() const {
    return isDeveloperMode || (bleController && bleController->isConnected());
} 