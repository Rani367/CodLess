// Authentication UI Components for CodLess
// This file contains all the UI components for authentication

class AuthUI {
    constructor() {
        console.log('🔍 Auth UI: Constructor called');
        console.log('🔍 Auth UI: window.CodLessAuth:', window.CodLessAuth);
        
        this.authManager = window.CodLessAuth?.authManager;
        this.dataManager = window.CodLessAuth?.dataManager;
        this.currentModal = null;
        
        console.log('🔍 Auth UI: authManager assigned:', this.authManager);
        console.log('🔍 Auth UI: dataManager assigned:', this.dataManager);
        
        this.initializeStyles();
    }

    initializeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .auth-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .auth-container {
                background: var(--surface-color, #2a2a2a);
                border-radius: 12px;
                padding: 2rem;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                animation: slideUp 0.3s ease;
                position: relative;
            }

            @keyframes slideUp {
                from { 
                    transform: translateY(20px);
                    opacity: 0;
                }
                to { 
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            .auth-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                color: var(--text-secondary, #999);
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0.5rem;
                transition: color 0.3s;
            }

            .auth-close:hover {
                color: var(--text-primary, #fff);
            }

            .auth-header {
                text-align: center;
                margin-bottom: 2rem;
            }

            .auth-logo {
                width: 60px;
                height: 60px;
                margin: 0 auto 1rem;
                background: var(--primary-color, #00a8ff);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                color: white;
            }

            .auth-title {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--text-primary, #fff);
                margin-bottom: 0.5rem;
            }

            .auth-subtitle {
                color: var(--text-secondary, #999);
                font-size: 0.9rem;
            }

            .auth-form {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .auth-input-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .auth-label {
                color: var(--text-secondary, #999);
                font-size: 0.85rem;
                font-weight: 500;
            }

            .auth-input {
                background: var(--input-bg, #1a1a1a);
                border: 1px solid var(--border-color, #333);
                border-radius: 8px;
                padding: 0.75rem 1rem;
                color: var(--text-primary, #fff);
                font-size: 1rem;
                transition: all 0.3s;
            }

            .auth-input:focus {
                outline: none;
                border-color: var(--primary-color, #00a8ff);
                box-shadow: 0 0 0 3px rgba(0, 168, 255, 0.1);
            }

            .auth-button {
                background: var(--primary-color, #00a8ff);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0.75rem 1.5rem;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 0.5rem;
            }

            .auth-button:hover:not(:disabled) {
                background: var(--primary-hover, #0090dd);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 168, 255, 0.3);
            }

            .auth-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .auth-button-secondary {
                background: transparent;
                color: var(--primary-color, #00a8ff);
                border: 1px solid var(--primary-color, #00a8ff);
            }

            .auth-button-secondary:hover:not(:disabled) {
                background: rgba(0, 168, 255, 0.1);
            }

            .auth-divider {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin: 1.5rem 0;
                color: var(--text-secondary, #666);
                font-size: 0.85rem;
            }

            .auth-divider::before,
            .auth-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: var(--border-color, #333);
            }

            .auth-google-button {
                background: white;
                color: #333;
                border: 1px solid #ddd;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                font-weight: 500;
            }

            .auth-google-button:hover:not(:disabled) {
                background: #f5f5f5;
                border-color: #ccc;
            }

            .auth-google-icon {
                width: 20px;
                height: 20px;
            }

            .auth-error {
                background: rgba(255, 59, 48, 0.1);
                border: 1px solid rgba(255, 59, 48, 0.3);
                color: #ff3b30;
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 0.85rem;
                margin-bottom: 1rem;
            }

            .auth-success {
                background: rgba(52, 199, 89, 0.1);
                border: 1px solid rgba(52, 199, 89, 0.3);
                color: #34c759;
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 0.85rem;
                margin-bottom: 1rem;
            }

            .auth-link {
                color: var(--primary-color, #00a8ff);
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
            }

            .auth-link:hover {
                text-decoration: underline;
            }

            .auth-footer {
                text-align: center;
                margin-top: 1.5rem;
                color: var(--text-secondary, #999);
                font-size: 0.85rem;
            }

            .user-menu {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 0.5rem;
                background: var(--surface-color, #2a2a2a);
                border: 1px solid var(--border-color, #333);
                border-radius: 8px;
                padding: 0.5rem;
                min-width: 200px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000;
            }

            .user-menu-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem;
                border-radius: 6px;
                color: var(--text-primary, #fff);
                text-decoration: none;
                transition: background 0.2s;
                cursor: pointer;
            }

            .user-menu-item:hover {
                background: var(--hover-bg, rgba(255, 255, 255, 0.1));
            }

            .user-menu-divider {
                height: 1px;
                background: var(--border-color, #333);
                margin: 0.5rem 0;
            }

            .user-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--primary-color, #00a8ff);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .user-avatar:hover {
                transform: scale(1.05);
            }

            .user-avatar img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
        `;
        document.head.appendChild(style);
    }

    showLoginModal() {
        this.closeCurrentModal();
        
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-container">
                <button class="auth-close">&times;</button>
                <div class="auth-header">
                    <div class="auth-logo">🤖</div>
                    <h2 class="auth-title">Welcome Back</h2>
                    <p class="auth-subtitle">Sign in to access your saved runs</p>
                </div>
                
                <form class="auth-form" id="loginForm">
                    <div class="auth-input-group">
                        <label class="auth-label">Email</label>
                        <input type="email" class="auth-input" name="email" required placeholder="your@email.com">
                    </div>
                    
                    <div class="auth-input-group">
                        <label class="auth-label">Password</label>
                        <input type="password" class="auth-input" name="password" required placeholder="••••••••">
                    </div>
                    
                    <button type="submit" class="auth-button" id="loginButton">Sign In</button>
                    
                    <div class="auth-divider">OR</div>
                    
                    <button type="button" class="auth-button auth-google-button" id="googleSignIn">
                        <svg class="auth-google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    </button>
                </form>
                
                <div class="auth-footer">
                    Don't have an account? <a class="auth-link" id="showSignup">Sign up</a>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentModal = modal;

        // Event listeners
        modal.querySelector('.auth-close').addEventListener('click', () => this.closeCurrentModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeCurrentModal();
        });

        modal.querySelector('#showSignup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignupModal();
        });

        modal.querySelector('#googleSignIn').addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleGoogleSignIn();
        });

        modal.querySelector('#loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEmailLogin(e.target);
        });
    }

    showSignupModal() {
        this.closeCurrentModal();
        
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-container">
                <button class="auth-close">&times;</button>
                <div class="auth-header">
                    <div class="auth-logo">🚀</div>
                    <h2 class="auth-title">Create Account</h2>
                    <p class="auth-subtitle">Join CodLess to save your robot runs</p>
                </div>
                
                <form class="auth-form" id="signupForm">
                    <div class="auth-input-group">
                        <label class="auth-label">Display Name</label>
                        <input type="text" class="auth-input" name="displayName" required placeholder="Your Name">
                    </div>
                    
                    <div class="auth-input-group">
                        <label class="auth-label">Email</label>
                        <input type="email" class="auth-input" name="email" required placeholder="your@email.com">
                    </div>
                    
                    <div class="auth-input-group">
                        <label class="auth-label">Password</label>
                        <input type="password" class="auth-input" name="password" required placeholder="••••••••" minlength="6">
                    </div>
                    
                    <button type="submit" class="auth-button" id="signupButton">Create Account</button>
                    
                    <div class="auth-divider">OR</div>
                    
                    <button type="button" class="auth-button auth-google-button" id="googleSignUp">
                        <svg class="auth-google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign up with Google
                    </button>
                </form>
                
                <div class="auth-footer">
                    Already have an account? <a class="auth-link" id="showLogin">Sign in</a>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentModal = modal;

        // Event listeners
        modal.querySelector('.auth-close').addEventListener('click', () => this.closeCurrentModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeCurrentModal();
        });

        modal.querySelector('#showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginModal();
        });

        modal.querySelector('#googleSignUp').addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleGoogleSignIn();
        });

        modal.querySelector('#signupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEmailSignup(e.target);
        });
    }

    async handleEmailLogin(form) {
        const button = form.querySelector('#loginButton');
        const email = form.email.value;
        const password = form.password.value;

        button.disabled = true;
        button.textContent = 'Signing in...';

        // Remove any existing error messages
        this.clearMessages();

        const result = await this.authManager.signInWithEmail(email, password);

        if (result.success) {
            this.showSuccess('Successfully signed in!');
            setTimeout(() => this.closeCurrentModal(), 1500);
        } else {
            this.showError(result.error);
            button.disabled = false;
            button.textContent = 'Sign In';
        }
    }

    async handleEmailSignup(form) {
        const button = form.querySelector('#signupButton');
        const displayName = form.displayName.value;
        const email = form.email.value;
        const password = form.password.value;

        button.disabled = true;
        button.textContent = 'Creating account...';

        // Remove any existing error messages
        this.clearMessages();

        const result = await this.authManager.signUpWithEmail(email, password, displayName);

        if (result.success) {
            this.showSuccess('Account created successfully!');
            setTimeout(() => this.closeCurrentModal(), 1500);
        } else {
            this.showError(result.error);
            button.disabled = false;
            button.textContent = 'Create Account';
        }
    }

    async handleGoogleSignIn() {
        this.clearMessages();
        
        const result = await this.authManager.signInWithGoogle();

        if (result.success) {
            this.showSuccess('Successfully signed in with Google!');
            setTimeout(() => this.closeCurrentModal(), 1500);
        } else {
            this.showError(result.error);
        }
    }

    showError(message) {
        const container = this.currentModal?.querySelector('.auth-form');
        if (!container) return;

        const error = document.createElement('div');
        error.className = 'auth-error';
        error.textContent = message;
        container.insertBefore(error, container.firstChild);
    }

    showSuccess(message) {
        const container = this.currentModal?.querySelector('.auth-form');
        if (!container) return;

        const success = document.createElement('div');
        success.className = 'auth-success';
        success.textContent = message;
        container.insertBefore(success, container.firstChild);
    }

    clearMessages() {
        const messages = this.currentModal?.querySelectorAll('.auth-error, .auth-success');
        messages?.forEach(msg => msg.remove());
    }

    closeCurrentModal() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
    }

    createUserButton() {
        console.log('🔍 Auth UI: createUserButton called');
        console.log('🔍 Auth UI: authManager:', this.authManager);
        
        const user = this.authManager.getCurrentUser();
        console.log('🔍 Auth UI: Current user:', user);
        
        const button = document.createElement('div');
        button.className = 'user-avatar';
        button.id = 'userButton';
        
        if (user) {
            if (user.photoURL) {
                button.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'User'}">`;
            } else {
                const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
                button.textContent = initial;
            }
        } else {
            button.innerHTML = '<i class="fas fa-user"></i>';
        }

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (user) {
                this.showUserMenu(button);
            } else {
                this.showLoginModal();
            }
        });

        console.log('🔍 Auth UI: Created button element:', button);
        return button;
    }

    showUserMenu(button) {
        // Remove any existing menu
        const existingMenu = document.querySelector('.user-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const user = this.authManager.getCurrentUser();
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.innerHTML = `
            <div class="user-menu-item">
                <i class="fas fa-user-circle"></i>
                <div>
                    <div style="font-weight: 600;">${user.displayName || 'User'}</div>
                    <div style="font-size: 0.8rem; opacity: 0.7;">${user.email}</div>
                </div>
            </div>
            <div class="user-menu-divider"></div>
            <div class="user-menu-item" id="accountSettings">
                <i class="fas fa-cog"></i>
                <span>Account Settings</span>
            </div>
            <div class="user-menu-item" id="signOut">
                <i class="fas fa-sign-out-alt"></i>
                <span>Sign Out</span>
            </div>
        `;

        // Position the menu
        const buttonRect = button.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${buttonRect.bottom + 8}px`;
        menu.style.right = `${window.innerWidth - buttonRect.right}px`;

        document.body.appendChild(menu);

        // Event listeners
        menu.querySelector('#signOut').addEventListener('click', async () => {
            menu.remove();
            await this.authManager.signOut();
        });

        menu.querySelector('#accountSettings').addEventListener('click', () => {
            menu.remove();
            this.showAccountSettings();
        });

        // Close menu on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    }

    showAccountSettings() {
        // This would show account settings modal
        // For now, just show a simple alert
        alert('Account settings coming soon!');
    }
}

// Initialize AuthUI when the auth manager is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 Auth UI: DOMContentLoaded fired');
    
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    // Wait for Firebase to be initialized
    const checkAuth = setInterval(() => {
        attempts++;
        console.log('🔍 Auth UI: Checking for CodLessAuth...', window.CodLessAuth);
        
        if (window.CodLessAuth || attempts >= maxAttempts) {
            clearInterval(checkAuth);
            
            if (window.CodLessAuth) {
                console.log('✅ Auth UI: CodLessAuth found, initializing AuthUI');
            } else {
                console.warn('⚠️ Auth UI: CodLessAuth not found after timeout, creating fallback');
                // Create a fallback auth system if the main one didn't load
                window.CodLessAuth = {
                    authManager: {
                        getCurrentUser: () => null,
                        onAuthStateChange: (callback) => {},
                        signIn: async () => { throw new Error('Auth system not loaded'); },
                        signUp: async () => { throw new Error('Auth system not loaded'); },
                        signOut: async () => {}
                    },
                    dataManager: {}
                };
            }
            
            window.authUI = new AuthUI();
            
            // Add user button to the UI
            const userControls = document.getElementById('userControls');
            console.log('🔍 Auth UI: userControls element:', userControls);
            
            if (userControls) {
                const userButton = window.authUI.createUserButton();
                console.log('🔍 Auth UI: Created user button:', userButton);
                userControls.appendChild(userButton);
                
                // Update button when auth state changes
                if (window.CodLessAuth.authManager.onAuthStateChange) {
                    window.CodLessAuth.authManager.onAuthStateChange(() => {
                        console.log('🔍 Auth UI: Auth state changed, updating button');
                        const newButton = window.authUI.createUserButton();
                        userControls.innerHTML = '';
                        userControls.appendChild(newButton);
                    });
                }
            } else {
                console.error('❌ Auth UI: userControls element not found!');
            }
        }
    }, 100);
});

// Also try to initialize on window load as a fallback
window.addEventListener('load', () => {
    console.log('🔍 Auth UI: Window load event fired');
    
    // Check if auth UI was already initialized
    if (!window.authUI) {
        console.log('⚠️ Auth UI: Not initialized yet on window load, forcing initialization');
        
        // Force create the auth UI
        const userControls = document.getElementById('userControls');
        if (userControls && !userControls.querySelector('#userButton')) {
            // Create a minimal auth UI
            const button = document.createElement('div');
            button.className = 'user-avatar';
            button.id = 'userButton';
            button.innerHTML = '<i class="fas fa-user"></i>';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', () => {
                alert('Authentication system is still loading. Please refresh the page if this persists.');
            });
            
            userControls.appendChild(button);
            console.log('✅ Auth UI: Fallback button created');
        }
    }
});