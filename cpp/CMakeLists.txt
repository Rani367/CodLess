cmake_minimum_required(VERSION 3.25)
project(CodLess VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 REQUIRED COMPONENTS Core Widgets Gui Bluetooth SerialPort Network)

qt_standard_project_setup()

set(SOURCES
    src/main.cpp
    src/core/robot_config.cpp
    src/core/recorded_command.cpp
    src/sim/robot_simulator.cpp
    src/hardware/ble_controller.cpp
    src/gui/main_window.cpp
    src/gui/config_dialog.cpp
    src/utils/json_utils.cpp
)

set(HEADERS
    include/core/robot_config.h
    include/core/recorded_command.h
    include/sim/robot_simulator.h
    include/hardware/ble_controller.h
    include/gui/main_window.h
    include/gui/config_dialog.h
    include/utils/json_utils.h
)

qt_add_executable(CodLess
    ${SOURCES}
    ${HEADERS}
)

target_include_directories(CodLess PRIVATE
    include
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(CodLess PRIVATE
    Qt6::Core
    Qt6::Widgets
    Qt6::Gui
    Qt6::Bluetooth
    Qt6::SerialPort
    Qt6::Network
)

if(WIN32)
    set_target_properties(CodLess PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

if(APPLE)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        MACOSX_BUNDLE TRUE
        MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_SOURCE_DIR}/Info.plist.in
        MACOSX_BUNDLE_BUNDLE_NAME ${PROJECT_NAME}
        MACOSX_BUNDLE_GUI_IDENTIFIER "com.fll-robotics.codless"
        MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
        MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION}
        MACOSX_BUNDLE_COPYRIGHT "Copyright 2024 FLL Robotics"
        XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "com.fll-robotics.codless"
        INSTALL_RPATH "@executable_path/../Frameworks"
        BUILD_WITH_INSTALL_RPATH TRUE
    )
endif()

file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/saved_runs) 