#include "sim/robot_simulator.h"
#include <QResizeEvent>
#include <QPen>
#include <QBrush>
#include <QColor>
#include <QFont>
#include <QPolygon>
#include <QPoint>
#include <cmath>
#include <algorithm>

RobotSimulator::RobotSimulator(QWidget* parent)
    : QWidget(parent)
    , robotX(200.0)
    , robotY(150.0)
    , robotAngle(0.0)
    , arm1Angle(0.0)
    , arm2Angle(0.0)
    , targetSpd(0.0)
    , targetTurn(0.0)
    , targetArm1Spd(0.0)
    , targetArm2Spd(0.0)
    , actualSpd(0.0)
    , actualTurn(0.0)
    , actualArm1Spd(0.0)
    , actualArm2Spd(0.0)
    , speedAccel(0.0)
    , turnAccel(0.0)
    , arm1Accel(0.0)
    , arm2Accel(0.0)
    , timer(std::make_unique<QTimer>(this))
{
    setMinimumSize(300, 200);
    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    setObjectName("robot_simulator");
    
    connect(timer.get(), &QTimer::timeout, this, &RobotSimulator::updateSimulation);
    timer->start(20);
    
    QTimer::singleShot(0, this, [this]() {
        resetSimulation();
    });
}

RobotSimulator::~RobotSimulator() = default;

void RobotSimulator::updateCommand(const QVariantHash& command) {
    QString cmdType = command.value("type").toString();
    
    if (cmdType == "drive") {
        targetSpd = command.value("speed").toDouble() * 1.5;
        targetTurn = command.value("turn_rate").toDouble() * 1.2;
    } else if (cmdType == "arm1") {
        targetArm1Spd = command.value("speed").toDouble() * 1.0;
    } else if (cmdType == "arm2") {
        targetArm2Spd = command.value("speed").toDouble() * 1.0;
    }
}

void RobotSimulator::resetSimulation() {
    robotX = std::max(30.0, std::min(static_cast<double>(width() - 30), width() / 2.0));
    robotY = std::max(30.0, std::min(static_cast<double>(height() - 30), height() / 2.0));
    robotAngle = 0.0;
    arm1Angle = 0.0;
    arm2Angle = 0.0;
    
    targetSpd = 0.0;
    targetTurn = 0.0;
    targetArm1Spd = 0.0;
    targetArm2Spd = 0.0;
    
    actualSpd = 0.0;
    actualTurn = 0.0;
    actualArm1Spd = 0.0;
    actualArm2Spd = 0.0;
    
    speedAccel = 0.0;
    turnAccel = 0.0;
    arm1Accel = 0.0;
    arm2Accel = 0.0;
    
    update();
}

void RobotSimulator::updateSimulation() {
    applyRealisticMotorPhysics();
    updateRobotPosition();
    updateArmPositions();
    update();
}

void RobotSimulator::applyRealisticMotorPhysics() {
    double speedError = targetSpd - actualSpd;
    double turnError = targetTurn - actualTurn;
    double arm1Error = targetArm1Spd - actualArm1Spd;
    double arm2Error = targetArm2Spd - actualArm2Spd;
    
    double maxSpeedChange = maxDriveAccel * dt;
    double maxTurnChange = maxTurnAccel * dt;
    double maxArmChange = maxArmAccel * dt;
    
    speedAccel = sCurveProfile(speedError, maxSpeedChange, speedAccel, maxDriveAccel);
    turnAccel = sCurveProfile(turnError, maxTurnChange, turnAccel, maxTurnAccel);
    arm1Accel = sCurveProfile(arm1Error, maxArmChange, arm1Accel, maxArmAccel);
    arm2Accel = sCurveProfile(arm2Error, maxArmChange, arm2Accel, maxArmAccel);
    
    double motorLagFactor = 1.0 - motorLag;
    actualSpd += speedAccel * dt * motorLagFactor;
    actualTurn += turnAccel * dt * motorLagFactor;
    actualArm1Spd += arm1Accel * dt * motorLagFactor;
    actualArm2Spd += arm2Accel * dt * motorLagFactor;
    
    const double inertialDamping = 0.995;
    actualSpd *= inertialDamping;
    actualTurn *= inertialDamping;
    actualArm1Spd *= inertialDamping;
    actualArm2Spd *= inertialDamping;
}

double RobotSimulator::sCurveProfile(double error, double maxChange, double currentAccel, double maxAccel) {
    double jerkLimit = maxAccel * 8.0;
    double targetAccel = std::clamp(error * 15.0, -maxAccel, maxAccel);
    double accelError = targetAccel - currentAccel;
    double maxJerkChange = jerkLimit * dt;
    
    double newAccel;
    if (std::abs(accelError) > maxJerkChange) {
        newAccel = currentAccel + (accelError > 0 ? maxJerkChange : -maxJerkChange);
    } else {
        newAccel = targetAccel;
    }
    
    double frictionFactor = 1.0 - frictionCoeff * dt;
    double damping = 0.92 + 0.08 * std::exp(-std::abs(error) * 0.1);
    
    return newAccel * frictionFactor * damping;
}

void RobotSimulator::updateRobotPosition() {
    if (std::abs(actualSpd) > 0.01 || std::abs(actualTurn) > 0.01) {
        double simSpeed = actualSpd * 0.15;
        double simTurn = actualTurn * 0.8;
        
        double momentumFactor = 1.0 / (1.0 + robotMass * 0.1);
        double inertiaFactor = 1.0 / (1.0 + robotInertia * 2.0);
        
        robotAngle += simTurn * dt * inertiaFactor;
        robotAngle = std::fmod(robotAngle, 360.0);
        
        double angleRad = robotAngle * M_PI / 180.0;
        double dx = simSpeed * std::cos(angleRad) * dt * momentumFactor;
        double dy = simSpeed * std::sin(angleRad) * dt * momentumFactor;
        
        robotX += dx;
        robotY += dy;
        
        robotX = std::clamp(robotX, 30.0, static_cast<double>(width() - 30));
        robotY = std::clamp(robotY, 30.0, static_cast<double>(height() - 30));
    }
}

void RobotSimulator::updateArmPositions() {
    if (std::abs(actualArm1Spd) > 0.1) {
        double armMomentum = 1.0 / (1.0 + armInertia * 0.8);
        arm1Angle += actualArm1Spd * 0.3 * dt * armMomentum;
        arm1Angle = std::clamp(arm1Angle, -90.0, 90.0);
    }
    
    if (std::abs(actualArm2Spd) > 0.1) {
        double armMomentum = 1.0 / (1.0 + armInertia * 0.8);
        arm2Angle += actualArm2Spd * 0.3 * dt * armMomentum;
        arm2Angle = std::clamp(arm2Angle, -90.0, 90.0);
    }
}

void RobotSimulator::paintEvent(QPaintEvent* event) {
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    
    painter.fillRect(rect(), QColor(45, 45, 45));
    
    painter.setPen(QPen(QColor(70, 70, 70), 1));
    for (int x = 0; x < width(); x += 50) {
        painter.drawLine(x, 0, x, height());
    }
    for (int y = 0; y < height(); y += 50) {
        painter.drawLine(0, y, width(), y);
    }
    
    drawRobot(painter);
    
    painter.setPen(QPen(QColor(255, 255, 255), 1));
    painter.setFont(QFont("Arial", 10));
    
    QString statusText = QString("Position: (%1, %2)")
                        .arg(static_cast<int>(robotX))
                        .arg(static_cast<int>(robotY));
    statusText += QString(" | Angle: %1°").arg(static_cast<int>(robotAngle));
    painter.drawText(10, 20, statusText);
    
    QString physicsText = QString("Speed: %1 | Turn: %2")
                         .arg(actualSpd, 0, 'f', 1)
                         .arg(actualTurn, 0, 'f', 1);
    painter.drawText(10, 40, physicsText);
    
    QString accelText = QString("Accel: %1 | T-Accel: %2")
                       .arg(speedAccel, 0, 'f', 1)
                       .arg(turnAccel, 0, 'f', 1);
    painter.drawText(10, 60, accelText);
    
    QString armText = QString("Arm1: %1° | Arm2: %2°")
                     .arg(static_cast<int>(arm1Angle))
                     .arg(static_cast<int>(arm2Angle));
    painter.drawText(10, 80, armText);
}

void RobotSimulator::drawRobot(QPainter& painter) {
    painter.save();
    
    painter.translate(robotX, robotY);
    painter.rotate(robotAngle);
    
    painter.setPen(QPen(QColor(0, 143, 170), 2));
    painter.setBrush(QBrush(QColor(0, 143, 170, 100)));
    painter.drawRect(-20, -15, 40, 30);
    
    painter.setBrush(QBrush(QColor(40, 167, 69)));
    QPolygon triangle;
    triangle << QPoint(20, 0) << QPoint(15, -8) << QPoint(15, 8);
    painter.drawPolygon(triangle);
    
    painter.setPen(QPen(QColor(100, 100, 100), 2));
    painter.setBrush(QBrush(QColor(60, 60, 60)));
    painter.drawRect(-10, -20, 8, 10);
    painter.drawRect(-10, 10, 8, 10);
    painter.drawRect(15, -20, 8, 10);
    painter.drawRect(15, 10, 8, 10);
    
    drawArm(painter, -15, -10, arm1Angle, QColor(220, 53, 69));
    drawArm(painter, -15, 10, arm2Angle, QColor(255, 193, 7));
    
    painter.restore();
}

void RobotSimulator::drawArm(QPainter& painter, int baseX, int baseY, double angle, const QColor& color) {
    painter.save();
    
    painter.translate(baseX, baseY);
    painter.rotate(angle);
    
    painter.setPen(QPen(color, 3));
    painter.drawLine(0, 0, 25, 0);
    
    painter.setBrush(QBrush(color));
    painter.drawEllipse(23, -3, 6, 6);
    
    painter.restore();
}

void RobotSimulator::resizeEvent(QResizeEvent* event) {
    QWidget::resizeEvent(event);
    robotX = std::clamp(robotX, 30.0, static_cast<double>(width() - 30));
    robotY = std::clamp(robotY, 30.0, static_cast<double>(height() - 30));
} 