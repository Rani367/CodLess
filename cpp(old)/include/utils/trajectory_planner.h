#pragma once

#include <QObject>
#include <QPointF>
#include <QRectF>
#include <QPolygonF>
#include <QTimer>
#include <QVector>
#include <QHash>
#include <memory>
#include <functional>

/**
 * @brief Advanced trajectory planning and path optimization system
 * 
 * This system provides sophisticated path planning capabilities including:
 * - A* pathfinding with dynamic obstacle avoidance
 * - Smooth trajectory generation with velocity profiles
 * - Real-time path optimization and re-planning
 * - Collision detection and avoidance
 * - Bezier curve path smoothing
 * - Waypoint-based navigation
 * - Predictive path planning for moving obstacles
 * - Multi-objective path optimization (time, energy, smoothness)
 */
class TrajectoryPlanner : public QObject {
    Q_OBJECT

public:
    struct PathNode {
        QPointF position;
        double heading;
        double velocity;
        double curvature;
        double timestamp;
        QHash<QString, double> metadata;
    };

    struct Obstacle {
        QPolygonF shape;
        QPointF velocity;
        QPointF acceleration;
        double radius;
        QString type;
        bool isStatic;
        double priority;
        QDateTime lastUpdate;
    };

    struct PlanningConstraints {
        double maxVelocity = 500.0;      // mm/s
        double maxAcceleration = 800.0;  // mm/s²
        double maxCurvature = 0.1;       // 1/mm
        double robotRadius = 150.0;      // mm
        double safetyMargin = 50.0;      // mm
        double planningHorizon = 5.0;    // seconds
        double timeResolution = 0.1;     // seconds
        bool allowReversing = false;
    };

    enum class PlanningAlgorithm {
        AStar,
        RRT,
        PRM,
        Dijkstra,
        Hybrid
    };

    enum class OptimizationObjective {
        MinimizeTime,
        MinimizeEnergy,
        MaximizeSmoothness,
        MinimizeDistance,
        Balanced
    };

    explicit TrajectoryPlanner(QObject* parent = nullptr);
    ~TrajectoryPlanner() override;

    // Path planning
    QVector<PathNode> planPath(const QPointF& start, const QPointF& goal,
                              const PlanningConstraints& constraints = PlanningConstraints());
    QVector<PathNode> planPathWithWaypoints(const QVector<QPointF>& waypoints,
                                           const PlanningConstraints& constraints = PlanningConstraints());
    bool replanPath(const QPointF& currentPosition, const QPointF& goal);

    // Obstacle management
    void addObstacle(const QString& id, const Obstacle& obstacle);
    void updateObstacle(const QString& id, const Obstacle& obstacle);
    void removeObstacle(const QString& id);
    void clearObstacles();
    QVector<Obstacle> getObstacles() const;

    // Dynamic planning
    void enableDynamicPlanning(bool enabled);
    void setReplanningInterval(int milliseconds);
    void setPredictionHorizon(double seconds);
    void setEmergencyStopDistance(double distance);

    // Path optimization
    void setOptimizationObjective(OptimizationObjective objective);
    void setPlanningAlgorithm(PlanningAlgorithm algorithm);
    void setPathSmoothingEnabled(bool enabled);
    void setVelocityProfileOptimization(bool enabled);

    // Collision detection
    bool checkCollision(const QPointF& position, double heading, double timestamp = 0.0) const;
    bool checkPathCollision(const QVector<PathNode>& path) const;
    double getDistanceToNearestObstacle(const QPointF& position) const;
    QVector<QPointF> getCollisionPoints(const QVector<PathNode>& path) const;

    // Path following
    PathNode getNextWaypoint(const QPointF& currentPosition, double currentHeading,
                           const QVector<PathNode>& path, double lookaheadDistance = 200.0) const;
    double calculateCrossTrackError(const QPointF& position, const QVector<PathNode>& path) const;
    double calculateHeadingError(double currentHeading, const QVector<PathNode>& path,
                               const QPointF& position) const;

    // Trajectory analysis
    double calculatePathLength(const QVector<PathNode>& path) const;
    double calculatePathTime(const QVector<PathNode>& path) const;
    double calculatePathCurvature(const QVector<PathNode>& path) const;
    double calculatePathSmoothness(const QVector<PathNode>& path) const;
    double calculateEnergyConsumption(const QVector<PathNode>& path) const;

    // Visualization support
    QVector<QPointF> getSearchGrid() const;
    QVector<QPointF> getExploredNodes() const;
    QVector<QLineF> getVisibilityGraph() const;

    // Configuration
    void setWorkspaceSize(const QRectF& workspace);
    void setGridResolution(double resolution);
    void setHeuristicWeight(double weight);
    void setInflationRadius(double radius);

signals:
    void pathPlanningStarted(const QPointF& start, const QPointF& goal);
    void pathPlanningCompleted(const QVector<PathNode>& path, double planningTime);
    void pathPlanningFailed(const QString& reason);
    void obstacleDetected(const QString& obstacleId, const QPointF& position);
    void collisionWarning(const QPointF& position, double timeToCollision);
    void emergencyStop(const QString& reason);
    void pathOptimized(const QVector<PathNode>& originalPath, const QVector<PathNode>& optimizedPath);

private slots:
    void performDynamicReplanning();
    void updateObstaclePredictions();
    void monitorCollisions();

private:
    struct GridCell {
        bool isObstacle = false;
        double cost = 0.0;
        QPointF position;
        GridCell* parent = nullptr;
        double gScore = std::numeric_limits<double>::infinity();
        double fScore = std::numeric_limits<double>::infinity();
        double hScore = 0.0;
    };

    void initializePlanner();
    void setupGrid();
    void updateObstacleGrid();
    
    // A* pathfinding
    QVector<PathNode> aStarPathfinding(const QPointF& start, const QPointF& goal,
                                      const PlanningConstraints& constraints);
    double calculateHeuristic(const QPointF& a, const QPointF& b) const;
    QVector<GridCell*> getNeighbors(GridCell* cell) const;
    double calculateMovementCost(GridCell* from, GridCell* to) const;
    
    // RRT pathfinding
    QVector<PathNode> rrtPathfinding(const QPointF& start, const QPointF& goal,
                                    const PlanningConstraints& constraints);
    
    // Path optimization
    QVector<PathNode> optimizePath(const QVector<PathNode>& path,
                                  const PlanningConstraints& constraints);
    QVector<PathNode> smoothPath(const QVector<PathNode>& path);
    QVector<PathNode> generateVelocityProfile(const QVector<PathNode>& path,
                                             const PlanningConstraints& constraints);
    
    // Bezier curve smoothing
    QVector<PathNode> applyCubicBezierSmoothing(const QVector<PathNode>& path);
    QPointF calculateBezierPoint(const QPointF& p0, const QPointF& p1,
                                const QPointF& p2, const QPointF& p3, double t) const;
    
    // Obstacle prediction
    void predictObstacleMovement(double timeHorizon);
    QPointF predictObstaclePosition(const Obstacle& obstacle, double time) const;
    
    // Collision detection algorithms
    bool isPointInObstacle(const QPointF& point, const Obstacle& obstacle, double timestamp = 0.0) const;
    bool isLineIntersectingObstacle(const QPointF& start, const QPointF& end,
                                   const Obstacle& obstacle, double timestamp = 0.0) const;
    
    // Utility functions
    double normalizeAngle(double angle) const;
    double calculateDistance(const QPointF& a, const QPointF& b) const;
    double calculateAngle(const QPointF& from, const QPointF& to) const;
    QPointF interpolatePosition(const QPointF& a, const QPointF& b, double t) const;
    
    // Planning state
    QRectF workspace;
    double gridResolution;
    double heuristicWeight;
    double inflationRadius;
    QVector<QVector<GridCell>> grid;
    QHash<QString, Obstacle> obstacles;
    QVector<PathNode> currentPath;
    PlanningConstraints currentConstraints;
    
    // Configuration
    PlanningAlgorithm planningAlgorithm;
    OptimizationObjective optimizationObjective;
    bool dynamicPlanningEnabled;
    bool pathSmoothingEnabled;
    bool velocityProfileOptimization;
    
    // Dynamic planning
    std::unique_ptr<QTimer> replanningTimer;
    std::unique_ptr<QTimer> predictionTimer;
    std::unique_ptr<QTimer> collisionTimer;
    int replanningInterval;
    double predictionHorizon;
    double emergencyStopDistance;
    
    // Visualization data
    QVector<QPointF> searchGrid;
    QVector<QPointF> exploredNodes;
    QVector<QLineF> visibilityGraph;
    
    // Performance tracking
    double lastPlanningTime;
    int planningCallCount;
    double averagePlanningTime;
    
    // Constants
    static constexpr double DEFAULT_GRID_RESOLUTION = 10.0; // mm
    static constexpr double DEFAULT_HEURISTIC_WEIGHT = 1.0;
    static constexpr double DEFAULT_INFLATION_RADIUS = 50.0; // mm
    static constexpr int DEFAULT_REPLANNING_INTERVAL = 100; // ms
    static constexpr double DEFAULT_PREDICTION_HORIZON = 3.0; // seconds
    static constexpr double DEFAULT_EMERGENCY_STOP_DISTANCE = 100.0; // mm
    static constexpr int MAX_PLANNING_ITERATIONS = 10000;
    static constexpr double PLANNING_TIMEOUT = 5.0; // seconds
}; 