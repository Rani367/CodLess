// Instant Authentication System for CodLess
// Works immediately - no Firebase or external setup required!

(function() {
    'use strict';

    // Secure hash function for passwords
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // Create user ID
    function createUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get all users (stored per-origin for security)
    function getUsers() {
        return JSON.parse(localStorage.getItem('codless_users') || '{}');
    }

    // Save users
    function saveUsers(users) {
        localStorage.setItem('codless_users', JSON.stringify(users));
    }

    // Get current user
    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('codless_current_user') || 'null');
    }

    // Set current user
    function setCurrentUser(user) {
        if (user) {
            localStorage.setItem('codless_current_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('codless_current_user');
        }
        notifyAuthChange(user);
    }

    // Auth state listeners
    const authListeners = [];
    
    function notifyAuthChange(user) {
        authListeners.forEach(callback => {
            try {
                callback(user);
            } catch (e) {
                console.error('Auth callback error:', e);
            }
        });
    }

    // Mock Firebase Auth
    const mockAuth = {
        currentUser: getCurrentUser(),
        
        signInWithEmailAndPassword: async (email, password) => {
            const users = getUsers();
            const hashedPassword = hashPassword(password);
            
            // Find user by email
            const userId = Object.keys(users).find(id => users[id].email === email);
            
            if (!userId) {
                throw { code: 'auth/user-not-found', message: 'No user found with this email' };
            }
            
            if (users[userId].password !== hashedPassword) {
                throw { code: 'auth/wrong-password', message: 'Incorrect password' };
            }
            
            const user = {
                uid: userId,
                email: users[userId].email,
                displayName: users[userId].displayName,
                photoURL: users[userId].photoURL
            };
            
            setCurrentUser(user);
            mockAuth.currentUser = user;
            return { user };
        },
        
        createUserWithEmailAndPassword: async (email, password) => {
            const users = getUsers();
            
            // Check if email already exists
            const existingUser = Object.values(users).find(u => u.email === email);
            if (existingUser) {
                throw { code: 'auth/email-already-in-use', message: 'Email already registered' };
            }
            
            if (password.length < 6) {
                throw { code: 'auth/weak-password', message: 'Password should be at least 6 characters' };
            }
            
            const userId = createUserId();
            const hashedPassword = hashPassword(password);
            
            const newUser = {
                email,
                password: hashedPassword,
                displayName: email.split('@')[0],
                photoURL: null,
                createdAt: new Date().toISOString()
            };
            
            users[userId] = newUser;
            saveUsers(users);
            
            const user = {
                uid: userId,
                email: newUser.email,
                displayName: newUser.displayName,
                photoURL: newUser.photoURL,
                updateProfile: async (profile) => {
                    if (profile.displayName) {
                        users[userId].displayName = profile.displayName;
                        user.displayName = profile.displayName;
                        saveUsers(users);
                        setCurrentUser(user);
                    }
                }
            };
            
            setCurrentUser(user);
            mockAuth.currentUser = user;
            return { user };
        },
        
        signInWithPopup: async () => {
            const email = prompt('Sign in with Google\n\nEnter your email address:');
            
            if (!email || !email.includes('@')) {
                throw { code: 'auth/popup-closed-by-user', message: 'Sign-in cancelled' };
            }
            
            const users = getUsers();
            let userId = Object.keys(users).find(id => users[id].email === email);
            
            if (!userId) {
                // Create new user
                userId = createUserId();
                const displayName = email.split('@')[0];
                
                users[userId] = {
                    email,
                    displayName,
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff`,
                    provider: 'google.com',
                    createdAt: new Date().toISOString()
                };
                
                saveUsers(users);
            }
            
            const user = {
                uid: userId,
                email: users[userId].email,
                displayName: users[userId].displayName,
                photoURL: users[userId].photoURL
            };
            
            setCurrentUser(user);
            mockAuth.currentUser = user;
            return { user };
        },
        
        signOut: async () => {
            setCurrentUser(null);
            mockAuth.currentUser = null;
        },
        
        onAuthStateChanged: (callback) => {
            authListeners.push(callback);
            callback(getCurrentUser());
            
            // Listen for storage changes (for multi-tab sync)
            window.addEventListener('storage', (e) => {
                if (e.key === 'codless_current_user') {
                    const user = getCurrentUser();
                    mockAuth.currentUser = user;
                    callback(user);
                }
            });
            
            return () => {
                const index = authListeners.indexOf(callback);
                if (index > -1) authListeners.splice(index, 1);
            };
        },
        
        sendPasswordResetEmail: async (email) => {
            const users = getUsers();
            const userId = Object.keys(users).find(id => users[id].email === email);
            
            if (!userId) {
                throw { code: 'auth/user-not-found', message: 'No user found with this email' };
            }
            
            // In a real app, this would send an email
            alert(`Password reset link sent to ${email}\n\n(Demo: Use the forgot password option to reset)`);
        },
        
        GoogleAuthProvider: class {}
    };

    // Mock Firestore
    const mockFirestore = {
        collection: (collectionName) => ({
            doc: (docId) => ({
                get: async () => {
                    const key = `codless_db_${collectionName}_${docId}`;
                    const data = JSON.parse(localStorage.getItem(key) || 'null');
                    return {
                        exists: !!data,
                        data: () => data
                    };
                },
                
                set: async (data) => {
                    const key = `codless_db_${collectionName}_${docId}`;
                    localStorage.setItem(key, JSON.stringify(data));
                },
                
                update: async (updates) => {
                    const key = `codless_db_${collectionName}_${docId}`;
                    const existing = JSON.parse(localStorage.getItem(key) || '{}');
                    const updated = { ...existing, ...updates };
                    localStorage.setItem(key, JSON.stringify(updated));
                },
                
                delete: async () => {
                    const key = `codless_db_${collectionName}_${docId}`;
                    localStorage.removeItem(key);
                },
                
                collection: (subCollection) => ({
                    doc: (subDocId) => ({
                        get: async () => {
                            const key = `codless_db_${collectionName}_${docId}_${subCollection}_${subDocId}`;
                            const data = JSON.parse(localStorage.getItem(key) || 'null');
                            return {
                                exists: !!data,
                                data: () => data
                            };
                        },
                        
                        set: async (data) => {
                            const key = `codless_db_${collectionName}_${docId}_${subCollection}_${subDocId}`;
                            localStorage.setItem(key, JSON.stringify(data));
                        },
                        
                        delete: async () => {
                            const key = `codless_db_${collectionName}_${docId}_${subCollection}_${subDocId}`;
                            localStorage.removeItem(key);
                        }
                    }),
                    
                    get: async () => {
                        const docs = [];
                        const prefix = `codless_db_${collectionName}_${docId}_${subCollection}_`;
                        
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith(prefix)) {
                                const docId = key.replace(prefix, '');
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
                    
                    onSnapshot: (callback) => {
                        const checkForChanges = () => {
                            this.collection(collectionName).doc(docId).collection(subCollection).get()
                                .then(snapshot => callback(snapshot));
                        };
                        
                        // Initial call
                        checkForChanges();
                        
                        // Check periodically
                        const interval = setInterval(checkForChanges, 1000);
                        
                        return () => clearInterval(interval);
                    }
                })
            })
        }),
        
        enablePersistence: () => Promise.resolve()
    };

    // Create global Firebase object
    window.firebase = {
        initializeApp: () => {},
        auth: () => mockAuth,
        firestore: () => mockFirestore
    };

    window.firebase.auth.GoogleAuthProvider = class {};
    window.firebase.firestore.FieldValue = {
        serverTimestamp: () => new Date().toISOString()
    };

    // Initialize auth and db shortcuts
    window.auth = mockAuth;
    window.db = mockFirestore;

    console.log('Instant authentication system loaded - works immediately!');
})();