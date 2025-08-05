// Firebase Configuration for CodLess
// This file now uses the local authentication system
// No external Firebase setup required!

// The local-auth-system.js file provides all Firebase functionality locally
// Including auth, firestore, and all Firebase methods

// Initialize services (using local implementations)
const auth = window.auth;
const db = window.db;
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Enable offline persistence for Firestore
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.warn('The current browser does not support offline persistence');
        }
    });

// Authentication state management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authStateCallbacks = [];
        this.initializeAuthListener();
    }

    initializeAuthListener() {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.notifyAuthStateChange(user);
            
            if (user) {
                console.log('User logged in:', user.email);
                this.syncLocalDataToFirestore();
            } else {
                console.log('User logged out');
            }
        });
    }

    notifyAuthStateChange(user) {
        this.authStateCallbacks.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('Auth state callback error:', error);
            }
        });
    }

    onAuthStateChange(callback) {
        this.authStateCallbacks.push(callback);
        // Immediately call with current state
        callback(this.currentUser);
        
        return () => {
            this.authStateCallbacks = this.authStateCallbacks.filter(cb => cb !== callback);
        };
    }

    async signInWithEmail(email, password) {
        try {
            const credential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: credential.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    async signUpWithEmail(email, password, displayName) {
        try {
            const credential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update display name
            if (displayName) {
                await credential.user.updateProfile({ displayName });
            }
            
            // Create user document in Firestore
            await this.createUserDocument(credential.user);
            
            return { success: true, user: credential.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    async signInWithGoogle() {
        try {
            const credential = await auth.signInWithPopup(googleProvider);
            
            // Create user document if it doesn't exist
            await this.createUserDocument(credential.user);
            
            return { success: true, user: credential.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    async signOut() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    async resetPassword(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    async createUserDocument(user) {
        if (!user) return;

        const userRef = db.collection('users').doc(user.uid);
        const snapshot = await userRef.get();

        if (!snapshot.exists) {
            const { displayName, email, photoURL } = user;
            const createdAt = new Date();

            try {
                await userRef.set({
                    displayName,
                    email,
                    photoURL,
                    createdAt,
                    settings: {
                        theme: 'dark',
                        autoSave: true,
                        notifications: true
                    }
                });
            } catch (error) {
                console.error('Error creating user document:', error);
            }
        }
    }

    async syncLocalDataToFirestore() {
        if (!this.currentUser) return;

        try {
            // Get local storage data
            const savedRuns = localStorage.getItem(STORAGE_KEYS.SAVED_RUNS);
            const config = localStorage.getItem(STORAGE_KEYS.CONFIG);
            const preferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            const calibration = localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA);

            const userRef = db.collection('users').doc(this.currentUser.uid);

            // Sync saved runs
            if (savedRuns) {
                const runs = JSON.parse(savedRuns);
                const batch = db.batch();
                
                for (const run of runs) {
                    const runRef = userRef.collection('savedRuns').doc(run.id);
                    batch.set(runRef, {
                        ...run,
                        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                await batch.commit();
            }

            // Sync other data
            const updates = {};
            if (config) updates.config = JSON.parse(config);
            if (preferences) updates.preferences = JSON.parse(preferences);
            if (calibration) updates.calibration = JSON.parse(calibration);

            if (Object.keys(updates).length > 0) {
                await userRef.update(updates);
            }

            console.log('Local data synced to Firestore');
        } catch (error) {
            console.error('Error syncing data to Firestore:', error);
        }
    }

    getErrorMessage(error) {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'This email is already registered. Please sign in instead.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/operation-not-allowed':
                return 'Email/password accounts are not enabled.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection.';
            default:
                return error.message || 'An error occurred. Please try again.';
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Data management with Firestore
class FirestoreDataManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.unsubscribers = {};
    }

    async saveRun(runData) {
        const user = this.authManager.getCurrentUser();
        if (!user) {
            throw new Error('User must be authenticated to save runs');
        }

        try {
            const userRef = db.collection('users').doc(user.uid);
            const runRef = userRef.collection('savedRuns').doc(runData.id);
            
            await runRef.set({
                ...runData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Also update local storage for offline access
            this.updateLocalStorage('savedRuns', runData);
            
            return { success: true };
        } catch (error) {
            console.error('Error saving run:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteRun(runId) {
        const user = this.authManager.getCurrentUser();
        if (!user) {
            throw new Error('User must be authenticated to delete runs');
        }

        try {
            const userRef = db.collection('users').doc(user.uid);
            await userRef.collection('savedRuns').doc(runId).delete();
            
            // Update local storage
            this.removeFromLocalStorage('savedRuns', runId);
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting run:', error);
            return { success: false, error: error.message };
        }
    }

    async loadUserData() {
        const user = this.authManager.getCurrentUser();
        if (!user) return null;

        try {
            const userRef = db.collection('users').doc(user.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) return null;
            
            const userData = userDoc.data();
            
            // Load saved runs
            const runsSnapshot = await userRef.collection('savedRuns').get();
            const savedRuns = [];
            runsSnapshot.forEach(doc => {
                savedRuns.push({ id: doc.id, ...doc.data() });
            });
            
            return {
                ...userData,
                savedRuns
            };
        } catch (error) {
            console.error('Error loading user data:', error);
            return null;
        }
    }

    subscribeToUserData(callback) {
        const user = this.authManager.getCurrentUser();
        if (!user) return () => {};

        const userRef = db.collection('users').doc(user.uid);
        
        // Subscribe to user document changes
        const userUnsubscribe = userRef.onSnapshot((doc) => {
            if (doc.exists) {
                callback({ type: 'user', data: doc.data() });
            }
        });

        // Subscribe to saved runs changes
        const runsUnsubscribe = userRef.collection('savedRuns')
            .onSnapshot((snapshot) => {
                const runs = [];
                snapshot.forEach(doc => {
                    runs.push({ id: doc.id, ...doc.data() });
                });
                callback({ type: 'runs', data: runs });
            });

        // Return unsubscribe function
        return () => {
            userUnsubscribe();
            runsUnsubscribe();
        };
    }

    async updateUserSettings(settings) {
        const user = this.authManager.getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        try {
            const userRef = db.collection('users').doc(user.uid);
            await userRef.update({
                settings: settings,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, error: error.message };
        }
    }

    updateLocalStorage(key, data) {
        try {
            const storageKey = STORAGE_KEYS[key.toUpperCase()];
            if (!storageKey) return;

            let existing = localStorage.getItem(storageKey);
            if (existing) {
                existing = JSON.parse(existing);
                if (Array.isArray(existing)) {
                    const index = existing.findIndex(item => item.id === data.id);
                    if (index >= 0) {
                        existing[index] = data;
                    } else {
                        existing.push(data);
                    }
                    localStorage.setItem(storageKey, JSON.stringify(existing));
                }
            }
        } catch (error) {
            console.error('Error updating local storage:', error);
        }
    }

    removeFromLocalStorage(key, itemId) {
        try {
            const storageKey = STORAGE_KEYS[key.toUpperCase()];
            if (!storageKey) return;

            let existing = localStorage.getItem(storageKey);
            if (existing) {
                existing = JSON.parse(existing);
                if (Array.isArray(existing)) {
                    existing = existing.filter(item => item.id !== itemId);
                    localStorage.setItem(storageKey, JSON.stringify(existing));
                }
            }
        } catch (error) {
            console.error('Error removing from local storage:', error);
        }
    }
}

// Export instances
const authManager = new AuthManager();
const dataManager = new FirestoreDataManager(authManager);

// Make available globally
window.CodLessAuth = {
    authManager,
    dataManager
};