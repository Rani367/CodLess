#include "core/robot_config.h"

RobotConfig::RobotConfig() = default;

QJsonObject RobotConfig::toJson() const {
    QJsonObject json;
    
    // Physical properties
    json["axle_track"] = axleTrack;
    json["wheel_diameter"] = wheelDiameter;
    json["left_motor_port"] = leftMotorPort;
    json["right_motor_port"] = rightMotorPort;
    json["arm1_motor_port"] = arm1MotorPort;
    json["arm2_motor_port"] = arm2MotorPort;
    json["straight_speed"] = straightSpeed;
    json["straight_acceleration"] = straightAcceleration;
    json["turn_rate"] = turnRate;
    json["turn_acceleration"] = turnAcceleration;
    
    // Calibration data
    json["is_calibrated"] = isCalibrated;
    json["calibration_date"] = calibrationDate;
    json["left_motor_delay"] = leftMotorDelay;
    json["right_motor_delay"] = rightMotorDelay;
    json["arm1_motor_delay"] = arm1MotorDelay;
    json["arm2_motor_delay"] = arm2MotorDelay;
    json["gyroscope_drift"] = gyroscopeDrift;
    json["gyroscope_delay"] = gyroscopeDelay;
    json["left_motor_speed_factor"] = leftMotorSpeedFactor;
    json["right_motor_speed_factor"] = rightMotorSpeedFactor;
    json["turn_accuracy_factor"] = turnAccuracyFactor;
    json["straight_drift_correction"] = straightDriftCorrection;
    json["motor_response_time"] = motorResponseTime;
    json["calibration_quality"] = calibrationQuality;
    
    return json;
}

void RobotConfig::fromJson(const QJsonObject& json) {
    // Physical properties
    axleTrack = json["axle_track"].toDouble(112.0);
    wheelDiameter = json["wheel_diameter"].toDouble(56.0);
    leftMotorPort = json["left_motor_port"].toString("A");
    rightMotorPort = json["right_motor_port"].toString("B");
    arm1MotorPort = json["arm1_motor_port"].toString("C");
    arm2MotorPort = json["arm2_motor_port"].toString("D");
    straightSpeed = json["straight_speed"].toDouble(500.0);
    straightAcceleration = json["straight_acceleration"].toDouble(250.0);
    turnRate = json["turn_rate"].toDouble(200.0);
    turnAcceleration = json["turn_acceleration"].toDouble(300.0);
    
    // Calibration data
    isCalibrated = json["is_calibrated"].toBool(false);
    calibrationDate = json["calibration_date"].toString("");
    leftMotorDelay = json["left_motor_delay"].toDouble(0.0);
    rightMotorDelay = json["right_motor_delay"].toDouble(0.0);
    arm1MotorDelay = json["arm1_motor_delay"].toDouble(0.0);
    arm2MotorDelay = json["arm2_motor_delay"].toDouble(0.0);
    gyroscopeDrift = json["gyroscope_drift"].toDouble(0.0);
    gyroscopeDelay = json["gyroscope_delay"].toDouble(0.0);
    leftMotorSpeedFactor = json["left_motor_speed_factor"].toDouble(1.0);
    rightMotorSpeedFactor = json["right_motor_speed_factor"].toDouble(1.0);
    turnAccuracyFactor = json["turn_accuracy_factor"].toDouble(1.0);
    straightDriftCorrection = json["straight_drift_correction"].toDouble(0.0);
    motorResponseTime = json["motor_response_time"].toDouble(0.0);
    calibrationQuality = json["calibration_quality"].toDouble(0.0);
}

bool RobotConfig::operator==(const RobotConfig& other) const {
    return axleTrack == other.axleTrack &&
           wheelDiameter == other.wheelDiameter &&
           leftMotorPort == other.leftMotorPort &&
           rightMotorPort == other.rightMotorPort &&
           arm1MotorPort == other.arm1MotorPort &&
           arm2MotorPort == other.arm2MotorPort &&
           straightSpeed == other.straightSpeed &&
           straightAcceleration == other.straightAcceleration &&
           turnRate == other.turnRate &&
           turnAcceleration == other.turnAcceleration &&
           isCalibrated == other.isCalibrated &&
           calibrationDate == other.calibrationDate &&
           leftMotorDelay == other.leftMotorDelay &&
           rightMotorDelay == other.rightMotorDelay &&
           arm1MotorDelay == other.arm1MotorDelay &&
           arm2MotorDelay == other.arm2MotorDelay &&
           gyroscopeDrift == other.gyroscopeDrift &&
           gyroscopeDelay == other.gyroscopeDelay &&
           leftMotorSpeedFactor == other.leftMotorSpeedFactor &&
           rightMotorSpeedFactor == other.rightMotorSpeedFactor &&
           turnAccuracyFactor == other.turnAccuracyFactor &&
           straightDriftCorrection == other.straightDriftCorrection &&
           motorResponseTime == other.motorResponseTime &&
           calibrationQuality == other.calibrationQuality;
}

bool RobotConfig::operator!=(const RobotConfig& other) const {
    return !(*this == other);
}

void RobotConfig::clearCalibration() {
    isCalibrated = false;
    calibrationDate.clear();
    leftMotorDelay = 0.0;
    rightMotorDelay = 0.0;
    arm1MotorDelay = 0.0;
    arm2MotorDelay = 0.0;
    gyroscopeDrift = 0.0;
    gyroscopeDelay = 0.0;
    leftMotorSpeedFactor = 1.0;
    rightMotorSpeedFactor = 1.0;
    turnAccuracyFactor = 1.0;
    straightDriftCorrection = 0.0;
    motorResponseTime = 0.0;
    calibrationQuality = 0.0;
}

bool RobotConfig::hasValidCalibration() const {
    return isCalibrated && !calibrationDate.isEmpty() && calibrationQuality > 0.0;
}

QString RobotConfig::getCalibrationSummary() const {
    if (!hasValidCalibration()) {
        return "Robot not calibrated";
    }
    
    QString summary = QString("Calibrated on %1\n").arg(calibrationDate);
    summary += QString("Quality Score: %1/100\n").arg(calibrationQuality, 0, 'f', 1);
    summary += QString("Motor Response Time: %1ms\n").arg(motorResponseTime, 0, 'f', 1);
    summary += QString("Left Motor Delay: %1ms\n").arg(leftMotorDelay, 0, 'f', 1);
    summary += QString("Right Motor Delay: %1ms\n").arg(rightMotorDelay, 0, 'f', 1);
    summary += QString("Gyroscope Drift: %1°/s\n").arg(gyroscopeDrift, 0, 'f', 3);
    summary += QString("Turn Accuracy: %1x\n").arg(turnAccuracyFactor, 0, 'f', 3);
    summary += QString("Straight Drift Correction: %1°").arg(straightDriftCorrection, 0, 'f', 2);
    
    return summary;
} 