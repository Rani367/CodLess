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
#include <algorithm>
#include <chrono>
#include <QDebug> // Added for qDebug

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent)
    , simulator(std::make_unique<RobotSimulator>(this))
    , bleController(std::make_unique<BLEController>(this))
    , keyUpdateTimer(std::make_unique<QTimer>(this))
    , playbackTimer(std::make_unique<QTimer>(this))
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

MainWindow::~MainWindow() = default;

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
    connectButton->setToolTip("1. Upload hub_control.py via code.pybricks.com\n2. Keep Pybricks website open\n3. Click to connect");
    
    developerCheck = new QCheckBox("Developer Mode (Simulation)");
    developerCheck->setObjectName("checkbox");
    
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
    
    configLayout->addWidget(configButton);
    
    sidebarLayout->addWidget(configGroup);
    
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
    
    deleteButton = new QPushButton("Delete");
    deleteButton->setObjectName("danger_btn");
    deleteButton->setEnabled(false);
    
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
    
    simControls->addWidget(simInfo);
    simControls->addStretch();
    simControls->addWidget(resetSimButton);
    
    simulatorLayout->addLayout(simControls);
    
    layout->addWidget(simulatorGroup);
    simulatorGroup->hide();
    
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
    
    saveButton = new QPushButton("Save Run");
    saveButton->setObjectName("success_btn");
    saveButton->setMinimumHeight(50);
    saveButton->setEnabled(false);
    
    recordButtonLayout->addWidget(recordButton);
    recordButtonLayout->addWidget(saveButton);
    recordLayout->addLayout(recordButtonLayout);
    
    recordStatus = new QLabel("Not Recording");
    recordStatus->setObjectName("info_text");
    recordLayout->addWidget(recordStatus);
    
    layout->addWidget(recordingGroup);
    
    statusGroup = new QGroupBox("Robot Status");
    statusGroup->setObjectName("group_box");
    auto* statusLayout = new QVBoxLayout(statusGroup);
    
    statusDisplay = new QTextEdit();
    statusDisplay->setObjectName("status_display");
    statusDisplay->setMaximumHeight(200);
    statusDisplay->setReadOnly(true);
    
    statusLayout->addWidget(statusDisplay);
    layout->addWidget(statusGroup);
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
        
        #status_display {
            background-color: rgb(35, 35, 35);
            border: 1px solid rgb(70, 70, 70);
            color: rgb(255, 255, 255);
            font-family: 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
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
    connect(resetSimButton, &QPushButton::clicked, this, &MainWindow::resetSimulator);
    connect(recordButton, &QPushButton::clicked, this, &MainWindow::toggleRecording);
    connect(saveButton, &QPushButton::clicked, this, &MainWindow::saveCurrentRun);
    connect(playButton, &QPushButton::clicked, this, &MainWindow::playSelectedRun);
    connect(deleteButton, &QPushButton::clicked, this, &MainWindow::deleteSelectedRun);
    
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
    

    
    playbackTimer->setInterval(20);
    connect(playbackTimer.get(), &QTimer::timeout, this, [this]() {
        if (!isPlayingBack || playbackCommands.empty()) {
            return;
        }
        
        double currentTime = (QDateTime::currentMSecsSinceEpoch() / 1000.0) - playbackStartTime;
        
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
    } else {
        logStatus("Developer mode disabled", "info");
        hubStatus->setText(isConnected ? "● Hub Connected" : "● Hub Disconnected");
        hubStatus->setObjectName(isConnected ? "status_connected" : "status_disconnected");
        simulatorGroup->hide();
    }
    
    connectButton->setEnabled(!isDeveloperMode);
}

void MainWindow::resetSimulator() {
    simulator->resetSimulation();
    logStatus("Robot simulator position reset", "info");
}

void MainWindow::openConfigDialog() {
    ConfigDialog* dialog = new ConfigDialog(this, robotConfig);
    if (dialog->exec() == QDialog::Accepted) {
        robotConfig = dialog->getConfig();
        logStatus("Robot configuration updated", "info");
    }
    dialog->deleteLater();
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
        savedRunsDir.mkpath(".");
    }
    
    QFile file(QString("saved_runs/%1").arg(filename));
    if (file.open(QIODevice::WriteOnly)) {
        file.write(doc.toJson());
        file.close();
        logStatus("Run saved: " + filename, "info");
        updateRunsList();
        saveButton->setEnabled(false);
        currentRecording.clear();
        recordStatus->setText("Not Recording");
    } else {
        logStatus("Failed to save run", "error");
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
    QVariantHash command;
    
    if (key == "W" || key == "A" || key == "S" || key == "D" || key == "SPACE") {
        command["type"] = "drive";
        
        int speed = 0;
        int turnRate = 0;
        
        if (pressedKeys.count(Qt::Key_W)) speed += 200;
        if (pressedKeys.count(Qt::Key_S)) speed -= 200;
        if (pressedKeys.count(Qt::Key_A)) turnRate -= 100;
        if (pressedKeys.count(Qt::Key_D)) turnRate += 100;
        if (pressedKeys.count(Qt::Key_Space)) speed = 0;
        
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
    if (isDeveloperMode) {
        simulator->updateCommand(command);
    } else if (isConnected) {
        bleController->sendCommand(command);
    }
    
    if (isRecording) {
        double timestamp = recordingTimer->elapsed() / 1000.0;
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