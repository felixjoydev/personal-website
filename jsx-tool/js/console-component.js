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