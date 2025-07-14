#pragma once

#include <QString>
#include <QJsonObject>
#include <QDateTime>

class RobotConfig {
public:
    RobotConfig();
    
    // Physical robot properties
    double axleTrack = 112.0;
    double wheelDiameter = 56.0;
    QString leftMotorPort = "A";
    QString rightMotorPort = "B";
    QString arm1MotorPort = "C";
    QString arm2MotorPort = "D";
    double straightSpeed = 500.0;
    double straightAcceleration = 250.0;
    double turnRate = 200.0;
    double turnAcceleration = 300.0;
    
    // Calibration data
    bool isCalibrated = false;
    QString calibrationDate;
    double leftMotorDelay = 0.0;         // Motor response delay (ms)
    double rightMotorDelay = 0.0;
    double arm1MotorDelay = 0.0;
    double arm2MotorDelay = 0.0;
    double gyroscopeDrift = 0.0;         // Drift compensation (°/s)
    double gyroscopeDelay = 0.0;         // Gyroscope response delay (ms)
    double leftMotorSpeedFactor = 1.0;   // Speed correction multiplier
    double rightMotorSpeedFactor = 1.0;
    double turnAccuracyFactor = 1.0;     // Turn angle correction
    double straightDriftCorrection = 0.0; // Straight line drift correction (°)
    double motorResponseTime = 0.0;      // Average motor response time (ms)
    double calibrationQuality = 0.0;     // Calibration quality score (0-100)
    
    // Calibration methods
    void clearCalibration();
    bool hasValidCalibration() const;
    QString getCalibrationSummary() const;
    
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
    
    bool operator==(const RobotConfig& other) const;
    bool operator!=(const RobotConfig& other) const;
}; 