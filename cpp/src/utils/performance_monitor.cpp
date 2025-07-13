#include "../include/utils/performance_monitor.h"

PerformanceMonitor::PerformanceMonitor(QObject* parent)
    : QObject(parent), monitoringActive(false), autoOptimizationEnabled(false),
      targetFPS(60.0), memoryLimit(512 * 1024 * 1024), qualityLevel(2),
      minFPSAlert(45.0), maxMemoryAlert(256 * 1024 * 1024), maxCPUAlert(80.0) {
    initializeMonitoring();
}

PerformanceMonitor::~PerformanceMonitor() {
    stopMonitoring();
}

void PerformanceMonitor::startMonitoring() {
    monitoringActive = true;
    setupTimers();
}

void PerformanceMonitor::stopMonitoring() {
    monitoringActive = false;
    if (metricsTimer) metricsTimer->stop();
    if (analysisTimer) analysisTimer->stop();
    if (cleanupTimer) cleanupTimer->stop();
}

void PerformanceMonitor::pauseMonitoring() {
    monitoringActive = false;
}

void PerformanceMonitor::resumeMonitoring() {
    monitoringActive = true;
}

bool PerformanceMonitor::isMonitoring() const {
    return monitoringActive;
}

void PerformanceMonitor::beginFrame() {
    if (frameTimer) {
        frameTimer->restart();
    }
}

void PerformanceMonitor::endFrame() {
    if (frameTimer) {
        frameTimes.enqueue(frameTimer->elapsed());
        if (frameTimes.size() > FPS_SAMPLE_SIZE) {
            frameTimes.dequeue();
        }
    }
}

void PerformanceMonitor::markRenderStart() {
    if (renderTimer) {
        renderTimer->restart();
    }
}

void PerformanceMonitor::markRenderEnd() {
    if (renderTimer) {
        renderTimes.enqueue(renderTimer->elapsed());
        if (renderTimes.size() > FPS_SAMPLE_SIZE) {
            renderTimes.dequeue();
        }
    }
}

void PerformanceMonitor::markPhysicsStart() {
    if (physicsTimer) {
        physicsTimer->restart();
    }
}

void PerformanceMonitor::markPhysicsEnd() {
    if (physicsTimer) {
        physicsTimes.enqueue(physicsTimer->elapsed());
        if (physicsTimes.size() > FPS_SAMPLE_SIZE) {
            physicsTimes.dequeue();
        }
    }
}

void PerformanceMonitor::markUIUpdateStart() {
    if (uiTimer) {
        uiTimer->restart();
    }
}

void PerformanceMonitor::markUIUpdateEnd() {
    if (uiTimer) {
        uiTimes.enqueue(uiTimer->elapsed());
        if (uiTimes.size() > FPS_SAMPLE_SIZE) {
            uiTimes.dequeue();
        }
    }
}

void PerformanceMonitor::beginComponent(const QString& componentName) {
    componentTimers[componentName].restart();
}

void PerformanceMonitor::endComponent(const QString& componentName) {
    if (componentTimers.contains(componentName)) {
        double elapsed = componentTimers[componentName].elapsed();
        logComponentTime(componentName, elapsed);
    }
}

void PerformanceMonitor::logComponentTime(const QString& componentName, double timeMs) {
    componentTimes[componentName].enqueue(timeMs);
    if (componentTimes[componentName].size() > FPS_SAMPLE_SIZE) {
        componentTimes[componentName].dequeue();
    }
}

void PerformanceMonitor::trackMemoryUsage() {
    // Implementation placeholder
}

void PerformanceMonitor::trackMemoryAllocation(const QString& component, qint64 bytes) {
    componentMemoryUsage[component] += bytes;
}

void PerformanceMonitor::trackMemoryDeallocation(const QString& component, qint64 bytes) {
    componentMemoryUsage[component] -= bytes;
}

void PerformanceMonitor::detectMemoryLeaks() {
    // Implementation placeholder
}

void PerformanceMonitor::trackNetworkLatency(double latencyMs) {
    currentMetrics.networkLatency = latencyMs;
}

void PerformanceMonitor::trackBLEPerformance(const QString& operation, double timeMs) {
    componentTimes[QString("BLE_%1").arg(operation)].enqueue(timeMs);
}

PerformanceMonitor::PerformanceMetrics PerformanceMonitor::getCurrentMetrics() const {
    QMutexLocker locker(&metricsMutex);
    return currentMetrics;
}

QList<PerformanceMonitor::OptimizationSuggestion> PerformanceMonitor::getOptimizationSuggestions() const {
    QMutexLocker locker(&suggestionsMutex);
    return activeSuggestions;
}

QHash<QString, double> PerformanceMonitor::getComponentPerformance() const {
    QHash<QString, double> result;
    for (auto it = componentTimes.begin(); it != componentTimes.end(); ++it) {
        result[it.key()] = calculateMovingAverage(it.value());
    }
    return result;
}

double PerformanceMonitor::getAverageFrameTime() const {
    return calculateMovingAverage(frameTimes);
}

double PerformanceMonitor::getAverageRenderTime() const {
    return calculateMovingAverage(renderTimes);
}

double PerformanceMonitor::getAveragePhysicsTime() const {
    return calculateMovingAverage(physicsTimes);
}

QList<PerformanceMonitor::PerformanceMetrics> PerformanceMonitor::getPerformanceHistory(int seconds) const {
    Q_UNUSED(seconds);
    QMutexLocker locker(&metricsMutex);
    return metricsHistory.toList();
}

void PerformanceMonitor::savePerformanceReport(const QString& filePath) const {
    Q_UNUSED(filePath);
    // Implementation placeholder
}

void PerformanceMonitor::exportPerformanceData(const QString& filePath) const {
    Q_UNUSED(filePath);
    // Implementation placeholder
}

void PerformanceMonitor::enableAutoOptimization(bool enabled) {
    autoOptimizationEnabled = enabled;
}

void PerformanceMonitor::setPerformanceTarget(double targetFPS) {
    this->targetFPS = targetFPS;
}

void PerformanceMonitor::setMemoryLimit(qint64 maxMemoryMB) {
    this->memoryLimit = maxMemoryMB * 1024 * 1024;
}

void PerformanceMonitor::setQualityLevel(int level) {
    this->qualityLevel = level;
}

void PerformanceMonitor::setFPSAlert(double minFPS) {
    this->minFPSAlert = minFPS;
}

void PerformanceMonitor::setMemoryAlert(qint64 maxMemoryMB) {
    this->maxMemoryAlert = maxMemoryMB * 1024 * 1024;
}

void PerformanceMonitor::setCPUAlert(double maxCPUPercent) {
    this->maxCPUAlert = maxCPUPercent;
}

void PerformanceMonitor::updatePerformanceMetrics() {
    if (!monitoringActive) return;
    
    calculateFPS();
    calculateCPUUsage();
    calculateMemoryUsage();
    
    emit performanceUpdate(currentMetrics);
}

void PerformanceMonitor::analyzePerformance() {
    if (!monitoringActive) return;
    
    detectPerformanceIssues();
    generateOptimizationSuggestions();
}

void PerformanceMonitor::applyAutoOptimizations() {
    if (!autoOptimizationEnabled) return;
    
    for (const auto& suggestion : activeSuggestions) {
        if (suggestion.severity == "high" || suggestion.severity == "critical") {
            applyOptimization(suggestion);
        }
    }
}

void PerformanceMonitor::cleanupOldData() {
    pruneHistoryData();
}

void PerformanceMonitor::initializeMonitoring() {
    frameTimer = std::make_unique<QElapsedTimer>();
    renderTimer = std::make_unique<QElapsedTimer>();
    physicsTimer = std::make_unique<QElapsedTimer>();
    uiTimer = std::make_unique<QElapsedTimer>();
}

void PerformanceMonitor::setupTimers() {
    metricsTimer = std::make_unique<QTimer>(this);
    analysisTimer = std::make_unique<QTimer>(this);
    cleanupTimer = std::make_unique<QTimer>(this);
    
    connect(metricsTimer.get(), &QTimer::timeout, this, &PerformanceMonitor::updatePerformanceMetrics);
    connect(analysisTimer.get(), &QTimer::timeout, this, &PerformanceMonitor::analyzePerformance);
    connect(cleanupTimer.get(), &QTimer::timeout, this, &PerformanceMonitor::cleanupOldData);
    
    metricsTimer->start(METRICS_UPDATE_INTERVAL);
    analysisTimer->start(ANALYSIS_INTERVAL);
    cleanupTimer->start(CLEANUP_INTERVAL);
}

void PerformanceMonitor::calculateFPS() {
    if (!frameTimes.isEmpty()) {
        double avgFrameTime = calculateMovingAverage(frameTimes);
        currentMetrics.fps = avgFrameTime > 0 ? 1000.0 / avgFrameTime : 0.0;
        currentMetrics.frameTime = avgFrameTime;
    }
}

void PerformanceMonitor::calculateCPUUsage() {
    // Implementation placeholder - would use platform-specific CPU monitoring
    currentMetrics.cpuUsage = 25.0; // Placeholder value
}

void PerformanceMonitor::calculateMemoryUsage() {
    // Implementation placeholder - would use platform-specific memory monitoring
    currentMetrics.memoryUsage = 128 * 1024 * 1024; // Placeholder value
}

void PerformanceMonitor::detectPerformanceIssues() {
    if (currentMetrics.fps < minFPSAlert) {
        emit performanceAlert("FPS", QString("Low FPS detected: %1").arg(currentMetrics.fps));
    }
    
    if (currentMetrics.memoryUsage > maxMemoryAlert) {
        emit performanceAlert("Memory", QString("High memory usage: %1 MB").arg(currentMetrics.memoryUsage / 1024 / 1024));
    }
    
    if (currentMetrics.cpuUsage > maxCPUAlert) {
        emit performanceAlert("CPU", QString("High CPU usage: %1%").arg(currentMetrics.cpuUsage));
    }
}

void PerformanceMonitor::generateOptimizationSuggestions() {
    QMutexLocker locker(&suggestionsMutex);
    activeSuggestions.clear();
    
    if (currentMetrics.fps < targetFPS * 0.8) {
        OptimizationSuggestion suggestion;
        suggestion.component = "Renderer";
        suggestion.issue = "Low FPS";
        suggestion.suggestion = "Consider reducing quality settings or optimizing render calls";
        suggestion.severity = "medium";
        suggestion.impact = 0.7;
        activeSuggestions.append(suggestion);
        emit optimizationSuggestion(suggestion);
    }
}

void PerformanceMonitor::applyOptimization(const OptimizationSuggestion& suggestion) {
    emit autoOptimizationApplied(suggestion.suggestion);
}

double PerformanceMonitor::calculateMovingAverage(const QQueue<double>& values, int samples) const {
    if (values.isEmpty()) return 0.0;
    
    int count = qMin(samples, values.size());
    double sum = 0.0;
    
    auto it = values.end();
    for (int i = 0; i < count; ++i) {
        --it;
        sum += *it;
    }
    
    return sum / count;
}

void PerformanceMonitor::pruneHistoryData() {
    while (metricsHistory.size() > MAX_HISTORY_SIZE) {
        metricsHistory.dequeue();
    }
} 