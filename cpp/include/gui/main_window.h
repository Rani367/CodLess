#pragma once

#include <QMainWindow>
#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QTextEdit>
#include <QListWidget>
#include <QCheckBox>
#include <QComboBox>
#include <QLineEdit>
#include <QGroupBox>
#include <QPropertyAnimation>
#include <QEasingCurve>
#include <QKeyEvent>
#include <QMouseEvent>
#include <QTimer>
#include <QElapsedTimer>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QScrollArea>
#include <QFrame>
#include <QSplitter>
#include <QShortcut>
#include <QDebug>
#include <memory>
#include <unordered_set>

#include "core/robot_config.h"
#include "core/recorded_command.h"
#include "sim/robot_simulator.h"
#include "hardware/ble_controller.h"

class ConfigDialog;

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow() override;

protected:
    void keyPressEvent(QKeyEvent* event) override;
    void keyReleaseEvent(QKeyEvent* event) override;
    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void closeEvent(QCloseEvent* event) override;
    void showEvent(QShowEvent* event) override;
    void resizeEvent(QResizeEvent* event) override;

private slots:
    void connectHub();
    void toggleDeveloperMode();
    void resetSimulator();
    void openConfigDialog();
    void copyPybricksCode();
    void uploadMap();
    void toggleRecording();
    void saveCurrentRun();
    void playSelectedRun();
    void deleteSelectedRun();
    void onBleConnectionChanged(bool connected);
    void onBleHubFound(const QString& hubName);
    void onBleError(const QString& error);
    void updateRunsList();
    void updateTelemetry();
    void undoLastAction();
    void redoLastAction();
    void saveRecordingState();
    void loadSettings();
    void saveSettings();

private:
    void setupUi();
    void setupStyle();
    void setupConnections();
    void setupStartupAnimation();
    void setupExitAnimation();
    void setupAutoSave();
    void performAutoSave();
    void createTitleBar();
    void createSidebar();
    void createMainContent();
    void createStatusBar();
    void toggleMaximize();
    void logStatus(const QString& message, const QString& level = "info");
    void processKeyCommand(const QString& key, bool isPressed);
    void executeCommand(const QVariantHash& command);
    QString formatCmdDisplay(const QVariantHash& command);
    void playbackRun(const QJsonObject& runData);
    QJsonObject loadSavedRuns();
    void startExitAnimation();
    void forceClose();
    
    QWidget* centralWidget;
    QWidget* titleBar;
    QWidget* sidebar;
    QWidget* mainContentWidget;
    QWidget* statusBar;
    QSplitter* contentSplitter;
    
    QLabel* titleLabel;
    QPushButton* minimizeButton;
    QPushButton* maximizeButton;
    QPushButton* closeButton;
    
    QGroupBox* connectionGroup;
    QGroupBox* configGroup;
    QGroupBox* pybricksGroup;
    QGroupBox* keysGroup;
    QGroupBox* runsGroup;
    QGroupBox* simulatorGroup;
    QGroupBox* recordingGroup;
    QGroupBox* statusGroup;
    QGroupBox* telemetryGroup;
    
    QPushButton* connectButton;
    QPushButton* disconnectButton;
    QCheckBox* developerCheck;
    QLabel* hubStatus;
    QPushButton* configButton;
    QPushButton* copyPybricksButton;
    QLabel* pybricksInfo;
    QPushButton* resetSimButton;
    QPushButton* uploadMapButton;
    
    QLabel* keysText;
    QLineEdit* runNameInput;
    QPushButton* recordButton;
    QPushButton* saveButton;
    QLabel* recordStatus;
    
    QPushButton* playButton;
    QPushButton* deleteButton;
    QListWidget* runsList;
    
    QTextEdit* statusDisplay;
    
    QLabel* positionLabel;
    QLabel* speedLabel;
    QLabel* connectionLabel;
    QLabel* performanceLabel;
    
    QLabel* statusLabel;
    QLabel* connectionStatusLabel;
    
    std::unique_ptr<RobotSimulator> simulator;
    std::unique_ptr<BLEController> bleController;
    std::unique_ptr<QPropertyAnimation> startupAnimation;
    std::unique_ptr<QPropertyAnimation> exitAnimation;
    std::unique_ptr<QPropertyAnimation> opacityAnimation;
    std::unique_ptr<QTimer> keyUpdateTimer;
    std::unique_ptr<QTimer> playbackTimer;
    std::unique_ptr<QTimer> telemetryTimer;
    std::unique_ptr<QTimer> autoSaveTimer;
    std::unique_ptr<QElapsedTimer> recordingTimer;
    
    RobotConfig robotConfig;
    std::vector<RecordedCommand> currentRecording;
    std::vector<std::vector<RecordedCommand>> undoHistory;
    std::vector<std::vector<RecordedCommand>> redoHistory;
    bool isRecording = false;
    bool isDeveloperMode = false;
    bool isConnected = false;
    bool isMaximized = false;
    bool isPlayingBack = false;
    bool isDragging = false;
    bool isClosing = false;
    bool hasAnimated = false;
    
    std::unordered_set<int> pressedKeys;
    QPoint lastMousePos;
    QRect targetGeometry;
    QRect startGeometry;
    
    int playbackIndex = 0;
    double playbackStartTime = 0.0;
    std::vector<RecordedCommand> playbackCommands;
    
    static constexpr int WINDOW_MIN_WIDTH = 900;
    static constexpr int WINDOW_MIN_HEIGHT = 600;
    static constexpr int SIDEBAR_WIDTH = 250;
    static constexpr int STATUSBAR_HEIGHT = 30;
    static constexpr int TITLEBAR_HEIGHT = 40;
}; 