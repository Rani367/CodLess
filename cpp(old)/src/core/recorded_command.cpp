#include "core/recorded_command.h"
#include <QJsonValue>
#include <QVariant>

RecordedCommand::RecordedCommand() = default;

RecordedCommand::RecordedCommand(double timestamp, const QString& commandType, const QVariantHash& parameters)
    : timestamp(timestamp), commandType(commandType), parameters(parameters) {}

QJsonObject RecordedCommand::toJson() const {
    QJsonObject json;
    json["timestamp"] = timestamp;
    json["command_type"] = commandType;
    
    QJsonObject params;
    for (auto it = parameters.begin(); it != parameters.end(); ++it) {
        const QVariant& value = it.value();
        // Use userType() for Qt5/Qt6 compatibility instead of typeId()
        if (value.userType() == QMetaType::QString) {
            params[it.key()] = value.toString();
        } else if (value.userType() == QMetaType::Int) {
            params[it.key()] = value.toInt();
        } else if (value.userType() == QMetaType::Double) {
            params[it.key()] = value.toDouble();
        } else if (value.userType() == QMetaType::Bool) {
            params[it.key()] = value.toBool();
        }
    }
    json["parameters"] = params;
    
    return json;
}

void RecordedCommand::fromJson(const QJsonObject& json) {
    timestamp = json["timestamp"].toDouble();
    commandType = json["command_type"].toString();
    
    parameters.clear();
    QJsonObject params = json["parameters"].toObject();
    for (auto it = params.begin(); it != params.end(); ++it) {
        QJsonValue value = it.value();
        if (value.isString()) {
            parameters[it.key()] = value.toString();
        } else if (value.isDouble()) {
            parameters[it.key()] = value.toDouble();
        } else if (value.isBool()) {
            parameters[it.key()] = value.toBool();
        }
    }
}

bool RecordedCommand::operator==(const RecordedCommand& other) const {
    return timestamp == other.timestamp &&
           commandType == other.commandType &&
           parameters == other.parameters;
}

bool RecordedCommand::operator!=(const RecordedCommand& other) const {
    return !(*this == other);
} 