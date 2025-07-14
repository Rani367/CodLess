#pragma once

#include <QObject>
#include <QTimer>
#include <QElapsedTimer>
#include <QMutex>
#include <QHash>
#include <QQueue>
#include <QThread>
#include <memory>
#include <chrono>

/**
 * @brief Advanced performance monitoring and profiling system
 * 
 * This class provides comprehensive performance monitoring capabilities including:
 * - Real-time FPS tracking and optimization suggestions
 * - Memory usage monitoring with leak detection
 * - CPU utilization tracking per component
 * - Network latency monitoring for BLE connections
 * - Automatic performance optimization recommendations
 * - Historical performance data analysis
 */
class PerformanceMonitor : public QObject {
    Q_OBJECT

public:
    struct PerformanceMetrics {
        double fps = 0.0;
        double cpuUsage = 0.0;
        qint64 memoryUsage = 0;
        qint64 peakMemoryUsage = 0;
        double networkLatency = 0.0;
        double frameTime = 0.0;
        double renderTime = 0.0;
        double physicsTime = 0.0;
        double uiUpdateTime = 0.0;
        QHash<QString, double> componentTimes;
    };

    struct OptimizationSuggestion {
        QString component;
        QString issue;
        QString suggestion;
        QString severity; // "low", "medium", "high", "critical"
        double impact; // 0.0 to 1.0
    };

    explicit PerformanceMonitor(QObject* parent = nullptr);
    ~PerformanceMonitor() override;

    // Monitoring control
    void startMonitoring();
    void stopMonitoring();
    void pauseMonitoring();
    void resumeMonitoring();
    bool isMonitoring() const;

    // Frame performance tracking
    void beginFrame();
    void endFrame();
    void markRenderStart();
    void markRenderEnd();
    void markPhysicsStart();
    void markPhysicsEnd();
    void markUIUpdateStart();
    void markUIUpdateEnd();

    // Component performance tracking
    void beginComponent(const QString& componentName);
    void endComponent(const QString& componentName);
    void logComponentTime(const QString& componentName, double timeMs);

    // Memory monitoring
    void trackMemoryUsage();
    void trackMemoryAllocation(const QString& component, qint64 bytes);
    void trackMemoryDeallocation(const QString& component, qint64 bytes);
    void detectMemoryLeaks();

    // Network monitoring
    void trackNetworkLatency(double latencyMs);
    void trackBLEPerformance(const QString& operation, double timeMs);

    // Performance analysis
    PerformanceMetrics getCurrentMetrics() const;
    QList<OptimizationSuggestion> getOptimizationSuggestions() const;
    QHash<QString, double> getComponentPerformance() const;
    double getAverageFrameTime() const;
    double getAverageRenderTime() const;
    double getAveragePhysicsTime() const;

    // Performance history
    QList<PerformanceMetrics> getPerformanceHistory(int seconds = 60) const;
    void savePerformanceReport(const QString& filePath) const;
    void exportPerformanceData(const QString& filePath) const;

    // Optimization features
    void enableAutoOptimization(bool enabled);
    void setPerformanceTarget(double targetFPS);
    void setMemoryLimit(qint64 maxMemoryMB);
    void setQualityLevel(int level); // 0=low, 1=medium, 2=high, 3=ultra

    // Real-time alerts
    void setFPSAlert(double minFPS);
    void setMemoryAlert(qint64 maxMemoryMB);
    void setCPUAlert(double maxCPUPercent);

signals:
    void performanceUpdate(const PerformanceMetrics& metrics);
    void optimizationSuggestion(const OptimizationSuggestion& suggestion);
    void performanceAlert(const QString& alertType, const QString& message);
    void autoOptimizationApplied(const QString& optimization);

private slots:
    void updatePerformanceMetrics();
    void analyzePerformance();
    void applyAutoOptimizations();
    void cleanupOldData();

private:
    void initializeMonitoring();
    void setupTimers();
    void calculateFPS();
    void calculateCPUUsage();
    void calculateMemoryUsage();
    void detectPerformanceIssues();
    void generateOptimizationSuggestions();
    void applyOptimization(const OptimizationSuggestion& suggestion);
    double calculateMovingAverage(const QQueue<double>& values, int samples = 30) const;
    void pruneHistoryData();

    // Monitoring state
    bool monitoringActive;
    bool autoOptimizationEnabled;
    double targetFPS;
    qint64 memoryLimit;
    int qualityLevel;

    // Performance tracking
    std::unique_ptr<QTimer> metricsTimer;
    std::unique_ptr<QTimer> analysisTimer;
    std::unique_ptr<QTimer> cleanupTimer;
    std::unique_ptr<QElapsedTimer> frameTimer;
    std::unique_ptr<QElapsedTimer> renderTimer;
    std::unique_ptr<QElapsedTimer> physicsTimer;
    std::unique_ptr<QElapsedTimer> uiTimer;

    // Performance data
    QQueue<double> frameTimes;
    QQueue<double> renderTimes;
    QQueue<double> physicsTimes;
    QQueue<double> uiTimes;
    QQueue<PerformanceMetrics> metricsHistory;
    QHash<QString, QElapsedTimer> componentTimers;
    QHash<QString, QQueue<double>> componentTimes;
    QHash<QString, qint64> componentMemoryUsage;

    // Current metrics
    PerformanceMetrics currentMetrics;
    QList<OptimizationSuggestion> activeSuggestions;

    // Alert thresholds
    double minFPSAlert;
    qint64 maxMemoryAlert;
    double maxCPUAlert;

    // Thread safety
    mutable QMutex metricsMutex;
    mutable QMutex suggestionsMutex;

    // Performance constants
    static constexpr int METRICS_UPDATE_INTERVAL = 100; // ms
    static constexpr int ANALYSIS_INTERVAL = 1000; // ms
    static constexpr int CLEANUP_INTERVAL = 60000; // ms
    static constexpr int MAX_HISTORY_SIZE = 3600; // 1 hour at 1Hz
    static constexpr int FPS_SAMPLE_SIZE = 30;
    static constexpr double LOW_FPS_THRESHOLD = 45.0;
    static constexpr double HIGH_CPU_THRESHOLD = 80.0;
    static constexpr qint64 HIGH_MEMORY_THRESHOLD = 512 * 1024 * 1024; // 512MB
}; 