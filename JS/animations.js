// Animation System
'use strict';

// Animation Configuration
const AnimationConfig = {
    scrollThreshold: 0.15,
    rippleDuration: 600,
    pageTransitionDuration: 300,
    observerOptions: {
        root: null,
        rootMargin: '0px',
        threshold: [0, 0.15, 0.5, 1]
    }
};

// Scroll-based animations
class ScrollAnimationObserver {
    constructor() {
        this.observer = null;
        this.animatedElements = new Set();
        this.init();
    }

    init() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= AnimationConfig.scrollThreshold) {
                    entry.target.classList.add('in-view');
                    
                    if (entry.target.hasAttribute('data-animate-once')) {
                        this.observer.unobserve(entry.target);
                    }
                } else if (!entry.isIntersecting && !entry.target.hasAttribute('data-animate-once')) {
                    entry.target.classList.remove('in-view');
                }
            });
        }, AnimationConfig.observerOptions);

        this.observeElements();
    }

    observeElements() {
        const elements = document.querySelectorAll('[data-scroll-animation]');
        
        elements.forEach(element => {
            this.observer.observe(element);
            this.animatedElements.add(element);
        });
    }

    refresh() {
        this.observeElements();
    }

    destroy() {
        if (this.observer) {
            this.animatedElements.forEach(element => {
                this.observer.unobserve(element);
            });
            this.observer.disconnect();
        }
    }
}

// Ripple effect
class RippleEffect {
    constructor() {
        this.init();
    }

    init() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.btn, .window-btn, .tab-btn, .ripple-container, [data-ripple]');
            if (target) {
                this.createRipple(e, target);
            }
        });
    }

    createRipple(event, element) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, AnimationConfig.rippleDuration);
    }
}

// Micro interactions
class MicroInteractions {
    constructor() {
        this.init();
    }

    init() {
        this.addHoverEffects();
        this.addClickFeedback();
    }

    addHoverEffects() {
        const hoverElements = document.querySelectorAll('.btn, .tab-btn, .control-item');
        
        hoverElements.forEach(element => {
            if (!element.classList.contains('hover-scale')) {
                element.classList.add('hover-lift');
            }
        });
    }

    addClickFeedback() {
        document.addEventListener('mousedown', (e) => {
            const clickable = e.target.closest('button, .btn, [role="button"]');
            if (clickable && !clickable.disabled) {
                clickable.style.transform = 'scale(0.95)';
            }
        });

        document.addEventListener('mouseup', () => {
            const pressed = document.querySelector('[style*="scale(0.95)"]');
            if (pressed) {
                pressed.style.transform = '';
            }
        });
    }
}

// Animation controller
class AnimationController {
    constructor() {
        this.modules = {};
        this.init();
    }

    init() {
        this.modules.scrollObserver = new ScrollAnimationObserver();
        this.modules.ripple = new RippleEffect();
        this.modules.microInteractions = new MicroInteractions();
        
        this.playInitAnimation();
    }

    playInitAnimation() {
        const containers = document.querySelectorAll('.app-container, .sidebar, .main-container');
        
        containers.forEach((container, index) => {
            container.style.opacity = '0';
            container.classList.add('anim-fade-in-up');
            
            setTimeout(() => {
                container.style.opacity = '';
            }, index * 100);
        });
    }
}

// Initialize animation system when DOM is ready
let animationController;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        animationController = new AnimationController();
        window.AnimationController = animationController;
    });
} else {
    animationController = new AnimationController();
    window.AnimationController = animationController;
}
