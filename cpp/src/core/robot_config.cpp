#include "core/robot_config.h"

RobotConfig::RobotConfig() = default;

QJsonObject RobotConfig::toJson() const {
    QJsonObject json;
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
    return json;
}

void RobotConfig::fromJson(const QJsonObject& json) {
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
           turnAcceleration == other.turnAcceleration;
}

bool RobotConfig::operator!=(const RobotConfig& other) const {
    return !(*this == other);
} 