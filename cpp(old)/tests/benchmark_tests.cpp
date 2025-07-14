#include <QtTest/QtTest>
#include <QApplication>
#include <QElapsedTimer>
#include <QVariantHash>
#include "sim/robot_simulator.h"
#include "core/robot_config.h"
#include "core/recorded_command.h"
#include "utils/json_utils.h"

class BenchmarkTests : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();
    
    void benchmarkPhysicsSimulation();
    void benchmarkJsonSerialization();
    void benchmarkCommandProcessing();
    void benchmarkMemoryUsage();
    void benchmarkLargeDatasets();

private:
    RobotSimulator* simulator;
    QApplication* app;
};

void BenchmarkTests::initTestCase()
{
    if (!QApplication::instance()) {
        int argc = 0;
        char* argv[] = {nullptr};
        app = new QApplication(argc, argv);
    }
    qDebug() << "Starting Benchmark tests...";
}

void BenchmarkTests::cleanupTestCase()
{
    qDebug() << "Benchmark tests completed.";
}

void BenchmarkTests::init()
{
    simulator = new RobotSimulator();
    simulator->resize(400, 300);
    simulator->resetSimulation();
}

void BenchmarkTests::cleanup()
{
    delete simulator;
    simulator = nullptr;
}

void BenchmarkTests::benchmarkPhysicsSimulation()
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

void BenchmarkTests::benchmarkJsonSerialization()
{
    RobotConfig config;
    config.straightSpeed = 600.0;
    config.straightAcceleration = 300.0;
    config.turnRate = 250.0;
    config.turnAcceleration = 350.0;
    config.axleTrack = 120.0;
    config.wheelDiameter = 62.0;
    
    QBENCHMARK {
        QJsonObject json = config.toJson();
        RobotConfig deserializedConfig;
        deserializedConfig.fromJson(json);
    }
}

void BenchmarkTests::benchmarkCommandProcessing()
{
    QVariantHash command;
    command["type"] = "drive";
    command["speed"] = 150.0;
    command["turn_rate"] = 75.0;
    command["arm1"] = 50.0;
    command["arm2"] = -25.0;
    command["timestamp"] = 1234567890;
    
    QBENCHMARK {
        RecordedCommand recordedCmd(1234567890, command);
        QJsonObject json = recordedCmd.toJson();
        RecordedCommand deserializedCmd;
        deserializedCmd.fromJson(json);
    }
}

void BenchmarkTests::benchmarkMemoryUsage()
{
    QList<RecordedCommand> commands;
    
    QBENCHMARK {
        // Simulate creating many commands
        for (int i = 0; i < 1000; ++i) {
            QVariantHash command;
            command["type"] = "drive";
            command["speed"] = i % 300;
            command["turn_rate"] = (i % 200) - 100;
            command["timestamp"] = i;
            
            commands.append(RecordedCommand(i, command));
        }
        
        // Clear for next iteration
        commands.clear();
    }
}

void BenchmarkTests::benchmarkLargeDatasets()
{
    QJsonObject largeJson;
    
    // Create large JSON object
    for (int i = 0; i < 10000; ++i) {
        largeJson[QString("key_%1").arg(i)] = QString("value_%1").arg(i);
    }
    
    QBENCHMARK {
        QVariantHash variant = JsonUtils::jsonToVariant(largeJson);
        QJsonObject reconstructedJson = JsonUtils::variantToJson(variant);
        Q_UNUSED(reconstructedJson);
    }
}

QTEST_MAIN(BenchmarkTests)
#include "benchmark_tests.moc" 