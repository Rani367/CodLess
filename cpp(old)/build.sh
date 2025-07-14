#!/bin/bash

# CodLess C++ Build Script
# Automated build system for cross-platform compilation

set -e

# Configuration
PROJECT_NAME="CodLess"
BUILD_TYPE="Release"
BUILD_DIR="build"
INSTALL_DIR="install"
VERBOSE=false
CLEAN=false
PACKAGE=false
TESTING=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}  CodLess C++ Build System${NC}"
    echo -e "${BLUE}=================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -d, --debug         Build in debug mode"
    echo "  -r, --release       Build in release mode (default)"
    echo "  -c, --clean         Clean build directory before building"
    echo "  -v, --verbose       Enable verbose output"
    echo "  -t, --testing       Enable testing"
    echo "  -p, --package       Create installation package"
    echo "  -j, --jobs N        Number of parallel jobs (default: auto)"
    echo
    echo "Examples:"
    echo "  $0                  # Default release build"
    echo "  $0 -d -v           # Debug build with verbose output"
    echo "  $0 -r -c -p        # Clean release build with packaging"
    echo "  $0 -t -j 4         # Build with testing using 4 jobs"
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    # Check CMake
    if ! command -v cmake &> /dev/null; then
        print_error "CMake is not installed. Please install CMake 3.25 or later."
    fi
    
    CMAKE_VERSION=$(cmake --version | head -n1 | cut -d' ' -f3)
    CMAKE_MAJOR=$(echo $CMAKE_VERSION | cut -d'.' -f1)
    CMAKE_MINOR=$(echo $CMAKE_VERSION | cut -d'.' -f2)
    
    if [ "$CMAKE_MAJOR" -lt 3 ] || ([ "$CMAKE_MAJOR" -eq 3 ] && [ "$CMAKE_MINOR" -lt 25 ]); then
        print_error "CMake version $CMAKE_VERSION is too old. Please install CMake 3.25 or later."
    fi
    
    print_success "CMake $CMAKE_VERSION found"
    
    # Check compiler
    if command -v g++ &> /dev/null; then
        GCC_VERSION=$(g++ --version | head -n1 | grep -o '[0-9]\+\.[0-9]\+' | head -n1)
        print_success "GCC $GCC_VERSION found"
    elif command -v clang++ &> /dev/null; then
        CLANG_VERSION=$(clang++ --version | head -n1 | grep -o '[0-9]\+\.[0-9]\+' | head -n1)
        print_success "Clang $CLANG_VERSION found"
    else
        print_error "No suitable C++ compiler found. Please install GCC 10+ or Clang 12+."
    fi
    
    # Check Qt6
    if command -v qmake6 &> /dev/null; then
        QT_VERSION=$(qmake6 -version | grep "Qt version" | cut -d' ' -f4)
        print_success "Qt $QT_VERSION found"
    elif command -v qmake &> /dev/null; then
        QT_VERSION=$(qmake -version | grep "Qt version" | cut -d' ' -f4)
        if [[ $QT_VERSION == 6.* ]]; then
            print_success "Qt $QT_VERSION found"
        else
            print_warning "Qt $QT_VERSION found, but Qt6 is recommended"
        fi
    else
        print_error "Qt6 is not installed. Please install Qt6.2 or later."
    fi
}

detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        PLATFORM="linux"
        JOBS=$(nproc)
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macos"
        JOBS=$(sysctl -n hw.ncpu)
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]]; then
        PLATFORM="windows"
        JOBS=$(nproc)
    else
        PLATFORM="unknown"
        JOBS=4
    fi
    
    print_info "Detected platform: $PLATFORM"
    print_info "Available CPU cores: $JOBS"
}

configure_build() {
    print_info "Configuring build..."
    
    CMAKE_ARGS=(
        -DCMAKE_BUILD_TYPE=$BUILD_TYPE
        -DCMAKE_INSTALL_PREFIX=$INSTALL_DIR
    )
    
    if $TESTING; then
        CMAKE_ARGS+=(-DBUILD_TESTING=ON)
    fi
    
    if $VERBOSE; then
        CMAKE_ARGS+=(-DCMAKE_VERBOSE_MAKEFILE=ON)
    fi
    
    # Platform-specific configuration
    case $PLATFORM in
        linux)
            CMAKE_ARGS+=(-DCMAKE_CXX_FLAGS="-march=native")
            ;;
        macos)
            CMAKE_ARGS+=(-DCMAKE_OSX_DEPLOYMENT_TARGET=10.15)
            ;;
        windows)
            CMAKE_ARGS+=(-G "MinGW Makefiles")
            ;;
    esac
    
    mkdir -p $BUILD_DIR
    cd $BUILD_DIR
    
    cmake "${CMAKE_ARGS[@]}" ..
    
    if [ $? -eq 0 ]; then
        print_success "Configuration completed"
    else
        print_error "Configuration failed"
    fi
    
    cd ..
}

build_project() {
    print_info "Building project..."
    
    cd $BUILD_DIR
    
    if $VERBOSE; then
        make -j$JOBS VERBOSE=1
    else
        make -j$JOBS
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
    fi
    
    cd ..
}

run_tests() {
    if $TESTING; then
        print_info "Running tests..."
        
        cd $BUILD_DIR
        ctest --output-on-failure
        
        if [ $? -eq 0 ]; then
            print_success "All tests passed"
        else
            print_error "Some tests failed"
        fi
        
        cd ..
    fi
}

create_package() {
    if $PACKAGE; then
        print_info "Creating installation package..."
        
        cd $BUILD_DIR
        
        case $PLATFORM in
            linux)
                make appimage
                ;;
            macos)
                make dmg
                ;;
            windows)
                make installer
                ;;
        esac
        
        if [ $? -eq 0 ]; then
            print_success "Package created successfully"
        else
            print_error "Package creation failed"
        fi
        
        cd ..
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -d|--debug)
            BUILD_TYPE="Debug"
            shift
            ;;
        -r|--release)
            BUILD_TYPE="Release"
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -t|--testing)
            TESTING=true
            shift
            ;;
        -p|--package)
            PACKAGE=true
            shift
            ;;
        -j|--jobs)
            JOBS="$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main build process
print_header

if $CLEAN; then
    print_info "Cleaning build directory..."
    rm -rf $BUILD_DIR
    print_success "Build directory cleaned"
fi

detect_platform
check_dependencies
configure_build
build_project
run_tests
create_package

print_success "Build process completed!"
print_info "Executable location: $BUILD_DIR/$PROJECT_NAME"

if $PACKAGE; then
    print_info "Installation package created in: $BUILD_DIR/packages/"
fi

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}  Build Summary${NC}"
echo -e "${GREEN}=================================================${NC}"
echo -e "Build Type: $BUILD_TYPE"
echo -e "Platform: $PLATFORM"
echo -e "Jobs: $JOBS"
echo -e "Testing: $TESTING"
echo -e "Packaging: $PACKAGE"
echo -e "${GREEN}=================================================${NC}" 