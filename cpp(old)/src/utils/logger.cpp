#include "utils/logger.h"
#include <QStandardPaths>
#include <QDir>
#include <QTextStream>
#include <QThread>
#include <QElapsedTimer>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMutexLocker>
#include <iostream>

Q_LOGGING_CATEGORY(loggerCategory, "logger")

Logger::Logger()
    : currentLevel(LogLevel::Info)
    , targets(OutputTarget::Console | OutputTarget::File)
    , maxFileSize(10 * 1024 * 1024) // 10MB
    , maxBackupFiles(5)
    , startTime(QDateTime::currentDateTime())
{
    // Set default log file
    QString logDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/logs";
    QDir().mkpath(logDir);
    setLogFile(logDir + "/codless.log");
    
    // Initialize statistics
    levelCounts.clear();
    categoryCounts.clear();
}

Logger::~Logger()
{
    flush();
    if (logFile && logFile->isOpen()) {
        logFile->close();
    }
}

Logger& Logger::instance()
{
    static Logger instance;
    return instance;
}

void Logger::setLogLevel(LogLevel level)
{
    QMutexLocker locker(&logMutex);
    currentLevel = level;
}

void Logger::setOutputTargets(OutputTargets targets)
{
    QMutexLocker locker(&logMutex);
    this->targets = targets;
}

void Logger::setLogFile(const QString& filename)
{
    QMutexLocker locker(&logMutex);
    logFilename = filename;
    
    // Close existing file
    if (logFile && logFile->isOpen()) {
        logFile->close();
    }
    
    // Open new file
    logFile = std::make_unique<QFile>(filename);
    if (logFile->open(QIODevice::WriteOnly | QIODevice::Append)) {
        logStream = std::make_unique<QTextStream>(logFile.get());
        logStream->setCodec("UTF-8");
    } else {
        qCritical() << "Failed to open log file:" << filename;
    }
}

void Logger::setMaxFileSize(qint64 maxSize)
{
    QMutexLocker locker(&logMutex);
    maxFileSize = maxSize;
}

void Logger::setMaxBackupFiles(int maxFiles)
{
    QMutexLocker locker(&logMutex);
    maxBackupFiles = maxFiles;
}

void Logger::setCallback(std::function<void(LogLevel, const QString&, const QString&)> callback)
{
    QMutexLocker locker(&logMutex);
    logCallback = std::move(callback);
}

void Logger::log(LogLevel level, const QString& message, const QString& category)
{
    if (level < currentLevel) {
        return;
    }
    
    QMutexLocker locker(&logMutex);
    
    // Update statistics
    levelCounts[level]++;
    categoryCounts[category]++;
    
    QString formattedEntry = formatLogEntry(level, message, category);
    
    if (targets & OutputTarget::Console) {
        writeToConsole(formattedEntry);
    }
    
    if (targets & OutputTarget::File) {
        writeToFile(formattedEntry);
    }
    
    if (targets & OutputTarget::Callback) {
        writeToCallback(level, message, category);
    }
    
    emit logEntryAdded(level, message, category);
}

void Logger::trace(const QString& message, const QString& category)
{
    log(LogLevel::Trace, message, category);
}

void Logger::debug(const QString& message, const QString& category)
{
    log(LogLevel::Debug, message, category);
}

void Logger::info(const QString& message, const QString& category)
{
    log(LogLevel::Info, message, category);
}

void Logger::warning(const QString& message, const QString& category)
{
    log(LogLevel::Warning, message, category);
}

void Logger::error(const QString& message, const QString& category)
{
    log(LogLevel::Error, message, category);
}

void Logger::critical(const QString& message, const QString& category)
{
    log(LogLevel::Critical, message, category);
}

void Logger::flush()
{
    QMutexLocker locker(&logMutex);
    if (logStream) {
        logStream->flush();
    }
    if (logFile) {
        logFile->flush();
    }
}

void Logger::rotate()
{
    QMutexLocker locker(&logMutex);
    
    if (!logFile || logFilename.isEmpty()) {
        return;
    }
    
    // Close current file
    if (logFile->isOpen()) {
        logFile->close();
    }
    
    // Rotate backup files
    for (int i = maxBackupFiles - 1; i >= 1; --i) {
        QString oldName = QString("%1.%2").arg(logFilename).arg(i);
        QString newName = QString("%1.%2").arg(logFilename).arg(i + 1);
        
        if (QFile::exists(oldName)) {
            QFile::remove(newName);
            QFile::rename(oldName, newName);
        }
    }
    
    // Move current file to .1
    if (QFile::exists(logFilename)) {
        QString backupName = QString("%1.1").arg(logFilename);
        QFile::remove(backupName);
        QFile::rename(logFilename, backupName);
    }
    
    // Reopen new file
    if (logFile->open(QIODevice::WriteOnly | QIODevice::Append)) {
        logStream = std::make_unique<QTextStream>(logFile.get());
        logStream->setCodec("UTF-8");
    }
}

QString Logger::formatLogEntry(LogLevel level, const QString& message, const QString& category)
{
    QString timestamp = QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm:ss.zzz");
    QString levelStr = levelToString(level).toUpper();
    QString threadId = QString::number(reinterpret_cast<quintptr>(QThread::currentThread()), 16);
    
    return QString("[%1] [%2] [%3] [%4] %5")
           .arg(timestamp)
           .arg(levelStr)
           .arg(category)
           .arg(threadId)
           .arg(message);
}

QString Logger::levelToString(LogLevel level)
{
    switch (level) {
        case LogLevel::Trace: return "TRACE";
        case LogLevel::Debug: return "DEBUG";
        case LogLevel::Info: return "INFO";
        case LogLevel::Warning: return "WARN";
        case LogLevel::Error: return "ERROR";
        case LogLevel::Critical: return "CRIT";
        default: return "UNKNOWN";
    }
}

Logger::LogLevel Logger::stringToLevel(const QString& levelStr)
{
    QString upper = levelStr.toUpper();
    if (upper == "TRACE") return LogLevel::Trace;
    if (upper == "DEBUG") return LogLevel::Debug;
    if (upper == "INFO") return LogLevel::Info;
    if (upper == "WARN" || upper == "WARNING") return LogLevel::Warning;
    if (upper == "ERROR") return LogLevel::Error;
    if (upper == "CRIT" || upper == "CRITICAL") return LogLevel::Critical;
    return LogLevel::Info;
}

void Logger::logPerformance(const QString& operation, qint64 durationMs)
{
    QString message = QString("Performance: %1 took %2ms").arg(operation).arg(durationMs);
    log(LogLevel::Info, message, "performance");
}

void Logger::logMemoryUsage(const QString& component, qint64 memoryBytes)
{
    QString message = QString("Memory: %1 using %2 bytes").arg(component).arg(memoryBytes);
    log(LogLevel::Debug, message, "memory");
}

void Logger::logStructured(LogLevel level, const QString& event, const QVariantHash& data)
{
    QJsonObject jsonObj;
    jsonObj["event"] = event;
    jsonObj["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    
    for (auto it = data.begin(); it != data.end(); ++it) {
        jsonObj[it.key()] = QJsonValue::fromVariant(it.value());
    }
    
    QJsonDocument doc(jsonObj);
    QString message = QString("Structured: %1").arg(doc.toJson(QJsonDocument::Compact));
    log(level, message, "structured");
}

void Logger::writeToFile(const QString& entry)
{
    if (!logStream) {
        return;
    }
    
    *logStream << entry << Qt::endl;
    logStream->flush();
    
    // Check if rotation is needed
    checkFileRotation();
}

void Logger::writeToConsole(const QString& entry)
{
    std::cout << entry.toStdString() << std::endl;
}

void Logger::writeToCallback(LogLevel level, const QString& message, const QString& category)
{
    if (logCallback) {
        logCallback(level, message, category);
    }
}

void Logger::checkFileRotation()
{
    if (logFile && logFile->size() > maxFileSize) {
        rotate();
    }
}

QString Logger::getColoredOutput(LogLevel level, const QString& message)
{
    const QString reset = "\033[0m";
    QString color;
    
    switch (level) {
        case LogLevel::Trace: color = "\033[37m"; break;    // White
        case LogLevel::Debug: color = "\033[36m"; break;    // Cyan
        case LogLevel::Info: color = "\033[32m"; break;     // Green
        case LogLevel::Warning: color = "\033[33m"; break;  // Yellow
        case LogLevel::Error: color = "\033[31m"; break;    // Red
        case LogLevel::Critical: color = "\033[35m"; break; // Magenta
        default: color = ""; break;
    }
    
    return color + message + reset;
}

// ScopedPerformanceLogger implementation
ScopedPerformanceLogger::ScopedPerformanceLogger(const QString& operation, const QString& category)
    : operation(operation), category(category)
{
    timer.start();
}

ScopedPerformanceLogger::~ScopedPerformanceLogger()
{
    qint64 elapsed = timer.elapsed();
    Logger::instance().logPerformance(operation, elapsed);
} 