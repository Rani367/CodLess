#include "../include/gui/ui_components_manager.h"
#include "../include/gui/main_window.h"

UIComponentsManager::UIComponentsManager(MainWindow* parent)
    : QObject(parent), mainWindow(parent) {
    // Constructor implementation
}

UIComponentsManager::~UIComponentsManager() = default;

void UIComponentsManager::setupMainLayout() {
}

void UIComponentsManager::setupTitleBar() {
}

void UIComponentsManager::setupSidebar() {
}

void UIComponentsManager::setupMainContent() {
}

void UIComponentsManager::setupStatusBar() {
} 