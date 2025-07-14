# Test CMakeLists.txt for CodLess
cmake_minimum_required(VERSION 3.25)

# Add parent include directories
include_directories(${CMAKE_SOURCE_DIR}/include)

# Test sources
set(TEST_SOURCES
    test_robot_config.cpp
    test_robot_simulator.cpp
    test_recorded_command.cpp
    test_json_utils.cpp
    test_ble_controller.cpp
    test_main_window.cpp
    test_integration.cpp
)

# Create test executable for each test file
foreach(test_source ${TEST_SOURCES})
    get_filename_component(test_name ${test_source} NAME_WE)
    
    qt_add_executable(${test_name}
        ${test_source}
        ${CMAKE_SOURCE_DIR}/src/core/robot_config.cpp
        ${CMAKE_SOURCE_DIR}/src/core/recorded_command.cpp
        ${CMAKE_SOURCE_DIR}/src/sim/robot_simulator.cpp
        ${CMAKE_SOURCE_DIR}/src/hardware/ble_controller.cpp
        ${CMAKE_SOURCE_DIR}/src/gui/main_window.cpp
        ${CMAKE_SOURCE_DIR}/src/gui/config_dialog.cpp
        ${CMAKE_SOURCE_DIR}/src/utils/json_utils.cpp
    )
    
    target_link_libraries(${test_name} PRIVATE
        Qt6::Core
        Qt6::Test
        Qt6::Widgets
        Qt6::Bluetooth
        Qt6::SerialPort
        Qt6::Network
    )
    
    target_include_directories(${test_name} PRIVATE
        ${CMAKE_SOURCE_DIR}/include
    )
    
    # Add test to CTest
    add_test(NAME ${test_name} COMMAND ${test_name})
    
    # Set test properties
    set_tests_properties(${test_name} PROPERTIES
        TIMEOUT 30
        ENVIRONMENT "QT_QPA_PLATFORM=offscreen"
    )
endforeach()

# Benchmark tests
qt_add_executable(benchmark_tests
    benchmark_tests.cpp
    ${CMAKE_SOURCE_DIR}/src/sim/robot_simulator.cpp
    ${CMAKE_SOURCE_DIR}/src/core/robot_config.cpp
    ${CMAKE_SOURCE_DIR}/src/core/recorded_command.cpp
    ${CMAKE_SOURCE_DIR}/src/utils/json_utils.cpp
)

target_link_libraries(benchmark_tests PRIVATE
    Qt6::Core
    Qt6::Test
    Qt6::Widgets
)

target_include_directories(benchmark_tests PRIVATE
    ${CMAKE_SOURCE_DIR}/include
)

add_test(NAME benchmark_tests COMMAND benchmark_tests) 