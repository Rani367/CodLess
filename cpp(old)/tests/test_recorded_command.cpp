#include <QtTest/QtTest>
#include <QJsonObject>
#include <QJsonDocument>
#include <QVariantHash>
#include "core/recorded_command.h"

class TestRecordedCommand : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();
    
    // Basic functionality tests
    void testDefaultConstructor();
    void testParameterizedConstructor();
    void testJsonSerialization();
    void testJsonDeserialization();
    void testEquality();
    void testInequality();
    
    // Edge cases
    void testEmptyJson();
    void testInvalidJson();
    void testLargeTimestamp();
    void testNegativeTimestamp();
    void testComplexCommand();
    
    // Performance tests
    void testSerializationPerformance();
    void testDeserializationPerformance();

private:
    RecordedCommand* command;
    QJsonObject testJson;
    QVariantHash testCommand;
};

void TestRecordedCommand::initTestCase()
{
    qDebug() << "Starting RecordedCommand tests...";
}

void TestRecordedCommand::cleanupTestCase()
{
    qDebug() << "RecordedCommand tests completed.";
}

void TestRecordedCommand::init()
{
    command = new RecordedCommand();
    
    // Create test command
    testCommand["type"] = "drive";
    testCommand["speed"] = 150.0;
    testCommand["turn_rate"] = 75.0;
    testCommand["timestamp"] = 1234567890;
    
    // Create test JSON
    testJson["timestamp"] = 1234567890;
    testJson["type"] = "drive";
    testJson["speed"] = 150.0;
    testJson["turn_rate"] = 75.0;
}

void TestRecordedCommand::cleanup()
{
    delete command;
    command = nullptr;
}

void TestRecordedCommand::testDefaultConstructor()
{
    RecordedCommand defaultCmd;
    
    QCOMPARE(defaultCmd.timestamp, 0);
    QVERIFY(defaultCmd.command.isEmpty());
}

void TestRecordedCommand::testParameterizedConstructor()
{
    RecordedCommand cmd(1234567890, testCommand);
    
    QCOMPARE(cmd.timestamp, 1234567890);
    QCOMPARE(cmd.command["type"].toString(), QString("drive"));
    QCOMPARE(cmd.command["speed"].toDouble(), 150.0);
    QCOMPARE(cmd.command["turn_rate"].toDouble(), 75.0);
}

void TestRecordedCommand::testJsonSerialization()
{
    command->timestamp = 1234567890;
    command->command = testCommand;
    
    QJsonObject json = command->toJson();
    
    QCOMPARE(json["timestamp"].toInt(), 1234567890);
    QCOMPARE(json["type"].toString(), QString("drive"));
    QCOMPARE(json["speed"].toDouble(), 150.0);
    QCOMPARE(json["turn_rate"].toDouble(), 75.0);
}

void TestRecordedCommand::testJsonDeserialization()
{
    command->fromJson(testJson);
    
    QCOMPARE(command->timestamp, 1234567890);
    QCOMPARE(command->command["type"].toString(), QString("drive"));
    QCOMPARE(command->command["speed"].toDouble(), 150.0);
    QCOMPARE(command->command["turn_rate"].toDouble(), 75.0);
}

void TestRecordedCommand::testEquality()
{
    RecordedCommand cmd1(1234567890, testCommand);
    RecordedCommand cmd2(1234567890, testCommand);
    
    QVERIFY(cmd1 == cmd2);
    
    // Different timestamp
    cmd2.timestamp = 1234567891;
    QVERIFY(!(cmd1 == cmd2));
    
    // Different command
    cmd2.timestamp = 1234567890;
    cmd2.command["speed"] = 200.0;
    QVERIFY(!(cmd1 == cmd2));
}

void TestRecordedCommand::testInequality()
{
    RecordedCommand cmd1(1234567890, testCommand);
    RecordedCommand cmd2(1234567890, testCommand);
    
    QVERIFY(!(cmd1 != cmd2));
    
    // Different timestamp
    cmd2.timestamp = 1234567891;
    QVERIFY(cmd1 != cmd2);
}

void TestRecordedCommand::testEmptyJson()
{
    QJsonObject emptyJson;
    command->fromJson(emptyJson);
    
    QCOMPARE(command->timestamp, 0);
    QVERIFY(command->command.isEmpty());
}

void TestRecordedCommand::testInvalidJson()
{
    QJsonObject invalidJson;
    invalidJson["timestamp"] = "invalid_timestamp";
    invalidJson["speed"] = QJsonValue::Null;
    invalidJson["type"] = QJsonValue::Undefined;
    
    command->fromJson(invalidJson);
    
    // Should handle invalid data gracefully
    QCOMPARE(command->timestamp, 0);
    QVERIFY(command->command.contains("speed"));
    QVERIFY(command->command.contains("type"));
}

void TestRecordedCommand::testLargeTimestamp()
{
    qint64 largeTimestamp = 9223372036854775807LL; // Max qint64
    command->timestamp = largeTimestamp;
    
    QJsonObject json = command->toJson();
    QCOMPARE(json["timestamp"].toVariant().toLongLong(), largeTimestamp);
    
    RecordedCommand cmd2;
    cmd2.fromJson(json);
    QCOMPARE(cmd2.timestamp, largeTimestamp);
}

void TestRecordedCommand::testNegativeTimestamp()
{
    qint64 negativeTimestamp = -1234567890;
    command->timestamp = negativeTimestamp;
    
    QJsonObject json = command->toJson();
    QCOMPARE(json["timestamp"].toVariant().toLongLong(), negativeTimestamp);
    
    RecordedCommand cmd2;
    cmd2.fromJson(json);
    QCOMPARE(cmd2.timestamp, negativeTimestamp);
}

void TestRecordedCommand::testComplexCommand()
{
    // Create complex command with nested data
    QVariantHash complexCmd;
    complexCmd["type"] = "complex";
    complexCmd["speed"] = 100.0;
    complexCmd["turn_rate"] = 50.0;
    complexCmd["arm1"] = 25.0;
    complexCmd["arm2"] = -30.0;
    complexCmd["duration"] = 500;
    complexCmd["priority"] = "high";
    
    QVariantHash metadata;
    metadata["source"] = "user";
    metadata["validated"] = true;
    complexCmd["metadata"] = metadata;
    
    command->timestamp = 1234567890;
    command->command = complexCmd;
    
    QJsonObject json = command->toJson();
    
    // Verify serialization
    QCOMPARE(json["type"].toString(), QString("complex"));
    QCOMPARE(json["speed"].toDouble(), 100.0);
    QCOMPARE(json["turn_rate"].toDouble(), 50.0);
    QCOMPARE(json["arm1"].toDouble(), 25.0);
    QCOMPARE(json["arm2"].toDouble(), -30.0);
    QCOMPARE(json["duration"].toInt(), 500);
    QCOMPARE(json["priority"].toString(), QString("high"));
    
    // Verify metadata
    QJsonObject metadataJson = json["metadata"].toObject();
    QCOMPARE(metadataJson["source"].toString(), QString("user"));
    QCOMPARE(metadataJson["validated"].toBool(), true);
    
    // Test deserialization
    RecordedCommand cmd2;
    cmd2.fromJson(json);
    
    QCOMPARE(cmd2.timestamp, 1234567890);
    QCOMPARE(cmd2.command["type"].toString(), QString("complex"));
    QCOMPARE(cmd2.command["speed"].toDouble(), 100.0);
    QCOMPARE(cmd2.command["turn_rate"].toDouble(), 50.0);
    QCOMPARE(cmd2.command["arm1"].toDouble(), 25.0);
    QCOMPARE(cmd2.command["arm2"].toDouble(), -30.0);
    QCOMPARE(cmd2.command["duration"].toInt(), 500);
    QCOMPARE(cmd2.command["priority"].toString(), QString("high"));
    
    // Verify metadata deserialization
    QVariantHash deserializedMetadata = cmd2.command["metadata"].toHash();
    QCOMPARE(deserializedMetadata["source"].toString(), QString("user"));
    QCOMPARE(deserializedMetadata["validated"].toBool(), true);
}

void TestRecordedCommand::testSerializationPerformance()
{
    command->timestamp = 1234567890;
    command->command = testCommand;
    
    QBENCHMARK {
        command->toJson();
    }
}

void TestRecordedCommand::testDeserializationPerformance()
{
    QBENCHMARK {
        command->fromJson(testJson);
    }
}

QTEST_MAIN(TestRecordedCommand)
#include "test_recorded_command.moc" 