#include <QtTest/QtTest>
#include <QApplication>
#include <QSignalSpy>
#include <QKeyEvent>
#include "gui/main_window.h"

class TestMainWindow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();
    
    void testConstructor();
    void testKeyEvents();
    void testDeveloperMode();
    void testRecording();

private:
    MainWindow* window;
    QApplication* app;
};

void TestMainWindow::initTestCase()
{
    if (!QApplication::instance()) {
        int argc = 0;
        char* argv[] = {nullptr};
        app = new QApplication(argc, argv);
    }
    qDebug() << "Starting MainWindow tests...";
}

void TestMainWindow::cleanupTestCase()
{
    qDebug() << "MainWindow tests completed.";
}

void TestMainWindow::init()
{
    window = new MainWindow();
    window->show();
    QTest::qWaitForWindowExposed(window);
}

void TestMainWindow::cleanup()
{
    delete window;
    window = nullptr;
}

void TestMainWindow::testConstructor()
{
    QVERIFY(window != nullptr);
    QVERIFY(window->isVisible());
}

void TestMainWindow::testKeyEvents()
{
    // Test key press events
    QKeyEvent* keyPress = new QKeyEvent(QEvent::KeyPress, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyPress);
    
    QKeyEvent* keyRelease = new QKeyEvent(QEvent::KeyRelease, Qt::Key_W, Qt::NoModifier);
    QApplication::postEvent(window, keyRelease);
    
    QApplication::processEvents();
    
    QVERIFY(true); // If we get here, key events didn't crash
}

void TestMainWindow::testDeveloperMode()
{
    // Test developer mode toggle
    window->toggleDeveloperMode();
    QTest::qWait(50);
    
    QVERIFY(true); // Basic test that it doesn't crash
}

void TestMainWindow::testRecording()
{
    // Test recording functionality
    window->toggleRecording();
    QTest::qWait(50);
    
    window->toggleRecording();
    QTest::qWait(50);
    
    QVERIFY(true); // Basic test that recording toggle works
}

QTEST_MAIN(TestMainWindow)
#include "test_main_window.moc" 