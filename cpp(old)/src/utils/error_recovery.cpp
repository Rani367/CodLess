#include "../include/utils/error_recovery.h"

ErrorRecovery::ErrorRecovery(QObject* parent)
    : QObject(parent), autoRecoveryEnabled(true), gracefulDegradationEnabled(true),
      userInterventionTimeout(30), errorLogRetentionDays(30),
      recoveryInProgress(false), recoveryProgress(0.0),
      bleAutoReconnectEnabled(true), bleReconnectDelay(5), bleMaxReconnectAttempts(3), bleCurrentAttempts(0) {
    initializeRecovery();
}

ErrorRecovery::~ErrorRecovery() = default;

void ErrorRecovery::reportError(ErrorType type, const QString& component, const QString& message, 
                               const QString& details, ErrorSeverity severity) {
    ErrorInfo error;
    error.type = type;
    error.component = component;
    error.message = message;
    error.details = details;
    error.severity = severity;
    error.timestamp = QDateTime::currentDateTime();
    error.occurrenceCount = 1;
    
    QMutexLocker locker(&errorMutex);
    
    // Check if this error has occurred before
    QString errorKey = QString("%1_%2").arg(component, message);
    if (errorMap.contains(errorKey)) {
        errorMap[errorKey].occurrenceCount++;
    } else {
        errorMap[errorKey] = error;
    }
    
    errorHistory.enqueue(error);
    if (errorHistory.size() > MAX_ERROR_HISTORY) {
        errorHistory.dequeue();
    }
    
    updateErrorStatistics(error);
    emit errorOccurred(error);
    
    if (autoRecoveryEnabled) {
        executeRecoveryAction(error);
    }
}

void ErrorRecovery::reportException(const std::exception& exception, const QString& component) {
    reportError(ErrorType::Unknown, component, "Exception occurred", exception.what(), ErrorSeverity::High);
}

void ErrorRecovery::reportCriticalError(const QString& component, const QString& message) {
    reportError(ErrorType::Unknown, component, message, "", ErrorSeverity::Critical);
}

void ErrorRecovery::registerRecoveryAction(ErrorType type, const QString& component, const RecoveryAction& action) {
    recoveryActions[type][component] = action;
}

void ErrorRecovery::setDefaultRecoveryStrategy(ErrorType type, RecoveryStrategy strategy) {
    defaultStrategies[type] = strategy;
}

void ErrorRecovery::setErrorThreshold(ErrorType type, int maxErrors, int timeWindowSeconds) {
}

void ErrorRecovery::enableAutoRecovery(bool enabled) {
    autoRecoveryEnabled = enabled;
}

void ErrorRecovery::setRetryStrategy(ErrorType type, int maxRetries, int baseDelay, double backoffMultiplier) {
    RetryConfig config;
    config.maxRetries = maxRetries;
    config.baseDelay = baseDelay;
    config.backoffMultiplier = backoffMultiplier;
    retryConfigs[type] = config;
}

void ErrorRecovery::enableCircuitBreaker(ErrorType type, int failureThreshold, int timeoutSeconds) {
    CircuitBreaker breaker;
    breaker.failureThreshold = failureThreshold;
    breaker.timeoutSeconds = timeoutSeconds;
    circuitBreakers[type]["default"] = breaker;
}

void ErrorRecovery::enableBLEAutoReconnect(bool enabled) {
    bleAutoReconnectEnabled = enabled;
}

void ErrorRecovery::setBLEReconnectDelay(int seconds) {
    bleReconnectDelay = seconds;
}

void ErrorRecovery::setBLEMaxReconnectAttempts(int attempts) {
    bleMaxReconnectAttempts = attempts;
}

void ErrorRecovery::saveRecoveryState() {
}

void ErrorRecovery::loadRecoveryState() {
}

void ErrorRecovery::clearRecoveryState() {
    recoveryState = QJsonObject();
}

bool ErrorRecovery::hasRecoveryState() const {
    return !recoveryState.isEmpty();
}

QList<ErrorRecovery::ErrorInfo> ErrorRecovery::getRecentErrors(int hours) const {
    QMutexLocker locker(&errorMutex);
    QList<ErrorInfo> result;
    QDateTime cutoff = QDateTime::currentDateTime().addSecs(-hours * 3600);
    
    for (const auto& error : errorHistory) {
        if (error.timestamp >= cutoff) {
            result.append(error);
        }
    }
    
    return result;
}

QHash<ErrorRecovery::ErrorType, int> ErrorRecovery::getErrorStatistics() const {
    return errorCounts;
}

QStringList ErrorRecovery::getErrorPatterns() const {
    return errorPatterns.keys();
}

bool ErrorRecovery::isErrorTrendIncreasing(ErrorType type) const {
    return false;
}

bool ErrorRecovery::isRecoveryInProgress() const {
    return recoveryInProgress;
}

QString ErrorRecovery::getCurrentRecoveryOperation() const {
    return currentRecoveryOperation;
}

double ErrorRecovery::getRecoveryProgress() const {
    return recoveryProgress;
}

QStringList ErrorRecovery::getActiveRecoveryActions() const {
    return activeRecoveryActions;
}

void ErrorRecovery::setGracefulDegradationEnabled(bool enabled) {
    gracefulDegradationEnabled = enabled;
}

void ErrorRecovery::setUserInterventionTimeout(int seconds) {
    userInterventionTimeout = seconds;
}

void ErrorRecovery::setErrorLogRetentionDays(int days) {
    errorLogRetentionDays = days;
}

void ErrorRecovery::processRecoveryQueue() {
}

void ErrorRecovery::checkCircuitBreakers() {
}

void ErrorRecovery::cleanupOldErrors() {
    QMutexLocker locker(&errorMutex);
    QDateTime cutoff = QDateTime::currentDateTime().addDays(-errorLogRetentionDays);
    
    while (!errorHistory.isEmpty() && errorHistory.front().timestamp < cutoff) {
        errorHistory.dequeue();
    }
}

void ErrorRecovery::attemptAutoRecovery() {
}

void ErrorRecovery::monitorSystemHealth() {
}

void ErrorRecovery::initializeRecovery() {
    setupDefaultStrategies();
    
    recoveryTimer = std::make_unique<QTimer>(this);
    circuitBreakerTimer = std::make_unique<QTimer>(this);
    cleanupTimer = std::make_unique<QTimer>(this);
    healthMonitorTimer = std::make_unique<QTimer>(this);
    
    connect(recoveryTimer.get(), &QTimer::timeout, this, &ErrorRecovery::processRecoveryQueue);
    connect(circuitBreakerTimer.get(), &QTimer::timeout, this, &ErrorRecovery::checkCircuitBreakers);
    connect(cleanupTimer.get(), &QTimer::timeout, this, &ErrorRecovery::cleanupOldErrors);
    connect(healthMonitorTimer.get(), &QTimer::timeout, this, &ErrorRecovery::monitorSystemHealth);
    
    recoveryTimer->start(RECOVERY_QUEUE_INTERVAL);
    circuitBreakerTimer->start(CIRCUIT_BREAKER_CHECK_INTERVAL);
    cleanupTimer->start(CLEANUP_INTERVAL);
    healthMonitorTimer->start(HEALTH_MONITOR_INTERVAL);
}

void ErrorRecovery::setupDefaultStrategies() {
    defaultStrategies[ErrorType::BLEConnection] = RecoveryStrategy::Retry;
    defaultStrategies[ErrorType::HardwareCommunication] = RecoveryStrategy::Retry;
    defaultStrategies[ErrorType::FileSystem] = RecoveryStrategy::Fallback;
    defaultStrategies[ErrorType::Network] = RecoveryStrategy::Retry;
    defaultStrategies[ErrorType::Memory] = RecoveryStrategy::Graceful;
    defaultStrategies[ErrorType::Physics] = RecoveryStrategy::Restart;
    defaultStrategies[ErrorType::UI] = RecoveryStrategy::Graceful;
    defaultStrategies[ErrorType::Configuration] = RecoveryStrategy::Fallback;
}

void ErrorRecovery::executeRecoveryAction(const ErrorInfo& error) {
    if (isCircuitBreakerOpen(error.type, error.component)) {
        return;
    }
    
    emit recoveryStarted(error.type, error.component);
    
    bool success = false;
    if (recoveryActions[error.type].contains(error.component)) {
        success = attemptRecovery(error, recoveryActions[error.type][error.component]);
    } else {
        // Use default strategy
        RecoveryStrategy strategy = defaultStrategies.value(error.type, RecoveryStrategy::UserIntervention);
        RecoveryAction defaultAction;
        defaultAction.strategy = strategy;
        defaultAction.description = "Default recovery action";
        defaultAction.maxRetries = 3;
        defaultAction.retryDelay = 1000;
        success = attemptRecovery(error, defaultAction);
    }
    
    if (success) {
        emit recoveryCompleted(error.type, error.component, true);
    } else {
        emit recoveryCompleted(error.type, error.component, false);
        triggerCircuitBreaker(error.type, error.component);
    }
}

bool ErrorRecovery::attemptRecovery(const ErrorInfo& error, const RecoveryAction& action) {
    Q_UNUSED(error);
    
    switch (action.strategy) {
        case RecoveryStrategy::Retry:
            return true;
        case RecoveryStrategy::Fallback:
            return true;
        case RecoveryStrategy::Graceful:
            degradeGracefully(error.component, error.message);
            return true;
        case RecoveryStrategy::Restart:
            return false; // Would restart component
        case RecoveryStrategy::Ignore:
            return true;
        case RecoveryStrategy::UserIntervention:
            notifyUserIntervention(QString("Manual intervention required for %1: %2").arg(error.component, error.message));
            return false;
    }
    
    return false;
}

void ErrorRecovery::notifyUserIntervention(const QString& message) {
    emit userInterventionRequired(message, "Please check the system and retry the operation");
}

void ErrorRecovery::updateErrorStatistics(const ErrorInfo& error) {
    errorCounts[error.type]++;
    lastErrorTime[error.type] = error.timestamp;
}

void ErrorRecovery::analyzeErrorPatterns() {
}

void ErrorRecovery::triggerCircuitBreaker(ErrorType type, const QString& component) {
    if (circuitBreakers[type].contains(component)) {
        circuitBreakers[type][component].isOpen = true;
        circuitBreakers[type][component].lastFailure = QDateTime::currentDateTime();
        emit circuitBreakerTripped(type, component);
    }
}

void ErrorRecovery::resetCircuitBreaker(ErrorType type, const QString& component) {
    if (circuitBreakers[type].contains(component)) {
        circuitBreakers[type][component].isOpen = false;
        circuitBreakers[type][component].failureCount = 0;
    }
}

bool ErrorRecovery::isCircuitBreakerOpen(ErrorType type, const QString& component) const {
    if (circuitBreakers[type].contains(component)) {
        return circuitBreakers[type][component].isOpen;
    }
    return false;
}

void ErrorRecovery::degradeGracefully(const QString& component, const QString& reason) {
    if (gracefulDegradationEnabled) {
        emit systemDegraded(component, reason);
    }
}

void ErrorRecovery::saveErrorLog() {
}

void ErrorRecovery::loadErrorLog() {
} 