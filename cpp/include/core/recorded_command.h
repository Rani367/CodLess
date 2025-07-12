#pragma once

#include <QString>
#include <QJsonObject>
#include <QVariantHash>

class RecordedCommand {
public:
    RecordedCommand();
    RecordedCommand(double timestamp, const QString& commandType, const QVariantHash& parameters);
    
    double timestamp = 0.0;
    QString commandType;
    QVariantHash parameters;
    
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
    
    bool operator==(const RecordedCommand& other) const;
    bool operator!=(const RecordedCommand& other) const;
}; 