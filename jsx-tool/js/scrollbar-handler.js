// Handle scrollbar visibility on hover for console component elements
document.addEventListener('DOMContentLoaded', function() {
    const scrollableElements = [
        '.main-tree-branch',
        '.code-content',
        '.css-code-wrapper'
    ];

    scrollableElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.addEventListener('mouseenter', function() {
                this.classList.add('scrollbar-visible');
            });
            
            element.addEventListener('mouseleave', function() {
                this.classList.remove('scrollbar-visible');
            });
        });
    });
});
