"""
A* Path Planning module for CodLess FLL autonomous navigation
Provides optimal path planning on a grid representation of the FLL mat
"""

from math import sqrt
import heapq


class Node:
    """Represents a node in the A* search grid."""
    
    def __init__(self, x, y, g=0, h=0, parent=None):
        self.x = x
        self.y = y
        self.g = g  # Cost from start
        self.h = h  # Heuristic cost to goal
        self.f = g + h  # Total cost
        self.parent = parent
    
    def __lt__(self, other):
        return self.f < other.f
    
    def __eq__(self, other):
        return self.x == other.x and self.y == other.y


class PathPlanner:
    """
    A* path planner for FLL mat navigation.
    Uses a grid representation of the field.
    """
    
    def __init__(self, field_width=1200, field_height=1200, grid_size=50):
        """
        Initialize path planner.
        
        Args:
            field_width: Width of FLL field in mm
            field_height: Height of FLL field in mm
            grid_size: Size of each grid cell in mm
        """
        self.field_width = field_width
        self.field_height = field_height
        self.grid_size = grid_size
        
        # Calculate grid dimensions
        self.grid_width = field_width // grid_size
        self.grid_height = field_height // grid_size
        
        # Initialize grid (True = passable, False = obstacle)
        self.grid = [[True for _ in range(self.grid_width)] 
                     for _ in range(self.grid_height)]
        
        # Movement directions (8-directional)
        self.directions = [
            (0, 1), (1, 0), (0, -1), (-1, 0),  # Cardinal
            (1, 1), (-1, 1), (1, -1), (-1, -1)  # Diagonal
        ]
        
        # Movement costs
        self.cardinal_cost = 1.0
        self.diagonal_cost = sqrt(2)
    
    def world_to_grid(self, world_x, world_y):
        """Convert world coordinates (mm) to grid coordinates."""
        grid_x = int(world_x / self.grid_size)
        grid_y = int(world_y / self.grid_size)
        return (grid_x, grid_y)
    
    def grid_to_world(self, grid_x, grid_y):
        """Convert grid coordinates to world coordinates (mm)."""
        world_x = (grid_x + 0.5) * self.grid_size
        world_y = (grid_y + 0.5) * self.grid_size
        return (world_x, world_y)
    
    def set_obstacle(self, x, y, width, height):
        """
        Mark an area as obstacle.
        
        Args:
            x, y: Top-left corner in world coordinates (mm)
            width, height: Size of obstacle in mm
        """
        start_gx, start_gy = self.world_to_grid(x, y)
        end_gx, end_gy = self.world_to_grid(x + width, y + height)
        
        for gy in range(start_gy, min(end_gy + 1, self.grid_height)):
            for gx in range(start_gx, min(end_gx + 1, self.grid_width)):
                if 0 <= gx < self.grid_width and 0 <= gy < self.grid_height:
                    self.grid[gy][gx] = False
    
    def clear_obstacles(self):
        """Clear all obstacles from the grid."""
        self.grid = [[True for _ in range(self.grid_width)] 
                     for _ in range(self.grid_height)]
    
    def setup_fll_obstacles(self):
        """
        Setup common FLL mat obstacles.
        Customize this for specific FLL season.
        """
        # Example obstacles - customize for your FLL mat
        # Mission models typically have standard sizes
        
        # Example: Large mission model in center
        self.set_obstacle(500, 500, 200, 200)
        
        # Example: Side missions
        self.set_obstacle(100, 300, 100, 100)
        self.set_obstacle(1000, 300, 100, 100)
        self.set_obstacle(100, 800, 100, 100)
        self.set_obstacle(1000, 800, 100, 100)
        
        # Add safety margin around field edges
        margin = 50  # mm
        self.set_obstacle(0, 0, self.field_width, margin)  # Top
        self.set_obstacle(0, self.field_height - margin, self.field_width, margin)  # Bottom
        self.set_obstacle(0, 0, margin, self.field_height)  # Left
        self.set_obstacle(self.field_width - margin, 0, margin, self.field_height)  # Right
    
    def is_valid(self, x, y):
        """Check if grid position is valid and passable."""
        return (0 <= x < self.grid_width and 
                0 <= y < self.grid_height and 
                self.grid[y][x])
    
    def heuristic(self, x1, y1, x2, y2):
        """Calculate heuristic distance (Euclidean)."""
        return sqrt((x2 - x1)**2 + (y2 - y1)**2)
    
    def plan_path(self, start_pos, goal_pos):
        """
        Plan optimal path from start to goal using A*.
        
        Args:
            start_pos: Start position (x, y) in world coordinates (mm)
            goal_pos: Goal position (x, y) in world coordinates (mm)
            
        Returns:
            list: Path as list of waypoints in world coordinates, or None if no path
        """
        # Convert to grid coordinates
        start = self.world_to_grid(start_pos[0], start_pos[1])
        goal = self.world_to_grid(goal_pos[0], goal_pos[1])
        
        # Check if start and goal are valid
        if not self.is_valid(start[0], start[1]) or not self.is_valid(goal[0], goal[1]):
            return None
        
        # Initialize open and closed sets
        open_set = []
        closed_set = set()
        
        # Create start node
        start_node = Node(start[0], start[1], 0, 
                         self.heuristic(start[0], start[1], goal[0], goal[1]))
        heapq.heappush(open_set, start_node)
        
        # A* search
        while open_set:
            current = heapq.heappop(open_set)
            
            # Check if reached goal
            if current.x == goal[0] and current.y == goal[1]:
                return self._reconstruct_path(current)
            
            closed_set.add((current.x, current.y))
            
            # Explore neighbors
            for i, (dx, dy) in enumerate(self.directions):
                nx, ny = current.x + dx, current.y + dy
                
                # Skip if invalid or in closed set
                if not self.is_valid(nx, ny) or (nx, ny) in closed_set:
                    continue
                
                # Calculate cost
                if i < 4:  # Cardinal direction
                    move_cost = self.cardinal_cost
                else:  # Diagonal direction
                    move_cost = self.diagonal_cost
                
                g_cost = current.g + move_cost
                h_cost = self.heuristic(nx, ny, goal[0], goal[1])
                
                # Check if this path to neighbor is better
                neighbor = Node(nx, ny, g_cost, h_cost, current)
                
                # Check if neighbor is already in open set with worse cost
                update = False
                for i, node in enumerate(open_set):
                    if node.x == nx and node.y == ny:
                        if g_cost < node.g:
                            open_set[i] = neighbor
                            heapq.heapify(open_set)
                        update = True
                        break
                
                if not update:
                    heapq.heappush(open_set, neighbor)
        
        # No path found
        return None
    
    def _reconstruct_path(self, node):
        """Reconstruct path from goal node to start."""
        path = []
        current = node
        
        while current:
            world_pos = self.grid_to_world(current.x, current.y)
            path.append(world_pos)
            current = current.parent
        
        # Reverse to get path from start to goal
        path.reverse()
        
        # Smooth path
        return self._smooth_path(path)
    
    def _smooth_path(self, path):
        """
        Smooth path by removing unnecessary waypoints.
        Uses line-of-sight checking.
        """
        if len(path) <= 2:
            return path
        
        smoothed = [path[0]]
        current_idx = 0
        
        while current_idx < len(path) - 1:
            # Try to skip ahead as far as possible
            farthest_visible = current_idx + 1
            
            for i in range(current_idx + 2, len(path)):
                if self._has_line_of_sight(path[current_idx], path[i]):
                    farthest_visible = i
                else:
                    break
            
            smoothed.append(path[farthest_visible])
            current_idx = farthest_visible
        
        return smoothed
    
    def _has_line_of_sight(self, pos1, pos2):
        """
        Check if there's a clear line of sight between two positions.
        Uses Bresenham's line algorithm.
        """
        x1, y1 = self.world_to_grid(pos1[0], pos1[1])
        x2, y2 = self.world_to_grid(pos2[0], pos2[1])
        
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        sx = 1 if x1 < x2 else -1
        sy = 1 if y1 < y2 else -1
        err = dx - dy
        
        x, y = x1, y1
        
        while True:
            if not self.is_valid(x, y):
                return False
            
            if x == x2 and y == y2:
                return True
            
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy
    
    def get_path_length(self, path):
        """Calculate total length of path in mm."""
        if not path or len(path) < 2:
            return 0
        
        total_length = 0
        for i in range(1, len(path)):
            dx = path[i][0] - path[i-1][0]
            dy = path[i][1] - path[i-1][1]
            total_length += sqrt(dx*dx + dy*dy)
        
        return total_length