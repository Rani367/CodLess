#pragma once

#include <QString>
#include <QJsonObject>

class RobotConfig {
public:
    RobotConfig();
    
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
    
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
    
    bool operator==(const RobotConfig& other) const;
    bool operator!=(const RobotConfig& other) const;
}; 