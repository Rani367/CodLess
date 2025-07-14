#pragma once

#include <QString>
#include <QTextStream>
#include <QFile>
#include <QDateTime>
#include <QMutex>
#include <QDebug>
#include <QLoggingCategory>
#include <memory>
#include <functional>

Q_DECLARE_LOGGING_CATEGORY(loggerCategory)

class Logger : public QObject
{
    Q_OBJECT
    
public:
    enum class LogLevel {
        Trace = 0,
        Debug = 1,
        Info = 2,
        Warning = 3,
        Error = 4,
        Critical = 5
    };
    
    enum class OutputTarget {
        Console = 0x01,
        File = 0x02,
        Callback = 0x04,
        All = Console | File | Callback
    };
    Q_DECLARE_FLAGS(OutputTargets, OutputTarget)
    
    static Logger& instance();
    
    // Configuration
    void setLogLevel(LogLevel level);
    void setOutputTargets(OutputTargets targets);
    void setLogFile(const QString& filename);
    void setMaxFileSize(qint64 maxSize);
    void setMaxBackupFiles(int maxFiles);
    void setCallback(std::function<void(LogLevel, const QString&, const QString&)> callback);
    
    // Logging methods
    void log(LogLevel level, const QString& message, const QString& category = "general");
    void trace(const QString& message, const QString& category = "general");
    void debug(const QString& message, const QString& category = "general");
    void info(const QString& message, const QString& category = "general");
    void warning(const QString& message, const QString& category = "general");
    void error(const QString& message, const QString& category = "general");
    void critical(const QString& message, const QString& category = "general");
    
    // Utility methods
    void flush();
    void rotate();
    QString formatLogEntry(LogLevel level, const QString& message, const QString& category);
    static QString levelToString(LogLevel level);
    static LogLevel stringToLevel(const QString& levelStr);
    
    // Performance logging
    void logPerformance(const QString& operation, qint64 durationMs);
    void logMemoryUsage(const QString& component, qint64 memoryBytes);
    
    // Structured logging
    void logStructured(LogLevel level, const QString& event, const QVariantHash& data);
    
signals:
    void logEntryAdded(LogLevel level, const QString& message, const QString& category);
    
private:
    Logger();
    ~Logger();
    
    void writeToFile(const QString& entry);
    void writeToConsole(const QString& entry);
    void writeToCallback(LogLevel level, const QString& message, const QString& category);
    void checkFileRotation();
    QString getColoredOutput(LogLevel level, const QString& message);
    
    LogLevel currentLevel;
    OutputTargets targets;
    QString logFilename;
    qint64 maxFileSize;
    int maxBackupFiles;
    std::function<void(LogLevel, const QString&, const QString&)> logCallback;
    
    std::unique_ptr<QFile> logFile;
    std::unique_ptr<QTextStream> logStream;
    QMutex logMutex;
    
    // Statistics
    QHash<LogLevel, qint64> levelCounts;
    QHash<QString, qint64> categoryCounts;
    QDateTime startTime;
};

Q_DECLARE_OPERATORS_FOR_FLAGS(Logger::OutputTargets)

// Convenience macros
#define LOG_TRACE(message, category) Logger::instance().trace(message, category)
#define LOG_DEBUG(message, category) Logger::instance().debug(message, category)
#define LOG_INFO(message, category) Logger::instance().info(message, category)
#define LOG_WARNING(message, category) Logger::instance().warning(message, category)
#define LOG_ERROR(message, category) Logger::instance().error(message, category)
#define LOG_CRITICAL(message, category) Logger::instance().critical(message, category)

// Performance logging macros
#define LOG_PERFORMANCE(operation, duration) Logger::instance().logPerformance(operation, duration)
#define LOG_MEMORY(component, memory) Logger::instance().logMemoryUsage(component, memory)

// Scoped performance logger
class ScopedPerformanceLogger
{
public:
    ScopedPerformanceLogger(const QString& operation, const QString& category = "performance");
    ~ScopedPerformanceLogger();
    
private:
    QString operation;
    QString category;
    QElapsedTimer timer;
};

#define SCOPED_PERFORMANCE_LOG(operation) ScopedPerformanceLogger _perf_logger(operation) 