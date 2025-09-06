// Animation System
// @ts-nocheck
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
                }
                else if (!entry.isIntersecting && !entry.target.hasAttribute('data-animate-once')) {
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
            // Ensure an inner wrapper exists so visual lift does not change hitbox
            if (!element.querySelector('.hover-lift-inner')) {
                const inner = document.createElement('span');
                inner.className = 'hover-lift-inner';
                // Move all existing child nodes into the inner wrapper
                while (element.firstChild) {
                    inner.appendChild(element.firstChild);
                }
                element.appendChild(inner);
            }
        });
    }
    addClickFeedback() {
        document.addEventListener('mousedown', (e) => {
            const clickable = e.target.closest('button, .btn, [role="button"]');
            if (clickable && !clickable.disabled) {
                const inner = clickable.querySelector('.hover-lift-inner');
                if (inner) {
                    // Preserve any translate from hover while scaling
                    const currentTransform = getComputedStyle(inner).transform;
                    inner.style.transform = currentTransform === 'none' ? 'scale(0.95)' : currentTransform + ' scale(0.95)';
                }
                else {
                    clickable.style.transform = 'scale(0.95)';
                }
            }
        });
        document.addEventListener('mouseup', () => {
            // Reset any inner wrappers first
            document.querySelectorAll('.hover-lift-inner[style*="scale(0.95)"]').forEach(node => {
                node.style.transform = '';
            });
            // Fallback reset if any clickable itself was scaled
            document.querySelectorAll('[style*="scale(0.95)"]').forEach(node => {
                if (!node.classList || !node.classList.contains('hover-lift-inner')) {
                    node.style.transform = '';
                }
            });
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
}
else {
    animationController = new AnimationController();
    window.AnimationController = animationController;
}
(function () {
    try {
        const btn = document.getElementById('enterAppBtn');
        if (!btn)
            return;
        const glow = btn.querySelector('.cta-glow');
        btn.addEventListener('pointermove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            if (glow)
                glow.style.setProperty('--mx', x + '%');
            if (glow)
                glow.style.setProperty('--my', y + '%');
        }, { passive: true });
    }
    catch (e) { }
})();
//# sourceMappingURL=animations.js.map