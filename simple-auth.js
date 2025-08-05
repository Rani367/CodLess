// Simple Authentication System for CodLess
// Works immediately with no external dependencies or setup required!

(function() {
    'use strict';

    // Simple auth implementation
    class SimpleAuth {
        constructor() {
            this.currentUser = null;
            this.authCallbacks = [];
            this.checkExistingSession();
        }

        checkExistingSession() {
            const savedUser = localStorage.getItem('codless_current_user');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                setTimeout(() => this.notifyAuthChange(this.currentUser), 100);
            }
        }

        async signInWithEmailAndPassword(email, password) {
            // Get stored users
            const users = JSON.parse(localStorage.getItem('codless_users') || '{}');
            const userKey = btoa(email); // Simple encoding for key
            
            if (!users[userKey]) {
                throw { code: 'auth/user-not-found' };
            }
            
            if (users[userKey].password !== btoa(password)) {
                throw { code: 'auth/wrong-password' };
            }
            
            const user = {
                uid: users[userKey].uid,
                email: email,
                displayName: users[userKey].displayName,
                photoURL: null
            };
            
            this.setCurrentUser(user);
            return { user };
        }

        async createUserWithEmailAndPassword(email, password) {
            const users = JSON.parse(localStorage.getItem('codless_users') || '{}');
            const userKey = btoa(email);
            
            if (users[userKey]) {
                throw { code: 'auth/email-already-in-use' };
            }
            
            const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const user = {
                uid: uid,
                email: email,
                displayName: email.split('@')[0],
                photoURL: null,
                updateProfile: async function(profile) {
                    if (profile.displayName) {
                        this.displayName = profile.displayName;
                        users[userKey].displayName = profile.displayName;
                        localStorage.setItem('codless_users', JSON.stringify(users));
                    }
                }
            };
            
            users[userKey] = {
                uid: uid,
                email: email,
                password: btoa(password),
                displayName: user.displayName
            };
            
            localStorage.setItem('codless_users', JSON.stringify(users));
            this.setCurrentUser(user);
            return { user };
        }

        async signInWithPopup(provider) {
            // Simulate Google sign-in with a simple modal
            const email = prompt('Sign in with Google\n\nEnter your email address:');
            
            if (!email || !email.includes('@')) {
                throw { code: 'auth/popup-closed-by-user' };
            }
            
            const users = JSON.parse(localStorage.getItem('codless_users') || '{}');
            const userKey = btoa(email);
            
            let user;
            if (users[userKey]) {
                // Existing user
                user = {
                    uid: users[userKey].uid,
                    email: email,
                    displayName: users[userKey].displayName,
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(users[userKey].displayName)}&background=4285f4&color=fff`
                };
            } else {
                // New user
                const uid = 'google_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const displayName = email.split('@')[0];
                
                user = {
                    uid: uid,
                    email: email,
                    displayName: displayName,
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff`
                };
                
                users[userKey] = {
                    uid: uid,
                    email: email,
                    displayName: displayName,
                    provider: 'google'
                };
                
                localStorage.setItem('codless_users', JSON.stringify(users));
            }
            
            this.setCurrentUser(user);
            return { user };
        }

        async signOut() {
            this.currentUser = null;
            localStorage.removeItem('codless_current_user');
            this.notifyAuthChange(null);
        }

        async sendPasswordResetEmail(email) {
            const users = JSON.parse(localStorage.getItem('codless_users') || '{}');
            const userKey = btoa(email);
            
            if (!users[userKey]) {
                throw { code: 'auth/user-not-found' };
            }
            
            // Simulate email sent
            alert(`Password reset instructions sent to ${email}\n\n(In this demo, use the password reset option in the login dialog)`);
        }

        onAuthStateChanged(callback) {
            this.authCallbacks.push(callback);
            callback(this.currentUser);
            return () => {
                this.authCallbacks = this.authCallbacks.filter(cb => cb !== callback);
            };
        }

        setCurrentUser(user) {
            this.currentUser = user;
            localStorage.setItem('codless_current_user', JSON.stringify(user));
            this.notifyAuthChange(user);
        }

        notifyAuthChange(user) {
            this.authCallbacks.forEach(callback => {
                try {
                    callback(user);
                } catch (e) {
                    console.error('Auth callback error:', e);
                }
            });
        }
    }

    // Simple Firestore implementation
    class SimpleFirestore {
        constructor() {
            this.collections = {};
            this.listeners = {};
        }

        collection(name) {
            return {
                doc: (id) => ({
                    get: async () => {
                        const data = JSON.parse(localStorage.getItem(`codless_db_${name}_${id}`) || 'null');
                        return {
                            exists: !!data,
                            data: () => data
                        };
                    },
                    set: async (data) => {
                        localStorage.setItem(`codless_db_${name}_${id}`, JSON.stringify(data));
                        this.notifyListeners(`${name}/${id}`, data);
                    },
                    update: async (data) => {
                        const existing = JSON.parse(localStorage.getItem(`codless_db_${name}_${id}`) || '{}');
                        const updated = { ...existing, ...data };
                        localStorage.setItem(`codless_db_${name}_${id}`, JSON.stringify(updated));
                        this.notifyListeners(`${name}/${id}`, updated);
                    },
                    delete: async () => {
                        localStorage.removeItem(`codless_db_${name}_${id}`);
                        this.notifyListeners(`${name}/${id}`, null);
                    },
                    collection: (subName) => {
                        const fullPath = `${name}_${id}_${subName}`;
                        return {
                            doc: (subId) => this.collection(fullPath).doc(subId),
                            add: async (data) => {
                                const id = Date.now().toString();
                                await this.collection(fullPath).doc(id).set(data);
                                return { id };
                            },
                            get: async () => {
                                const docs = [];
                                const prefix = `codless_db_${fullPath}_`;
                                
                                for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i);
                                    if (key && key.startsWith(prefix)) {
                                        const id = key.replace(prefix, '');
                                        const data = JSON.parse(localStorage.getItem(key));
                                        docs.push({
                                            id,
                                            data: () => data,
                                            exists: true
                                        });
                                    }
                                }
                                
                                return {
                                    docs,
                                    forEach: (callback) => docs.forEach(doc => callback(doc)),
                                    empty: docs.length === 0
                                };
                            },
                            onSnapshot: (callback) => {
                                const path = fullPath;
                                if (!this.listeners[path]) {
                                    this.listeners[path] = [];
                                }
                                this.listeners[path].push(callback);
                                
                                // Initial callback
                                this.collection(name).doc(id).collection(subName).get().then(snapshot => {
                                    callback(snapshot);
                                });
                                
                                return () => {
                                    this.listeners[path] = this.listeners[path].filter(cb => cb !== callback);
                                };
                            }
                        };
                    }
                })
            };
        }

        enablePersistence() {
            return Promise.resolve();
        }

        notifyListeners(path, data) {
            Object.keys(this.listeners).forEach(listenerPath => {
                if (path.startsWith(listenerPath)) {
                    this.listeners[listenerPath].forEach(callback => {
                        // Re-fetch the data for the callback
                        const parts = listenerPath.split('_');
                        if (parts.length >= 3) {
                            this.collection(parts[0]).doc(parts[1]).collection(parts[2]).get().then(snapshot => {
                                callback(snapshot);
                            });
                        }
                    });
                }
            });
        }
    }

    // Create global Firebase mock
    const authInstance = new SimpleAuth();
    const firestoreInstance = new SimpleFirestore();

    window.firebase = {
        initializeApp: () => {},
        auth: () => ({
            ...authInstance,
            GoogleAuthProvider: function() {}
        }),
        firestore: () => firestoreInstance
    };

    // Create shortcuts
    window.auth = window.firebase.auth();
    window.db = window.firebase.firestore();

    // Add FieldValue
    window.firebase.auth.GoogleAuthProvider = function() {};
    window.firebase.firestore.FieldValue = {
        serverTimestamp: () => new Date().toISOString()
    };

    console.log('Simple authentication system loaded - ready to use!');
})();