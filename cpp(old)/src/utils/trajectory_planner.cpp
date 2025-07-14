#include "../include/utils/trajectory_planner.h"
#include <QDebug>
#include <QtMath>

TrajectoryPlanner::TrajectoryPlanner(QObject* parent)
    : QObject(parent), workspace(0, 0, 1000, 1000), gridResolution(DEFAULT_GRID_RESOLUTION),
      heuristicWeight(DEFAULT_HEURISTIC_WEIGHT), inflationRadius(DEFAULT_INFLATION_RADIUS),
      planningAlgorithm(PlanningAlgorithm::AStar), optimizationObjective(OptimizationObjective::Balanced),
      dynamicPlanningEnabled(false), pathSmoothingEnabled(true), velocityProfileOptimization(true),
      replanningInterval(DEFAULT_REPLANNING_INTERVAL), predictionHorizon(DEFAULT_PREDICTION_HORIZON),
      emergencyStopDistance(DEFAULT_EMERGENCY_STOP_DISTANCE), lastPlanningTime(0.0),
      planningCallCount(0), averagePlanningTime(0.0) {
    initializePlanner();
}

TrajectoryPlanner::~TrajectoryPlanner() = default;

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::planPath(const QPointF& start, const QPointF& goal,
                                                                const PlanningConstraints& constraints) {
    emit pathPlanningStarted(start, goal);
    
    QElapsedTimer timer;
    timer.start();
    
    QVector<PathNode> path;
    
    switch (planningAlgorithm) {
        case PlanningAlgorithm::AStar:
            path = aStarPathfinding(start, goal, constraints);
            break;
        case PlanningAlgorithm::RRT:
            path = rrtPathfinding(start, goal, constraints);
            break;
        default:
            path = aStarPathfinding(start, goal, constraints);
            break;
    }
    
    if (!path.isEmpty()) {
        if (pathSmoothingEnabled) {
            path = smoothPath(path);
        }
        
        if (velocityProfileOptimization) {
            path = generateVelocityProfile(path, constraints);
        }
        
        currentPath = path;
        currentConstraints = constraints;
        
        lastPlanningTime = timer.elapsed();
        planningCallCount++;
        averagePlanningTime = (averagePlanningTime * (planningCallCount - 1) + lastPlanningTime) / planningCallCount;
        
        emit pathPlanningCompleted(path, lastPlanningTime);
    } else {
        emit pathPlanningFailed("No path found");
    }
    
    return path;
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::planPathWithWaypoints(const QVector<QPointF>& waypoints,
                                                                             const PlanningConstraints& constraints) {
    if (waypoints.size() < 2) {
        emit pathPlanningFailed("Insufficient waypoints");
        return QVector<PathNode>();
    }
    
    QVector<PathNode> fullPath;
    
    for (int i = 0; i < waypoints.size() - 1; ++i) {
        QVector<PathNode> segment = planPath(waypoints[i], waypoints[i + 1], constraints);
        if (segment.isEmpty()) {
            emit pathPlanningFailed(QString("Failed to plan segment %1 to %2").arg(i).arg(i + 1));
            return QVector<PathNode>();
        }
        
        if (i > 0) {
            segment.removeFirst(); // Remove duplicate waypoint
        }
        
        fullPath.append(segment);
    }
    
    return fullPath;
}

bool TrajectoryPlanner::replanPath(const QPointF& currentPosition, const QPointF& goal) {
    if (!dynamicPlanningEnabled) {
        return false;
    }
    
    QVector<PathNode> newPath = planPath(currentPosition, goal, currentConstraints);
    return !newPath.isEmpty();
}

void TrajectoryPlanner::addObstacle(const QString& id, const Obstacle& obstacle) {
    obstacles[id] = obstacle;
    updateObstacleGrid();
    
    emit obstacleDetected(id, obstacle.shape.boundingRect().center());
}

void TrajectoryPlanner::updateObstacle(const QString& id, const Obstacle& obstacle) {
    if (obstacles.contains(id)) {
        obstacles[id] = obstacle;
        updateObstacleGrid();
    }
}

void TrajectoryPlanner::removeObstacle(const QString& id) {
    obstacles.remove(id);
    updateObstacleGrid();
}

void TrajectoryPlanner::clearObstacles() {
    obstacles.clear();
    updateObstacleGrid();
}

QVector<TrajectoryPlanner::Obstacle> TrajectoryPlanner::getObstacles() const {
    return obstacles.values().toVector();
}

void TrajectoryPlanner::enableDynamicPlanning(bool enabled) {
    dynamicPlanningEnabled = enabled;
    
    if (enabled && !replanningTimer) {
        replanningTimer = std::make_unique<QTimer>(this);
        connect(replanningTimer.get(), &QTimer::timeout, this, &TrajectoryPlanner::performDynamicReplanning);
        replanningTimer->start(replanningInterval);
    } else if (!enabled && replanningTimer) {
        replanningTimer->stop();
    }
}

void TrajectoryPlanner::setReplanningInterval(int milliseconds) {
    replanningInterval = milliseconds;
    if (replanningTimer) {
        replanningTimer->setInterval(milliseconds);
    }
}

void TrajectoryPlanner::setPredictionHorizon(double seconds) {
    predictionHorizon = seconds;
}

void TrajectoryPlanner::setEmergencyStopDistance(double distance) {
    emergencyStopDistance = distance;
}

void TrajectoryPlanner::setOptimizationObjective(OptimizationObjective objective) {
    optimizationObjective = objective;
}

void TrajectoryPlanner::setPlanningAlgorithm(PlanningAlgorithm algorithm) {
    planningAlgorithm = algorithm;
}

void TrajectoryPlanner::setPathSmoothingEnabled(bool enabled) {
    pathSmoothingEnabled = enabled;
}

void TrajectoryPlanner::setVelocityProfileOptimization(bool enabled) {
    velocityProfileOptimization = enabled;
}

bool TrajectoryPlanner::checkCollision(const QPointF& position, double heading, double timestamp) const {
    Q_UNUSED(heading);
    Q_UNUSED(timestamp);
    
    for (const auto& obstacle : obstacles) {
        if (isPointInObstacle(position, obstacle)) {
            return true;
        }
    }
    
    return false;
}

bool TrajectoryPlanner::checkPathCollision(const QVector<PathNode>& path) const {
    for (const auto& node : path) {
        if (checkCollision(node.position, node.heading, node.timestamp)) {
            return true;
        }
    }
    
    return false;
}

double TrajectoryPlanner::getDistanceToNearestObstacle(const QPointF& position) const {
    double minDistance = std::numeric_limits<double>::max();
    
    for (const auto& obstacle : obstacles) {
        QPointF center = obstacle.shape.boundingRect().center();
        double distance = calculateDistance(position, center) - obstacle.radius;
        minDistance = qMin(minDistance, distance);
    }
    
    return minDistance;
}

QVector<QPointF> TrajectoryPlanner::getCollisionPoints(const QVector<PathNode>& path) const {
    QVector<QPointF> collisionPoints;
    
    for (const auto& node : path) {
        if (checkCollision(node.position, node.heading, node.timestamp)) {
            collisionPoints.append(node.position);
        }
    }
    
    return collisionPoints;
}

TrajectoryPlanner::PathNode TrajectoryPlanner::getNextWaypoint(const QPointF& currentPosition, double currentHeading,
                                                              const QVector<PathNode>& path, double lookaheadDistance) const {
    Q_UNUSED(currentHeading);
    
    if (path.isEmpty()) {
        return PathNode();
    }
    
    // Find the closest point on the path
    double minDistance = std::numeric_limits<double>::max();
    int closestIndex = 0;
    
    for (int i = 0; i < path.size(); ++i) {
        double distance = calculateDistance(currentPosition, path[i].position);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }
    
    // Look ahead from the closest point
    for (int i = closestIndex; i < path.size(); ++i) {
        double distance = calculateDistance(currentPosition, path[i].position);
        if (distance >= lookaheadDistance) {
            return path[i];
        }
    }
    
    // Return the last point if no lookahead point found
    return path.last();
}

double TrajectoryPlanner::calculateCrossTrackError(const QPointF& position, const QVector<PathNode>& path) const {
    if (path.size() < 2) {
        return 0.0;
    }
    
    double minError = std::numeric_limits<double>::max();
    
    for (int i = 0; i < path.size() - 1; ++i) {
        QPointF p1 = path[i].position;
        QPointF p2 = path[i + 1].position;
        
        // Calculate perpendicular distance from point to line segment
        QPointF v = p2 - p1;
        QPointF w = position - p1;
        
        double c1 = QPointF::dotProduct(w, v);
        if (c1 <= 0) {
            minError = qMin(minError, calculateDistance(position, p1));
            continue;
        }
        
        double c2 = QPointF::dotProduct(v, v);
        if (c1 >= c2) {
            minError = qMin(minError, calculateDistance(position, p2));
            continue;
        }
        
        double b = c1 / c2;
        QPointF pb = p1 + b * v;
        minError = qMin(minError, calculateDistance(position, pb));
    }
    
    return minError;
}

double TrajectoryPlanner::calculateHeadingError(double currentHeading, const QVector<PathNode>& path,
                                               const QPointF& position) const {
    Q_UNUSED(path);
    Q_UNUSED(position);
    Q_UNUSED(currentHeading);
    
    // Implementation placeholder
    return 0.0;
}

double TrajectoryPlanner::calculatePathLength(const QVector<PathNode>& path) const {
    if (path.size() < 2) {
        return 0.0;
    }
    
    double length = 0.0;
    for (int i = 1; i < path.size(); ++i) {
        length += calculateDistance(path[i-1].position, path[i].position);
    }
    
    return length;
}

double TrajectoryPlanner::calculatePathTime(const QVector<PathNode>& path) const {
    if (path.isEmpty()) {
        return 0.0;
    }
    
    return path.last().timestamp;
}

double TrajectoryPlanner::calculatePathCurvature(const QVector<PathNode>& path) const {
    if (path.size() < 3) {
        return 0.0;
    }
    
    double totalCurvature = 0.0;
    for (int i = 1; i < path.size() - 1; ++i) {
        totalCurvature += qAbs(path[i].curvature);
    }
    
    return totalCurvature / (path.size() - 2);
}

double TrajectoryPlanner::calculatePathSmoothness(const QVector<PathNode>& path) const {
    if (path.size() < 3) {
        return 1.0;
    }
    
    double totalVariation = 0.0;
    for (int i = 1; i < path.size() - 1; ++i) {
        double angle1 = calculateAngle(path[i-1].position, path[i].position);
        double angle2 = calculateAngle(path[i].position, path[i+1].position);
        double angleDiff = normalizeAngle(angle2 - angle1);
        totalVariation += qAbs(angleDiff);
    }
    
    return 1.0 / (1.0 + totalVariation);
}

double TrajectoryPlanner::calculateEnergyConsumption(const QVector<PathNode>& path) const {
    Q_UNUSED(path);
    // Implementation placeholder
    return 1.0;
}

QVector<QPointF> TrajectoryPlanner::getSearchGrid() const {
    return searchGrid;
}

QVector<QPointF> TrajectoryPlanner::getExploredNodes() const {
    return exploredNodes;
}

QVector<QLineF> TrajectoryPlanner::getVisibilityGraph() const {
    return visibilityGraph;
}

void TrajectoryPlanner::setWorkspaceSize(const QRectF& workspace) {
    this->workspace = workspace;
    setupGrid();
}

void TrajectoryPlanner::setGridResolution(double resolution) {
    this->gridResolution = resolution;
    setupGrid();
}

void TrajectoryPlanner::setHeuristicWeight(double weight) {
    this->heuristicWeight = weight;
}

void TrajectoryPlanner::setInflationRadius(double radius) {
    this->inflationRadius = radius;
}

void TrajectoryPlanner::performDynamicReplanning() {
    // Implementation placeholder
}

void TrajectoryPlanner::updateObstaclePredictions() {
    predictObstacleMovement(predictionHorizon);
}

void TrajectoryPlanner::monitorCollisions() {
    // Implementation placeholder
}

void TrajectoryPlanner::initializePlanner() {
    setupGrid();
    
    predictionTimer = std::make_unique<QTimer>(this);
    collisionTimer = std::make_unique<QTimer>(this);
    
    connect(predictionTimer.get(), &QTimer::timeout, this, &TrajectoryPlanner::updateObstaclePredictions);
    connect(collisionTimer.get(), &QTimer::timeout, this, &TrajectoryPlanner::monitorCollisions);
    
    predictionTimer->start(1000); // Update predictions every second
    collisionTimer->start(100);   // Check collisions every 100ms
}

void TrajectoryPlanner::setupGrid() {
    int cols = static_cast<int>(workspace.width() / gridResolution);
    int rows = static_cast<int>(workspace.height() / gridResolution);
    
    grid.clear();
    grid.resize(rows);
    
    for (int r = 0; r < rows; ++r) {
        grid[r].resize(cols);
        for (int c = 0; c < cols; ++c) {
            grid[r][c].position = QPointF(c * gridResolution + workspace.left(),
                                         r * gridResolution + workspace.top());
            grid[r][c].isObstacle = false;
            grid[r][c].cost = 1.0;
        }
    }
    
    updateObstacleGrid();
}

void TrajectoryPlanner::updateObstacleGrid() {
    // Reset grid
    for (auto& row : grid) {
        for (auto& cell : row) {
            cell.isObstacle = false;
        }
    }
    
    // Mark obstacle cells
    for (const auto& obstacle : obstacles) {
        QRectF bounds = obstacle.shape.boundingRect();
        
        int minCol = qMax(0, static_cast<int>((bounds.left() - workspace.left()) / gridResolution));
        int maxCol = qMin(grid[0].size() - 1, static_cast<int>((bounds.right() - workspace.left()) / gridResolution));
        int minRow = qMax(0, static_cast<int>((bounds.top() - workspace.top()) / gridResolution));
        int maxRow = qMin(grid.size() - 1, static_cast<int>((bounds.bottom() - workspace.top()) / gridResolution));
        
        for (int r = minRow; r <= maxRow; ++r) {
            for (int c = minCol; c <= maxCol; ++c) {
                if (isPointInObstacle(grid[r][c].position, obstacle)) {
                    grid[r][c].isObstacle = true;
                }
            }
        }
    }
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::aStarPathfinding(const QPointF& start, const QPointF& goal,
                                                                        const PlanningConstraints& constraints) {
    Q_UNUSED(constraints);
    
    // Implementation placeholder - simplified A* algorithm
    QVector<PathNode> path;
    
    // Create a simple straight-line path for now
    PathNode startNode;
    startNode.position = start;
    startNode.heading = calculateAngle(start, goal);
    startNode.velocity = 0.0;
    startNode.timestamp = 0.0;
    
    PathNode goalNode;
    goalNode.position = goal;
    goalNode.heading = startNode.heading;
    goalNode.velocity = 0.0;
    goalNode.timestamp = calculateDistance(start, goal) / 300.0; // Assume 300 mm/s speed
    
    path.append(startNode);
    path.append(goalNode);
    
    return path;
}

double TrajectoryPlanner::calculateHeuristic(const QPointF& a, const QPointF& b) const {
    return calculateDistance(a, b) * heuristicWeight;
}

QVector<TrajectoryPlanner::GridCell*> TrajectoryPlanner::getNeighbors(GridCell* cell) const {
    Q_UNUSED(cell);
    // Implementation placeholder
    return QVector<GridCell*>();
}

double TrajectoryPlanner::calculateMovementCost(GridCell* from, GridCell* to) const {
    Q_UNUSED(from);
    Q_UNUSED(to);
    // Implementation placeholder
    return 1.0;
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::rrtPathfinding(const QPointF& start, const QPointF& goal,
                                                                      const PlanningConstraints& constraints) {
    Q_UNUSED(start);
    Q_UNUSED(goal);
    Q_UNUSED(constraints);
    // Implementation placeholder
    return QVector<PathNode>();
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::optimizePath(const QVector<PathNode>& path,
                                                                    const PlanningConstraints& constraints) {
    Q_UNUSED(constraints);
    // Implementation placeholder
    return path;
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::smoothPath(const QVector<PathNode>& path) {
    if (path.size() < 3) {
        return path;
    }
    
    return applyCubicBezierSmoothing(path);
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::generateVelocityProfile(const QVector<PathNode>& path,
                                                                               const PlanningConstraints& constraints) {
    QVector<PathNode> profiledPath = path;
    
    for (int i = 0; i < profiledPath.size(); ++i) {
        double progress = static_cast<double>(i) / (profiledPath.size() - 1);
        
        // Simple trapezoidal velocity profile
        if (progress < 0.3) {
            profiledPath[i].velocity = constraints.maxVelocity * (progress / 0.3);
        } else if (progress > 0.7) {
            profiledPath[i].velocity = constraints.maxVelocity * ((1.0 - progress) / 0.3);
        } else {
            profiledPath[i].velocity = constraints.maxVelocity;
        }
        
        profiledPath[i].velocity = qMax(0.0, qMin(constraints.maxVelocity, profiledPath[i].velocity));
    }
    
    return profiledPath;
}

QVector<TrajectoryPlanner::PathNode> TrajectoryPlanner::applyCubicBezierSmoothing(const QVector<PathNode>& path) {
    // Implementation placeholder - simplified smoothing
    return path;
}

QPointF TrajectoryPlanner::calculateBezierPoint(const QPointF& p0, const QPointF& p1,
                                               const QPointF& p2, const QPointF& p3, double t) const {
    Q_UNUSED(p0);
    Q_UNUSED(p1);
    Q_UNUSED(p2);
    Q_UNUSED(p3);
    Q_UNUSED(t);
    // Implementation placeholder
    return QPointF();
}

void TrajectoryPlanner::predictObstacleMovement(double timeHorizon) {
    Q_UNUSED(timeHorizon);
    // Implementation placeholder
}

QPointF TrajectoryPlanner::predictObstaclePosition(const Obstacle& obstacle, double time) const {
    return obstacle.shape.boundingRect().center() + obstacle.velocity * time;
}

bool TrajectoryPlanner::isPointInObstacle(const QPointF& point, const Obstacle& obstacle, double timestamp) const {
    Q_UNUSED(timestamp);
    
    if (obstacle.shape.containsPoint(point, Qt::OddEvenFill)) {
        return true;
    }
    
    // Check circular obstacle
    QPointF center = obstacle.shape.boundingRect().center();
    double distance = calculateDistance(point, center);
    return distance <= obstacle.radius;
}

bool TrajectoryPlanner::isLineIntersectingObstacle(const QPointF& start, const QPointF& end,
                                                  const Obstacle& obstacle, double timestamp) const {
    Q_UNUSED(start);
    Q_UNUSED(end);
    Q_UNUSED(obstacle);
    Q_UNUSED(timestamp);
    // Implementation placeholder
    return false;
}

double TrajectoryPlanner::normalizeAngle(double angle) const {
    while (angle > M_PI) angle -= 2 * M_PI;
    while (angle < -M_PI) angle += 2 * M_PI;
    return angle;
}

double TrajectoryPlanner::calculateDistance(const QPointF& a, const QPointF& b) const {
    QPointF diff = b - a;
    return qSqrt(diff.x() * diff.x() + diff.y() * diff.y());
}

double TrajectoryPlanner::calculateAngle(const QPointF& from, const QPointF& to) const {
    QPointF diff = to - from;
    return qAtan2(diff.y(), diff.x());
}

QPointF TrajectoryPlanner::interpolatePosition(const QPointF& a, const QPointF& b, double t) const {
    return a + t * (b - a);
} 