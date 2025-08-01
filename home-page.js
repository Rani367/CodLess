// Home Page 3D Animations and Interactions
let scene, camera, renderer;
let controller, particles;
let mouseX = 0, mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Initialize 3D Scene
function init3D() {
    const container = document.getElementById('canvas-container');
    
    // Scene setup
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0f0c29, 1, 1000);
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 50;
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x00f2fe, 1);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0x764ba2, 1, 100);
    pointLight.position.set(20, 20, 20);
    scene.add(pointLight);
    
    // Load Xbox Controller Model
    const loader = new THREE.GLTFLoader();
    loader.load('White XBOX controller.glb', (gltf) => {
        controller = gltf.scene;
        controller.scale.set(15, 15, 15);
        controller.position.set(0, 0, 0);
        
        // Add emissive material for glow effect
        controller.traverse((child) => {
            if (child.isMesh) {
                child.material.emissive = new THREE.Color(0x00f2fe);
                child.material.emissiveIntensity = 0.1;
            }
        });
        
        scene.add(controller);
    });
    
    // Create particle system
    createParticles();
    
    // Create floating shapes
    window.floatingShapes = createFloatingShapes();
    
    // Mouse move event
    document.addEventListener('mousemove', onDocumentMouseMove);
    
    // Window resize event
    window.addEventListener('resize', onWindowResize);
}

// Create floating particles
function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const sizes = [];
    
    for (let i = 0; i < 1000; i++) {
        vertices.push(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100
        );
        sizes.push(Math.random() * 2);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: true,
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

// Create floating geometric shapes
function createFloatingShapes() {
    const shapes = [];
    
    // Create floating cube
    const cubeGeometry = new THREE.BoxGeometry(5, 5, 5);
    const cubeMaterial = new THREE.MeshPhongMaterial({
        color: 0x667eea,
        emissive: 0x667eea,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.8
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(-30, 15, -20);
    scene.add(cube);
    shapes.push({ mesh: cube, rotationSpeed: { x: 0.01, y: 0.01 } });
    
    // Create floating sphere
    const sphereGeometry = new THREE.SphereGeometry(4, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
        color: 0xf093fb,
        emissive: 0xf093fb,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(35, -10, -25);
    scene.add(sphere);
    shapes.push({ mesh: sphere, rotationSpeed: { x: 0.005, y: 0.01 } });
    
    // Create floating pyramid
    const pyramidGeometry = new THREE.ConeGeometry(5, 8, 4);
    const pyramidMaterial = new THREE.MeshPhongMaterial({
        color: 0x00f2fe,
        emissive: 0x00f2fe,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.8
    });
    const pyramid = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
    pyramid.position.set(25, 20, -30);
    scene.add(pyramid);
    shapes.push({ mesh: pyramid, rotationSpeed: { x: 0.008, y: 0.006 } });
    
    return shapes;
}

// Mouse move handler
function onDocumentMouseMove(event) {
    mouseX = (event.clientX - windowHalfX) / 100;
    mouseY = (event.clientY - windowHalfY) / 100;
}

// Window resize handler
function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate controller based on mouse position
    if (controller) {
        controller.rotation.x += (mouseY * 0.5 - controller.rotation.x) * 0.05;
        controller.rotation.y += (mouseX * 0.5 - controller.rotation.y) * 0.05;
        controller.rotation.z += 0.001;
    }
    
    // Animate particles
    if (particles) {
        particles.rotation.x += 0.0005;
        particles.rotation.y += 0.0005;
        
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.01;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Animate floating shapes
    if (window.floatingShapes) {
        window.floatingShapes.forEach((shape, index) => {
            shape.mesh.rotation.x += shape.rotationSpeed.x;
            shape.mesh.rotation.y += shape.rotationSpeed.y;
            
            // Floating motion
            shape.mesh.position.y += Math.sin(Date.now() * 0.001 + index) * 0.02;
            shape.mesh.position.x += Math.cos(Date.now() * 0.0008 + index) * 0.01;
        });
    }
    
    renderer.render(scene, camera);
}

// GSAP Scroll Animations
function initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);
    
    // Hero text animation
    gsap.timeline({
        scrollTrigger: {
            trigger: ".hero-section",
            start: "top top",
            end: "bottom top",
            scrub: 1
        }
    })
    .to(".hero-title", { y: -100, opacity: 0.5 })
    .to(".hero-subtitle", { y: -80, opacity: 0.3 }, "<0.1")
    .to(".hero-description", { y: -60, opacity: 0.2 }, "<0.1");
    
    // Parallax effect for feature cards
    gsap.utils.toArray(".feature-card").forEach((card) => {
        const speed = card.dataset.speed || 0.5;
        
        gsap.to(card, {
            y: -100 * speed,
            scrollTrigger: {
                trigger: ".features-section",
                start: "top bottom",
                end: "bottom top",
                scrub: 1
            }
        });
    });
    
    // Feature cards entrance animation
    gsap.utils.toArray(".feature-card").forEach((card, index) => {
        gsap.from(card, {
            y: 100,
            opacity: 0,
            duration: 1,
            delay: index * 0.2,
            scrollTrigger: {
                trigger: card,
                start: "top 80%",
                toggleActions: "play none none reverse"
            }
        });
    });
    
    // CTA button animation
    gsap.from(".cta-button", {
        scale: 0,
        opacity: 0,
        duration: 1.5,
        ease: "elastic.out(1, 0.5)",
        scrollTrigger: {
            trigger: ".cta-section",
            start: "top 50%"
        }
    });
    
    // Gradient orbs animation
    gsap.utils.toArray(".gradient-orb").forEach((orb) => {
        gsap.to(orb, {
            x: "random(-100, 100)",
            y: "random(-100, 100)",
            duration: "random(15, 25)",
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
    });
}

// Initialize home page
function initHomePage() {
    // Hide main app initially
    const appContainer = document.getElementById('appContainer');
    appContainer.style.display = 'none';
    
    // Initialize 3D scene
    init3D();
    animate();
    
    // Initialize scroll animations
    initScrollAnimations();
    
    // CTA button click handler
    const enterButton = document.getElementById('enterApp');
    enterButton.addEventListener('click', () => {
        const homePage = document.getElementById('homePage');
        
        // Animate out home page
        gsap.to(homePage, {
            opacity: 0,
            y: -100,
            duration: 0.8,
            ease: "power2.inOut",
            onComplete: () => {
                homePage.classList.add('hidden');
                appContainer.style.display = 'block';
                
                // Animate in app container
                gsap.from(appContainer, {
                    opacity: 0,
                    y: 50,
                    duration: 0.6,
                    ease: "power2.out"
                });
            }
        });
    });
    
    // Add entrance animations
    gsap.from(".hero-title .title-word", {
        y: 100,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out"
    });
    
    gsap.from(".hero-subtitle", {
        y: 50,
        opacity: 0,
        duration: 1,
        delay: 0.5,
        ease: "power3.out"
    });
    
    gsap.from(".hero-description", {
        y: 30,
        opacity: 0,
        duration: 1,
        delay: 0.8,
        ease: "power3.out"
    });
    
    gsap.from(".scroll-indicator", {
        y: -30,
        opacity: 0,
        duration: 1,
        delay: 1.2,
        ease: "power3.out"
    });
}

// Wait for DOM to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomePage);
} else {
    initHomePage();
}