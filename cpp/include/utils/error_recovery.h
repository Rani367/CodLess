#pragma once

#include <QObject>
#include <QTimer>
#include <QMutex>
#include <QHash>
#include <QQueue>
#include <QJsonObject>
#include <functional>
#include <memory>
#include <exception>

/**
 * @brief Advanced error recovery and fault tolerance system
 * 
 * This system provides comprehensive error handling and recovery capabilities:
 * - Automatic connection recovery for BLE failures
 * - Graceful degradation when hardware is unavailable
 * - State recovery after application crashes
 * - Automatic retry mechanisms with exponential backoff
 * - Error pattern analysis and prevention
 * - Circuit breaker pattern for failing operations
 * - Fallback mechanisms for critical operations
 */
class ErrorRecovery : public QObject {
    Q_OBJECT

public:
    enum class ErrorType {
        BLEConnection,
        HardwareCommunication,
        FileSystem,
        Network,
        Memory,
        Physics,
        UI,
        Configuration,
        Unknown
    };

    enum class RecoveryStrategy {
        Retry,
        Fallback,
        Graceful,
        Restart,
        Ignore,
        UserIntervention
    };

    enum class ErrorSeverity {
        Low,
        Medium,
        High,
        Critical
    };

    struct ErrorInfo {
        ErrorType type;
        QString component;
        QString message;
        QString details;
        ErrorSeverity severity;
        QDateTime timestamp;
        int occurrenceCount;
        QJsonObject context;
    };

    struct RecoveryAction {
        RecoveryStrategy strategy;
        std::function<bool()> action;
        QString description;
        int maxRetries;
        int retryDelay;
        bool requiresUserConfirmation;
    };

    explicit ErrorRecovery(QObject* parent = nullptr);
    ~ErrorRecovery() override;

    // Error reporting and handling
    void reportError(ErrorType type, const QString& component, const QString& message, 
                    const QString& details = "", ErrorSeverity severity = ErrorSeverity::Medium);
    void reportException(const std::exception& exception, const QString& component);
    void reportCriticalError(const QString& component, const QString& message);

    // Recovery strategy registration
    void registerRecoveryAction(ErrorType type, const QString& component, 
                               const RecoveryAction& action);
    void setDefaultRecoveryStrategy(ErrorType type, RecoveryStrategy strategy);
    void setErrorThreshold(ErrorType type, int maxErrors, int timeWindowSeconds);

    // Automatic recovery control
    void enableAutoRecovery(bool enabled);
    void setRetryStrategy(ErrorType type, int maxRetries, int baseDelay, double backoffMultiplier);
    void enableCircuitBreaker(ErrorType type, int failureThreshold, int timeoutSeconds);

    // BLE connection recovery
    void enableBLEAutoReconnect(bool enabled);
    void setBLEReconnectDelay(int seconds);
    void setBLEMaxReconnectAttempts(int attempts);

    // State recovery
    void saveRecoveryState();
    void loadRecoveryState();
    void clearRecoveryState();
    bool hasRecoveryState() const;

    // Error analysis
    QList<ErrorInfo> getRecentErrors(int hours = 24) const;
    QHash<ErrorType, int> getErrorStatistics() const;
    QStringList getErrorPatterns() const;
    bool isErrorTrendIncreasing(ErrorType type) const;

    // Recovery status
    bool isRecoveryInProgress() const;
    QString getCurrentRecoveryOperation() const;
    double getRecoveryProgress() const;
    QStringList getActiveRecoveryActions() const;

    // Configuration
    void setGracefulDegradationEnabled(bool enabled);
    void setUserInterventionTimeout(int seconds);
    void setErrorLogRetentionDays(int days);

signals:
    void errorOccurred(const ErrorInfo& error);
    void recoveryStarted(ErrorType type, const QString& component);
    void recoveryCompleted(ErrorType type, const QString& component, bool success);
    void recoveryFailed(ErrorType type, const QString& component, const QString& reason);
    void userInterventionRequired(const QString& message, const QString& suggestion);
    void circuitBreakerTripped(ErrorType type, const QString& component);
    void systemDegraded(const QString& component, const QString& reason);

private slots:
    void processRecoveryQueue();
    void checkCircuitBreakers();
    void cleanupOldErrors();
    void attemptAutoRecovery();
    void monitorSystemHealth();

private:
    struct CircuitBreaker {
        int failureCount = 0;
        int failureThreshold = 5;
        int timeoutSeconds = 60;
        QDateTime lastFailure;
        bool isOpen = false;
        QTimer* resetTimer = nullptr;
    };

    struct RetryConfig {
        int maxRetries = 3;
        int baseDelay = 1000; // ms
        double backoffMultiplier = 2.0;
        int currentRetry = 0;
    };

    void initializeRecovery();
    void setupDefaultStrategies();
    void executeRecoveryAction(const ErrorInfo& error);
    bool attemptRecovery(const ErrorInfo& error, const RecoveryAction& action);
    void notifyUserIntervention(const QString& message);
    void updateErrorStatistics(const ErrorInfo& error);
    void analyzeErrorPatterns();
    void triggerCircuitBreaker(ErrorType type, const QString& component);
    void resetCircuitBreaker(ErrorType type, const QString& component);
    bool isCircuitBreakerOpen(ErrorType type, const QString& component) const;
    void degradeGracefully(const QString& component, const QString& reason);
    void saveErrorLog();
    void loadErrorLog();

    // Configuration
    bool autoRecoveryEnabled;
    bool gracefulDegradationEnabled;
    int userInterventionTimeout;
    int errorLogRetentionDays;

    // Error tracking
    QQueue<ErrorInfo> errorHistory;
    QHash<QString, ErrorInfo> errorMap; // component -> latest error
    QHash<ErrorType, QHash<QString, CircuitBreaker>> circuitBreakers;
    QHash<ErrorType, RetryConfig> retryConfigs;
    QHash<ErrorType, QHash<QString, RecoveryAction>> recoveryActions;
    QHash<ErrorType, RecoveryStrategy> defaultStrategies;

    // Recovery state
    bool recoveryInProgress;
    QString currentRecoveryOperation;
    double recoveryProgress;
    QStringList activeRecoveryActions;
    QJsonObject recoveryState;

    // BLE specific recovery
    bool bleAutoReconnectEnabled;
    int bleReconnectDelay;
    int bleMaxReconnectAttempts;
    int bleCurrentAttempts;

    // Timers
    std::unique_ptr<QTimer> recoveryTimer;
    std::unique_ptr<QTimer> circuitBreakerTimer;
    std::unique_ptr<QTimer> cleanupTimer;
    std::unique_ptr<QTimer> healthMonitorTimer;

    // Thread safety
    mutable QMutex errorMutex;
    mutable QMutex recoveryMutex;

    // Statistics
    QHash<ErrorType, int> errorCounts;
    QHash<ErrorType, QDateTime> lastErrorTime;
    QHash<QString, int> errorPatterns;

    // Constants
    static constexpr int RECOVERY_QUEUE_INTERVAL = 500; // ms
    static constexpr int CIRCUIT_BREAKER_CHECK_INTERVAL = 10000; // ms
    static constexpr int CLEANUP_INTERVAL = 3600000; // 1 hour
    static constexpr int HEALTH_MONITOR_INTERVAL = 30000; // 30 seconds
    static constexpr int MAX_ERROR_HISTORY = 1000;
    static constexpr int DEFAULT_USER_INTERVENTION_TIMEOUT = 30; // seconds
}; 