// Local Authentication System for CodLess
// This provides a fully functional authentication system without external dependencies

class LocalAuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
        this.sessions = this.loadSessions();
        this.authStateCallbacks = [];
        this.initializeAuth();
    }

    // Initialize authentication state
    initializeAuth() {
        // Check for existing session
        const sessionToken = localStorage.getItem('codless_session_token');
        if (sessionToken && this.sessions[sessionToken]) {
            const session = this.sessions[sessionToken];
            if (new Date(session.expiresAt) > new Date()) {
                this.currentUser = this.users[session.userId];
                this.notifyAuthStateChange(this.currentUser);
            } else {
                // Session expired
                this.signOut();
            }
        }
    }

    // Load users from localStorage
    loadUsers() {
        const usersData = localStorage.getItem('codless_users');
        return usersData ? JSON.parse(usersData) : {};
    }

    // Save users to localStorage
    saveUsers() {
        localStorage.setItem('codless_users', JSON.stringify(this.users));
    }

    // Load sessions from localStorage
    loadSessions() {
        const sessionsData = localStorage.getItem('codless_sessions');
        return sessionsData ? JSON.parse(sessionsData) : {};
    }

    // Save sessions to localStorage
    saveSessions() {
        localStorage.setItem('codless_sessions', JSON.stringify(this.sessions));
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Generate session token
    generateSessionToken() {
        return this.generateId() + this.generateId();
    }

    // Hash password (simple hash for demo - in production use bcrypt)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Create user object
    createUserObject(email, displayName, photoURL = null, provider = 'password') {
        return {
            uid: this.generateId(),
            email: email,
            displayName: displayName || email.split('@')[0],
            photoURL: photoURL,
            provider: provider,
            createdAt: new Date().toISOString(),
            emailVerified: provider === 'google.com'
        };
    }

    // Sign up with email and password
    async signUpWithEmail(email, password, displayName) {
        // Validate email
        if (!email || !email.includes('@')) {
            throw new Error('Invalid email address');
        }

        // Check if user exists
        const existingUser = Object.values(this.users).find(u => u.email === email);
        if (existingUser) {
            throw new Error('Email already in use');
        }

        // Validate password
        if (!password || password.length < 6) {
            throw new Error('Password should be at least 6 characters');
        }

        // Create user
        const user = this.createUserObject(email, displayName);
        const hashedPassword = this.hashPassword(password);
        
        // Store user with password
        this.users[user.uid] = {
            ...user,
            password: hashedPassword
        };
        this.saveUsers();

        // Create session
        await this.createSession(user);

        return user;
    }

    // Sign in with email and password
    async signInWithEmail(email, password) {
        const user = Object.values(this.users).find(u => u.email === email);
        
        if (!user) {
            throw new Error('User not found');
        }

        const hashedPassword = this.hashPassword(password);
        if (user.password !== hashedPassword) {
            throw new Error('Invalid password');
        }

        // Create session
        await this.createSession(user);

        return user;
    }

    // Sign in with Google (simulated)
    async signInWithGoogle() {
        // Simulate Google OAuth flow
        const googleEmail = prompt('Enter your Google email:');
        if (!googleEmail || !googleEmail.includes('@')) {
            throw new Error('Invalid email or sign-in cancelled');
        }

        // Check if user exists
        let user = Object.values(this.users).find(u => u.email === googleEmail);
        
        if (!user) {
            // Create new user
            const displayName = googleEmail.split('@')[0];
            const photoURL = `https://ui-avatars.com/api/?name=${displayName}&background=4285f4&color=fff`;
            user = this.createUserObject(googleEmail, displayName, photoURL, 'google.com');
            
            this.users[user.uid] = user;
            this.saveUsers();
        }

        // Create session
        await this.createSession(user);

        return user;
    }

    // Create session
    async createSession(user) {
        const token = this.generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        this.sessions[token] = {
            userId: user.uid,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        };
        this.saveSessions();

        // Save session token
        localStorage.setItem('codless_session_token', token);

        // Set current user
        this.currentUser = user;
        this.notifyAuthStateChange(user);
    }

    // Sign out
    async signOut() {
        const token = localStorage.getItem('codless_session_token');
        if (token) {
            delete this.sessions[token];
            this.saveSessions();
            localStorage.removeItem('codless_session_token');
        }

        this.currentUser = null;
        this.notifyAuthStateChange(null);
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Listen to auth state changes
    onAuthStateChanged(callback) {
        this.authStateCallbacks.push(callback);
        // Immediately call with current state
        callback(this.currentUser);
        
        return () => {
            this.authStateCallbacks = this.authStateCallbacks.filter(cb => cb !== callback);
        };
    }

    // Notify auth state change
    notifyAuthStateChange(user) {
        this.authStateCallbacks.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('Auth state callback error:', error);
            }
        });
    }

    // Reset password (simulated)
    async sendPasswordResetEmail(email) {
        const user = Object.values(this.users).find(u => u.email === email);
        if (!user) {
            throw new Error('User not found');
        }

        // In a real system, this would send an email
        alert(`Password reset link sent to ${email} (simulated)`);
        
        // For demo, allow immediate password reset
        const newPassword = prompt('Enter new password (min 6 characters):');
        if (newPassword && newPassword.length >= 6) {
            user.password = this.hashPassword(newPassword);
            this.saveUsers();
            alert('Password reset successfully!');
        }
    }
}

// Local Firestore implementation
class LocalFirestore {
    constructor() {
        this.data = this.loadData();
        this.listeners = {};
    }

    loadData() {
        const data = localStorage.getItem('codless_firestore_data');
        return data ? JSON.parse(data) : {};
    }

    saveData() {
        localStorage.setItem('codless_firestore_data', JSON.stringify(this.data));
    }

    collection(name) {
        if (!this.data[name]) {
            this.data[name] = {};
        }
        return new LocalCollection(this, name);
    }

    notifyListeners(path, data) {
        Object.keys(this.listeners).forEach(key => {
            if (key.startsWith(path)) {
                this.listeners[key].forEach(callback => callback(data));
            }
        });
    }
}

class LocalCollection {
    constructor(firestore, name) {
        this.firestore = firestore;
        this.name = name;
    }

    doc(id) {
        return new LocalDocument(this.firestore, this.name, id);
    }

    async add(data) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const doc = this.doc(id);
        await doc.set(data);
        return doc;
    }

    async get() {
        const docs = [];
        const collection = this.firestore.data[this.name] || {};
        
        Object.keys(collection).forEach(id => {
            docs.push({
                id,
                data: () => collection[id],
                exists: true
            });
        });

        return {
            docs,
            forEach: (callback) => docs.forEach(doc => callback(doc)),
            empty: docs.length === 0
        };
    }

    onSnapshot(callback) {
        const path = this.name;
        if (!this.firestore.listeners[path]) {
            this.firestore.listeners[path] = [];
        }
        this.firestore.listeners[path].push(callback);

        // Initial callback
        this.get().then(snapshot => callback(snapshot));

        // Return unsubscribe function
        return () => {
            this.firestore.listeners[path] = this.firestore.listeners[path].filter(cb => cb !== callback);
        };
    }
}

class LocalDocument {
    constructor(firestore, collection, id) {
        this.firestore = firestore;
        this.collectionName = collection;
        this.id = id;
    }

    async set(data, options = {}) {
        if (!this.firestore.data[this.collectionName]) {
            this.firestore.data[this.collectionName] = {};
        }

        if (options.merge) {
            const existing = this.firestore.data[this.collectionName][this.id] || {};
            this.firestore.data[this.collectionName][this.id] = { ...existing, ...data };
        } else {
            this.firestore.data[this.collectionName][this.id] = data;
        }

        this.firestore.saveData();
        this.firestore.notifyListeners(`${this.collectionName}/${this.id}`, data);
        this.firestore.notifyListeners(this.collectionName, null);
    }

    async get() {
        const data = this.firestore.data[this.collectionName]?.[this.id];
        return {
            exists: !!data,
            data: () => data,
            id: this.id
        };
    }

    async update(data) {
        await this.set(data, { merge: true });
    }

    async delete() {
        if (this.firestore.data[this.collectionName]) {
            delete this.firestore.data[this.collectionName][this.id];
            this.firestore.saveData();
            this.firestore.notifyListeners(this.collectionName, null);
        }
    }

    collection(name) {
        const path = `${this.collectionName}/${this.id}/${name}`;
        if (!this.firestore.data[path]) {
            this.firestore.data[path] = {};
        }
        return new LocalCollection(this.firestore, path);
    }

    onSnapshot(callback) {
        const path = `${this.collectionName}/${this.id}`;
        if (!this.firestore.listeners[path]) {
            this.firestore.listeners[path] = [];
        }
        this.firestore.listeners[path].push(callback);

        // Initial callback
        this.get().then(doc => callback(doc));

        // Return unsubscribe function
        return () => {
            this.firestore.listeners[path] = this.firestore.listeners[path].filter(cb => cb !== callback);
        };
    }
}

// Create mock Firebase object
window.firebase = {
    auth: () => ({
        onAuthStateChanged: (callback) => window.localAuth.onAuthStateChanged(callback),
        signInWithEmailAndPassword: (email, password) => 
            window.localAuth.signInWithEmail(email, password).then(user => ({ user })),
        createUserWithEmailAndPassword: (email, password) => 
            window.localAuth.signUpWithEmail(email, password, null).then(user => ({ user })),
        signInWithPopup: () => 
            window.localAuth.signInWithGoogle().then(user => ({ user })),
        signOut: () => window.localAuth.signOut(),
        sendPasswordResetEmail: (email) => window.localAuth.sendPasswordResetEmail(email),
        GoogleAuthProvider: class {}
    }),
    firestore: () => window.localFirestore,
    initializeApp: () => {}
};

// Initialize local auth and firestore
window.localAuth = new LocalAuthSystem();
window.localFirestore = new LocalFirestore();

// Create global auth and db references
window.auth = window.firebase.auth();
window.db = window.firebase.firestore();

// Mock Firestore FieldValue
window.firebase.firestore = {
    FieldValue: {
        serverTimestamp: () => new Date().toISOString()
    }
};

console.log('Local authentication system initialized');