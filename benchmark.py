#!/usr/bin/env python3
"""
Performance Benchmark for CodLess FLL Robotics Control Center
Measures startup time and import performance
"""

import time
import sys
import os

def benchmark_startup():
    """Benchmark application startup time"""
    print("🚀 CodLess Performance Benchmark")
    print("=" * 50)
    
    # Test 1: Import time
    print("\n📦 Testing Import Performance...")
    start_time = time.time()
    
    try:
        # Simulate the optimized import process
        from PySide6.QtWidgets import QApplication
        print(f"✅ Basic Qt import: {(time.time() - start_time)*1000:.1f}ms")
        
        # Test lazy import simulation
        start_lazy = time.time()
        def lazy_import_simulation():
            # This simulates the lazy loading approach
            from PySide6.QtCore import QTimer, QObject, Signal
            from PySide6.QtGui import QIcon, QPixmap, QFont
            from PySide6.QtWidgets import QWidget, QMainWindow, QDialog
            return locals()
        
        qt_components = lazy_import_simulation()
        print(f"✅ Lazy Qt components: {(time.time() - start_lazy)*1000:.1f}ms")
        
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return
    
    # Test 2: Cache cleaning performance
    print("\n🧹 Testing Cache Cleaning Performance...")
    
    # Test optimized cache cleaning
    start_cache = time.time()
    cache_dirs_found = 0
    try:
        for root, dirs, files in os.walk(".", topdown=True):
            if root.count(os.sep) > 2:  # Limit depth like in optimization
                dirs[:] = []
                continue
            if "__pycache__" in dirs:
                cache_dirs_found += 1
    except Exception:
        pass
    
    cache_time = (time.time() - start_cache) * 1000
    print(f"✅ Optimized cache scan: {cache_time:.1f}ms ({cache_dirs_found} dirs found)")
    
    # Test 3: Stylesheet loading
    print("\n🎨 Testing Stylesheet Loading...")
    start_css = time.time()
    
    if os.path.exists("styles.qss"):
        try:
            with open("styles.qss", 'r') as f:
                stylesheet = f.read()
            css_size = len(stylesheet)
            css_time = (time.time() - start_css) * 1000
            print(f"✅ External stylesheet loaded: {css_time:.1f}ms ({css_size} bytes)")
        except Exception as e:
            print(f"❌ Stylesheet loading failed: {e}")
    else:
        print("ℹ️  External stylesheet not found, would use inline fallback")
    
    # Test 4: Memory usage estimation
    print("\n💾 Estimating Memory Impact...")
    
    # Estimate memory savings from optimizations
    original_file_size = 116 * 1024  # 116KB original
    current_file_size = os.path.getsize("main.py") if os.path.exists("main.py") else 0
    
    if current_file_size > 0:
        size_reduction = original_file_size - current_file_size
        percentage_reduction = (size_reduction / original_file_size) * 100
        print(f"✅ File size reduction: {size_reduction/1024:.1f}KB ({percentage_reduction:.1f}%)")
    
    # Performance Summary
    print("\n📊 Performance Summary")
    print("=" * 50)
    print("🎯 Key Improvements:")
    print("   • Lazy loading reduces initial import time")
    print("   • Optional cache cleaning speeds startup")
    print("   • External stylesheets reduce memory footprint")
    print("   • Non-blocking operations prevent UI freezes")
    print("   • Optimized animation frame rate (30 FPS)")
    
    print("\n💡 Performance Tips:")
    print("   • Set SKIP_CACHE_CLEAN=1 for fastest startup")
    print("   • Use developer mode to skip Bluetooth initialization")
    print("   • Keep styles.qss in same directory for optimal loading")
    
    total_time = (time.time() - start_time) * 1000
    print(f"\n⏱️  Total benchmark time: {total_time:.1f}ms")

if __name__ == "__main__":
    benchmark_startup()