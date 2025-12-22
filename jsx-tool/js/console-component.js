// Console Component JavaScript
// This file will handle interactions for the console component

console.log('Console component loaded');

// Resizable Panel Functionality (Horizontal)
(function initializeResizablePanels() {
    const jsxLeft = document.querySelector('.jsx-left');
    const jsxRight = document.querySelector('.jsx-right');
    const jsxCenter = document.querySelector('.jsx-center');
    const leftHandle = document.querySelector('.resize-handle-right');
    const rightHandle = document.querySelector('.resize-handle-left');
    
    let isResizingLeft = false;
    let isResizingRight = false;
    let startX = 0;
    let startWidth = 0;
    
    // Left panel resize
    if (leftHandle && jsxLeft) {
        leftHandle.addEventListener('mousedown', function(e) {
            isResizingLeft = true;
            startX = e.clientX;
            startWidth = jsxLeft.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    }
    
    // Right panel resize
    if (rightHandle && jsxRight) {
        rightHandle.addEventListener('mousedown', function(e) {
            isResizingRight = true;
            startX = e.clientX;
            startWidth = jsxRight.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    }
    
    // Mouse move handler
    document.addEventListener('mousemove', function(e) {
        if (isResizingLeft) {
            const delta = e.clientX - startX;
            const newWidth = startWidth + delta;
            const minWidth = parseInt(getComputedStyle(jsxLeft).minWidth);
            const maxWidth = parseInt(getComputedStyle(jsxLeft).maxWidth);
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                jsxLeft.style.width = newWidth + 'px';
            }
        }
        
        if (isResizingRight) {
            const delta = startX - e.clientX; // Reversed for right panel
            const newWidth = startWidth + delta;
            const minWidth = parseInt(getComputedStyle(jsxRight).minWidth);
            const maxWidth = parseInt(getComputedStyle(jsxRight).maxWidth);
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                jsxRight.style.width = newWidth + 'px';
            }
        }
    });
    
    // Mouse up handler
    document.addEventListener('mouseup', function() {
        if (isResizingLeft || isResizingRight) {
            isResizingLeft = false;
            isResizingRight = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
})();

// Vertical Resize Functionality (like Chrome DevTools)
(function initializeVerticalResize() {
    const consoleComponent = document.querySelector('.console-jsx-component');
    const topHandle = document.querySelector('.resize-handle-top');
    
    if (!consoleComponent || !topHandle) return;
    
    let isResizingVertical = false;
    let startY = 0;
    let startHeight = 0;
    const minHeight = 200; // Minimum console height
    const maxHeight = 450; // Maximum console height
    
    topHandle.addEventListener('mousedown', function(e) {
        isResizingVertical = true;
        startY = e.clientY;
        startHeight = consoleComponent.offsetHeight;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizingVertical) return;
        
        // Dragging up increases height, dragging down decreases height
        const delta = startY - e.clientY;
        const newHeight = startHeight + delta;
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
            consoleComponent.style.height = newHeight + 'px';
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizingVertical) {
            isResizingVertical = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
    
    // Update maxHeight on window resize
    window.addEventListener('resize', function() {
        const currentMaxHeight = 450;
        if (consoleComponent.offsetHeight > currentMaxHeight) {
            consoleComponent.style.height = currentMaxHeight + 'px';
        }
    });
})();

// Responsive Tab Overflow Handler - Progressive hiding from right
(function handleTabOverflow() {
    const tabsContainer = document.querySelector('.console-header-tabs');
    const overflowBtn = document.querySelector('.tab-overflow-btn');
    const tabItems = Array.from(document.querySelectorAll('.tab-item'));
    const jsxTabHighlighted = document.querySelector('.jsx-tab-highlighted');
    
    function checkOverflow() {
        if (!tabsContainer || !overflowBtn || tabItems.length === 0 || !jsxTabHighlighted) return;
        
        // Show all tabs initially
        tabItems.forEach(tab => tab.style.display = '');
        overflowBtn.style.display = 'none';
        
        // Wait for layout to settle
        setTimeout(() => {
            const containerRect = tabsContainer.getBoundingClientRect();
            const containerRight = containerRect.right;
            const overflowBtnWidth = 30;
            
            // Get all tabs sorted by priority (highest priority = hide first)
            const sortedTabs = tabItems
                .map(tab => ({
                    element: tab,
                    priority: parseInt(tab.getAttribute('data-priority') || '0')
                }))
                .sort((a, b) => b.priority - a.priority);
            
            let hasHiddenTabs = false;
            
            // Check each tab from highest priority (rightmost)
            for (let i = 0; i < sortedTabs.length; i++) {
                const tab = sortedTabs[i].element;
                const tabRect = tab.getBoundingClientRect();
                
                // Calculate if tab extends beyond container (accounting for overflow button if needed)
                const availableSpace = hasHiddenTabs ? containerRight - overflowBtnWidth - 10 : containerRight;
                
                if (tabRect.right > availableSpace) {
                    tab.style.display = 'none';
                    hasHiddenTabs = true;
                }
            }
            
            // Show overflow button if any tabs are hidden
            if (hasHiddenTabs) {
                overflowBtn.style.display = 'flex';
                
                // Re-check if showing the button caused more overflow
                setTimeout(() => {
                    sortedTabs.forEach(({ element }) => {
                        if (element.style.display !== 'none') {
                            const rect = element.getBoundingClientRect();
                            const overflowBtnRect = overflowBtn.getBoundingClientRect();
                            if (rect.right > overflowBtnRect.left - 5) {
                                element.style.display = 'none';
                            }
                        }
                    });
                }, 10);
            }
        }, 50);
    }
    
    // Debounced resize handler
    let resizeTimer;
    function handleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(checkOverflow, 100);
    }
    
    // Initial check
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkOverflow);
    } else {
        setTimeout(checkOverflow, 300);
    }
    
    window.addEventListener('resize', handleResize);
})();

// Example: Handle code highlighting animations (to be implemented)
function animateCodeHighlight() {
    // Implementation will go here
}

// Tree Folder Collapse/Expand Functionality
(function initializeTreeFolders() {
    const folderToggles = document.querySelectorAll('.tree-folder-toggle');
    
    folderToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const isExpanded = this.getAttribute('data-expanded') === 'true';
            const childrenElement = this.nextElementSibling;
            
            if (!childrenElement || !childrenElement.classList.contains('tree-children')) {
                return;
            }
            
            if (isExpanded) {
                // Collapse
                this.setAttribute('data-expanded', 'false');
                childrenElement.style.display = 'none';
            } else {
                // Expand
                this.setAttribute('data-expanded', 'true');
                childrenElement.style.display = '';
            }
        });
    });
})();

// Handle chat send functionality
// Replace informative-icon <img> Figma reload asset with inline SVG when it appears
document.addEventListener('DOMContentLoaded', () => {
    const replaceWithReloadSVG = (target) => {
        if (!target) return;
        if (target.tagName && target.tagName.toLowerCase() === 'svg') return;
        const wrapper = document.createElement('span');
        wrapper.className = target.className || 'informative-icon';
        wrapper.innerHTML = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1ZM15.5 12C15.5 13.933 13.933 15.5 12 15.5C11.1505 15.5 10.3705 15.1978 9.76367 14.6934L10.3535 14.1035C10.4965 13.9605 10.5393 13.7454 10.4619 13.5586C10.3845 13.3718 10.2022 13.25 10 13.25H7.5C7.22386 13.25 7 13.4739 7 13.75V16.25C7.00001 16.4522 7.1218 16.6345 7.30859 16.7119C7.49542 16.7893 7.71052 16.7465 7.85352 16.6035L8.34668 16.1113C9.31761 16.9747 10.5971 17.5 12 17.5C15.0376 17.5 17.5 15.0376 17.5 12H15.5ZM12 6.5C8.96244 6.5 6.50002 8.96245 6.5 12H8.5C8.50002 10.067 10.067 8.5 12 8.5C12.8495 8.5 13.6295 8.80227 14.2363 9.30664L13.6465 9.89648C13.5035 10.0395 13.4607 10.2546 13.5381 10.4414C13.6155 10.6282 13.7978 10.75 14 10.75H16.5C16.7761 10.75 17 10.5261 17 10.25V7.75C17 7.54779 16.8782 7.36549 16.6914 7.28809C16.5046 7.2107 16.2895 7.25349 16.1465 7.39648L15.6533 7.88965C14.6823 7.02599 13.4031 6.5 12 6.5Z" fill="url(#paint0_linear_89_9509)"/>
<defs>
<linearGradient id="paint0_linear_89_9509" x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
<stop stop-color="#8937F0"/>
<stop offset="1" stop-color="#611CB8"/>
</linearGradient>
</defs>
</svg>`;
        target.replaceWith(wrapper);
    };

    const parent = document.body;
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.matches && node.matches('.informative-icon')) {
                    if (node.tagName.toLowerCase() === 'img' && /figma\.com\/api\/mcp\/asset/.test(node.src)) {
                        replaceWithReloadSVG(node);
                    }
                }
                const found = node.querySelectorAll && node.querySelectorAll('.informative-icon');
                if (found && found.length) {
                    found.forEach(el => {
                        if (el.tagName.toLowerCase() === 'img' && /figma\.com\/api\/mcp\/asset/.test(el.src)) {
                            replaceWithReloadSVG(el);
                        }
                    });
                }
            }
            if (m.type === 'attributes' && m.target && m.target.matches && m.target.matches('.informative-icon')) {
                const t = m.target;
                if (t.tagName.toLowerCase() === 'img' && /figma\.com\/api\/mcp\/asset/.test(t.src)) {
                    replaceWithReloadSVG(t);
                }
            }
        }
    });

    observer.observe(parent, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    const existing = document.querySelector('.informative-icon');
    if (existing && existing.tagName.toLowerCase() === 'img' && /figma\.com\/api\/mcp\/asset/.test(existing.src)) {
        replaceWithReloadSVG(existing);
    }
});

function handleChatSend() {
    // Notify parent window (demo.html) that send was clicked
    if (window.parent !== window) {
        window.parent.postMessage('sendClicked', '*');
    }
    
    // Also call global function if available
    if (window.parent.swapBrowserCardState) {
        window.parent.swapBrowserCardState();
    }
}

// Attach send button click handler
(function initializeSendButton() {
    document.addEventListener('DOMContentLoaded', () => {
        // Find the second action-icon (send button)
        const actionIcons = document.querySelectorAll('.action-icon');
        if (actionIcons.length >= 2) {
            const sendButton = actionIcons[1]; // Second icon is the send button
            sendButton.style.cursor = 'pointer';
            sendButton.addEventListener('click', handleChatSend);
        }
    });
})();