#pragma once

#include <exception>
#include <QString>
#include <QVariant>
#include <QDebug>

// Base exception class for all CodLess exceptions
class CodLessException : public std::exception
{
public:
    explicit CodLessException(const QString& message, const QString& context = "");
    virtual ~CodLessException() = default;
    
    const char* what() const noexcept override;
    QString getMessage() const;
    QString getContext() const;
    QString getFullMessage() const;
    
    virtual QString getType() const { return "CodLessException"; }
    
protected:
    QString message;
    QString context;
    mutable std::string whatString;
};

// Configuration related exceptions
class ConfigurationException : public CodLessException
{
public:
    explicit ConfigurationException(const QString& message, const QString& context = "");
    QString getType() const override { return "ConfigurationException"; }
};

class InvalidConfigurationException : public ConfigurationException
{
public:
    explicit InvalidConfigurationException(const QString& field, const QVariant& value);
    QString getType() const override { return "InvalidConfigurationException"; }
    QString getField() const { return field; }
    QVariant getValue() const { return value; }
    
private:
    QString field;
    QVariant value;
};

// Hardware/BLE related exceptions
class HardwareException : public CodLessException
{
public:
    explicit HardwareException(const QString& message, const QString& context = "");
    QString getType() const override { return "HardwareException"; }
};

class BLEException : public HardwareException
{
public:
    explicit BLEException(const QString& message, const QString& context = "");
    QString getType() const override { return "BLEException"; }
};

class DeviceNotFoundException : public BLEException
{
public:
    explicit DeviceNotFoundException(const QString& deviceName);
    QString getType() const override { return "DeviceNotFoundException"; }
    QString getDeviceName() const { return deviceName; }
    
private:
    QString deviceName;
};

class ConnectionException : public BLEException
{
public:
    explicit ConnectionException(const QString& message, const QString& deviceName = "");
    QString getType() const override { return "ConnectionException"; }
    QString getDeviceName() const { return deviceName; }
    
private:
    QString deviceName;
};

class CommandTimeoutException : public BLEException
{
public:
    explicit CommandTimeoutException(const QString& command, int timeoutMs);
    QString getType() const override { return "CommandTimeoutException"; }
    QString getCommand() const { return command; }
    int getTimeoutMs() const { return timeoutMs; }
    
private:
    QString command;
    int timeoutMs;
};

// Simulation related exceptions
class SimulationException : public CodLessException
{
public:
    explicit SimulationException(const QString& message, const QString& context = "");
    QString getType() const override { return "SimulationException"; }
};

class PhysicsException : public SimulationException
{
public:
    explicit PhysicsException(const QString& message, const QString& context = "");
    QString getType() const override { return "PhysicsException"; }
};

class InvalidCommandException : public SimulationException
{
public:
    explicit InvalidCommandException(const QString& commandType, const QString& reason);
    QString getType() const override { return "InvalidCommandException"; }
    QString getCommandType() const { return commandType; }
    QString getReason() const { return reason; }
    
private:
    QString commandType;
    QString reason;
};

// File I/O related exceptions
class FileException : public CodLessException
{
public:
    explicit FileException(const QString& message, const QString& filename = "");
    QString getType() const override { return "FileException"; }
    QString getFilename() const { return filename; }
    
private:
    QString filename;
};

class FileNotFoundException : public FileException
{
public:
    explicit FileNotFoundException(const QString& filename);
    QString getType() const override { return "FileNotFoundException"; }
};

class FilePermissionException : public FileException
{
public:
    explicit FilePermissionException(const QString& filename, const QString& operation);
    QString getType() const override { return "FilePermissionException"; }
    QString getOperation() const { return operation; }
    
private:
    QString operation;
};

class FileCorruptedException : public FileException
{
public:
    explicit FileCorruptedException(const QString& filename, const QString& reason);
    QString getType() const override { return "FileCorruptedException"; }
    QString getReason() const { return reason; }
    
private:
    QString reason;
};

// JSON/Data related exceptions
class DataException : public CodLessException
{
public:
    explicit DataException(const QString& message, const QString& context = "");
    QString getType() const override { return "DataException"; }
};

class JsonException : public DataException
{
public:
    explicit JsonException(const QString& message, const QString& context = "");
    QString getType() const override { return "JsonException"; }
};

class SerializationException : public JsonException
{
public:
    explicit SerializationException(const QString& objectType, const QString& reason);
    QString getType() const override { return "SerializationException"; }
    QString getObjectType() const { return objectType; }
    QString getReason() const { return reason; }
    
private:
    QString objectType;
    QString reason;
};

class ValidationException : public DataException
{
public:
    explicit ValidationException(const QString& field, const QString& reason);
    QString getType() const override { return "ValidationException"; }
    QString getField() const { return field; }
    QString getReason() const { return reason; }
    
private:
    QString field;
    QString reason;
};

// UI/GUI related exceptions
class UIException : public CodLessException
{
public:
    explicit UIException(const QString& message, const QString& context = "");
    QString getType() const override { return "UIException"; }
};

class WindowException : public UIException
{
public:
    explicit WindowException(const QString& message, const QString& windowName = "");
    QString getType() const override { return "WindowException"; }
    QString getWindowName() const { return windowName; }
    
private:
    QString windowName;
};

// Recording/Playback related exceptions
class RecordingException : public CodLessException
{
public:
    explicit RecordingException(const QString& message, const QString& context = "");
    QString getType() const override { return "RecordingException"; }
};

class PlaybackException : public RecordingException
{
public:
    explicit PlaybackException(const QString& message, const QString& runName = "");
    QString getType() const override { return "PlaybackException"; }
    QString getRunName() const { return runName; }
    
private:
    QString runName;
};

class RecordingStateException : public RecordingException
{
public:
    explicit RecordingStateException(const QString& currentState, const QString& attemptedAction);
    QString getType() const override { return "RecordingStateException"; }
    QString getCurrentState() const { return currentState; }
    QString getAttemptedAction() const { return attemptedAction; }
    
private:
    QString currentState;
    QString attemptedAction;
};

// Performance/Resource related exceptions
class ResourceException : public CodLessException
{
public:
    explicit ResourceException(const QString& message, const QString& resource = "");
    QString getType() const override { return "ResourceException"; }
    QString getResource() const { return resource; }
    
private:
    QString resource;
};

class MemoryException : public ResourceException
{
public:
    explicit MemoryException(const QString& message, qint64 requestedSize = -1);
    QString getType() const override { return "MemoryException"; }
    qint64 getRequestedSize() const { return requestedSize; }
    
private:
    qint64 requestedSize;
};

class PerformanceException : public ResourceException
{
public:
    explicit PerformanceException(const QString& operation, qint64 actualTime, qint64 expectedTime);
    QString getType() const override { return "PerformanceException"; }
    QString getOperation() const { return operation; }
    qint64 getActualTime() const { return actualTime; }
    qint64 getExpectedTime() const { return expectedTime; }
    
private:
    QString operation;
    qint64 actualTime;
    qint64 expectedTime;
};

// Exception utilities
namespace ExceptionUtils
{
    // Log exception with appropriate level
    void logException(const CodLessException& e);
    
    // Create user-friendly error message
    QString createUserMessage(const CodLessException& e);
    
    // Handle exception with appropriate UI response
    void handleException(const CodLessException& e);
    
    // Convert standard exceptions to CodLess exceptions
    CodLessException wrapStandardException(const std::exception& e, const QString& context = "");
    
    // Exception reporter for debugging
    void reportException(const CodLessException& e, const QString& additionalInfo = "");
} 