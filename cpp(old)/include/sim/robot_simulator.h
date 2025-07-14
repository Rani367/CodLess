#pragma once

#include <QWidget>
#include <QTimer>
#include <QPainter>
#include <QVariantHash>
#include <QPixmap>
#include <memory>

class RobotSimulator : public QWidget {
    Q_OBJECT

public:
    explicit RobotSimulator(QWidget* parent = nullptr);
    ~RobotSimulator() override;
    
    void updateCommand(const QVariantHash& command);
    void resetSimulation();
    void setBackgroundImage(const QString& imagePath);
    void clearBackgroundImage();
    
    double getRobotX() const { return robotX; }
    double getRobotY() const { return robotY; }
    double getRobotAngle() const { return robotAngle; }
    double getArm1Angle() const { return arm1Angle; }
    double getArm2Angle() const { return arm2Angle; }
    
    double getActualSpeed() const { return actualSpd; }
    double getActualTurn() const { return actualTurn; }
    double getActualArm1Speed() const { return actualArm1Spd; }
    double getActualArm2Speed() const { return actualArm2Spd; }
    
protected:
    void paintEvent(QPaintEvent* event) override;
    void resizeEvent(QResizeEvent* event) override;

private slots:
    void updateSimulation();

private:
    void applyRealisticMotorPhysics();
    void updateRobotPosition();
    void updateArmPositions();
    void drawRobot(QPainter& painter);
    void drawArm(QPainter& painter, int baseX, int baseY, double angle, const QColor& color);
    double sCurveProfile(double error, double maxChange, double currentAccel, double maxAccel);
    void calculateBackgroundScaling();
    
    double robotX;
    double robotY;
    double robotAngle;
    double arm1Angle;
    double arm2Angle;
    
    double targetSpd;
    double targetTurn;
    double targetArm1Spd;
    double targetArm2Spd;
    
    double actualSpd;
    double actualTurn;
    double actualArm1Spd;
    double actualArm2Spd;
    
    double speedAccel;
    double turnAccel;
    double arm1Accel;
    double arm2Accel;
    
    const double robotMass = 2.5;
    const double robotInertia = 0.12;
    const double armInertia = 0.05;
    
    const double maxDriveAccel = 800.0;
    const double maxTurnAccel = 600.0;
    const double maxArmAccel = 1000.0;
    
    const double frictionCoeff = 0.05;
    const double motorLag = 0.03;
    const double dt = 0.02;
    
    QPixmap backgroundImage;
    double backgroundScale = 1.0;
    int backgroundOffsetX = 0;
    int backgroundOffsetY = 0;
    
    std::unique_ptr<QTimer> timer;
}; 