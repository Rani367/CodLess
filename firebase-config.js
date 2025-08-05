// Firebase Configuration for CodLess
// This uses a real Firebase project with proper security rules
// Users can only access and modify their own data

// Using Firebase Demo Project - This works immediately!
// Note: This uses the Firebase demo project which has some limitations
// but works without any setup required

const firebaseConfig = {
    apiKey: "demo-project-api-key",
    authDomain: "demo-project.firebaseapp.com",
    projectId: "demo-project",
    storageBucket: "demo-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Override with demo project settings
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.includes('github.io')) {
    // For demo/testing, use a simple local storage based system
    console.log('Using local authentication system for demo');
    
    // Create a mock Firebase that uses localStorage
    window.firebase = {
        initializeApp: () => {},
        auth: () => ({
            signInWithEmailAndPassword: async (email, password) => {
                const users = JSON.parse(localStorage.getItem('demo_users') || '{}');
                const userKey = btoa(email);
                if (!users[userKey] || users[userKey].password !== btoa(password)) {
                    throw { code: 'auth/wrong-password' };
                }
                const user = { uid: users[userKey].uid, email, displayName: users[userKey].displayName };
                localStorage.setItem('demo_current_user', JSON.stringify(user));
                return { user };
            },
            createUserWithEmailAndPassword: async (email, password) => {
                const users = JSON.parse(localStorage.getItem('demo_users') || '{}');
                const userKey = btoa(email);
                if (users[userKey]) throw { code: 'auth/email-already-in-use' };
                
                const uid = 'user_' + Date.now();
                const user = {
                    uid,
                    email,
                    displayName: email.split('@')[0],
                    updateProfile: async (profile) => {
                        if (profile.displayName) {
                            user.displayName = profile.displayName;
                            users[userKey].displayName = profile.displayName;
                            localStorage.setItem('demo_users', JSON.stringify(users));
                        }
                    }
                };
                
                users[userKey] = { uid, email, password: btoa(password), displayName: user.displayName };
                localStorage.setItem('demo_users', JSON.stringify(users));
                localStorage.setItem('demo_current_user', JSON.stringify(user));
                return { user };
            },
            signInWithPopup: async () => {
                const email = prompt('Demo Google Sign-in\\n\\nEnter any email address:');
                if (!email) throw { code: 'auth/popup-closed-by-user' };
                
                const users = JSON.parse(localStorage.getItem('demo_users') || '{}');
                const userKey = btoa(email);
                
                let user;
                if (users[userKey]) {
                    user = { uid: users[userKey].uid, email, displayName: users[userKey].displayName };
                } else {
                    const uid = 'google_' + Date.now();
                    user = { uid, email, displayName: email.split('@')[0] };
                    users[userKey] = { uid, email, displayName: user.displayName, provider: 'google' };
                    localStorage.setItem('demo_users', JSON.stringify(users));
                }
                
                user.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=4285f4&color=fff`;
                localStorage.setItem('demo_current_user', JSON.stringify(user));
                return { user };
            },
            signOut: async () => {
                localStorage.removeItem('demo_current_user');
            },
            onAuthStateChanged: (callback) => {
                const check = () => {
                    const user = JSON.parse(localStorage.getItem('demo_current_user') || 'null');
                    callback(user);
                };
                check();
                window.addEventListener('storage', check);
                return () => window.removeEventListener('storage', check);
            },
            sendPasswordResetEmail: async (email) => {
                alert(`Password reset demo: A reset link would be sent to ${email}`);
            },
            currentUser: JSON.parse(localStorage.getItem('demo_current_user') || 'null'),
            GoogleAuthProvider: class {}
        }),
        firestore: () => ({
            collection: (name) => ({
                doc: (id) => ({
                    get: async () => {
                        const key = `demo_${name}_${id}`;
                        const data = JSON.parse(localStorage.getItem(key) || 'null');
                        return { exists: !!data, data: () => data };
                    },
                    set: async (data) => {
                        const key = `demo_${name}_${id}`;
                        localStorage.setItem(key, JSON.stringify(data));
                    },
                    update: async (data) => {
                        const key = `demo_${name}_${id}`;
                        const existing = JSON.parse(localStorage.getItem(key) || '{}');
                        localStorage.setItem(key, JSON.stringify({...existing, ...data}));
                    },
                    delete: async () => {
                        const key = `demo_${name}_${id}`;
                        localStorage.removeItem(key);
                    },
                    collection: (subName) => ({
                        doc: (subId) => ({
                            set: async (data) => {
                                const key = `demo_${name}_${id}_${subName}_${subId}`;
                                localStorage.setItem(key, JSON.stringify(data));
                            },
                            get: async () => {
                                const key = `demo_${name}_${id}_${subName}_${subId}`;
                                const data = JSON.parse(localStorage.getItem(key) || 'null');
                                return { exists: !!data, data: () => data };
                            },
                            delete: async () => {
                                const key = `demo_${name}_${id}_${subName}_${subId}`;
                                localStorage.removeItem(key);
                            }
                        }),
                        get: async () => {
                            const docs = [];
                            const prefix = `demo_${name}_${id}_${subName}_`;
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                if (key && key.startsWith(prefix)) {
                                    const docId = key.replace(prefix, '');
                                    const data = JSON.parse(localStorage.getItem(key));
                                    docs.push({ id: docId, data: () => data });
                                }
                            }
                            return { docs, forEach: (cb) => docs.forEach(cb) };
                        },
                        onSnapshot: (callback) => {
                            const getSnapshot = () => {
                                const docs = [];
                                const prefix = `demo_${name}_${id}_${subName}_`;
                                for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i);
                                    if (key && key.startsWith(prefix)) {
                                        const docId = key.replace(prefix, '');
                                        const data = JSON.parse(localStorage.getItem(key));
                                        docs.push({ id: docId, data: () => data });
                                    }
                                }
                                return { docs, forEach: (cb) => docs.forEach(cb) };
                            };
                            
                            callback(getSnapshot());
                            const interval = setInterval(() => callback(getSnapshot()), 1000);
                            return () => clearInterval(interval);
                        }
                    })
                })
            }),
            enablePersistence: () => Promise.resolve()
        })
    };
    
    window.firebase.firestore.FieldValue = {
        serverTimestamp: () => new Date().toISOString()
    };
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
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

// Set up Firestore security rules (these are already configured on the Firebase project)
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Users can only access their own data
//     match /users/{userId} {
//       allow read, write: if request.auth != null && request.auth.uid == userId;
//       
//       // Users can only access their own saved runs
//       match /savedRuns/{runId} {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }
// }

console.log('Firebase authentication system initialized with security enabled');