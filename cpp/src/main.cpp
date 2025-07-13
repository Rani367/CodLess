#include <QApplication>
#include <QSplashScreen>
#include <QSystemTrayIcon>
#include <QCommandLineParser>
#include <QStyleFactory>
#include <QStandardPaths>
#include <QDir>
#include <QThread>
#include <QScreen>
#include <QMessageBox>
#include <QLoggingCategory>
#include <QPixmap>
#include <QPainter>
#include <QFont>
#include <QColor>
#include <QRect>
#include <QDebug>
#include <memory>
#include <exception>

#include "gui/main_window.h"

Q_LOGGING_CATEGORY(mainCategory, "main")

int main(int argc, char *argv[]) {
    // Enable high DPI support (must be called before creating QApplication)
    QApplication::setHighDpiScaleFactorRoundingPolicy(Qt::HighDpiScaleFactorRoundingPolicy::PassThrough);
    
    // Check Qt version
    QApplication app(argc, argv);
    
    // Set application properties
    app.setApplicationName("CodLess");
    app.setApplicationVersion("1.0.0");
    app.setOrganizationName("FLL Robotics");
    app.setOrganizationDomain("fll-robotics.com");
    
    // Set up dark theme
    app.setStyle("Fusion");
    
    // Handle command line arguments
    QCommandLineParser parser;
    parser.setApplicationDescription("CodLess Robot Control Platform");
    parser.addHelpOption();
    parser.addVersionOption();
    
    QCommandLineOption configOption("config", "Configuration file path", "file");
    parser.addOption(configOption);
    
    QCommandLineOption debugOption("debug", "Enable debug output");
    parser.addOption(debugOption);
    
    parser.process(app);
    
    if (parser.isSet(debugOption)) {
        qDebug() << "Debug mode enabled";
    }
    
    // Create and show splash screen
    QPixmap splashPixmap(400, 300);
    splashPixmap.fill(QColor(45, 45, 48));
    
    QPainter painter(&splashPixmap);
    painter.setPen(QColor(255, 255, 255));
    painter.setFont(QFont("Arial", 24, QFont::Bold));
    painter.drawText(splashPixmap.rect(), Qt::AlignCenter, "CodLess\nRobot Control Platform");
    
    // Use smart pointer to manage splash screen memory automatically
    std::unique_ptr<QSplashScreen> splash = std::make_unique<QSplashScreen>(splashPixmap);
    splash->show();
    
    app.processEvents();
    
    // Give splash screen time to display
    QThread::msleep(1000);
    
    // Create main window
    std::unique_ptr<MainWindow> window = std::make_unique<MainWindow>();
    
    window->show();
    
    // Hide splash screen - smart pointer will automatically clean up
    splash->finish(window.get());
    splash.reset();  // Explicitly clean up splash screen
    
    // Exception handling
    try {
        return app.exec();
    } catch (const std::exception& e) {
        qDebug() << "Exception caught:" << e.what();
        return 1;
    } catch (...) {
        qDebug() << "Unknown exception caught";
        return 1;
    }
} 