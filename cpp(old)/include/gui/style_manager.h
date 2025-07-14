#pragma once

#include <QObject>
#include <QWidget>
#include <QString>

/**
 * @brief Manages application-wide styling and themes
 * 
 * This class centralizes all styling logic, making it easy to maintain
 * and switch between different themes. It provides a clean separation
 * of styling concerns from the main application logic.
 */
class StyleManager : public QObject {
    Q_OBJECT

public:
    enum class Theme {
        Dark,
        Light,
        HighContrast
    };

    explicit StyleManager(QObject* parent = nullptr);
    ~StyleManager() override;

    // Theme management
    void setTheme(Theme theme);
    Theme getCurrentTheme() const { return currentTheme; }
    
    // Style application methods
    void applyMainWindowStyle(QWidget* widget);
    void applyTitleBarStyle(QWidget* widget);
    void applySidebarStyle(QWidget* widget);
    void applyButtonStyles(QWidget* widget);
    void applyInputStyles(QWidget* widget);
    void applyTextStyles(QWidget* widget);
    void applyGroupBoxStyles(QWidget* widget);
    void applyStatusBarStyle(QWidget* widget);
    
    // Color utilities
    QString getPrimaryColor() const;
    QString getSecondaryColor() const;
    QString getSuccessColor() const;
    QString getDangerColor() const;
    QString getWarningColor() const;
    QString getBackgroundColor() const;
    QString getTextColor() const;
    QString getBorderColor() const;
    
    // Dynamic theme switching
    void toggleTheme();
    void refreshStyles();
    
    // Custom style sheets
    QString getMainWindowStyleSheet() const;
    QString getTitleBarStyleSheet() const;
    QString getSidebarStyleSheet() const;
    QString getButtonStyleSheet() const;
    QString getInputStyleSheet() const;
    QString getTextStyleSheet() const;
    QString getGroupBoxStyleSheet() const;
    QString getStatusBarStyleSheet() const;

signals:
    void themeChanged(Theme newTheme);

private:
    void initializeThemes();
    void loadThemeColors();
    QString generateStyleSheet(const QString& component) const;
    
    Theme currentTheme;
    
    // Theme color maps
    QHash<QString, QString> darkColors;
    QHash<QString, QString> lightColors;
    QHash<QString, QString> highContrastColors;
    
    // Current color palette
    QHash<QString, QString> colors;
    
    // Style sheet templates
    QString mainWindowTemplate;
    QString titleBarTemplate;
    QString sidebarTemplate;
    QString buttonTemplate;
    QString inputTemplate;
    QString textTemplate;
    QString groupBoxTemplate;
    QString statusBarTemplate;
}; 