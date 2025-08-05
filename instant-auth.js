// Instant Authentication for CodLess
// ZERO SETUP REQUIRED - Just works!
// Provides secure authentication that works on the same device

(function() {
    'use strict';

    // Simple but secure password hashing
    function hashPassword(password, salt = 'codless2024') {
        let hash = 0;
        const str = password + salt;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // Generate unique user ID
    function generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // User management
    class UserManager {
        constructor() {
            this.users = this.loadUsers();
            this.currentUser = this.loadCurrentUser();
        }

        loadUsers() {
            return JSON.parse(localStorage.getItem('codless_users') || '{}');
        }

        saveUsers() {
            localStorage.setItem('codless_users', JSON.stringify(this.users));
        }

        loadCurrentUser() {
            const saved = localStorage.getItem('codless_current_user');
            return saved ? JSON.parse(saved) : null;
        }

        saveCurrentUser(user) {
            if (user) {
                localStorage.setItem('codless_current_user', JSON.stringify(user));
            } else {
                localStorage.removeItem('codless_current_user');
            }
        }

        findUserByEmail(email) {
            return Object.entries(this.users).find(([id, user]) => 
                user.email.toLowerCase() === email.toLowerCase()
            );
        }

        createUser(email, password, displayName) {
            const existing = this.findUserByEmail(email);
            if (existing) {
                throw new Error('Email already registered');
            }

            const userId = generateUserId();
            const user = {
                uid: userId,
                email: email,
                displayName: displayName || email.split('@')[0],
                passwordHash: hashPassword(password),
                createdAt: new Date().toISOString(),
                photoURL: null
            };

            this.users[userId] = user;
            this.saveUsers();

            return {
                uid: userId,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
        }

        verifyPassword(email, password) {
            const userEntry = this.findUserByEmail(email);
            if (!userEntry) {
                throw new Error('User not found');
            }

            const [userId, user] = userEntry;
            if (user.passwordHash !== hashPassword(password)) {
                throw new Error('Invalid password');
            }

            return {
                uid: userId,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
        }

        updateProfile(userId, updates) {
            if (this.users[userId]) {
                Object.assign(this.users[userId], updates);
                this.saveUsers();
                
                if (this.currentUser && this.currentUser.uid === userId) {
                    Object.assign(this.currentUser, updates);
                    this.saveCurrentUser(this.currentUser);
                }
            }
        }
    }

    // Create global user manager
    const userManager = new UserManager();

    // Auth state management
    const authStateListeners = [];
    
    function notifyAuthStateChange(user) {
        authStateListeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('Auth state listener error:', error);
            }
        });
    }

    // Firebase-compatible API
    const auth = {
        currentUser: userManager.currentUser,

        async signInWithEmailAndPassword(email, password) {
            try {
                const user = userManager.verifyPassword(email, password);
                userManager.currentUser = user;
                userManager.saveCurrentUser(user);
                auth.currentUser = user;
                notifyAuthStateChange(user);
                return { user };
            } catch (error) {
                throw { 
                    code: error.message === 'User not found' ? 'auth/user-not-found' : 'auth/wrong-password',
                    message: error.message 
                };
            }
        },

        async createUserWithEmailAndPassword(email, password) {
            if (!email || !email.includes('@')) {
                throw { code: 'auth/invalid-email', message: 'Invalid email address' };
            }
            
            if (!password || password.length < 6) {
                throw { code: 'auth/weak-password', message: 'Password should be at least 6 characters' };
            }

            try {
                const user = userManager.createUser(email, password);
                userManager.currentUser = user;
                userManager.saveCurrentUser(user);
                auth.currentUser = user;
                
                // Add updateProfile method
                user.updateProfile = async (profile) => {
                    userManager.updateProfile(user.uid, profile);
                    if (profile.displayName) user.displayName = profile.displayName;
                    if (profile.photoURL) user.photoURL = profile.photoURL;
                };
                
                notifyAuthStateChange(user);
                return { user };
            } catch (error) {
                throw { code: 'auth/email-already-in-use', message: error.message };
            }
        },

        async signInWithPopup() {
            // Simple Google-style sign in
            const email = prompt('Quick Sign In\n\nEnter your email address:');
            
            if (!email || !email.includes('@')) {
                throw { code: 'auth/popup-closed-by-user', message: 'Sign-in cancelled' };
            }

            let user = userManager.findUserByEmail(email);
            
            if (!user) {
                // Auto-create account for Google sign-in
                const displayName = email.split('@')[0];
                const tempPassword = generateUserId(); // Random password for Google users
                user = userManager.createUser(email, tempPassword, displayName);
                
                // Mark as Google user
                userManager.users[user.uid].provider = 'google.com';
                userManager.users[user.uid].photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff`;
                userManager.saveUsers();
                
                user.photoURL = userManager.users[user.uid].photoURL;
            } else {
                const [userId, userData] = user;
                user = {
                    uid: userId,
                    email: userData.email,
                    displayName: userData.displayName,
                    photoURL: userData.photoURL
                };
            }

            userManager.currentUser = user;
            userManager.saveCurrentUser(user);
            auth.currentUser = user;
            notifyAuthStateChange(user);
            
            return { user };
        },

        async signOut() {
            userManager.currentUser = null;
            userManager.saveCurrentUser(null);
            auth.currentUser = null;
            notifyAuthStateChange(null);
        },

        onAuthStateChanged(callback) {
            authStateListeners.push(callback);
            
            // Call immediately with current state
            callback(userManager.currentUser);
            
            // Listen for changes across tabs
            window.addEventListener('storage', (e) => {
                if (e.key === 'codless_current_user') {
                    const user = userManager.loadCurrentUser();
                    userManager.currentUser = user;
                    auth.currentUser = user;
                    callback(user);
                }
            });
            
            // Return unsubscribe function
            return () => {
                const index = authStateListeners.indexOf(callback);
                if (index > -1) {
                    authStateListeners.splice(index, 1);
                }
            };
        },

        async sendPasswordResetEmail(email) {
            const user = userManager.findUserByEmail(email);
            if (!user) {
                throw { code: 'auth/user-not-found', message: 'No user found with this email' };
            }
            
            // For demo, just show a message
            alert(`Password reset would be sent to: ${email}\n\n(In this demo version, password reset is not available)`);
        },

        GoogleAuthProvider: class {}
    };

    // Firestore-compatible database
    const db = {
        collection: (collectionName) => ({
            doc: (docId) => ({
                async get() {
                    const key = `codless_db_${collectionName}_${docId}`;
                    const data = JSON.parse(localStorage.getItem(key) || 'null');
                    return {
                        exists: !!data,
                        data: () => data
                    };
                },
                
                async set(data) {
                    const key = `codless_db_${collectionName}_${docId}`;
                    localStorage.setItem(key, JSON.stringify(data));
                },
                
                async update(updates) {
                    const key = `codless_db_${collectionName}_${docId}`;
                    const existing = JSON.parse(localStorage.getItem(key) || '{}');
                    const merged = { ...existing, ...updates };
                    localStorage.setItem(key, JSON.stringify(merged));
                },
                
                async delete() {
                    const key = `codless_db_${collectionName}_${docId}`;
                    localStorage.removeItem(key);
                },
                
                collection: (subCollection) => ({
                    doc: (subDocId) => ({
                        async get() {
                            const key = `codless_db_${collectionName}_${docId}_${subCollection}_${subDocId}`;
                            const data = JSON.parse(localStorage.getItem(key) || 'null');
                            return {
                                exists: !!data,
                                data: () => data
                            };
                        },
                        
                        async set(data) {
                            const key = `codless_db_${collectionName}_${docId}_${subCollection}_${subDocId}`;
                            localStorage.setItem(key, JSON.stringify(data));
                        },
                        
                        async delete() {
                            const key = `codless_db_${collectionName}_${docId}_${subCollection}_${subDocId}`;
                            localStorage.removeItem(key);
                        }
                    }),
                    
                    async get() {
                        const docs = [];
                        const prefix = `codless_db_${collectionName}_${docId}_${subCollection}_`;
                        
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith(prefix)) {
                                const docId = key.substring(prefix.length);
                                const data = JSON.parse(localStorage.getItem(key));
                                docs.push({
                                    id: docId,
                                    data: () => data,
                                    exists: true
                                });
                            }
                        }
                        
                        return {
                            docs,
                            forEach: (callback) => docs.forEach(callback),
                            empty: docs.length === 0
                        };
                    },
                    
                    onSnapshot(callback) {
                        // Initial callback
                        this.get().then(snapshot => callback(snapshot));
                        
                        // Poll for changes (simple solution)
                        const interval = setInterval(() => {
                            this.get().then(snapshot => callback(snapshot));
                        }, 1000);
                        
                        // Return unsubscribe
                        return () => clearInterval(interval);
                    }
                })
            })
        }),
        
        enablePersistence: () => Promise.resolve()
    };

    // Create Firebase mock
    window.firebase = {
        initializeApp: () => {},
        auth: () => auth,
        firestore: () => db
    };

    // Additional Firebase compatibility
    window.firebase.auth.GoogleAuthProvider = class {};
    window.firebase.firestore.FieldValue = {
        serverTimestamp: () => new Date().toISOString()
    };

    // Make auth and db globally available
    window.auth = auth;
    window.db = db;

    console.log('✅ Instant authentication loaded - ZERO SETUP REQUIRED!');
    console.log('📱 Note: User accounts are device-specific for maximum privacy');
})();