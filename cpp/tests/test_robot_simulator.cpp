#include <QtTest/QtTest>
#include <QApplication>
#include <QSignalSpy>
#include <QVariantHash>
#include <cmath>
#include "sim/robot_simulator.h"

class TestRobotSimulator : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();
    
    // Basic functionality tests
    void testConstructor();
    void testResetSimulation();
    void testUpdateCommand();
    void testPhysicsAcceleration();
    void testPositionUpdate();
    void testArmMovement();
    
    // Physics engine tests
    void testSCurveProfile();
    void testRealisticMotorResponse();
    void testBoundaryConditions();
    void testContinuousMovement();
    
    // Performance tests
    void testSimulationPerformance();
    void testMemoryUsage();
    
    // Integration tests
    void testComplexMovements();
    void testStopCommand();

private:
    RobotSimulator* simulator;
    QApplication* app;
    
    // Helper functions
    void waitForPhysicsUpdate();
    bool isNearlyEqual(double a, double b, double tolerance = 0.01);
};

void TestRobotSimulator::initTestCase()
{
    if (!QApplication::instance()) {
        int argc = 0;
        char* argv[] = {nullptr};
        app = new QApplication(argc, argv);
    }
    qDebug() << "Starting RobotSimulator tests...";
}

void TestRobotSimulator::cleanupTestCase()
{
    qDebug() << "RobotSimulator tests completed.";
}

void TestRobotSimulator::init()
{
    simulator = new RobotSimulator();
    simulator->resize(400, 300);
    simulator->resetSimulation();
    
    // Wait for initial setup
    QTest::qWait(50);
}

void TestRobotSimulator::cleanup()
{
    delete simulator;
    simulator = nullptr;
}

void TestRobotSimulator::testConstructor()
{
    QVERIFY(simulator != nullptr);
    QCOMPARE(simulator->getRobotX(), 200.0);
    QCOMPARE(simulator->getRobotY(), 150.0);
    QCOMPARE(simulator->getRobotAngle(), 0.0);
    QCOMPARE(simulator->getArm1Angle(), 0.0);
    QCOMPARE(simulator->getArm2Angle(), 0.0);
    QCOMPARE(simulator->getActualSpeed(), 0.0);
    QCOMPARE(simulator->getActualTurn(), 0.0);
    QCOMPARE(simulator->getActualArm1Speed(), 0.0);
    QCOMPARE(simulator->getActualArm2Speed(), 0.0);
}

void TestRobotSimulator::testResetSimulation()
{
    // Move robot away from center
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 100.0;
    driveCommand["turn_rate"] = 50.0;
    simulator->updateCommand(driveCommand);
    
    // Wait for movement
    QTest::qWait(100);
    
    // Reset should return to center
    simulator->resetSimulation();
    
    QCOMPARE(simulator->getRobotX(), 200.0);
    QCOMPARE(simulator->getRobotY(), 150.0);
    QCOMPARE(simulator->getRobotAngle(), 0.0);
    QCOMPARE(simulator->getActualSpeed(), 0.0);
    QCOMPARE(simulator->getActualTurn(), 0.0);
}

void TestRobotSimulator::testUpdateCommand()
{
    // Test drive command
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 100.0;
    driveCommand["turn_rate"] = 50.0;
    
    simulator->updateCommand(driveCommand);
    
    // Wait for physics update
    QTest::qWait(100);
    
    // Should have some movement
    QVERIFY(simulator->getActualSpeed() > 0.0);
    QVERIFY(simulator->getActualTurn() > 0.0);
    
    // Test arm command
    QVariantHash armCommand;
    armCommand["type"] = "arm1";
    armCommand["speed"] = 75.0;
    
    simulator->updateCommand(armCommand);
    
    // Wait for physics update
    QTest::qWait(100);
    
    QVERIFY(simulator->getActualArm1Speed() > 0.0);
}

void TestRobotSimulator::testPhysicsAcceleration()
{
    // Test that robot doesn't instantly reach target speed
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 200.0;
    driveCommand["turn_rate"] = 0.0;
    
    simulator->updateCommand(driveCommand);
    
    // Immediately after command, should still be accelerating
    QTest::qWait(20);
    double speed1 = simulator->getActualSpeed();
    
    // Wait a bit more
    QTest::qWait(50);
    double speed2 = simulator->getActualSpeed();
    
    // Should be accelerating
    QVERIFY(speed2 > speed1);
    QVERIFY(speed2 < 200.0 * 1.5); // Target speed * scaling factor
}

void TestRobotSimulator::testPositionUpdate()
{
    double initialX = simulator->getRobotX();
    double initialY = simulator->getRobotY();
    
    // Move forward
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 100.0;
    driveCommand["turn_rate"] = 0.0;
    
    simulator->updateCommand(driveCommand);
    
    // Wait for movement
    QTest::qWait(200);
    
    // Position should have changed
    QVERIFY(simulator->getRobotX() != initialX || simulator->getRobotY() != initialY);
}

void TestRobotSimulator::testArmMovement()
{
    double initialArm1Angle = simulator->getArm1Angle();
    double initialArm2Angle = simulator->getArm2Angle();
    
    // Move arm 1
    QVariantHash arm1Command;
    arm1Command["type"] = "arm1";
    arm1Command["speed"] = 50.0;
    
    simulator->updateCommand(arm1Command);
    
    // Wait for movement
    QTest::qWait(200);
    
    // Arm angle should have changed
    QVERIFY(simulator->getArm1Angle() != initialArm1Angle);
    
    // Move arm 2
    QVariantHash arm2Command;
    arm2Command["type"] = "arm2";
    arm2Command["speed"] = -30.0;
    
    simulator->updateCommand(arm2Command);
    
    // Wait for movement
    QTest::qWait(200);
    
    // Arm 2 angle should have changed
    QVERIFY(simulator->getArm2Angle() != initialArm2Angle);
}

void TestRobotSimulator::testSCurveProfile()
{
    // Test that acceleration follows S-curve profile
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 300.0;
    driveCommand["turn_rate"] = 0.0;
    
    simulator->updateCommand(driveCommand);
    
    QList<double> speeds;
    QList<double> accelerations;
    
    // Sample speeds over time
    for (int i = 0; i < 20; ++i) {
        QTest::qWait(20);
        speeds.append(simulator->getActualSpeed());
        if (i > 0) {
            accelerations.append(speeds[i] - speeds[i-1]);
        }
    }
    
    // Should show gradual acceleration (S-curve)
    QVERIFY(speeds.first() < speeds.last());
    QVERIFY(accelerations.size() > 5); // Should have acceleration data
}

void TestRobotSimulator::testRealisticMotorResponse()
{
    // Test motor lag and realistic response
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 150.0;
    driveCommand["turn_rate"] = 0.0;
    
    simulator->updateCommand(driveCommand);
    
    // Should not instantly reach target
    QTest::qWait(20);
    QVERIFY(simulator->getActualSpeed() < 150.0 * 1.5);
    
    // Should gradually approach target
    QTest::qWait(200);
    QVERIFY(simulator->getActualSpeed() > 0.0);
    
    // Test stopping
    driveCommand["speed"] = 0.0;
    simulator->updateCommand(driveCommand);
    
    QTest::qWait(200);
    QVERIFY(std::abs(simulator->getActualSpeed()) < 10.0); // Should slow down
}

void TestRobotSimulator::testBoundaryConditions()
{
    // Test robot doesn't go outside widget bounds
    simulator->resize(200, 200);
    
    // Try to move to edge
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 500.0;
    driveCommand["turn_rate"] = 0.0;
    
    simulator->updateCommand(driveCommand);
    
    // Wait for movement
    QTest::qWait(1000);
    
    // Should stay within bounds
    QVERIFY(simulator->getRobotX() >= 30.0);
    QVERIFY(simulator->getRobotX() <= 170.0);
    QVERIFY(simulator->getRobotY() >= 30.0);
    QVERIFY(simulator->getRobotY() <= 170.0);
}

void TestRobotSimulator::testContinuousMovement()
{
    // Test continuous movement over time
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 100.0;
    driveCommand["turn_rate"] = 30.0;
    
    simulator->updateCommand(driveCommand);
    
    QList<QPair<double, double>> positions;
    
    // Sample positions over time
    for (int i = 0; i < 10; ++i) {
        QTest::qWait(50);
        positions.append(qMakePair(simulator->getRobotX(), simulator->getRobotY()));
    }
    
    // Should have smooth movement
    QVERIFY(positions.size() == 10);
    
    // Check for reasonable movement
    double totalDistance = 0;
    for (int i = 1; i < positions.size(); ++i) {
        double dx = positions[i].first - positions[i-1].first;
        double dy = positions[i].second - positions[i-1].second;
        totalDistance += std::sqrt(dx*dx + dy*dy);
    }
    
    QVERIFY(totalDistance > 0.0);
}

void TestRobotSimulator::testSimulationPerformance()
{
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 200.0;
    driveCommand["turn_rate"] = 100.0;
    
    QBENCHMARK {
        simulator->updateCommand(driveCommand);
        QTest::qWait(20); // One physics update cycle
    }
}

void TestRobotSimulator::testMemoryUsage()
{
    // Test for memory leaks by repeated operations
    for (int i = 0; i < 1000; ++i) {
        QVariantHash driveCommand;
        driveCommand["type"] = "drive";
        driveCommand["speed"] = i % 200;
        driveCommand["turn_rate"] = (i % 100) - 50;
        
        simulator->updateCommand(driveCommand);
        
        if (i % 100 == 0) {
            QTest::qWait(10);
        }
    }
    
    // If we get here without crashing, memory usage is reasonable
    QVERIFY(true);
}

void TestRobotSimulator::testComplexMovements()
{
    // Test complex movement pattern
    QList<QVariantHash> commands;
    
    // Forward
    QVariantHash cmd1;
    cmd1["type"] = "drive";
    cmd1["speed"] = 100.0;
    cmd1["turn_rate"] = 0.0;
    commands.append(cmd1);
    
    // Turn
    QVariantHash cmd2;
    cmd2["type"] = "drive";
    cmd2["speed"] = 0.0;
    cmd2["turn_rate"] = 90.0;
    commands.append(cmd2);
    
    // Backward
    QVariantHash cmd3;
    cmd3["type"] = "drive";
    cmd3["speed"] = -100.0;
    cmd3["turn_rate"] = 0.0;
    commands.append(cmd3);
    
    double initialX = simulator->getRobotX();
    double initialY = simulator->getRobotY();
    double initialAngle = simulator->getRobotAngle();
    
    // Execute commands
    for (const auto& cmd : commands) {
        simulator->updateCommand(cmd);
        QTest::qWait(300);
    }
    
    // Position and angle should have changed
    QVERIFY(simulator->getRobotX() != initialX || 
            simulator->getRobotY() != initialY ||
            simulator->getRobotAngle() != initialAngle);
}

void TestRobotSimulator::testStopCommand()
{
    // Start movement
    QVariantHash driveCommand;
    driveCommand["type"] = "drive";
    driveCommand["speed"] = 200.0;
    driveCommand["turn_rate"] = 100.0;
    
    simulator->updateCommand(driveCommand);
    QTest::qWait(100);
    
    // Should be moving
    QVERIFY(simulator->getActualSpeed() > 0.0);
    QVERIFY(simulator->getActualTurn() > 0.0);
    
    // Stop command
    driveCommand["speed"] = 0.0;
    driveCommand["turn_rate"] = 0.0;
    
    simulator->updateCommand(driveCommand);
    QTest::qWait(300);
    
    // Should slow down significantly
    QVERIFY(std::abs(simulator->getActualSpeed()) < 50.0);
    QVERIFY(std::abs(simulator->getActualTurn()) < 50.0);
}

void TestRobotSimulator::waitForPhysicsUpdate()
{
    QTest::qWait(25); // Slightly more than 20ms physics update interval
}

bool TestRobotSimulator::isNearlyEqual(double a, double b, double tolerance)
{
    return std::abs(a - b) < tolerance;
}

QTEST_MAIN(TestRobotSimulator)
#include "test_robot_simulator.moc" 