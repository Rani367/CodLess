#include "utils/exceptions.h"
#include "utils/logger.h"
#include <QMessageBox>
#include <QApplication>
#include <QJsonDocument>
#include <QJsonObject>

// Base CodLessException implementation
CodLessException::CodLessException(const QString& message, const QString& context)
    : message(message), context(context)
{
}

const char* CodLessException::what() const noexcept
{
    whatString = getFullMessage().toStdString();
    return whatString.c_str();
}

QString CodLessException::getMessage() const
{
    return message;
}

QString CodLessException::getContext() const
{
    return context;
}

QString CodLessException::getFullMessage() const
{
    if (context.isEmpty()) {
        return QString("%1: %2").arg(getType(), message);
    }
    return QString("%1 [%2]: %3").arg(getType(), context, message);
}

// Configuration exceptions
ConfigurationException::ConfigurationException(const QString& message, const QString& context)
    : CodLessException(message, context)
{
}

InvalidConfigurationException::InvalidConfigurationException(const QString& field, const QVariant& value)
    : ConfigurationException(QString("Invalid value '%1' for field '%2'").arg(value.toString(), field))
    , field(field), value(value)
{
}

// Hardware exceptions
HardwareException::HardwareException(const QString& message, const QString& context)
    : CodLessException(message, context)
{
}

BLEException::BLEException(const QString& message, const QString& context)
    : HardwareException(message, context)
{
}

DeviceNotFoundException::DeviceNotFoundException(const QString& deviceName)
    : BLEException(QString("Device '%1' not found").arg(deviceName))
    , deviceName(deviceName)
{
}

ConnectionException::ConnectionException(const QString& message, const QString& deviceName)
    : BLEException(message)
    , deviceName(deviceName)
{
}

CommandTimeoutException::CommandTimeoutException(const QString& command, int timeoutMs)
    : BLEException(QString("Command '%1' timed out after %2ms").arg(command).arg(timeoutMs))
    , command(command), timeoutMs(timeoutMs)
{
}

// Simulation exceptions
SimulationException::SimulationException(const QString& message, const QString& context)
    : CodLessException(message, context)
{
}

PhysicsException::PhysicsException(const QString& message, const QString& context)
    : SimulationException(message, context)
{
}

InvalidCommandException::InvalidCommandException(const QString& commandType, const QString& reason)
    : SimulationException(QString("Invalid command '%1': %2").arg(commandType, reason))
    , commandType(commandType), reason(reason)
{
}

// File exceptions
FileException::FileException(const QString& message, const QString& filename)
    : CodLessException(message, filename)
    , filename(filename)
{
}

FileNotFoundException::FileNotFoundException(const QString& filename)
    : FileException(QString("File not found: %1").arg(filename), filename)
{
}

FilePermissionException::FilePermissionException(const QString& filename, const QString& operation)
    : FileException(QString("Permission denied for %1 on file: %2").arg(operation, filename), filename)
    , operation(operation)
{
}

FileCorruptedException::FileCorruptedException(const QString& filename, const QString& reason)
    : FileException(QString("File corrupted: %1 - %2").arg(filename, reason), filename)
    , reason(reason)
{
}

// Data exceptions
DataException::DataException(const QString& message, const QString& context)
    : CodLessException(message, context)
{
}

JsonException::JsonException(const QString& message, const QString& context)
    : DataException(message, context)
{
}

SerializationException::SerializationException(const QString& objectType, const QString& reason)
    : JsonException(QString("Failed to serialize %1: %2").arg(objectType, reason))
    , objectType(objectType), reason(reason)
{
}

ValidationException::ValidationException(const QString& field, const QString& reason)
    : DataException(QString("Validation failed for field '%1': %2").arg(field, reason))
    , field(field), reason(reason)
{
}

// UI exceptions
UIException::UIException(const QString& message, const QString& context)
    : CodLessException(message, context)
{
}

WindowException::WindowException(const QString& message, const QString& windowName)
    : UIException(message, windowName)
    , windowName(windowName)
{
}

// Recording exceptions
RecordingException::RecordingException(const QString& message, const QString& context)
    : CodLessException(message, context)
{
}

PlaybackException::PlaybackException(const QString& message, const QString& runName)
    : RecordingException(message, runName)
    , runName(runName)
{
}

RecordingStateException::RecordingStateException(const QString& currentState, const QString& attemptedAction)
    : RecordingException(QString("Cannot perform '%1' in state '%2'").arg(attemptedAction, currentState))
    , currentState(currentState), attemptedAction(attemptedAction)
{
}

// Resource exceptions
ResourceException::ResourceException(const QString& message, const QString& resource)
    : CodLessException(message, resource)
    , resource(resource)
{
}

MemoryException::MemoryException(const QString& message, qint64 requestedSize)
    : ResourceException(message, "memory")
    , requestedSize(requestedSize)
{
}

PerformanceException::PerformanceException(const QString& operation, qint64 actualTime, qint64 expectedTime)
    : ResourceException(QString("Performance issue in %1: took %2ms, expected %3ms").arg(operation).arg(actualTime).arg(expectedTime))
    , operation(operation), actualTime(actualTime), expectedTime(expectedTime)
{
}

// Exception utilities implementation
namespace ExceptionUtils
{
    void logException(const CodLessException& e)
    {
        Logger::LogLevel level = Logger::LogLevel::Error;
        
        // Determine log level based on exception type
        if (e.getType().contains("Critical") || e.getType().contains("Memory") || e.getType().contains("Performance")) {
            level = Logger::LogLevel::Critical;
        } else if (e.getType().contains("Warning") || e.getType().contains("Validation")) {
            level = Logger::LogLevel::Warning;
        }
        
        Logger::instance().log(level, e.getFullMessage(), "exception");
        
        // Also log structured data for certain exceptions
        QVariantHash exceptionData;
        exceptionData["type"] = e.getType();
        exceptionData["message"] = e.getMessage();
        exceptionData["context"] = e.getContext();
        
        Logger::instance().logStructured(level, "exception_thrown", exceptionData);
    }
    
    QString createUserMessage(const CodLessException& e)
    {
        // Create user-friendly messages based on exception type
        QString userMessage;
        
        if (e.getType().contains("BLE") || e.getType().contains("Connection")) {
            userMessage = "Communication error with robot. Please check connection and try again.";
        } else if (e.getType().contains("File")) {
            userMessage = "File operation failed. Please check file permissions and try again.";
        } else if (e.getType().contains("Configuration")) {
            userMessage = "Configuration error. Please check your settings and try again.";
        } else if (e.getType().contains("Recording")) {
            userMessage = "Recording operation failed. Please try again.";
        } else if (e.getType().contains("Simulation")) {
            userMessage = "Simulation error. Please reset the simulator and try again.";
        } else if (e.getType().contains("Performance")) {
            userMessage = "Performance issue detected. The operation may take longer than expected.";
        } else {
            userMessage = "An unexpected error occurred. Please try again.";
        }
        
        return userMessage;
    }
    
    void handleException(const CodLessException& e)
    {
        // Log the exception
        logException(e);
        
        // Show user-friendly message if GUI is available
        if (QApplication::instance() && QApplication::instance()->thread() == QThread::currentThread()) {
            QString userMessage = createUserMessage(e);
            QString detailedMessage = QString("Error: %1\n\nTechnical details: %2")
                                      .arg(userMessage, e.getFullMessage());
            
            QMessageBox::Icon icon = QMessageBox::Warning;
            if (e.getType().contains("Critical") || e.getType().contains("Memory")) {
                icon = QMessageBox::Critical;
            }
            
            QMessageBox msgBox(icon, "Error", userMessage);
            msgBox.setDetailedText(detailedMessage);
            msgBox.exec();
        }
    }
    
    CodLessException wrapStandardException(const std::exception& e, const QString& context)
    {
        QString message = QString("Standard exception: %1").arg(e.what());
        return CodLessException(message, context);
    }
    
    void reportException(const CodLessException& e, const QString& additionalInfo)
    {
        // Create comprehensive exception report
        QJsonObject report;
        report["type"] = e.getType();
        report["message"] = e.getMessage();
        report["context"] = e.getContext();
        report["full_message"] = e.getFullMessage();
        report["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
        
        if (!additionalInfo.isEmpty()) {
            report["additional_info"] = additionalInfo;
        }
        
        // Add system information
        QJsonObject systemInfo;
        systemInfo["qt_version"] = QT_VERSION_STR;
        systemInfo["application_version"] = QApplication::applicationVersion();
        systemInfo["thread_id"] = QString::number(reinterpret_cast<quintptr>(QThread::currentThread()), 16);
        report["system_info"] = systemInfo;
        
        // Log as structured data
        QVariantHash reportData;
        reportData["exception_report"] = report;
        
        Logger::instance().logStructured(Logger::LogLevel::Error, "exception_report", reportData);
        
        // Also log formatted report
        QJsonDocument doc(report);
        QString formattedReport = doc.toJson(QJsonDocument::Indented);
        Logger::instance().error(QString("Exception Report:\n%1").arg(formattedReport), "exception_report");
    }
} 