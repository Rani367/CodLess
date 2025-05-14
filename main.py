#!/usr/bin/env python3
"""
CodLess - SPIKE Prime Robot Navigation
Main entry point for the application
"""

import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Import and run the launcher
    from run_codless import main
    main() 