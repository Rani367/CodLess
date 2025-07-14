#include "gui/main_window.h"
#include "gui/config_dialog.h"
#include <QApplication>
#include <QCloseEvent>
#include <QShowEvent>
#include <QResizeEvent>
#include <QKeyEvent>
#include <QMouseEvent>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFile>
#include <QDir>
#include <QDateTime>
#include <QMessageBox>
#include <QFileDialog>
#include <QGraphicsDropShadowEffect>
#include <QParallelAnimationGroup>
#include <QSequentialAnimationGroup>
#include <QGraphicsOpacityEffect>
#include <QScrollBar>
#include <QHeaderView>
#include <QSizeGrip>
#include <QClipboard>
#include <QFileInfo>
#include <QGridLayout>
#include <QProcess>
#include <algorithm>
#include <chrono>
#include <QDebug> // Added for qDebug

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent)
    , simulator(std::make_unique<RobotSimulator>(this))
    , bleController(std::make_unique<BLEController>(this))
    , keyUpdateTimer(std::make_unique<QTimer>(this))
    , playbackTimer(std::make_unique<QTimer>(this))
    , telemetryTimer(std::make_unique<QTimer>(this))
    , autoSaveTimer(std::make_unique<QTimer>(this))
    , recordingTimer(std::make_unique<QElapsedTimer>())
    , robotConfig()
    , currentRecording()
    , playbackCommands() {
    
    setWindowTitle("CodLess - FLL Robotics Control Center");
    setGeometry(120, 80, 1200, 800);
    setMinimumSize(900, 600);
    setMaximumSize(1920, 1280);
    
    setWindowFlags(Qt::FramelessWindowHint);
    
    setupUi();
    setupStyle();
    setupConnections();
    setupStartupAnimation();
    setupExitAnimation();
    setupAutoSave();
    
    // Load settings first, which will set developer mode state
    loadSettings();
    
    bleController->setLogCallback([this](const QString& msg, const QString& level) {
        logStatus(msg, level);
    });
    
    updateRunsList();
    
    logStatus("CodLess - FLL Robotics Control Center initialized", "info");
    logStatus("Use WASD keys for driving, QE for Arm 1, RF for Arm 2", "info");
    logStatus("Press SPACE to stop all movement", "info");
    
    setFocusPolicy(Qt::StrongFocus);
    setFocus();
}

MainWindow::~MainWindow() {
    // Ensure all timers are stopped before destruction
    if (playbackTimer && playbackTimer->isActive()) {
        playbackTimer->stop();
    }
    if (telemetryTimer && telemetryTimer->isActive()) {
        telemetryTimer->stop();
    }
    if (keyUpdateTimer && keyUpdateTimer->isActive()) {
        keyUpdateTimer->stop();
    }
    if (autoSaveTimer && autoSaveTimer->isActive()) {
        autoSaveTimer->stop();
    }
    
    // Stop any ongoing animations
    if (exitAnimation && exitAnimation->state() == QAbstractAnimation::Running) {
        exitAnimation->stop();
    }
    if (opacityAnimation && opacityAnimation->state() == QAbstractAnimation::Running) {
        opacityAnimation->stop();
    }
    if (startupAnimation && startupAnimation->state() == QAbstractAnimation::Running) {
        startupAnimation->stop();
    }
    
    // Ensure BLE controller is properly disconnected
    if (bleController && bleController->isConnected()) {
        bleController->disconnectFromHub();
    }
}

void MainWindow::setupUi() {
    centralWidget = new QWidget(this);
    setCentralWidget(centralWidget);
    
    createTitleBar();
    createSidebar();
    createMainContent();
    createStatusBar();
    
    auto* windowLayout = new QVBoxLayout(centralWidget);
    windowLayout->setContentsMargins(0, 0, 0, 0);
    windowLayout->setSpacing(0);
    
    windowLayout->addWidget(titleBar);
    
    contentSplitter = new QSplitter(Qt::Horizontal, this);
    contentSplitter->addWidget(sidebar);
    contentSplitter->addWidget(mainContentWidget);
    contentSplitter->setSizes({SIDEBAR_WIDTH, width() - SIDEBAR_WIDTH});
    contentSplitter->setHandleWidth(1);
    
    windowLayout->addWidget(contentSplitter);
    windowLayout->addWidget(statusBar);
}

void MainWindow::createTitleBar() {
    titleBar = new QWidget(this);
    titleBar->setFixedHeight(TITLEBAR_HEIGHT);
    titleBar->setObjectName("title_bar");
    
    auto* titleLayout = new QHBoxLayout(titleBar);
    titleLayout->setContentsMargins(15, 0, 15, 0);
    titleLayout->setSpacing(10);
    
    titleLabel = new QLabel("CodLess - FLL Robotics Control Center", titleBar);
    titleLabel->setObjectName("title_label");
    titleLabel->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(titleLabel);
    titleLayout->addStretch();
    
    minimizeButton = new QPushButton("-", titleBar);
    minimizeButton->setObjectName("window_btn");
    minimizeButton->setFixedSize(30, 30);
    minimizeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    maximizeButton = new QPushButton("□", titleBar);
    maximizeButton->setObjectName("window_btn");
    maximizeButton->setFixedSize(30, 30);
    maximizeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    closeButton = new QPushButton("X", titleBar);
    closeButton->setObjectName("close_btn");
    closeButton->setFixedSize(30, 30);
    closeButton->setFont(QFont("Arial", 12, QFont::Bold));
    
    titleLayout->addWidget(minimizeButton);
    titleLayout->addWidget(maximizeButton);
    titleLayout->addWidget(closeButton);
    
    connect(minimizeButton, &QPushButton::clicked, this, &QWidget::showMinimized);
    connect(maximizeButton, &QPushButton::clicked, this, &MainWindow::toggleMaximize);
    connect(closeButton, &QPushButton::clicked, this, &QWidget::close);
}

void MainWindow::createSidebar() {
    sidebar = new QWidget(this);
    sidebar->setObjectName("sidebar");
    sidebar->setFixedWidth(SIDEBAR_WIDTH);
    
    auto* sidebarLayout = new QVBoxLayout(sidebar);
    sidebarLayout->setContentsMargins(20, 20, 20, 20);
    sidebarLayout->setSpacing(15);
    
    connectionGroup = new QGroupBox("Hub Connection");
    connectionGroup->setObjectName("group_box");
    auto* connectionLayout = new QVBoxLayout(connectionGroup);
    
    connectButton = new QPushButton("Connect to Pybricks Hub");
    connectButton->setObjectName("primary_btn");
    connectButton->setMinimumHeight(40);
    connectButton->setToolTip("1. Upload hub_control.py via code.pybricks.com\n2. Keep Pybricks website open\n3. Click to connect\n\n"
#ifdef Q_OS_MAC
                               "Shortcut: Cmd+Shift+C"
#else
                               "Shortcut: Ctrl+C"
#endif
                               );
    
    developerCheck = new QCheckBox("Developer Mode (Simulation)");
    developerCheck->setObjectName("checkbox");
    developerCheck->setChecked(false); // Start unchecked by default
    developerCheck->setToolTip("Enable simulation mode for development\n\n"
#ifdef Q_OS_MAC
                               "Shortcut: Cmd+D"
#else
                               "Shortcut: Ctrl+D"
#endif
                               );
    
    hubStatus = new QLabel("● Hub Disconnected");
    hubStatus->setObjectName("status_disconnected");
    
    connectionLayout->addWidget(connectButton);
    connectionLayout->addWidget(developerCheck);
    connectionLayout->addWidget(hubStatus);
    
    sidebarLayout->addWidget(connectionGroup);
    
    configGroup = new QGroupBox("Robot Configuration");
    configGroup->setObjectName("group_box");
    auto* configLayout = new QVBoxLayout(configGroup);
    
    configButton = new QPushButton("Configure Robot");
    configButton->setObjectName("success_btn");
    configButton->setMinimumHeight(35);
    configButton->setToolTip("Configure robot settings and motor ports\n\n"
#ifdef Q_OS_MAC
                              "Shortcut: Cmd+,"
#else
                              "Shortcut: Ctrl+P"
#endif
                              );
    
    configLayout->addWidget(configButton);
    
    sidebarLayout->addWidget(configGroup);
    
    pybricksGroup = new QGroupBox("Copy Pybricks Code");
    pybricksGroup->setObjectName("group_box");
    auto* pybricksLayout = new QVBoxLayout(pybricksGroup);
    
    pybricksInfo = new QLabel("Click to copy the hub control code\nto your clipboard, then paste it into\ncode.pybricks.com");
    pybricksInfo->setObjectName("info_text");
    pybricksInfo->setWordWrap(true);
    
    copyPybricksButton = new QPushButton("Copy Hub Code");
    copyPybricksButton->setObjectName("primary_btn");
    copyPybricksButton->setMinimumHeight(35);
    copyPybricksButton->setToolTip("Copy the Python code to upload to your SPIKE Prime hub");
    
    pybricksLayout->addWidget(pybricksInfo);
    pybricksLayout->addWidget(copyPybricksButton);
    
    sidebarLayout->addWidget(pybricksGroup);
    
    keysGroup = new QGroupBox("Control Keys");
    keysGroup->setObjectName("group_box");
    auto* keysLayout = new QVBoxLayout(keysGroup);
    
    keysText = new QLabel("Drive (hold to move):\n  W - Forward    S - Backward\n  A - Turn Left  D - Turn Right\n\nArms (hold to move):\n  Q - Arm 1 Up   E - Arm 1 Down\n  R - Arm 2 Up   F - Arm 2 Down");
    keysText->setObjectName("info_text");
    QFont monospaceFont("Monaco", 9);
    keysText->setFont(monospaceFont);
    
    keysLayout->addWidget(keysText);
    sidebarLayout->addWidget(keysGroup);
    
    runsGroup = new QGroupBox("Saved Runs");
    runsGroup->setObjectName("group_box");
    auto* runsLayout = new QVBoxLayout(runsGroup);
    
    runsList = new QListWidget();
    runsList->setObjectName("runs_list");
    runsList->setMaximumHeight(150);
    
    auto* runsButtonLayout = new QHBoxLayout();
    playButton = new QPushButton("Play");
    playButton->setObjectName("success_btn");
    playButton->setEnabled(false);
    playButton->setToolTip("Play selected recording\n\n"
#ifdef Q_OS_MAC
                           "Shortcut: Cmd+Space"
#else
                           "Shortcut: Ctrl+Space"
#endif
                           );
    
    deleteButton = new QPushButton("Delete");
    deleteButton->setObjectName("danger_btn");
    deleteButton->setEnabled(false);
    deleteButton->setToolTip("Delete selected recording\n\nShortcut: Delete key");
    
    runsButtonLayout->addWidget(playButton);
    runsButtonLayout->addWidget(deleteButton);
    
    runsLayout->addWidget(runsList);
    runsLayout->addLayout(runsButtonLayout);
    
    sidebarLayout->addWidget(runsGroup);
    sidebarLayout->addStretch();
}

void MainWindow::createMainContent() {
    mainContentWidget = new QWidget(this);
    mainContentWidget->setObjectName("main_content");
    
    auto* layout = new QVBoxLayout(mainContentWidget);
    layout->setContentsMargins(20, 20, 20, 20);
    layout->setSpacing(20);
    
    simulatorGroup = new QGroupBox("Robot Simulator");
    simulatorGroup->setObjectName("group_box");
    auto* simulatorLayout = new QVBoxLayout(simulatorGroup);
    
    simulatorLayout->addWidget(simulator.get());
    
    auto* simControls = new QHBoxLayout();
    auto* simInfo = new QLabel("Real-time visual simulation of your robot's movement and arm positions");
    simInfo->setObjectName("info_text");
    
    resetSimButton = new QPushButton("Reset Position");
    resetSimButton->setObjectName("success_btn");
    resetSimButton->setMinimumHeight(30);
    resetSimButton->setToolTip("Reset robot simulator position\n\n"
#ifdef Q_OS_MAC
                               "Shortcut: Cmd+Shift+R"
#else
                               "Shortcut: Ctrl+Shift+R"
#endif
                               );
    
    uploadMapButton = new QPushButton("Upload Map");
    uploadMapButton->setObjectName("primary_btn");
    uploadMapButton->setMinimumHeight(30);
    uploadMapButton->setToolTip("Upload a map image to use as background in the simulator\nRight-click to clear the background\n\nShortcut: Ctrl+Shift+R (Reset)");
    uploadMapButton->setContextMenuPolicy(Qt::CustomContextMenu);
    connect(uploadMapButton, &QPushButton::customContextMenuRequested, this, [this]() {
        simulator->clearBackgroundImage();
        logStatus("Background map cleared", "info");
    });
    
    simControls->addWidget(simInfo);
    simControls->addStretch();
    simControls->addWidget(uploadMapButton);
    simControls->addWidget(resetSimButton);
    
    simulatorLayout->addLayout(simControls);
    
    layout->addWidget(simulatorGroup, 3);  // Give simulator most space when visible
    simulatorGroup->hide();
    uploadMapButton->setVisible(false);
    
    recordingGroup = new QGroupBox("Recording Controls");
    recordingGroup->setObjectName("group_box");
    auto* recordLayout = new QVBoxLayout(recordingGroup);
    
    auto* nameLayout = new QHBoxLayout();
    nameLayout->addWidget(new QLabel("Run Name:"));
    runNameInput = new QLineEdit("Run 1");
    runNameInput->setObjectName("line_edit");
    nameLayout->addWidget(runNameInput);
    recordLayout->addLayout(nameLayout);
    
        auto* recordButtonLayout = new QHBoxLayout();
    recordButton = new QPushButton("Record Run");
    recordButton->setObjectName("danger_btn");
    recordButton->setMinimumHeight(50);
    recordButton->setToolTip("Start/stop recording robot movements\n\n"
#ifdef Q_OS_MAC
                              "Shortcut: Cmd+R"
#else
                              "Shortcut: Ctrl+R"
#endif
                              );
    
    saveButton = new QPushButton("Save Run");
    saveButton->setObjectName("success_btn");
    saveButton->setMinimumHeight(50);
    saveButton->setEnabled(false);
    saveButton->setToolTip("Save the current recording\n\n"
#ifdef Q_OS_MAC
                            "Shortcut: Cmd+S"
#else
                            "Shortcut: Ctrl+S"
#endif
                            );
    
    recordButtonLayout->addWidget(recordButton);
    recordButtonLayout->addWidget(saveButton);
    recordLayout->addLayout(recordButtonLayout);
    
    recordStatus = new QLabel("Not Recording");
    recordStatus->setObjectName("info_text");
    recordLayout->addWidget(recordStatus);
    
    layout->addWidget(recordingGroup, 0);  // Keep recording controls compact
    
    statusGroup = new QGroupBox("Robot Status");
    statusGroup->setObjectName("group_box");
    auto* statusLayout = new QVBoxLayout(statusGroup);
    
    statusDisplay = new QTextEdit();
    statusDisplay->setObjectName("status_display");
    statusDisplay->setMinimumHeight(120);
    statusDisplay->setMaximumHeight(180);
    statusDisplay->setReadOnly(true);
    
    statusLayout->addWidget(statusDisplay);
    layout->addWidget(statusGroup, 0);  // Keep status area compact
    
    telemetryGroup = new QGroupBox("Robot Telemetry");
    telemetryGroup->setObjectName("group_box");
    auto* telemetryLayout = new QVBoxLayout(telemetryGroup);
    telemetryLayout->setSpacing(8);
    
    positionLabel = new QLabel("Position: (0, 0) | Angle: 0°");
    positionLabel->setObjectName("telemetry_text");
    
    speedLabel = new QLabel("Speed: 0.0 | Turn: 0.0 | Arms: 0.0, 0.0");
    speedLabel->setObjectName("telemetry_text");
    
    connectionLabel = new QLabel("Connection: Disconnected | Lag: 0ms");
    connectionLabel->setObjectName("telemetry_text");
    
    performanceLabel = new QLabel("Performance: FPS: 0 | Memory: 0 MB");
    performanceLabel->setObjectName("telemetry_text");
    
    telemetryLayout->addWidget(positionLabel);
    telemetryLayout->addWidget(speedLabel);
    telemetryLayout->addWidget(connectionLabel);
    telemetryLayout->addWidget(performanceLabel);
    
    layout->addWidget(telemetryGroup, 0);  // Keep telemetry compact
    
    // Add stretch to prevent unwanted expansion
    layout->addStretch(1);
}

void MainWindow::createStatusBar() {
    statusBar = new QWidget(this);
    statusBar->setFixedHeight(STATUSBAR_HEIGHT);
    statusBar->setObjectName("status_bar");
    
    auto* statusLayout = new QHBoxLayout(statusBar);
    statusLayout->setContentsMargins(15, 5, 15, 5);
    
    statusLabel = new QLabel("Ready");
    statusLabel->setObjectName("status_label");
    
    statusLayout->addWidget(new QLabel("Status:"));
    statusLayout->addWidget(statusLabel);
    statusLayout->addStretch();
}

void MainWindow::setupStyle() {
    setStyleSheet(R"(
        QMainWindow {
            background-color: rgb(45, 45, 45);
        }
        
        #title_bar {
            background-color: rgb(35, 35, 35);
            border-bottom: 1px solid rgb(70, 70, 70);
        }
        
        #title_label {
            color: rgb(255, 255, 255);
        }
        
        #window_btn {
            background-color: transparent;
            color: rgb(255, 255, 255);
            border: none;
            font-size: 12px;
        }
        
        #window_btn:hover {
            background-color: rgb(0, 143, 170);
        }
        
        #close_btn {
            background-color: transparent;
            color: rgb(255, 255, 255);
            border: none;
            font-size: 12px;
        }
        
        #close_btn:hover{
            background-color: rgb(220, 53, 69);
        }
        
        #content_widget {
            background-color: rgb(51, 51, 51);
        }
        
        #sidebar {
            background-color: rgb(45, 45, 45);
            border-right: 1px solid rgb(70, 70, 70);
        }
        
        #main_content {
            background-color: rgb(51, 51, 51);
        }
        
        QGroupBox {
            border: 1px solid rgb(70, 70, 70);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background: rgb(45, 45, 45);
            font-weight: bold;
            padding-top: 10px;
            margin-top: 5px;
        }
        
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        
        #primary_btn {
            border: 2px solid rgb(0, 143, 170);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(0, 143, 170);
            font-weight: bold;
        }
        
        #primary_btn:hover {
            background-color: rgb(0, 123, 150);
        }
        
        #primary_btn:pressed {
            background-color: rgb(0, 103, 130);
        }
        
        #success_btn {
            border: 2px solid rgb(40, 167, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(40, 167, 69);
            font-weight: bold;
        }
        
        #success_btn:hover {
            background-color: rgb(34, 142, 58);
        }
        
        #success_btn:disabled {
            background-color: rgb(108, 117, 125);
            border-color: rgb(108, 117, 125);
        }
        
        #danger_btn {
            border: 2px solid rgb(220, 53, 69);
            border-radius: 5px;
            color: rgb(255, 255, 255);
            background-color: rgb(220, 53, 69);
            font-weight: bold;
        }
        
        #danger_btn:hover {
            background-color: rgb(200, 35, 51);
        }
        
        #line_edit {
            color: rgb(255, 255, 255);
            border: 2px solid rgb(70, 70, 70);
            border-radius: 4px;
            background: rgb(60, 60, 60);
            padding: 5px;
        }
        
        #line_edit:focus {
            border-color: rgb(0, 143, 170);
        }
        
        #info_text {
            color: rgb(200, 200, 200);
        }
        
        #telemetry_text {
            color: rgb(220, 220, 220);
            font-family: 'Monaco', 'Menlo', 'Liberation Mono', 'Courier New', monospace;
            font-size: 11px;
            background-color: rgb(35, 35, 35);
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid rgb(70, 70, 70);
        }
        
        #status_display {
            background-color: rgb(35, 35, 35);
            border: 1px solid rgb(70, 70, 70);
            color: rgb(255, 255, 255);
            font-family: 'Monaco', 'Menlo', 'Liberation Mono', 'Courier New', monospace;
        }
        
        #runs_list {
            background-color: rgb(60, 60, 60);
            border: 1px solid rgb(70, 70, 70);
            color: rgb(255, 255, 255);
        }
        
        #runs_list::item {
            padding: 5px;
            border-bottom: 1px solid rgb(70, 70, 70);
        }
        
        #runs_list::item:selected {
            background-color: rgb(0, 143, 170);
        }
        
        QCheckBox {
            color: rgb(255, 255, 255);
        }
        
        QCheckBox::indicator {
            width: 15px;
            height: 15px;
        }
        
        QCheckBox::indicator:unchecked {
            border: 2px solid rgb(70, 70, 70);
            background-color: rgb(60, 60, 60);
        }
        
        QCheckBox::indicator:checked {
            border: 2px solid rgb(0, 143, 170);
            background-color: rgb(0, 143, 170);
        }
        
        #status_disconnected {
            color: rgb(220, 53, 69);
            font-weight: bold;
        }
        
        #status_connected {
            color: rgb(40, 167, 69);
            font-weight: bold;
        }
        
        #status_bar {
            background-color: rgb(35, 35, 35);
            border-top: 1px solid rgb(70, 70, 70);
        }
        
        #status_label {
            color: rgb(200, 200, 200);
        }
        
        QLabel {
            color: rgb(255, 255, 255);
        }
        
        #robot_simulator {
            background-color: rgb(45, 45, 45);
            border: 2px solid rgb(70, 70, 70);
            border-radius: 5px;
        }
    )");
}

void MainWindow::setupConnections() {
    connect(connectButton, &QPushButton::clicked, this, &MainWindow::connectHub);
    connect(developerCheck, &QCheckBox::clicked, this, &MainWindow::toggleDeveloperMode);
    connect(configButton, &QPushButton::clicked, this, &MainWindow::openConfigDialog);
    connect(copyPybricksButton, &QPushButton::clicked, this, &MainWindow::copyPybricksCode);
    connect(resetSimButton, &QPushButton::clicked, this, &MainWindow::resetSimulator);
    connect(uploadMapButton, &QPushButton::clicked, this, &MainWindow::uploadMap);
    connect(recordButton, &QPushButton::clicked, this, &MainWindow::toggleRecording);
    connect(saveButton, &QPushButton::clicked, this, &MainWindow::saveCurrentRun);
    connect(playButton, &QPushButton::clicked, this, &MainWindow::playSelectedRun);
    connect(deleteButton, &QPushButton::clicked, this, &MainWindow::deleteSelectedRun);
    
    // Add keyboard shortcuts for better UX (using Cmd on Mac, Ctrl on other platforms)
#ifdef Q_OS_MAC
    auto* connectShortcut = new QShortcut(QKeySequence("Cmd+Shift+C"), this);
    auto* configShortcut = new QShortcut(QKeySequence("Cmd+,"), this);  // Standard preferences shortcut on Mac
    auto* recordShortcut = new QShortcut(QKeySequence("Cmd+R"), this);
    auto* saveShortcut = new QShortcut(QKeySequence("Cmd+S"), this);
    auto* playShortcut = new QShortcut(QKeySequence("Cmd+Space"), this);
    auto* resetShortcut = new QShortcut(QKeySequence("Cmd+Shift+R"), this);
    auto* devModeShortcut = new QShortcut(QKeySequence("Cmd+D"), this);
#else
    auto* connectShortcut = new QShortcut(QKeySequence("Ctrl+C"), this);
    auto* configShortcut = new QShortcut(QKeySequence("Ctrl+P"), this);
    auto* recordShortcut = new QShortcut(QKeySequence("Ctrl+R"), this);
    auto* saveShortcut = new QShortcut(QKeySequence("Ctrl+S"), this);
    auto* playShortcut = new QShortcut(QKeySequence("Ctrl+Space"), this);
    auto* resetShortcut = new QShortcut(QKeySequence("Ctrl+Shift+R"), this);
    auto* devModeShortcut = new QShortcut(QKeySequence("Ctrl+D"), this);
#endif
    
    connect(connectShortcut, &QShortcut::activated, this, &MainWindow::connectHub);
    connect(configShortcut, &QShortcut::activated, this, &MainWindow::openConfigDialog);
    connect(recordShortcut, &QShortcut::activated, this, &MainWindow::toggleRecording);
    connect(saveShortcut, &QShortcut::activated, this, &MainWindow::saveCurrentRun);
    connect(playShortcut, &QShortcut::activated, this, &MainWindow::playSelectedRun);
    connect(resetShortcut, &QShortcut::activated, this, &MainWindow::resetSimulator);
    connect(devModeShortcut, &QShortcut::activated, this, [this]() {
        developerCheck->setChecked(!developerCheck->isChecked());
        toggleDeveloperMode();
    });
    
    auto* deleteShortcut = new QShortcut(QKeySequence("Delete"), this);
    connect(deleteShortcut, &QShortcut::activated, this, &MainWindow::deleteSelectedRun);
    
    // Add undo/redo shortcuts
#ifdef Q_OS_MAC
    auto* undoShortcut = new QShortcut(QKeySequence("Cmd+Z"), this);
    auto* redoShortcut = new QShortcut(QKeySequence("Cmd+Shift+Z"), this);
#else
    auto* undoShortcut = new QShortcut(QKeySequence("Ctrl+Z"), this);
    auto* redoShortcut = new QShortcut(QKeySequence("Ctrl+Y"), this);
#endif
    connect(undoShortcut, &QShortcut::activated, this, &MainWindow::undoLastAction);
    connect(redoShortcut, &QShortcut::activated, this, &MainWindow::redoLastAction);
    
    connect(runsList, &QListWidget::itemSelectionChanged, this, [this]() {
        bool hasSelection = !runsList->selectedItems().isEmpty();
        playButton->setEnabled(hasSelection);
        deleteButton->setEnabled(hasSelection);
    });
    
    connect(bleController.get(), &BLEController::connectionStateChanged,
            this, [this](BLEController::ConnectionState state) {
                onBleConnectionChanged(state == BLEController::ConnectionState::Connected);
            });
    connect(bleController.get(), &BLEController::hubFound,
            this, &MainWindow::onBleHubFound);
    connect(bleController.get(), &BLEController::errorOccurred,
            this, &MainWindow::onBleError);
    

    
    telemetryTimer->setInterval(100);  // Update telemetry every 100ms
    connect(telemetryTimer.get(), &QTimer::timeout, this, &MainWindow::updateTelemetry);
    telemetryTimer->start();
    
    playbackTimer->setInterval(20);
    connect(playbackTimer.get(), &QTimer::timeout, this, [this]() {
        // Add safety checks to prevent crashes during shutdown
        if (!playbackTimer || isClosing) {
            return;
        }
        
        if (!isPlayingBack || playbackCommands.empty()) {
            playbackTimer->stop();
            return;
        }
        
        double currentTime = (QDateTime::currentMSecsSinceEpoch() / 1000.0) - playbackStartTime;
        
        // Safety check for playback index bounds
        if (playbackIndex < 0 || playbackIndex >= static_cast<int>(playbackCommands.size())) {
            isPlayingBack = false;
            playbackTimer->stop();
            logStatus("Playback stopped due to index error", "warning");
            return;
        }
        
        while (playbackIndex < static_cast<int>(playbackCommands.size()) &&
               playbackCommands[playbackIndex].timestamp <= currentTime) {
            executeCommand(playbackCommands[playbackIndex].parameters);
            playbackIndex++;
        }
        
        if (playbackIndex >= static_cast<int>(playbackCommands.size())) {
            isPlayingBack = false;
            playbackTimer->stop();
            logStatus("Playback completed", "info");
        }
    });
}

void MainWindow::setupStartupAnimation() {
    targetGeometry = geometry();
    
    startupAnimation = std::make_unique<QPropertyAnimation>(this, "geometry");
    startupAnimation->setDuration(850);
    startupAnimation->setEasingCurve(QEasingCurve::OutCubic);
    
    QRect rect = targetGeometry;
    int w = static_cast<int>(rect.width() * 0.5);
    int h = static_cast<int>(rect.height() * 0.5);
    int x = rect.x() + (rect.width() - w) / 2;
    int y = rect.y() + (rect.height() - h) / 2;
    
    startGeometry = QRect(x, y, w, h);
}

void MainWindow::setupExitAnimation() {
    exitAnimation = std::make_unique<QPropertyAnimation>(this, "geometry");
    exitAnimation->setDuration(650);
    exitAnimation->setEasingCurve(QEasingCurve::InCubic);
    
    opacityAnimation = std::make_unique<QPropertyAnimation>(this, "windowOpacity");
    opacityAnimation->setDuration(650);
    opacityAnimation->setEasingCurve(QEasingCurve::InCubic);
    
    connect(exitAnimation.get(), &QPropertyAnimation::finished, this, &MainWindow::forceClose);
}

void MainWindow::setupAutoSave() {
    autoSaveTimer->setInterval(30000); // Auto-save every 30 seconds
    connect(autoSaveTimer.get(), &QTimer::timeout, this, &MainWindow::performAutoSave);
    autoSaveTimer->start();
}

void MainWindow::performAutoSave() {
    if (isRecording && !currentRecording.empty()) {
        // Create auto-save with timestamp
        QString timestamp = QDateTime::currentDateTime().toString("yyyy-MM-dd_hh-mm-ss");
        QString autoSaveName = QString("AutoSave_%1").arg(timestamp);
        
        // Save the recording data
        QJsonObject runData;
        runData["name"] = autoSaveName;
        runData["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
        runData["duration"] = recordingTimer->elapsed() / 1000.0;
        runData["isAutoSave"] = true;
        
        QJsonArray commandsArray;
        for (const auto& cmd : currentRecording) {
            QJsonObject cmdObj;
            cmdObj["timestamp"] = cmd.timestamp;
            cmdObj["command"] = QJsonObject::fromVariantHash(cmd.parameters);
            commandsArray.append(cmdObj);
        }
        runData["commands"] = commandsArray;
        
        // Save to auto-save file
        QJsonObject allRuns = loadSavedRuns();
        allRuns[autoSaveName] = runData;
        
        QJsonDocument doc(allRuns);
        QFile file("saved_runs/saved_runs.json");
        if (file.open(QIODevice::WriteOnly)) {
            file.write(doc.toJson());
            file.close();
            logStatus(QString("Auto-saved: %1").arg(autoSaveName), "info");
        }
    }
}

void MainWindow::keyPressEvent(QKeyEvent* event) {
    if (event->isAutoRepeat()) {
        return;
    }
    
    int key = event->key();
    pressedKeys.insert(key);
    
    QString keyStr;
    switch (key) {
        case Qt::Key_W: keyStr = "W"; break;
        case Qt::Key_A: keyStr = "A"; break;
        case Qt::Key_S: keyStr = "S"; break;
        case Qt::Key_D: keyStr = "D"; break;
        case Qt::Key_Q: keyStr = "Q"; break;
        case Qt::Key_E: keyStr = "E"; break;
        case Qt::Key_R: keyStr = "R"; break;
        case Qt::Key_F: keyStr = "F"; break;
        case Qt::Key_Space: keyStr = "SPACE"; break;
        default: return;
    }
    
    processKeyCommand(keyStr, true);
}

void MainWindow::keyReleaseEvent(QKeyEvent* event) {
    if (event->isAutoRepeat()) {
        return;
    }
    
    int key = event->key();
    pressedKeys.erase(key);
    
    QString keyStr;
    switch (key) {
        case Qt::Key_W: keyStr = "W"; break;
        case Qt::Key_A: keyStr = "A"; break;
        case Qt::Key_S: keyStr = "S"; break;
        case Qt::Key_D: keyStr = "D"; break;
        case Qt::Key_Q: keyStr = "Q"; break;
        case Qt::Key_E: keyStr = "E"; break;
        case Qt::Key_R: keyStr = "R"; break;
        case Qt::Key_F: keyStr = "F"; break;
        case Qt::Key_Space: keyStr = "SPACE"; break;
        default: return;
    }
    
    processKeyCommand(keyStr, false);
}

void MainWindow::mousePressEvent(QMouseEvent *event) {
    if (event->button() == Qt::LeftButton) {
        isDragging = true;
        lastMousePos = event->globalPosition().toPoint();
    }
}

void MainWindow::mouseMoveEvent(QMouseEvent *event) {
    if (isDragging && event->buttons() & Qt::LeftButton) {
        QPoint delta = event->globalPosition().toPoint() - lastMousePos;
        move(pos() + delta);
        lastMousePos = event->globalPosition().toPoint();
    }
}

void MainWindow::closeEvent(QCloseEvent* event) {
    if (isClosing) {
        event->accept();
        return;
    }
    
    // Save settings before closing
    saveSettings();
    
    event->ignore();
    startExitAnimation();
}

void MainWindow::showEvent(QShowEvent* event) {
    QMainWindow::showEvent(event);
    
    if (startupAnimation && !hasAnimated) {
        hasAnimated = true;
        setGeometry(startGeometry);
        startupAnimation->setStartValue(startGeometry);
        startupAnimation->setEndValue(targetGeometry);
        startupAnimation->start();
    }
}

void MainWindow::resizeEvent(QResizeEvent* event) {
    QMainWindow::resizeEvent(event);
    if (contentSplitter) {
        contentSplitter->setSizes({SIDEBAR_WIDTH, width() - SIDEBAR_WIDTH});
    }
}

void MainWindow::connectHub() {
    logStatus("Scanning for Pybricks hubs...", "info");
    bleController->scanForHub();
    
    QTimer::singleShot(5000, this, [this]() {
        if (!isConnected) {
            bleController->connectToHub();
        }
    });
}

void MainWindow::toggleDeveloperMode() {
    isDeveloperMode = developerCheck->isChecked();
    
    if (isDeveloperMode) {
        logStatus("Developer mode enabled - using simulator only", "info");
        hubStatus->setText("● Developer Mode");
        hubStatus->setObjectName("status_connected");
        simulatorGroup->show();
        uploadMapButton->setVisible(true);
        // Reset the robot position to center when developer mode is enabled
        simulator->resetSimulation();
    } else {
        logStatus("Developer mode disabled", "info");
        hubStatus->setText(isConnected ? "● Hub Connected" : "● Hub Disconnected");
        hubStatus->setObjectName(isConnected ? "status_connected" : "status_disconnected");
        simulatorGroup->hide();
        uploadMapButton->setVisible(false);
    }
    
    connectButton->setEnabled(!isDeveloperMode);
}

void MainWindow::resetSimulator() {
    simulator->resetSimulation();
    logStatus("Robot simulator position reset", "info");
}

void MainWindow::openConfigDialog() {
    // Use stack allocation to avoid memory management issues
    ConfigDialog dialog(this, robotConfig);
    
    // Setup calibration system
    dialog.setBLEController(bleController.get());
    dialog.setRobotSimulator(simulator.get());
    dialog.setDeveloperMode(isDeveloperMode);
    
    int result = dialog.exec();
    
    if (result == QDialog::Accepted) {
        RobotConfig newConfig = dialog.getConfig();
        robotConfig = newConfig;
        logStatus("Robot configuration updated", "info");
        
        // If calibration data was updated, log it
        if (newConfig.hasValidCalibration()) {
            logStatus(QString("Robot calibration active - Quality: %1%")
                     .arg(newConfig.calibrationQuality, 0, 'f', 1), "info");
        }
    }
    
    // No manual deletion needed - stack object will be destroyed automatically
}

void MainWindow::copyPybricksCode() {
    const QString hubCode = R"(from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Color
from pybricks.robotics import DriveBase
from pybricks.tools import wait
from usys import stdin, stdout
from uselect import poll
import ujson

hub = PrimeHub()

hub.display.icon([
    [100, 100, 100, 100, 100],
    [100, 0, 100, 0, 100], 
    [100, 100, 100, 100, 100],
    [100, 0, 0, 0, 100],
    [100, 100, 100, 100, 100]
])

motors = {}
drive_base = None

left_motor_port = Port.A
right_motor_port = Port.B
arm1_motor_port = Port.C
arm2_motor_port = Port.D

try:
    left_motor = Motor(left_motor_port)
    right_motor = Motor(right_motor_port)
    drive_base = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)
    
    drive_base.settings(
        straight_speed=500,
        straight_acceleration=250,
        turn_rate=200,
        turn_acceleration=300
    )
    
    hub.light.on(Color.GREEN)
except:
    hub.light.on(Color.YELLOW)

try:
    motors['arm1'] = Motor(arm1_motor_port)
except:
    pass

try:
    motors['arm2'] = Motor(arm2_motor_port)
except:
    pass

keyboard = poll()
keyboard.register(stdin)

hub.display.icon([
    [0, 100, 0, 100, 0],
    [100, 100, 100, 100, 100],
    [0, 100, 100, 100, 0],
    [0, 0, 100, 0, 0],
    [0, 0, 100, 0, 0]
])

while True:
    stdout.buffer.write(b"rdy")
    
    while not keyboard.poll(10):
        wait(1)
    
    try:
        data = stdin.buffer.read()
        if data:
            command_str = data.decode('utf-8')
            command = ujson.loads(command_str)
            
            cmd_type = command.get('type', '')
            
            if cmd_type == 'drive' and drive_base:
                speed = command.get('speed', 0)
                turn_rate = command.get('turn_rate', 0)
                drive_base.drive(speed, turn_rate)
                stdout.buffer.write(b"DRIVE_OK")
                
            elif cmd_type in ['arm1', 'arm2'] and cmd_type in motors:
                motor = motors[cmd_type]
                speed = command.get('speed', 0)
                if speed == 0:
                    motor.stop()
                else:
                    motor.run(speed)
                stdout.buffer.write(b"ARM_OK")
                
            elif cmd_type == 'config':
                try:
                    axle_track = command.get('axle_track', 112)
                    wheel_diameter = command.get('wheel_diameter', 56)
                    if drive_base:
                        drive_base = DriveBase(left_motor, right_motor, 
                                             wheel_diameter=wheel_diameter, 
                                             axle_track=axle_track)
                        
                        straight_speed = command.get('straight_speed', 500)
                        straight_acceleration = command.get('straight_acceleration', 250)
                        turn_rate = command.get('turn_rate', 200)
                        turn_acceleration = command.get('turn_acceleration', 300)
                        
                        drive_base.settings(
                            straight_speed=straight_speed,
                            straight_acceleration=straight_acceleration,
                            turn_rate=turn_rate,
                            turn_acceleration=turn_acceleration
                        )
                        
                    stdout.buffer.write(b"CONFIG_OK")
                except:
                    stdout.buffer.write(b"CONFIG_ERROR")
            else:
                stdout.buffer.write(b"UNKNOWN_CMD")
                
    except Exception as e:
        stdout.buffer.write(b"ERROR")
    
    wait(10) 
)";
    
    QClipboard* clipboard = QApplication::clipboard();
    clipboard->setText(hubCode);
    
    logStatus("Pybricks hub code copied to clipboard!", "info");
    copyPybricksButton->setText("Copied!");
    
    // Reset button text after 2 seconds
    QTimer::singleShot(2000, this, [this]() {
        copyPybricksButton->setText("Copy Hub Code");
    });
}

void MainWindow::uploadMap() {
    QString fileName = QFileDialog::getOpenFileName(this,
        "Select Map Image", "",
        "Image Files (*.png *.jpg *.jpeg *.bmp *.gif *.tiff)");
    
    if (!fileName.isEmpty()) {
        simulator->setBackgroundImage(fileName);
        logStatus("Map uploaded: " + QFileInfo(fileName).fileName(), "info");
    }
}

void MainWindow::toggleRecording() {
    if (isRecording) {
        isRecording = false;
        recordButton->setText("Record Run");
        recordButton->setChecked(false);
        saveButton->setEnabled(!currentRecording.empty());
        recordStatus->setText("Not Recording");
        logStatus("Recording stopped", "info");
    } else {
        currentRecording.clear();
        isRecording = true;
        recordingTimer->start();
        recordButton->setText("Stop Recording");
        recordButton->setChecked(true);
        saveButton->setEnabled(false);
        recordStatus->setText("Recording...");
        logStatus("Recording started", "info");
    }
}

void MainWindow::saveCurrentRun() {
    if (currentRecording.empty()) {
        logStatus("No recording to save", "warning");
        return;
    }
    
    QString runName = runNameInput->text().trimmed();
    if (runName.isEmpty()) {
        runName = "Run 1";
    }
    
    QString timestamp = QDateTime::currentDateTime().toString("yyyy-MM-dd_hh-mm-ss");
    QString filename = QString("%1_%2.json").arg(runName.replace(" ", "_"), timestamp);
    
    QJsonObject runData;
    runData["name"] = runName;
    runData["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    runData["config"] = robotConfig.toJson();
    
    QJsonArray commandsArray;
    for (const auto& cmd : currentRecording) {
        commandsArray.append(cmd.toJson());
    }
    runData["commands"] = commandsArray;
    
    QJsonDocument doc(runData);
    
    QDir savedRunsDir("saved_runs");
    if (!savedRunsDir.exists()) {
        if (!savedRunsDir.mkpath(".")) {
            logStatus("Failed to create saved_runs directory", "error");
            return;
        }
    }
    
    QFile file(QString("saved_runs/%1").arg(filename));
    if (file.open(QIODevice::WriteOnly)) {
        qint64 bytesWritten = file.write(doc.toJson());
        file.close();
        
        if (bytesWritten > 0) {
            logStatus("Run saved: " + filename, "info");
            updateRunsList();
            saveButton->setEnabled(false);
            currentRecording.clear();
            recordStatus->setText("Not Recording");
        } else {
            logStatus("Failed to write run data", "error");
        }
    } else {
        logStatus("Failed to save run: " + file.errorString(), "error");
    }
}

void MainWindow::playSelectedRun() {
    auto selectedItems = runsList->selectedItems();
    if (selectedItems.isEmpty()) {
        return;
    }
    
    QString filename = selectedItems[0]->text();
    QFile file(QString("saved_runs/%1").arg(filename));
    
    if (!file.open(QIODevice::ReadOnly)) {
        logStatus("Failed to load run: " + filename, "error");
        return;
    }
    
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    file.close();
    
    playbackRun(doc.object());
}

void MainWindow::deleteSelectedRun() {
    auto selectedItems = runsList->selectedItems();
    if (selectedItems.isEmpty()) {
        return;
    }
    
    QString filename = selectedItems[0]->text();
    
    int ret = QMessageBox::question(this, "Delete Run",
                                   QString("Are you sure you want to delete '%1'?").arg(filename),
                                   QMessageBox::Yes | QMessageBox::No,
                                   QMessageBox::No);
    
    if (ret == QMessageBox::Yes) {
        QFile file(QString("saved_runs/%1").arg(filename));
        if (file.remove()) {
            logStatus("Run deleted: " + filename, "info");
            updateRunsList();
        } else {
            logStatus("Failed to delete run", "error");
        }
    }
}



void MainWindow::onBleConnectionChanged(bool connected) {
    isConnected = connected;
    
    connectButton->setEnabled(!connected && !isDeveloperMode);
    
    if (!isDeveloperMode) {
        hubStatus->setText(connected ? "● Hub Connected" : "● Hub Disconnected");
        hubStatus->setObjectName(connected ? "status_connected" : "status_disconnected");
    }
    
    if (connected) {
        logStatus("Successfully connected to SPIKE Prime hub", "info");
    }
}

void MainWindow::onBleHubFound(const QString& hubName) {
    logStatus("Found hub: " + hubName, "info");
}

void MainWindow::onBleError(const QString& error) {
    logStatus("BLE Error: " + error, "error");
}

void MainWindow::updateRunsList() {
    runsList->clear();
    
    QDir savedRunsDir("saved_runs");
    if (!savedRunsDir.exists()) {
        return;
    }
    
    QStringList filters;
    filters << "*.json";
    
    QFileInfoList files = savedRunsDir.entryInfoList(filters, QDir::Files, QDir::Time);
    
    for (const QFileInfo& fileInfo : files) {
        runsList->addItem(fileInfo.fileName());
    }
}

void MainWindow::toggleMaximize() {
    if (isMaximized) {
        showNormal();
        maximizeButton->setText("□");
        isMaximized = false;
    } else {
        showMaximized();
        maximizeButton->setText("⧉");
        isMaximized = true;
    }
}

void MainWindow::updateTelemetry() {
    static int frameCount = 0;
    static qint64 lastTime = QDateTime::currentMSecsSinceEpoch();
    
    // Position and orientation
    QString posText = QString("Position: (%1, %2) | Angle: %3°")
                     .arg(static_cast<int>(simulator->getRobotX()))
                     .arg(static_cast<int>(simulator->getRobotY()))
                     .arg(static_cast<int>(simulator->getRobotAngle()));
    positionLabel->setText(posText);
    
    // Speed and movement data
    QString speedText = QString("Speed: %1 | Turn: %2 | Arms: %3, %4")
                       .arg(simulator->getActualSpeed(), 0, 'f', 1)
                       .arg(simulator->getActualTurn(), 0, 'f', 1)
                       .arg(simulator->getActualArm1Speed(), 0, 'f', 1)
                       .arg(simulator->getActualArm2Speed(), 0, 'f', 1);
    speedLabel->setText(speedText);
    
    // Connection status
    QString connText;
    if (isDeveloperMode) {
        connText = "Connection: Developer Mode | Lag: 0ms";
    } else if (isConnected) {
        connText = "Connection: Hub Connected | Lag: ~30ms";
    } else {
        connText = "Connection: Disconnected | Lag: N/A";
    }
    connectionLabel->setText(connText);
    
    // Performance monitoring (update every second)
    frameCount++;
    qint64 currentTime = QDateTime::currentMSecsSinceEpoch();
    if (currentTime - lastTime >= 1000) {
        double fps = frameCount * 1000.0 / (currentTime - lastTime);
        
        // Simple memory estimation based on current recordings
        double memoryMB = (currentRecording.size() * 0.001) + 15.0; // Base app memory ~15MB
        
        performanceLabel->setText(QString("Performance: FPS: %1 | Memory: ~%2 MB")
                                 .arg(fps, 0, 'f', 1)
                                 .arg(memoryMB, 0, 'f', 1));
        
        frameCount = 0;
        lastTime = currentTime;
    }
}

void MainWindow::logStatus(const QString& message, const QString& level) {
    QString timestamp = QDateTime::currentDateTime().toString("hh:mm:ss");
    QString logEntry = QString("[%1] %2: %3").arg(timestamp, level.toUpper(), message);
    
    statusDisplay->append(logEntry);
    
    if (statusDisplay->document()->blockCount() > 100) {
        QTextCursor cursor = statusDisplay->textCursor();
        cursor.movePosition(QTextCursor::Start);
        cursor.select(QTextCursor::BlockUnderCursor);
        cursor.deleteChar();
    }
    
    statusDisplay->moveCursor(QTextCursor::End);
    statusLabel->setText(message);
}

void MainWindow::processKeyCommand(const QString& key, bool isPressed) {
    Q_UNUSED(isPressed)  // Parameter reserved for future use
    QVariantHash command;
    
    if (key == "W" || key == "A" || key == "S" || key == "D" || key == "SPACE") {
        command["type"] = "drive";
        
        int speed = 0;
        int turnRate = 0;
        
        if (pressedKeys.count(Qt::Key_W)) speed += 200;
        if (pressedKeys.count(Qt::Key_S)) speed -= 200;
        if (pressedKeys.count(Qt::Key_A)) turnRate -= 100;
        if (pressedKeys.count(Qt::Key_D)) turnRate += 100;
        if (pressedKeys.count(Qt::Key_Space)) {
            speed = 0;
            turnRate = 0;  // Also reset turn rate when space is pressed
        }
        
        command["speed"] = speed;
        command["turn_rate"] = turnRate;
        
    } else if (key == "Q" || key == "E") {
        command["type"] = "arm1";
        
        int speed = 0;
        if (pressedKeys.count(Qt::Key_Q)) speed = 200;
        if (pressedKeys.count(Qt::Key_E)) speed = -200;
        
        command["speed"] = speed;
        
    } else if (key == "R" || key == "F") {
        command["type"] = "arm2";
        
        int speed = 0;
        if (pressedKeys.count(Qt::Key_R)) speed = 200;
        if (pressedKeys.count(Qt::Key_F)) speed = -200;
        
        command["speed"] = speed;
    }
    
    if (!command.isEmpty()) {
        executeCommand(command);
    }
}

void MainWindow::executeCommand(const QVariantHash& command) {
    QVariantHash compensatedCommand = command;
    
    // Apply calibration compensation if calibrated
    if (robotConfig.hasValidCalibration()) {
        QString cmdType = command["type"].toString();
        
        if (cmdType == "drive") {
            // Apply motor speed compensation
            double speed = command["speed"].toDouble();
            double turnRate = command["turn_rate"].toDouble();
            
            // Apply speed factors for motor balance
            if (speed > 0) {
                // When moving forward, apply left/right motor compensation
                double leftSpeed = speed * robotConfig.leftMotorSpeedFactor;
                double rightSpeed = speed * robotConfig.rightMotorSpeedFactor;
                // Use average for overall speed, but the individual compensation
                // would be applied at the motor level
                compensatedCommand["speed"] = (leftSpeed + rightSpeed) / 2.0;
            } else if (speed < 0) {
                // When moving backward, apply similar compensation
                double leftSpeed = speed * robotConfig.leftMotorSpeedFactor;
                double rightSpeed = speed * robotConfig.rightMotorSpeedFactor;
                compensatedCommand["speed"] = (leftSpeed + rightSpeed) / 2.0;
            }
            
            // Apply turn accuracy compensation
            if (turnRate != 0) {
                compensatedCommand["turn_rate"] = turnRate * robotConfig.turnAccuracyFactor;
            }
            
            // Apply straight drift correction
            if (speed != 0 && turnRate == 0) {
                // Add slight turn to counteract drift
                compensatedCommand["turn_rate"] = robotConfig.straightDriftCorrection;
            }
        }
        
        // Apply motor delay compensation would be handled by the hub
        // or could be implemented as a delay in command sending
    }
    
    if (isDeveloperMode) {
        simulator->updateCommand(compensatedCommand);
    } else if (isConnected) {
        bleController->sendCommand(compensatedCommand);
    }
    
    if (isRecording) {
        // Save state before adding new command for undo functionality
        saveRecordingState();
        
        double timestamp = recordingTimer->elapsed() / 1000.0;
        // Record the original command, not the compensated one
        currentRecording.emplace_back(timestamp, command["type"].toString(), command);
    }
}

QString MainWindow::formatCmdDisplay(const QVariantHash& command) {
    QString type = command["type"].toString();
    
    if (type == "drive") {
        return QString("DRIVE(speed=%1, turn=%2)")
               .arg(command["speed"].toInt())
               .arg(command["turn_rate"].toInt());
    } else if (type == "arm1") {
        return QString("ARM1(speed=%1)")
               .arg(command["speed"].toInt());
    } else if (type == "arm2") {
        return QString("ARM2(speed=%1)")
               .arg(command["speed"].toInt());
    }
    
    return "UNKNOWN";
}

void MainWindow::playbackRun(const QJsonObject& runData) {
    if (isPlayingBack) {
        logStatus("Already playing back a run", "warning");
        return;
    }
    
    playbackCommands.clear();
    
    QJsonArray commandsArray = runData["commands"].toArray();
    for (const QJsonValue& value : commandsArray) {
        RecordedCommand cmd;
        cmd.fromJson(value.toObject());
        playbackCommands.push_back(cmd);
    }
    
    if (playbackCommands.empty()) {
        logStatus("No commands to play back", "warning");
        return;
    }
    
    playbackIndex = 0;
    playbackStartTime = QDateTime::currentMSecsSinceEpoch() / 1000.0;
    isPlayingBack = true;
    
    logStatus("Starting playback: " + runData["name"].toString(), "info");
    playbackTimer->start();
}

QJsonObject MainWindow::loadSavedRuns() {
    QDir savedRunsDir("saved_runs");
    if (!savedRunsDir.exists()) {
        return QJsonObject();
    }
    
    QJsonObject runs;
    QStringList filters;
    filters << "*.json";
    
    QFileInfoList files = savedRunsDir.entryInfoList(filters, QDir::Files);
    
    for (const QFileInfo& fileInfo : files) {
        QFile file(fileInfo.absoluteFilePath());
        if (file.open(QIODevice::ReadOnly)) {
            QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
            runs[fileInfo.baseName()] = doc.object();
            file.close();
        }
    }
    
    return runs;
}

void MainWindow::startExitAnimation() {
    if (isClosing) {
        return;
    }
    
    isClosing = true;
    
    if (isConnected) {
        bleController->disconnectFromHub();
    }
    
    QRect rect = geometry();
    int w = static_cast<int>(rect.width() * 0.3);
    int h = static_cast<int>(rect.height() * 0.3);
    int x = rect.x() + (rect.width() - w) / 2;
    int y = rect.y() + (rect.height() - h) / 2;
    
    QRect endGeometry(x, y, w, h);
    
    exitAnimation->setStartValue(rect);
    exitAnimation->setEndValue(endGeometry);
    
    opacityAnimation->setStartValue(1.0);
    opacityAnimation->setEndValue(0.0);
    
    exitAnimation->start();
    opacityAnimation->start();
}

void MainWindow::forceClose() {
    isClosing = true;
    QApplication::quit();
} 

void MainWindow::saveRecordingState() {
    if (isRecording) {
        undoHistory.push_back(currentRecording);
        redoHistory.clear(); // Clear redo history when new action is performed
        
        // Limit history size to prevent memory bloat
        const size_t MAX_HISTORY = 20;
        if (undoHistory.size() > MAX_HISTORY) {
            undoHistory.erase(undoHistory.begin());
        }
    }
}

void MainWindow::undoLastAction() {
    if (!undoHistory.empty() && isRecording) {
        // Save current state to redo history
        redoHistory.push_back(currentRecording);
        
        // Restore previous state
        currentRecording = undoHistory.back();
        undoHistory.pop_back();
        
        logStatus("Undo: Restored previous recording state", "info");
    }
}

void MainWindow::redoLastAction() {
    if (!redoHistory.empty() && isRecording) {
        // Save current state to undo history
        undoHistory.push_back(currentRecording);
        
        // Restore next state
        currentRecording = redoHistory.back();
        redoHistory.pop_back();
        
        logStatus("Redo: Restored next recording state", "info");
    }
}

void MainWindow::loadSettings() {
    QFile file("settings.json");
    if (file.open(QIODevice::ReadOnly)) {
        QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
        QJsonObject settings = doc.object();
        file.close();
        
        // Restore window geometry
        if (settings.contains("window_geometry")) {
            QJsonObject geo = settings["window_geometry"].toObject();
            setGeometry(geo["x"].toInt(), geo["y"].toInt(), 
                       geo["width"].toInt(), geo["height"].toInt());
        }
        
        // Restore developer mode
        if (settings.contains("developer_mode")) {
            bool devMode = settings["developer_mode"].toBool();
            
            // Temporarily block signals to prevent toggleDeveloperMode from being called
            developerCheck->blockSignals(true);
            developerCheck->setChecked(devMode);
            developerCheck->blockSignals(false);
            
            isDeveloperMode = devMode; // Set the state directly
            if (devMode) {
                logStatus("Developer mode enabled - using simulator only", "info");
                hubStatus->setText("● Developer Mode");
                hubStatus->setObjectName("status_connected");
                simulatorGroup->show();
                uploadMapButton->setVisible(true);
                simulator->resetSimulation();
            } else {
                logStatus("Developer mode disabled", "info");
                hubStatus->setText("● Hub Disconnected");
                hubStatus->setObjectName("status_disconnected");
                simulatorGroup->hide();
                uploadMapButton->setVisible(false);
            }
            connectButton->setEnabled(!devMode);
        }
        
        // Restore last run name
        if (settings.contains("last_run_name")) {
            runNameInput->setText(settings["last_run_name"].toString());
        }
        
        // Restore splitter sizes
        if (settings.contains("splitter_sizes")) {
            QJsonArray sizes = settings["splitter_sizes"].toArray();
            QList<int> sizeList;
            for (const auto& size : sizes) {
                sizeList.append(size.toInt());
            }
            if (sizeList.size() == 2) {
                contentSplitter->setSizes(sizeList);
            }
        }
        
        // Restore robot configuration (including calibration data)
        if (settings.contains("robot_config")) {
            robotConfig.fromJson(settings["robot_config"].toObject());
            if (robotConfig.hasValidCalibration()) {
                logStatus(QString("Loaded calibration data - Quality: %1%")
                         .arg(robotConfig.calibrationQuality, 0, 'f', 1), "info");
            }
        }
        
        logStatus("Settings loaded successfully", "info");
    } else {
        logStatus("No previous settings found, using defaults", "info");
    }
}

void MainWindow::saveSettings() {
    QJsonObject settings;
    
    // Save window geometry
    QJsonObject geo;
    geo["x"] = geometry().x();
    geo["y"] = geometry().y();
    geo["width"] = geometry().width();
    geo["height"] = geometry().height();
    settings["window_geometry"] = geo;
    
    // Don't save developer mode - always start with it disabled
    // settings["developer_mode"] = developerCheck->isChecked();
    
    // Save last run name
    settings["last_run_name"] = runNameInput->text();
    
    // Save splitter sizes
    QJsonArray sizes;
    for (int size : contentSplitter->sizes()) {
        sizes.append(size);
    }
    settings["splitter_sizes"] = sizes;
    
    // Save robot configuration (including calibration data)
    settings["robot_config"] = robotConfig.toJson();
    
    // Save timestamp
    settings["saved_at"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    
    QJsonDocument doc(settings);
    QFile file("settings.json");
    if (file.open(QIODevice::WriteOnly)) {
        file.write(doc.toJson());
        file.close();
        logStatus("Settings saved successfully", "info");
    } else {
        logStatus("Failed to save settings", "warning");
    }
} 