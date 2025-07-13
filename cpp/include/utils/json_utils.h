#pragma once

#include <QString>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QVariantHash>
#include <QDateTime>

class JsonUtils {
public:
    static QJsonDocument loadJsonFromFile(const QString& filename);
    static bool saveJsonToFile(const QJsonDocument& doc, const QString& filename);
    static QJsonObject variantHashToJsonObject(const QVariantHash& hash);
    static QVariantHash jsonObjectToVariantHash(const QJsonObject& obj);
    static QString formatJsonForDisplay(const QJsonDocument& doc);
    static bool validateJsonStructure(const QJsonObject& obj, const QStringList& requiredFields);
    static QJsonObject createTimestampedEntry(const QJsonObject& data);
    static QString getCurrentTimestamp();
}; 