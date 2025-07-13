#pragma once

#include <QObject>
#include <QJsonObject>
#include <QJsonDocument>
#include <QSettings>
#include <QRect>
#include <QByteArray>
#include <QTimer>
#include <memory>

/**
 * @brief Manages application settings and configuration
 * 
 * This class handles loading, saving, and managing all application settings
 * including window geometry, user preferences, and application state.
 * It provides both persistent storage and runtime configuration management.
 */
class SettingsManager : public QObject {
    Q_OBJECT

public:
    enum class SettingsFormat {
        JSON,
        INI,
        Registry
    };

    explicit SettingsManager(QObject* parent = nullptr);
    ~SettingsManager() override;

    // Settings management
    void loadSettings();
    void saveSettings();
    void resetToDefaults();
    void exportSettings(const QString& filePath);
    void importSettings(const QString& filePath);
    
    // Window settings
    void setWindowGeometry(const QRect& geometry);
    QRect getWindowGeometry() const;
    void setSplitterSizes(const QList<int>& sizes);
    QList<int> getSplitterSizes() const;
    void setWindowState(Qt::WindowState state);
    Qt::WindowState getWindowState() const;
    
    // Application settings
    void setDeveloperMode(bool enabled);
    bool getDeveloperMode() const;
    void setLastRunName(const QString& name);
    QString getLastRunName() const;
    void setAutoSaveInterval(int seconds);
    int getAutoSaveInterval() const;
    void setAnimationsEnabled(bool enabled);
    bool getAnimationsEnabled() const;
    void setTheme(const QString& theme);
    QString getTheme() const;
    
    // Robot configuration settings
    void setRobotConfig(const QJsonObject& config);
    QJsonObject getRobotConfig() const;
    void setLastConnectedHub(const QString& hubId);
    QString getLastConnectedHub() const;
    
    // Performance settings
    void setSimulationFPS(int fps);
    int getSimulationFPS() const;
    void setTelemetryUpdateRate(int ms);
    int getTelemetryUpdateRate() const;
    void setLogLevel(const QString& level);
    QString getLogLevel() const;
    
    // Recent files and runs
    void addRecentRun(const QString& runName);
    QStringList getRecentRuns() const;
    void clearRecentRuns();
    void setMaxRecentRuns(int count);
    int getMaxRecentRuns() const;
    
    // Auto-save functionality
    void enableAutoSave(bool enabled);
    bool isAutoSaveEnabled() const;
    void setAutoSaveEnabled(bool enabled);
    
    // Settings validation
    bool validateSettings() const;
    void repairSettings();
    
    // Advanced settings
    void setValue(const QString& key, const QVariant& value);
    QVariant getValue(const QString& key, const QVariant& defaultValue = QVariant()) const;
    void removeKey(const QString& key);
    bool hasKey(const QString& key) const;
    QStringList allKeys() const;

signals:
    void settingsChanged(const QString& key, const QVariant& value);
    void settingsLoaded();
    void settingsSaved();
    void settingsReset();
    void autoSaveTriggered();

private slots:
    void performAutoSave();
    void onSettingsFileChanged();

private:
    void initializeDefaults();
    void setupAutoSave();
    void createSettingsFile();
    void backupSettings();
    void restoreFromBackup();
    QString getSettingsFilePath() const;
    QJsonObject getDefaultSettings() const;
    void migrateSettings();
    
    SettingsFormat format;
    QString settingsFilePath;
    QJsonObject currentSettings;
    QJsonObject defaultSettings;
    
    // Auto-save functionality
    std::unique_ptr<QTimer> autoSaveTimer;
    bool autoSaveEnabled;
    int autoSaveInterval;
    
    // Settings caching
    mutable QHash<QString, QVariant> settingsCache;
    bool cacheEnabled;
    
    // File watching
    std::unique_ptr<QFileSystemWatcher> fileWatcher;
    
    // Default values
    static constexpr int DEFAULT_WINDOW_WIDTH = 1200;
    static constexpr int DEFAULT_WINDOW_HEIGHT = 800;
    static constexpr int DEFAULT_WINDOW_X = 120;
    static constexpr int DEFAULT_WINDOW_Y = 80;
    static constexpr int DEFAULT_SIDEBAR_WIDTH = 250;
    static constexpr int DEFAULT_AUTO_SAVE_INTERVAL = 30; // seconds
    static constexpr int DEFAULT_SIMULATION_FPS = 50;
    static constexpr int DEFAULT_TELEMETRY_UPDATE_RATE = 100; // ms
    static constexpr int DEFAULT_MAX_RECENT_RUNS = 10;
}; 