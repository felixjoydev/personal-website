// JSX Tool Landing Page Script
// Includes GSAP gradient animations and browser demo functionality

// ===================
// GSAP Gradient Animations
// ===================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize subtle gradient orb animations
    initGradientAnimations();
    
    // Initialize browser demo
    initBrowserDemo();
});

function initGradientAnimations() {
    // Check if GSAP is loaded
    if (typeof gsap === 'undefined') {
        console.warn('GSAP not loaded, skipping gradient animations');
        return;
    }

    // Animate gradient orb 1 - slow circular drift
    gsap.to('.gradient-orb-1', {
        x: '+=80',
        y: '+=60',
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });

    // Animate gradient orb 2 - different pattern
    gsap.to('.gradient-orb-2', {
        x: '-=60',
        y: '+=80',
        duration: 15,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });

    // Animate gradient orb 3 - subtle horizontal drift
    gsap.to('.gradient-orb-3', {
        x: '+=100',
        y: '-=40',
        duration: 18,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
    });

    // Subtle opacity pulsing for depth effect
    gsap.to('.gradient-orb-1', {
        opacity: 0.35,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
    });

    gsap.to('.gradient-orb-2', {
        opacity: 0.25,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: 2
    });

    gsap.to('.gradient-orb-3', {
        opacity: 0.3,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: 4
    });
}

// ===================
// Browser Demo Functionality
// ===================

function initBrowserDemo() {
    // State
    let cardState = 'initial';
    let consoleVisible = false;
    let consoleHeight = null;
    let isResizing = false;
    let resizeStartY = 0;
    let resizeStartHeight = 0;

    // Elements
    const browserSection = document.getElementById('browserSection');
    const consoleOverlay = document.getElementById('consoleOverlay');
    const initialCard = document.querySelector('.login-card-initial');
    const updatedCard = document.querySelector('.login-card-updated');

    // Initialize card state
    if (initialCard) {
        initialCard.classList.add('active');
    }

    // Scroll detection to show console
    window.addEventListener('scroll', () => {
        if (!browserSection) return;
        
        const rect = browserSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // When browser section is visible (30% from top), show console
        if (rect.top <= windowHeight * 0.3 && rect.bottom > 100) {
            if (!consoleVisible && consoleOverlay) {
                consoleVisible = true;
                consoleOverlay.classList.add('visible');
            }
        }
    });

    // Card state swap
    function swapCardState() {
        if (!initialCard || !updatedCard) return;
        
        if (cardState === 'initial') {
            initialCard.classList.remove('active');
            updatedCard.classList.add('active');
            cardState = 'updated';
        } else {
            updatedCard.classList.remove('active');
            initialCard.classList.add('active');
            cardState = 'initial';
        }
    }

    // Expose globally
    window.swapBrowserCardState = swapCardState;

    // Direct click handler for send button
    document.addEventListener('click', (e) => {
        if (e.target.closest('#sendButton') || e.target.closest('.send-button')) {
            swapCardState();
        }
    });

    // Console resize handlers
    const resizeHandle = document.querySelector('.resize-handle-top');
    const consoleComponent = document.querySelector('.console-jsx-component');

    if (resizeHandle && consoleComponent) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            resizeStartY = e.clientY;
            resizeStartHeight = consoleComponent.offsetHeight;
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isResizing && consoleComponent) {
            const deltaY = resizeStartY - e.clientY;
            const calculatedHeight = resizeStartHeight + deltaY;
            const newHeight = Math.max(200, Math.min(450, calculatedHeight));
            consoleHeight = newHeight;
            consoleComponent.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Press 'S' to swap card state
        if (e.key === 's' || e.key === 'S') {
            swapCardState();
        }
        
        // Press 'C' to toggle console
        if ((e.key === 'c' || e.key === 'C') && consoleOverlay) {
            consoleVisible = !consoleVisible;
            if (consoleVisible) {
                consoleOverlay.classList.add('visible');
            } else {
                consoleOverlay.classList.remove('visible');
            }
        }
    });
}
