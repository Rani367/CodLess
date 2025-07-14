#include "utils/json_utils.h"
#include <QFile>
#include <QDir>
#include <QJsonParseError>
#include <QVariant>
#include <QDebug>

QJsonDocument JsonUtils::loadJsonFromFile(const QString& filename) {
    QFile file(filename);
    if (!file.open(QIODevice::ReadOnly)) {
        qWarning() << "Failed to open file for reading:" << filename;
        return QJsonDocument();
    }
    
    QByteArray data = file.readAll();
    file.close();
    
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(data, &error);
    
    if (error.error != QJsonParseError::NoError) {
        qWarning() << "JSON parse error in file" << filename << ":" << error.errorString();
        return QJsonDocument();
    }
    
    return doc;
}

bool JsonUtils::saveJsonToFile(const QJsonDocument& doc, const QString& filename) {
    QFileInfo fileInfo(filename);
    QDir dir = fileInfo.absoluteDir();
    
    if (!dir.exists()) {
        if (!dir.mkpath(".")) {
            qWarning() << "Failed to create directory:" << dir.absolutePath();
            return false;
        }
    }
    
    QFile file(filename);
    if (!file.open(QIODevice::WriteOnly)) {
        qWarning() << "Failed to open file for writing:" << filename;
        return false;
    }
    
    QByteArray jsonData = doc.toJson();
    qint64 bytesWritten = file.write(jsonData);
    file.close();
    
    if (bytesWritten == -1) {
        qWarning() << "Failed to write to file:" << filename;
        return false;
    }
    
    return true;
}

QJsonObject JsonUtils::variantHashToJsonObject(const QVariantHash& hash) {
    QJsonObject obj;
    
    for (auto it = hash.begin(); it != hash.end(); ++it) {
        const QVariant& value = it.value();
        
        // Use userType() for Qt5/Qt6 compatibility instead of typeId()
        switch (value.userType()) {
            case QMetaType::QString:
                obj[it.key()] = value.toString();
                break;
            case QMetaType::Int:
                obj[it.key()] = value.toInt();
                break;
            case QMetaType::Double:
                obj[it.key()] = value.toDouble();
                break;
            case QMetaType::Bool:
                obj[it.key()] = value.toBool();
                break;
            case QMetaType::QVariantHash:
                obj[it.key()] = variantHashToJsonObject(value.toHash());
                break;
            case QMetaType::QVariantList: {
                QJsonArray array;
                QVariantList list = value.toList();
                for (const QVariant& item : list) {
                    if (item.userType() == QMetaType::QVariantHash) {
                        array.append(variantHashToJsonObject(item.toHash()));
                    } else {
                        array.append(QJsonValue::fromVariant(item));
                    }
                }
                obj[it.key()] = array;
                break;
            }
            default:
                obj[it.key()] = QJsonValue::fromVariant(value);
                break;
        }
    }
    
    return obj;
}

QVariantHash JsonUtils::jsonObjectToVariantHash(const QJsonObject& obj) {
    QVariantHash hash;
    
    for (auto it = obj.begin(); it != obj.end(); ++it) {
        const QJsonValue& value = it.value();
        
        if (value.isString()) {
            hash[it.key()] = value.toString();
        } else if (value.isDouble()) {
            hash[it.key()] = value.toDouble();
        } else if (value.isBool()) {
            hash[it.key()] = value.toBool();
        } else if (value.isObject()) {
            hash[it.key()] = jsonObjectToVariantHash(value.toObject());
        } else if (value.isArray()) {
            QVariantList list;
            QJsonArray array = value.toArray();
            for (const QJsonValue& item : array) {
                if (item.isObject()) {
                    list.append(jsonObjectToVariantHash(item.toObject()));
                } else {
                    list.append(item.toVariant());
                }
            }
            hash[it.key()] = list;
        } else {
            hash[it.key()] = value.toVariant();
        }
    }
    
    return hash;
}

QString JsonUtils::formatJsonForDisplay(const QJsonDocument& doc) {
    return doc.toJson(QJsonDocument::Indented);
}

bool JsonUtils::validateJsonStructure(const QJsonObject& obj, const QStringList& requiredFields) {
    for (const QString& field : requiredFields) {
        if (!obj.contains(field)) {
            qWarning() << "Missing required field:" << field;
            return false;
        }
    }
    return true;
}

QJsonObject JsonUtils::createTimestampedEntry(const QJsonObject& data) {
    QJsonObject entry = data;
    entry["timestamp"] = getCurrentTimestamp();
    return entry;
}

QString JsonUtils::getCurrentTimestamp() {
    return QDateTime::currentDateTime().toString(Qt::ISODate);
} 