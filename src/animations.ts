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
                } else {
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

// Liquid glass cursor spotlight and 3D tilt
class Tilt3D {
    constructor() {
        this.tiltElements = new Set<HTMLElement>();
        this.maxTiltDeg = 8;
        this.isPerfLite = false;
        this.pointer = { x: 0, y: 0 };
        this.currentTarget = null as HTMLElement | null;
        this.init();
    }

    init() {
        this.isPerfLite = document.body.classList.contains('perf-lite');
        if (this.isPerfLite) return; // Skip heavy interactions

        // Observe DOM additions if needed later
        this.addHandlersToExisting();
        const observer = new MutationObserver(() => this.addHandlersToExisting());
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
    }

    addHandlersToExisting() {
        document.querySelectorAll<HTMLElement>('.tilt-3d').forEach((el) => {
            if (this.tiltElements.has(el)) return;
            this.tiltElements.add(el);

            // Ensure a glow child exists
            if (!el.querySelector('.tilt-glow')) {
                const glow = document.createElement('span');
                glow.className = 'tilt-glow';
                el.appendChild(glow);
            }

            el.addEventListener('pointermove', (e) => this.onPointerMove(e as PointerEvent, el), { passive: true });
            el.addEventListener('pointerleave', () => this.reset(el), { passive: true });
        });
    }

    onPointerMove(e: PointerEvent, el: HTMLElement) {
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.currentTarget = el;
        this.applyTilt();
    }

    applyTilt() {
        const el = this.currentTarget;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const relX = (this.pointer.x - rect.left) / Math.max(1, rect.width);
        const relY = (this.pointer.y - rect.top) / Math.max(1, rect.height);
        const dx = (relX - 0.5);
        const dy = (relY - 0.5);
        const rotateY = -dx * this.maxTiltDeg;
        const rotateX = dy * this.maxTiltDeg;

        // Update CSS variables for glow positioning
        el.style.setProperty('--mx', `${relX * 100}%`);
        el.style.setProperty('--my', `${relY * 100}%`);

        // Apply transform with perspective - more responsive with higher precision
        el.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(1)}deg) rotateY(${rotateY.toFixed(1)}deg)`;
    }

    reset(el: HTMLElement) {
        el.style.transform = '';
        el.style.setProperty('--mx', '');
        el.style.setProperty('--my', '');
    }
}

class CursorSpotlight {
    constructor() {
        this.targets = new Set<HTMLElement>();
        this.isPerfLite = document.body.classList.contains('perf-lite');
        this.init();
    }

    init() {
        this.addHandlersToExisting();
        const observer = new MutationObserver(() => this.addHandlersToExisting());
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
    }

    addHandlersToExisting() {
        document.querySelectorAll<HTMLElement>('.liquid-glass').forEach((el) => {
            if (this.targets.has(el)) return;
            this.targets.add(el);

            const onMove = (e: PointerEvent) => {
                const rect = el.getBoundingClientRect();
                const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
                const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
                el.style.setProperty('--mx', `${(relX * 100).toFixed(2)}%`);
                el.style.setProperty('--my', `${(relY * 100).toFixed(2)}%`);
                if (!this.isPerfLite) el.style.setProperty('--spotlight-alpha', '0.10');
            };
            const onLeave = () => {
                el.style.removeProperty('--spotlight-alpha');
            };
            el.addEventListener('pointermove', onMove as EventListener, { passive: true });
            el.addEventListener('pointerleave', onLeave as EventListener, { passive: true });
        });
    }
}

class DOMDecorator {
    constructor() {
        this.decorate();
    }

    decorate() {
        try {
            // Apply liquid glass to core surfaces
            const glassSelectors = [
                '.content-section',
                '.sidebar-section',
                '.simulator-container',
                '.modal-content',
                '.toast',
                '.home-hero',
                '.model-card',
                '.status-display'
            ];
            glassSelectors.forEach(sel => {
                document.querySelectorAll<HTMLElement>(sel).forEach(el => el.classList.add('liquid-glass'));
            });

            // Apply tilt to select cards/panels (excluding modals to prevent unwanted movement)
            const tiltSelectors = [
                '.model-card',
                '.content-section',
                '.sidebar-section'
            ];
            tiltSelectors.forEach(sel => {
                document.querySelectorAll<HTMLElement>(sel).forEach(el => el.classList.add('tilt-3d'));
            });

            // Ensure ripple on buttons
            document.querySelectorAll<HTMLElement>('.btn, .window-btn, .tab-btn').forEach(el => {
                el.setAttribute('data-ripple', '');
            });

            // Add scroll animation attributes if missing
            document.querySelectorAll<HTMLElement>('.sidebar-section').forEach(el => {
                if (!el.hasAttribute('data-scroll-animation')) el.setAttribute('data-scroll-animation', 'fade-right');
            });
            document.querySelectorAll<HTMLElement>('.content-section, .simulator-container, .control-group, .status-display').forEach(el => {
                if (!el.hasAttribute('data-scroll-animation')) el.setAttribute('data-scroll-animation', '');
            });
        } catch (_) {}
    }
}

// Animation controller
class AnimationController {
    constructor() {
        this.modules = {};
        this.init();
    }

    init() {
        // Decorate DOM first so observers/enhancers see classes/attrs
        this.modules.domDecorator = new DOMDecorator();
        this.modules.scrollObserver = new ScrollAnimationObserver();
        this.modules.ripple = new RippleEffect();
        this.modules.microInteractions = new MicroInteractions();
        this.modules.cursorSpotlight = new CursorSpotlight();
        this.modules.tilt3d = new Tilt3D();
        
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

(function(){
    try {
        const btn = document.getElementById('enterAppBtn');
        if(!btn) return;
        const glow = btn.querySelector('.cta-glow');
        btn.addEventListener('pointermove', (e)=>{
            const rect = btn.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            if(glow) glow.style.setProperty('--mx', x + '%');
            if(glow) glow.style.setProperty('--my', y + '%');
        }, {passive:true});
    } catch(e) {}
})();
