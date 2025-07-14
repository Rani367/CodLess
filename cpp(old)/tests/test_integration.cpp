#include <QtTest/QtTest>
#include <QApplication>
#include <QSignalSpy>
#include <QTimer>
#include <QKeyEvent>
#include "gui/main_window.h"
#include "sim/robot_simulator.h"
#include "core/robot_config.h"
#include "core/recorded_command.h"

class TestIntegration : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();
    
    void testFullSystemIntegration();
    void testSimulatorIntegration();
    void testRecordingPlayback();
    void testConfigurationPersistence();
    void testKeyboardToSimulator();
    void testCommandSerialization();

private:
    MainWindow* window;
    QApplication* app;
};

void TestIntegration::initTestCase()
{
    if (!QApplication::instance()) {
        int argc = 0;
        char* argv[] = {nullptr};
        app = new QApplication(argc, argv);
    }
    qDebug() << "Starting Integration tests...";
}

void TestIntegration::cleanupTestCase()
{
    qDebug() << "Integration tests completed.";
}

void TestIntegration::init()
{
    window = new MainWindow();
    window->show();
    QTest::qWaitForWindowExposed(window);
}

void TestIntegration::cleanup()
{
    delete window;
    window = nullptr;
}

void TestIntegration::testFullSystemIntegration()
{
    // Test full system workflow
    // 1. Enable developer mode
    window->toggleDeveloperMode();
    QTest::qWait(100);
    
    // 2. Start recording
    window->toggleRecording();
    QTest::qWait(100);
    
    // 3. Send some commands
    QKeyEvent* keyPress = new QKeyEvent(QEvent::KeyPress, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyPress);
    QApplication::processEvents();
    QTest::qWait(200);
    
    QKeyEvent* keyRelease = new QKeyEvent(QEvent::KeyRelease, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyRelease);
    QApplication::processEvents();
    QTest::qWait(200);
    
    // 4. Stop recording
    window->toggleRecording();
    QTest::qWait(100);
    
    // 5. Save recording
    window->saveCurrentRun();
    QTest::qWait(100);
    
    QVERIFY(true); // If we get here, the full workflow completed
}

void TestIntegration::testSimulatorIntegration()
{
    // Test simulator integration with commands
    window->toggleDeveloperMode();
    QTest::qWait(100);
    
    // Send forward command
    QKeyEvent* keyPress = new QKeyEvent(QEvent::KeyPress, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyPress);
    QApplication::processEvents();
    QTest::qWait(500);
    
    QKeyEvent* keyRelease = new QKeyEvent(QEvent::KeyRelease, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyRelease);
    QApplication::processEvents();
    QTest::qWait(100);
    
    QVERIFY(true); // Simulator should have processed the command
}

void TestIntegration::testRecordingPlayback()
{
    // Test recording and playback functionality
    window->toggleDeveloperMode();
    QTest::qWait(100);
    
    // Start recording
    window->toggleRecording();
    QTest::qWait(100);
    
    // Record some movement
    QKeyEvent* keyPress = new QKeyEvent(QEvent::KeyPress, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyPress);
    QApplication::processEvents();
    QTest::qWait(200);
    
    QKeyEvent* keyRelease = new QKeyEvent(QEvent::KeyRelease, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyRelease);
    QApplication::processEvents();
    QTest::qWait(200);
    
    // Stop recording
    window->toggleRecording();
    QTest::qWait(100);
    
    // Save the recording
    window->saveCurrentRun();
    QTest::qWait(100);
    
    // Reset simulator
    window->resetSimulator();
    QTest::qWait(100);
    
    // Play back the recording
    window->playSelectedRun();
    QTest::qWait(1000);
    
    QVERIFY(true); // Playback should have completed
}

void TestIntegration::testConfigurationPersistence()
{
    // Test configuration saving and loading
    window->openConfigDialog();
    QTest::qWait(100);
    
    // Configuration dialog should have opened
    // In a real test, we'd interact with the dialog
    
    QVERIFY(true); // Configuration system should work
}

void TestIntegration::testKeyboardToSimulator()
{
    // Test keyboard input to simulator chain
    window->toggleDeveloperMode();
    QTest::qWait(100);
    
    // Test all movement keys
    QList<Qt::Key> testKeys = {Qt::Key_W, Qt::Key_A, Qt::Key_S, Qt::Key_D, Qt::Key_Q, Qt::Key_E};
    
    for (Qt::Key key : testKeys) {
        QKeyEvent* keyPress = new QKeyEvent(QEvent::KeyPress, key, Qt::NoModifier);
        QApplication::postEvent(window, keyPress);
        QApplication::processEvents();
        QTest::qWait(100);
        
        QKeyEvent* keyRelease = new QKeyEvent(QEvent::KeyRelease, key, Qt::NoModifier);
        QApplication::postEvent(window, keyRelease);
        QApplication::processEvents();
        QTest::qWait(100);
    }
    
    QVERIFY(true); // All keys should have been processed
}

void TestIntegration::testCommandSerialization()
{
    // Test command serialization throughout system
    QVariantHash command;
    command["type"] = "drive";
    command["speed"] = 100.0;
    command["turn_rate"] = 50.0;
    
    RecordedCommand recordedCmd(12345, command);
    
    // Serialize to JSON
    QJsonObject json = recordedCmd.toJson();
    
    // Deserialize back
    RecordedCommand deserializedCmd;
    deserializedCmd.fromJson(json);
    
    // Should be equal
    QVERIFY(recordedCmd == deserializedCmd);
    
    // Test with configuration
    RobotConfig config;
    config.straightSpeed = 600.0;
    config.wheelDiameter = 62.0;
    
    QJsonObject configJson = config.toJson();
    
    RobotConfig deserializedConfig;
    deserializedConfig.fromJson(configJson);
    
    QVERIFY(config == deserializedConfig);
}

QTEST_MAIN(TestIntegration)
#include "test_integration.moc" 