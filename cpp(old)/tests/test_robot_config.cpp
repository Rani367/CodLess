#include <QtTest/QtTest>
#include <QJsonObject>
#include <QJsonDocument>
#include "core/robot_config.h"

class TestRobotConfig : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();
    
    // Basic functionality tests
    void testDefaultConstructor();
    void testJsonSerialization();
    void testJsonDeserialization();
    void testEquality();
    void testInequality();
    
    // Edge cases
    void testEmptyJson();
    void testPartialJson();
    void testInvalidJson();
    void testBoundaryValues();
    
    // Performance tests
    void testSerializationPerformance();
    void testDeserializationPerformance();

private:
    RobotConfig* config;
    QJsonObject testJson;
};

void TestRobotConfig::initTestCase()
{
    // Test case initialization
    qDebug() << "Starting RobotConfig tests...";
}

void TestRobotConfig::cleanupTestCase()
{
    qDebug() << "RobotConfig tests completed.";
}

void TestRobotConfig::init()
{
    config = new RobotConfig();
    
    // Create test JSON
    testJson["axle_track"] = 120.0;
    testJson["wheel_diameter"] = 62.0;
    testJson["left_motor_port"] = "A";
    testJson["right_motor_port"] = "B";
    testJson["arm1_motor_port"] = "C";
    testJson["arm2_motor_port"] = "D";
    testJson["straight_speed"] = 600.0;
    testJson["straight_acceleration"] = 300.0;
    testJson["turn_rate"] = 250.0;
    testJson["turn_acceleration"] = 350.0;
}

void TestRobotConfig::cleanup()
{
    delete config;
    config = nullptr;
}

void TestRobotConfig::testDefaultConstructor()
{
    RobotConfig defaultConfig;
    
    // Test default values
    QCOMPARE(defaultConfig.axleTrack, 112.0);
    QCOMPARE(defaultConfig.wheelDiameter, 56.0);
    QCOMPARE(defaultConfig.leftMotorPort, QString("A"));
    QCOMPARE(defaultConfig.rightMotorPort, QString("B"));
    QCOMPARE(defaultConfig.arm1MotorPort, QString("C"));
    QCOMPARE(defaultConfig.arm2MotorPort, QString("D"));
    QCOMPARE(defaultConfig.straightSpeed, 500.0);
    QCOMPARE(defaultConfig.straightAcceleration, 250.0);
    QCOMPARE(defaultConfig.turnRate, 200.0);
    QCOMPARE(defaultConfig.turnAcceleration, 300.0);
}

void TestRobotConfig::testJsonSerialization()
{
    config->axleTrack = 120.0;
    config->wheelDiameter = 62.0;
    config->leftMotorPort = "A";
    config->rightMotorPort = "B";
    config->arm1MotorPort = "C";
    config->arm2MotorPort = "D";
    config->straightSpeed = 600.0;
    config->straightAcceleration = 300.0;
    config->turnRate = 250.0;
    config->turnAcceleration = 350.0;
    
    QJsonObject json = config->toJson();
    
    QCOMPARE(json["axle_track"].toDouble(), 120.0);
    QCOMPARE(json["wheel_diameter"].toDouble(), 62.0);
    QCOMPARE(json["left_motor_port"].toString(), QString("A"));
    QCOMPARE(json["right_motor_port"].toString(), QString("B"));
    QCOMPARE(json["arm1_motor_port"].toString(), QString("C"));
    QCOMPARE(json["arm2_motor_port"].toString(), QString("D"));
    QCOMPARE(json["straight_speed"].toDouble(), 600.0);
    QCOMPARE(json["straight_acceleration"].toDouble(), 300.0);
    QCOMPARE(json["turn_rate"].toDouble(), 250.0);
    QCOMPARE(json["turn_acceleration"].toDouble(), 350.0);
}

void TestRobotConfig::testJsonDeserialization()
{
    config->fromJson(testJson);
    
    QCOMPARE(config->axleTrack, 120.0);
    QCOMPARE(config->wheelDiameter, 62.0);
    QCOMPARE(config->leftMotorPort, QString("A"));
    QCOMPARE(config->rightMotorPort, QString("B"));
    QCOMPARE(config->arm1MotorPort, QString("C"));
    QCOMPARE(config->arm2MotorPort, QString("D"));
    QCOMPARE(config->straightSpeed, 600.0);
    QCOMPARE(config->straightAcceleration, 300.0);
    QCOMPARE(config->turnRate, 250.0);
    QCOMPARE(config->turnAcceleration, 350.0);
}

void TestRobotConfig::testEquality()
{
    RobotConfig config1;
    RobotConfig config2;
    
    // Default configs should be equal
    QVERIFY(config1 == config2);
    
    // Modify one and test inequality
    config1.axleTrack = 150.0;
    QVERIFY(!(config1 == config2));
    
    // Make them equal again
    config2.axleTrack = 150.0;
    QVERIFY(config1 == config2);
}

void TestRobotConfig::testInequality()
{
    RobotConfig config1;
    RobotConfig config2;
    
    // Default configs should not be inequal
    QVERIFY(!(config1 != config2));
    
    // Modify one and test inequality
    config1.wheelDiameter = 70.0;
    QVERIFY(config1 != config2);
}

void TestRobotConfig::testEmptyJson()
{
    QJsonObject emptyJson;
    config->fromJson(emptyJson);
    
    // Should use default values
    QCOMPARE(config->axleTrack, 112.0);
    QCOMPARE(config->wheelDiameter, 56.0);
    QCOMPARE(config->leftMotorPort, QString("A"));
    QCOMPARE(config->rightMotorPort, QString("B"));
}

void TestRobotConfig::testPartialJson()
{
    QJsonObject partialJson;
    partialJson["axle_track"] = 100.0;
    partialJson["wheel_diameter"] = 50.0;
    // Missing other fields
    
    config->fromJson(partialJson);
    
    // Should use provided values for existing fields
    QCOMPARE(config->axleTrack, 100.0);
    QCOMPARE(config->wheelDiameter, 50.0);
    
    // Should use defaults for missing fields
    QCOMPARE(config->leftMotorPort, QString("A"));
    QCOMPARE(config->rightMotorPort, QString("B"));
}

void TestRobotConfig::testInvalidJson()
{
    QJsonObject invalidJson;
    invalidJson["axle_track"] = "invalid_number";
    invalidJson["wheel_diameter"] = QJsonValue::Null;
    
    config->fromJson(invalidJson);
    
    // Should use default values for invalid data
    QCOMPARE(config->axleTrack, 112.0);
    QCOMPARE(config->wheelDiameter, 56.0);
}

void TestRobotConfig::testBoundaryValues()
{
    QJsonObject boundaryJson;
    boundaryJson["axle_track"] = 0.0;
    boundaryJson["wheel_diameter"] = -10.0;
    boundaryJson["straight_speed"] = 99999.0;
    
    config->fromJson(boundaryJson);
    
    // Test that boundary values are handled
    QCOMPARE(config->axleTrack, 0.0);
    QCOMPARE(config->wheelDiameter, -10.0);
    QCOMPARE(config->straightSpeed, 99999.0);
}

void TestRobotConfig::testSerializationPerformance()
{
    QBENCHMARK {
        config->toJson();
    }
}

void TestRobotConfig::testDeserializationPerformance()
{
    QBENCHMARK {
        config->fromJson(testJson);
    }
}

QTEST_MAIN(TestRobotConfig)
#include "test_robot_config.moc" 