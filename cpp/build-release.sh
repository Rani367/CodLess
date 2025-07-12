#!/bin/bash

# CodLess Release Build Script
# Builds distributable executables for macOS and prepares for Windows

echo "🚀 Building CodLess Release..."

# Clean and create build directory
echo "🧹 Cleaning build directory..."
rm -rf build
mkdir -p build

# Configure and build
echo "🔧 Configuring CMake..."
cmake -B build -DCMAKE_BUILD_TYPE=Release

echo "🏗️  Building application..."
cmake --build build --config Release

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Creating macOS DMG..."
    echo "🔐 Signing application..."
    codesign --force --deep --sign - build/CodLess.app
    macdeployqt build/CodLess.app -dmg
    echo "🔓 Removing quarantine attributes..."
    xattr -rd com.apple.quarantine build/CodLess.dmg
    
    if [ -f "build/CodLess.dmg" ]; then
        echo "✅ macOS DMG created: build/CodLess.dmg"
        ls -lh build/CodLess.dmg
    else
        echo "❌ Failed to create DMG"
        exit 1
    fi
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "🪟 Creating Windows package..."
    cd build
    windeployqt.exe --qmldir ../src --compiler-runtime CodLess.exe
    
    # Create distribution folder
    mkdir -p CodLess-Windows
    cp CodLess.exe CodLess-Windows/
    cp -r platforms/ CodLess-Windows/ 2>/dev/null || true
    cp -r styles/ CodLess-Windows/ 2>/dev/null || true
    cp -r imageformats/ CodLess-Windows/ 2>/dev/null || true
    cp *.dll CodLess-Windows/ 2>/dev/null || true
    
    # Create zip archive
    if command -v 7z &> /dev/null; then
        7z a CodLess-Windows.zip CodLess-Windows/
    elif command -v zip &> /dev/null; then
        zip -r CodLess-Windows.zip CodLess-Windows/
    else
        echo "⚠️  Please manually create zip of CodLess-Windows folder"
    fi
    
    echo "✅ Windows package created: build/CodLess-Windows/"
    
else
    echo "⚠️  Unknown platform: $OSTYPE"
    echo "ℹ️  For Windows: Use build-release.bat or GitHub Actions"
    echo "ℹ️  For macOS: Run this script on macOS"
fi

echo ""
echo "🎉 Build completed!"
echo ""
echo "📦 Distribution files:"
ls -la build/ | grep -E "\.(dmg|zip|exe)$" || echo "  (executables created, ready for distribution)"
echo ""
echo "🚀 To create a GitHub release:"
echo "   1. Tag your commit: git tag v1.0.0"
echo "   2. Push the tag: git push origin v1.0.0"
echo "   3. GitHub Actions will build both platforms automatically!" 