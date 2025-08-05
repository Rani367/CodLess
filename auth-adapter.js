// Authentication Adapter for CodLess
// This file integrates the authentication system with the existing app functionality

class AuthAdapter {
    constructor() {
        this.authManager = window.CodLessAuth?.authManager;
        this.dataManager = window.CodLessAuth?.dataManager;
        this.app = null;
        this.isInitialized = false;
        this.unsubscribeFromData = null;
    }

    async initialize(app) {
        this.app = app;
        
        // Listen for auth state changes
        this.authManager.onAuthStateChange(async (user) => {
            if (user) {
                await this.onUserSignedIn(user);
            } else {
                await this.onUserSignedOut();
            }
        });

        this.isInitialized = true;
    }

    async onUserSignedIn(user) {
        console.log('User signed in, loading cloud data...');
        
        // Load user data from Firestore
        const userData = await this.dataManager.loadUserData();
        
        if (userData) {
            // Merge cloud data with local data
            await this.mergeUserData(userData);
            
            // Subscribe to real-time updates
            this.unsubscribeFromData = this.dataManager.subscribeToUserData((update) => {
                this.handleDataUpdate(update);
            });
        }
        
        // Show welcome message
        this.app?.toastManager?.show(`Welcome back, ${user.displayName || 'User'}!`, 'success');
    }

    async onUserSignedOut() {
        console.log('User signed out, clearing user data...');
        
        // Unsubscribe from data updates
        if (this.unsubscribeFromData) {
            this.unsubscribeFromData();
            this.unsubscribeFromData = null;
        }
        
        // Clear user-specific data but keep local data
        // User can still use the app without signing in
        this.app?.toastManager?.show('Signed out successfully', 'info');
    }

    async mergeUserData(userData) {
        if (!this.app) return;

        // Merge saved runs
        if (userData.savedRuns && Array.isArray(userData.savedRuns)) {
            for (const run of userData.savedRuns) {
                this.app.savedRuns.set(run.id, run);
            }
            this.app.updateSavedRunsList();
        }

        // Merge configuration
        if (userData.config) {
            Object.assign(this.app.config, userData.config);
            this.app.updateConfigUI();
        }

        // Merge preferences
        if (userData.preferences) {
            // Apply theme, auto-save settings, etc.
            if (userData.preferences.theme) {
                document.body.className = userData.preferences.theme;
            }
        }

        // Merge calibration data
        if (userData.calibration) {
            this.app.calibrationData = userData.calibration;
            this.app.isCalibrated = true;
            this.app.updateCalibrationUI();
        }
    }

    handleDataUpdate(update) {
        if (!this.app) return;

        switch (update.type) {
            case 'user':
                // Update user settings
                if (update.data.settings) {
                    this.applyUserSettings(update.data.settings);
                }
                break;
                
            case 'runs':
                // Update saved runs
                this.app.savedRuns.clear();
                for (const run of update.data) {
                    this.app.savedRuns.set(run.id, run);
                }
                this.app.updateSavedRunsList();
                break;
        }
    }

    applyUserSettings(settings) {
        if (settings.theme) {
            document.body.className = settings.theme;
        }
        
        if (settings.autoSave !== undefined) {
            // Update auto-save preference
            if (settings.autoSave && !this.app.autoSaveTimer) {
                this.app.startAutoSave();
            } else if (!settings.autoSave && this.app.autoSaveTimer) {
                this.app.stopAutoSave();
            }
        }
    }

    // Override save methods to use Firestore when authenticated
    async saveRun(runData) {
        if (this.authManager.isAuthenticated()) {
            // Save to Firestore
            const result = await this.dataManager.saveRun(runData);
            if (!result.success) {
                this.app?.toastManager?.show('Failed to save to cloud: ' + result.error, 'error');
                // Fall back to local storage
                this.saveToLocalStorage(runData);
            }
        } else {
            // Save to local storage only
            this.saveToLocalStorage(runData);
        }
    }

    async deleteRun(runId) {
        if (this.authManager.isAuthenticated()) {
            // Delete from Firestore
            const result = await this.dataManager.deleteRun(runId);
            if (!result.success) {
                this.app?.toastManager?.show('Failed to delete from cloud: ' + result.error, 'error');
            }
        }
        
        // Always delete from local storage
        this.deleteFromLocalStorage(runId);
    }

    saveToLocalStorage(runData) {
        const savedRuns = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_RUNS) || '[]');
        const existingIndex = savedRuns.findIndex(r => r.id === runData.id);
        
        if (existingIndex >= 0) {
            savedRuns[existingIndex] = runData;
        } else {
            savedRuns.push(runData);
        }
        
        localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(savedRuns));
    }

    deleteFromLocalStorage(runId) {
        const savedRuns = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_RUNS) || '[]');
        const filtered = savedRuns.filter(r => r.id !== runId);
        localStorage.setItem(STORAGE_KEYS.SAVED_RUNS, JSON.stringify(filtered));
    }

    async updateSettings(settings) {
        if (this.authManager.isAuthenticated()) {
            const result = await this.dataManager.updateUserSettings(settings);
            if (!result.success) {
                this.app?.toastManager?.show('Failed to save settings to cloud', 'error');
            }
        }
        
        // Always save to local storage as well
        const prefs = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES) || '{}');
        Object.assign(prefs, settings);
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
    }
}

// Create and export the adapter instance
window.authAdapter = new AuthAdapter();

// Wait for both the app and auth to be ready
document.addEventListener('DOMContentLoaded', () => {
    const checkReady = setInterval(() => {
        if (window.app && window.CodLessAuth && window.authAdapter) {
            clearInterval(checkReady);
            window.authAdapter.initialize(window.app);
        }
    }, 100);
});