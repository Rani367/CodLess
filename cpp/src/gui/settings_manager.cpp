#include "../include/gui/settings_manager.h"
#include <QStandardPaths>
#include <QDir>

SettingsManager::SettingsManager(QObject* parent)
    : QObject(parent), format(SettingsFormat::JSON), autoSaveEnabled(true), autoSaveInterval(30), cacheEnabled(true) {
    initializeDefaults();
    setupAutoSave();
}

SettingsManager::~SettingsManager() = default;

void SettingsManager::loadSettings() {
    emit settingsLoaded();
}

void SettingsManager::saveSettings() {
    emit settingsSaved();
}

void SettingsManager::resetToDefaults() {
    currentSettings = defaultSettings;
    emit settingsReset();
}

void SettingsManager::exportSettings(const QString& filePath) {
    Q_UNUSED(filePath);
}

void SettingsManager::importSettings(const QString& filePath) {
    Q_UNUSED(filePath);
}

void SettingsManager::setWindowGeometry(const QRect& geometry) {
    setValue("window/geometry", geometry);
}

QRect SettingsManager::getWindowGeometry() const {
    return getValue("window/geometry", QRect(120, 80, 1200, 800)).toRect();
}

void SettingsManager::setSplitterSizes(const QList<int>& sizes) {
    setValue("window/splitter_sizes", QVariant::fromValue(sizes));
}

QList<int> SettingsManager::getSplitterSizes() const {
    return getValue("window/splitter_sizes", QList<int>{250, 950}).value<QList<int>>();
}

void SettingsManager::setWindowState(Qt::WindowState state) {
    setValue("window/state", static_cast<int>(state));
}

Qt::WindowState SettingsManager::getWindowState() const {
    return static_cast<Qt::WindowState>(getValue("window/state", 0).toInt());
}

void SettingsManager::setDeveloperMode(bool enabled) {
    setValue("developer_mode", enabled);
}

bool SettingsManager::getDeveloperMode() const {
    return getValue("developer_mode", false).toBool();
}

void SettingsManager::setLastRunName(const QString& name) {
    setValue("last_run_name", name);
}

QString SettingsManager::getLastRunName() const {
    return getValue("last_run_name", "Run 1").toString();
}

void SettingsManager::setAutoSaveInterval(int seconds) {
    autoSaveInterval = seconds;
}

int SettingsManager::getAutoSaveInterval() const {
    return autoSaveInterval;
}

void SettingsManager::setAnimationsEnabled(bool enabled) {
    setValue("animations_enabled", enabled);
}

bool SettingsManager::getAnimationsEnabled() const {
    return getValue("animations_enabled", true).toBool();
}

void SettingsManager::setTheme(const QString& theme) {
    setValue("theme", theme);
}

QString SettingsManager::getTheme() const {
    return getValue("theme", "dark").toString();
}

void SettingsManager::setRobotConfig(const QJsonObject& config) {
    setValue("robot_config", config);
}

QJsonObject SettingsManager::getRobotConfig() const {
    return getValue("robot_config", QJsonObject()).toJsonObject();
}

void SettingsManager::setLastConnectedHub(const QString& hubId) {
    setValue("last_connected_hub", hubId);
}

QString SettingsManager::getLastConnectedHub() const {
    return getValue("last_connected_hub", "").toString();
}

void SettingsManager::setSimulationFPS(int fps) {
    setValue("simulation_fps", fps);
}

int SettingsManager::getSimulationFPS() const {
    return getValue("simulation_fps", 50).toInt();
}

void SettingsManager::setTelemetryUpdateRate(int ms) {
    setValue("telemetry_update_rate", ms);
}

int SettingsManager::getTelemetryUpdateRate() const {
    return getValue("telemetry_update_rate", 100).toInt();
}

void SettingsManager::setLogLevel(const QString& level) {
    setValue("log_level", level);
}

QString SettingsManager::getLogLevel() const {
    return getValue("log_level", "info").toString();
}

void SettingsManager::addRecentRun(const QString& runName) {
    Q_UNUSED(runName);
}

QStringList SettingsManager::getRecentRuns() const {
    return QStringList();
}

void SettingsManager::clearRecentRuns() {
}

void SettingsManager::setMaxRecentRuns(int count) {
    Q_UNUSED(count);
}

int SettingsManager::getMaxRecentRuns() const {
    return 10;
}

void SettingsManager::enableAutoSave(bool enabled) {
    autoSaveEnabled = enabled;
}

bool SettingsManager::isAutoSaveEnabled() const {
    return autoSaveEnabled;
}

void SettingsManager::setAutoSaveEnabled(bool enabled) {
    autoSaveEnabled = enabled;
}

bool SettingsManager::validateSettings() const {
    return true;
}

void SettingsManager::repairSettings() {
}

void SettingsManager::setValue(const QString& key, const QVariant& value) {
    settingsCache[key] = value;
    emit settingsChanged(key, value);
}

QVariant SettingsManager::getValue(const QString& key, const QVariant& defaultValue) const {
    return settingsCache.value(key, defaultValue);
}

void SettingsManager::removeKey(const QString& key) {
    settingsCache.remove(key);
}

bool SettingsManager::hasKey(const QString& key) const {
    return settingsCache.contains(key);
}

QStringList SettingsManager::allKeys() const {
    return settingsCache.keys();
}

void SettingsManager::performAutoSave() {
    if (autoSaveEnabled) {
        saveSettings();
        emit autoSaveTriggered();
    }
}

void SettingsManager::onSettingsFileChanged() {
}

void SettingsManager::initializeDefaults() {
    defaultSettings = getDefaultSettings();
    currentSettings = defaultSettings;
}

void SettingsManager::setupAutoSave() {
    autoSaveTimer = std::make_unique<QTimer>(this);
    connect(autoSaveTimer.get(), &QTimer::timeout, this, &SettingsManager::performAutoSave);
    autoSaveTimer->start(autoSaveInterval * 1000);
}

void SettingsManager::createSettingsFile() {
}

void SettingsManager::backupSettings() {
}

void SettingsManager::restoreFromBackup() {
}

QString SettingsManager::getSettingsFilePath() const {
    return QStandardPaths::writableLocation(QStandardPaths::AppConfigLocation) + "/settings.json";
}

QJsonObject SettingsManager::getDefaultSettings() const {
    QJsonObject defaults;
    defaults["developer_mode"] = false;
    defaults["last_run_name"] = "Run 1";
    defaults["animations_enabled"] = true;
    defaults["theme"] = "dark";
    defaults["simulation_fps"] = 50;
    defaults["telemetry_update_rate"] = 100;
    defaults["log_level"] = "info";
    return defaults;
}

void SettingsManager::migrateSettings() {
} 