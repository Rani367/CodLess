#pragma once

#include <QObject>
#include <QWidget>
#include <QPropertyAnimation>
#include <QParallelAnimationGroup>
#include <QSequentialAnimationGroup>
#include <QEasingCurve>
#include <QGraphicsOpacityEffect>
#include <memory>

/**
 * @brief Manages all window animations and transitions
 * 
 * This class handles startup animations, exit animations, smooth transitions,
 * and visual effects. It provides a centralized animation system with
 * configurable easing curves and timing.
 */
class AnimationManager : public QObject {
    Q_OBJECT

public:
    enum class AnimationType {
        Startup,
        Exit,
        FadeIn,
        FadeOut,
        SlideIn,
        SlideOut,
        Bounce,
        Elastic
    };

    explicit AnimationManager(QWidget* targetWidget, QObject* parent = nullptr);
    ~AnimationManager() override;

    // Animation control
    void startAnimation(AnimationType type);
    void stopAnimation(AnimationType type);
    void stopAllAnimations();
    
    // Startup animations
    void setupStartupAnimation();
    void playStartupAnimation();
    
    // Exit animations
    void setupExitAnimation();
    void playExitAnimation();
    
    // Transition animations
    void fadeIn(QWidget* widget, int duration = 300);
    void fadeOut(QWidget* widget, int duration = 300);
    void slideIn(QWidget* widget, const QRect& startGeometry, const QRect& endGeometry, int duration = 400);
    void slideOut(QWidget* widget, const QRect& startGeometry, const QRect& endGeometry, int duration = 400);
    
    // Window effects
    void animateWindowResize(const QRect& startGeometry, const QRect& endGeometry, int duration = 300);
    void animateWindowMove(const QPoint& startPos, const QPoint& endPos, int duration = 250);
    void animateOpacity(double startOpacity, double endOpacity, int duration = 200);
    
    // Animation configuration
    void setAnimationEnabled(bool enabled);
    void setAnimationSpeed(double speed);
    void setEasingCurve(QEasingCurve::Type curve);
    
    // Animation state
    bool isAnimationRunning(AnimationType type) const;
    bool isAnyAnimationRunning() const;
    
    // Animation presets
    void setupSmoothTransitions();
    void setupBouncyAnimations();
    void setupElegantAnimations();
    void setupFastAnimations();

signals:
    void animationStarted(AnimationType type);
    void animationFinished(AnimationType type);
    void allAnimationsFinished();

private slots:
    void onAnimationFinished();
    void onAnimationStateChanged(QAbstractAnimation::State newState, QAbstractAnimation::State oldState);

private:
    void initializeAnimations();
    void createStartupAnimation();
    void createExitAnimation();
    void createOpacityAnimation();
    void setupAnimationConnections();
    
    QWidget* targetWidget;
    bool animationsEnabled;
    double animationSpeedMultiplier;
    QEasingCurve::Type defaultEasingCurve;
    
    // Animation objects
    std::unique_ptr<QPropertyAnimation> startupAnimation;
    std::unique_ptr<QPropertyAnimation> exitAnimation;
    std::unique_ptr<QPropertyAnimation> opacityAnimation;
    std::unique_ptr<QParallelAnimationGroup> startupGroup;
    std::unique_ptr<QSequentialAnimationGroup> exitGroup;
    
    // Animation tracking
    QHash<AnimationType, QAbstractAnimation*> activeAnimations;
    QHash<QAbstractAnimation*, AnimationType> animationTypeMap;
    
    // Animation properties
    QRect startGeometry;
    QRect targetGeometry;
    std::unique_ptr<QGraphicsOpacityEffect> opacityEffect;
    
    // Animation constants
    static constexpr int DEFAULT_STARTUP_DURATION = 600;
    static constexpr int DEFAULT_EXIT_DURATION = 400;
    static constexpr int DEFAULT_FADE_DURATION = 300;
    static constexpr int DEFAULT_SLIDE_DURATION = 400;
}; 