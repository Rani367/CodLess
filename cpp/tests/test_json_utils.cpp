#include <QtTest/QtTest>
#include <QJsonObject>
#include <QJsonDocument>
#include <QJsonArray>
#include <QVariantHash>
#include "utils/json_utils.h"

class TestJsonUtils : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    
    // JSON validation tests
    void testValidateJson();
    void testValidateJsonArray();
    void testValidateInvalidJson();
    
    // JSON conversion tests
    void testVariantToJson();
    void testJsonToVariant();
    void testComplexConversion();
    
    // Error handling tests
    void testErrorHandling();
    void testLargeJsonHandling();
    
    // Performance tests
    void testConversionPerformance();
    void testValidationPerformance();
};

void TestJsonUtils::initTestCase()
{
    qDebug() << "Starting JsonUtils tests...";
}

void TestJsonUtils::cleanupTestCase()
{
    qDebug() << "JsonUtils tests completed.";
}

void TestJsonUtils::testValidateJson()
{
    QJsonObject validJson;
    validJson["type"] = "drive";
    validJson["speed"] = 100.0;
    validJson["turn_rate"] = 50.0;
    
    QVERIFY(JsonUtils::isValidJson(validJson));
    
    QJsonObject invalidJson;
    invalidJson["invalid_key"] = QJsonValue::Undefined;
    
    // Should handle gracefully
    QVERIFY(JsonUtils::isValidJson(invalidJson));
}

void TestJsonUtils::testValidateJsonArray()
{
    QJsonArray validArray;
    validArray.append(QJsonValue("test"));
    validArray.append(QJsonValue(123));
    validArray.append(QJsonValue(true));
    
    QVERIFY(JsonUtils::isValidJsonArray(validArray));
    
    QJsonArray emptyArray;
    QVERIFY(JsonUtils::isValidJsonArray(emptyArray));
}

void TestJsonUtils::testValidateInvalidJson()
{
    QJsonObject testJson;
    testJson["null_value"] = QJsonValue::Null;
    testJson["undefined_value"] = QJsonValue::Undefined;
    
    // Should handle null/undefined values
    QVERIFY(JsonUtils::isValidJson(testJson));
}

void TestJsonUtils::testVariantToJson()
{
    QVariantHash variant;
    variant["string"] = "test";
    variant["integer"] = 42;
    variant["double"] = 3.14;
    variant["boolean"] = true;
    
    QJsonObject json = JsonUtils::variantToJson(variant);
    
    QCOMPARE(json["string"].toString(), QString("test"));
    QCOMPARE(json["integer"].toInt(), 42);
    QCOMPARE(json["double"].toDouble(), 3.14);
    QCOMPARE(json["boolean"].toBool(), true);
}

void TestJsonUtils::testJsonToVariant()
{
    QJsonObject json;
    json["string"] = "test";
    json["integer"] = 42;
    json["double"] = 3.14;
    json["boolean"] = true;
    
    QVariantHash variant = JsonUtils::jsonToVariant(json);
    
    QCOMPARE(variant["string"].toString(), QString("test"));
    QCOMPARE(variant["integer"].toInt(), 42);
    QCOMPARE(variant["double"].toDouble(), 3.14);
    QCOMPARE(variant["boolean"].toBool(), true);
}

void TestJsonUtils::testComplexConversion()
{
    QVariantHash originalVariant;
    originalVariant["simple"] = "value";
    
    QVariantHash nestedVariant;
    nestedVariant["nested_string"] = "nested_value";
    nestedVariant["nested_number"] = 123;
    originalVariant["nested"] = nestedVariant;
    
    QVariantList list;
    list.append("item1");
    list.append("item2");
    list.append(456);
    originalVariant["list"] = list;
    
    // Convert to JSON and back
    QJsonObject json = JsonUtils::variantToJson(originalVariant);
    QVariantHash convertedVariant = JsonUtils::jsonToVariant(json);
    
    QCOMPARE(convertedVariant["simple"].toString(), QString("value"));
    
    QVariantHash convertedNested = convertedVariant["nested"].toHash();
    QCOMPARE(convertedNested["nested_string"].toString(), QString("nested_value"));
    QCOMPARE(convertedNested["nested_number"].toInt(), 123);
    
    QVariantList convertedList = convertedVariant["list"].toList();
    QCOMPARE(convertedList.size(), 3);
    QCOMPARE(convertedList[0].toString(), QString("item1"));
    QCOMPARE(convertedList[1].toString(), QString("item2"));
    QCOMPARE(convertedList[2].toInt(), 456);
}

void TestJsonUtils::testErrorHandling()
{
    QJsonObject invalidJson;
    invalidJson["test"] = QJsonValue::Undefined;
    
    // Should handle invalid JSON gracefully
    QVariantHash result = JsonUtils::jsonToVariant(invalidJson);
    QVERIFY(result.contains("test"));
    
    QVariantHash invalidVariant;
    invalidVariant["invalid"] = QVariant();
    
    // Should handle invalid variants gracefully
    QJsonObject jsonResult = JsonUtils::variantToJson(invalidVariant);
    QVERIFY(jsonResult.contains("invalid"));
}

void TestJsonUtils::testLargeJsonHandling()
{
    QJsonObject largeJson;
    
    // Create large JSON object
    for (int i = 0; i < 1000; ++i) {
        largeJson[QString("key_%1").arg(i)] = QString("value_%1").arg(i);
    }
    
    // Should handle large JSON objects
    QVariantHash result = JsonUtils::jsonToVariant(largeJson);
    QCOMPARE(result.size(), 1000);
    QCOMPARE(result["key_0"].toString(), QString("value_0"));
    QCOMPARE(result["key_999"].toString(), QString("value_999"));
}

void TestJsonUtils::testConversionPerformance()
{
    QVariantHash testVariant;
    testVariant["type"] = "drive";
    testVariant["speed"] = 100.0;
    testVariant["turn_rate"] = 50.0;
    
    QBENCHMARK {
        QJsonObject json = JsonUtils::variantToJson(testVariant);
        QVariantHash result = JsonUtils::jsonToVariant(json);
        Q_UNUSED(result);
    }
}

void TestJsonUtils::testValidationPerformance()
{
    QJsonObject testJson;
    testJson["type"] = "drive";
    testJson["speed"] = 100.0;
    testJson["turn_rate"] = 50.0;
    
    QBENCHMARK {
        bool result = JsonUtils::isValidJson(testJson);
        Q_UNUSED(result);
    }
}

QTEST_MAIN(TestJsonUtils)
#include "test_json_utils.moc" 