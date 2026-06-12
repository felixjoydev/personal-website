// Code Typer Animation Module
// Simulates AI-driven code generation with character streaming and pink glow effect

class CodeTyper {
    constructor(options = {}) {
        this.speed = options.speed || 100; // characters per second
        this.tailLength = options.tailLength || 40; // number of characters with glow effect
        this.duration = options.duration || 1.5; // glow cooldown duration in seconds
        this.onComplete = options.onComplete || null;
        this.streamInterval = null;
        this.currentIndex = 0;
    }

    async typeCode(targetElement, code, preserveSyntax = true) {
        return new Promise((resolve) => {
            // Clear existing content
            targetElement.innerHTML = '';
            this.currentIndex = 0;

            // Create cursor element
            const cursor = document.createElement('span');
            cursor.className = 'typing-cursor';
            cursor.style.cssText = `
                display: inline-block;
                width: 0.6em;
                height: 1.2em;
                vertical-align: middle;
                margin-left: 2px;
                background-color: #ec4899;
                border-radius: 2px;
                box-shadow: 0 0 10px rgba(236, 72, 153, 0.8);
                animation: cursorBlink 1s step-end infinite;
            `;
            
            const intervalTime = 1000 / this.speed;

            this.streamInterval = setInterval(() => {
                // Add random variance (1-2 characters per interval)
                const charsToAdd = Math.floor(Math.random() * 2) + 1;
                const nextIndex = Math.min(this.currentIndex + charsToAdd, code.length);

                if (this.currentIndex < code.length) {
                    const newChunk = code.slice(this.currentIndex, nextIndex);
                    
                    // Remove cursor temporarily
                    if (cursor.parentNode) {
                        cursor.remove();
                    }

                    // Add new characters with glow effect
                    for (let i = 0; i < newChunk.length; i++) {
                        const char = newChunk[i];
                        const charSpan = document.createElement('span');
                        charSpan.className = 'animate-glow';
                        charSpan.textContent = char;
                        charSpan.style.display = 'inline';
                        targetElement.appendChild(charSpan);
                    }

                    // Re-add cursor
                    targetElement.appendChild(cursor);
                    this.currentIndex = nextIndex;

                    // Auto-scroll to bottom during typing
                    const scrollContainer = targetElement.closest('.css-code-wrapper') || targetElement.parentElement;
                    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    }
                } else {
                    // Animation complete
                    clearInterval(this.streamInterval);
                    cursor.remove();

                    // Apply syntax highlighting if needed
                    if (preserveSyntax) {
                        // Remove glow classes after animation
                        setTimeout(() => {
                            const glowSpans = targetElement.querySelectorAll('.animate-glow');
                            glowSpans.forEach(span => {
                                span.classList.remove('animate-glow');
                                span.style.display = 'inline';
                            });
                        }, this.duration * 1000);
                    }

                    resolve();
                    if (this.onComplete) {
                        this.onComplete();
                    }
                }
            }, intervalTime);
        });
    }

    stop() {
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
        }
    }
}

// Global animation state
window.codeAnimationState = {
    isAnimating: false,
    hasAnimated: false
};

// Main animation orchestrator
async function startCodeTransformAnimation() {
    // Prevent multiple executions
    if (window.codeAnimationState.isAnimating || window.codeAnimationState.hasAnimated) {
        return;
    }

    window.codeAnimationState.isAnimating = true;

    // Get elements
    const codeContent = document.querySelector('.code-content');
    const cssCode = document.querySelector('.css-code');
    const signUpBtn = document.getElementById('signUpBtn');
    const sendButton = document.getElementById('sendButton');
    const chatAttachment = document.querySelector('.chat-attachment');
    const chatPlaceholder = document.querySelector('.chat-placeholder');

    // Step 1: Immediately remove all highlight-line elements and reset chat box
    const highlightedLines = codeContent.querySelectorAll('.highlight-line');
    highlightedLines.forEach(line => {
        const parent = line.parentNode;
        while (line.firstChild) {
            parent.insertBefore(line.firstChild, line);
        }
        line.remove();
    });

    // Add animating class to sign-up button for border animation
    if (signUpBtn) {
        signUpBtn.classList.add('animating');
    }

    // Hide informative element immediately
    let informativeElement = document.getElementById('informativeElement');
    if (informativeElement) {
        informativeElement.style.display = 'none';
    }

    // Reset chat box immediately (don't wait for animation)
    if (chatAttachment) {
        chatAttachment.remove();
    }

    if (chatPlaceholder) {
        chatPlaceholder.textContent = 'Make file edits to LoginLayout.tsk, @tag elements for context';
        chatPlaceholder.style.color = '#422D57';
        chatPlaceholder.style.background = 'none';
        chatPlaceholder.style.backgroundClip = 'unset';
        chatPlaceholder.style.webkitBackgroundClip = 'unset';
        chatPlaceholder.style.webkitTextFillColor = 'unset';
        chatPlaceholder.style.animation = 'none';
    }

    // Change send button color immediately and stop animation
    const sendButtonPath = sendButton.querySelector('path');
    if (sendButtonPath) {
        sendButtonPath.setAttribute('fill', '#6B4C8D');
    }
    
    // Remove gradient defs if exists
    const sendButtonDefs = sendButton.querySelector('defs');
    if (sendButtonDefs) {
        sendButtonDefs.remove();
    }

    // Stop pulse animation
    sendButton.style.animation = 'none';

    // Step 2: Don't toggle button yet, will do after animation

    // Step 3: Disable send button during animation
    sendButton.style.pointerEvents = 'none';
    sendButton.style.opacity = '0.6';

    // CSS code to type (btn-primary styles)
    const newCSSCode = `.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  font-family: 'Alpha Lyrae', sans-serif;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.btn-primary {
  background: linear-gradient(to bottom, #5b1ea7, #380f6c);
  border: 1px solid #4c198c;
  border-radius: 100px;
  color: white;
}

.btn-primary::before {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0px 1px 2px 0px rgba(44, 12, 83, 0.5);
  pointer-events: none;
  border-radius: 100px;
}`;

    // Updated JSX code (line 3 shows variant === "primary")
    const newJSXCode = `export default function Button({ variant, children, onClick }) {
  const baseClass = "btn";
  const variantClass = variant === "primary" ? "btn-primary" : "btn-secondary";

  return (
    <button
      className={\`\${baseClass} \${variantClass}\`}
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  );
}`;

    // Step 4: Animate CSS code
    const cssTyper = new CodeTyper({ speed: 100, tailLength: 40, duration: 1.5 });
    await cssTyper.typeCode(cssCode, newCSSCode, false);

    // Step 4.5: Toggle sign-up button after CSS typing completes
    if (typeof toggleSignUpBtn === 'function') {
        // Remove animating class before toggling to active state
        if (signUpBtn) {
            signUpBtn.classList.remove('animating');
        }
        toggleSignUpBtn();
    }

    // Step 5: Wait 500ms, then update JSX code (no highlighting)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update JSX code without typing animation (instant change, no highlights)
    codeContent.innerHTML = `<span class="code-keyword">export default function</span> <span class="code-variable">Button</span>({ <span class="code-variable">variant</span>, <span class="code-variable">children</span>, <span class="code-variable">onClick</span> }) {
  <span class="code-keyword">const</span> <span class="code-variable">baseClass</span> = <span class="code-string">"btn"</span>;
  <span class="code-keyword">const</span> <span class="code-variable">variantClass</span> = <span class="code-variable">variant</span> === <span class="code-string">"primary"</span> ? <span class="code-string">"btn-primary"</span> : <span class="code-string">"btn-secondary"</span>;

  <span class="code-keyword">return</span> (
    <span class="code-tag">&lt;button</span>
      <span class="code-attribute">className</span>=<span class="code-value">{\`\${baseClass} \${variantClass}\`}</span>
      <span class="code-attribute">onClick</span>=<span class="code-value">{onClick}</span>
    <span class="code-tag">&gt;</span>
      <span class="code-tag">&lt;span&gt;</span>{<span class="code-variable">children</span>}<span class="code-tag">&lt;/span&gt;</span>
    <span class="code-tag">&lt;/button&gt;</span>
  );
}`;

    // Step 6: Wait for glow animations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6.5: Swap informative element to reload button
    informativeElement = document.getElementById('informativeElement');
    if (informativeElement) {
        informativeElement.style.display = 'inline-block';
        informativeElement.classList.add('reload-state');
        informativeElement.innerHTML = `
            <div class="informative-content">
                <img src="https://www.figma.com/api/mcp/asset/13edd807-c731-412c-bab5-edf34720f7cc" alt="reload" class="informative-icon">
                <p class="informative-text">Click here to reload the console</p>
            </div>
        `;
    }

    // Step 7: Re-enable send button
    sendButton.style.pointerEvents = 'auto';
    sendButton.style.opacity = '1';

    // Mark animation as complete
    window.codeAnimationState.isAnimating = false;
    window.codeAnimationState.hasAnimated = true;
}

// Reload function to reset everything
function reloadConsoleState() {
    // Reset animation state
    window.codeAnimationState.isAnimating = false;
    window.codeAnimationState.hasAnimated = false;

    // Reset sign-up button to initial state (remove active class)
    const signUpBtn = document.getElementById('signUpBtn');
    if (signUpBtn) {
        // Remove animating class if it exists
        signUpBtn.classList.remove('animating');
        
        if (signUpBtn.classList.contains('active')) {
            if (typeof toggleSignUpBtn === 'function') {
                toggleSignUpBtn();
            }
        }
    }

    // Reset JSX code to original with highlights on lines 5-10
    const codeContent = document.querySelector('.code-content');
    if (codeContent) {
        codeContent.innerHTML = `<span class="code-keyword">export default function</span> <span class="code-variable">Button</span>({ <span class="code-variable">variant</span>, <span class="code-variable">children</span>, <span class="code-variable">onClick</span> }) {
  <span class="code-keyword">const</span> <span class="code-variable">baseClass</span> = <span class="code-string">"btn"</span>;
  <span class="code-keyword">const</span> <span class="code-variable">variantClass</span> = <span class="code-variable">variant</span> === <span class="code-string">"secondary"</span> ? <span class="code-string">"btn-secondary"</span> : <span class="code-string">"btn-primary"</span>;

  <span class="highlight-line"><span class="code-keyword">return</span> (</span>
    <span class="highlight-line"><span class="code-tag">&lt;button</span></span>
      <span class="highlight-line"><span class="code-attribute">className</span>=<span class="code-value">{\`\${baseClass} \${variantClass}\`}</span></span>
      <span class="highlight-line"><span class="code-attribute">onClick</span>=<span class="code-value">{onClick}</span></span>
    <span class="highlight-line"><span class="code-tag">&gt;</span></span>
      <span class="highlight-line"><span class="code-tag">&lt;span&gt;</span>{<span class="code-variable">children</span>}<span class="code-tag">&lt;/span&gt;</span></span>
    <span class="code-tag">&lt;/button&gt;</span>
  );
}`;
    }

    // Reset CSS code to original (btn-secondary)
    const cssCode = document.querySelector('.css-code');
    if (cssCode) {
        cssCode.textContent = `.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  font-family: 'Alpha Lyrae', sans-serif;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.btn-secondary {
  background: linear-gradient(to bottom, #cfcfcf, #5a5a5a);
  border: 1px solid #595959;
  color: #242424;
}`;
    }

    // Reset chat placeholder to original with shimmer
    const chatPlaceholder = document.querySelector('.chat-placeholder');
    if (chatPlaceholder) {
        chatPlaceholder.textContent = 'Change the button similar to the screenshot';
        chatPlaceholder.style.color = '';
        chatPlaceholder.style.background = 'linear-gradient(90deg, #8B6BA8 0%, #C4A7E2 50%, #8B6BA8 100%)';
        chatPlaceholder.style.backgroundSize = '200% 100%';
        chatPlaceholder.style.backgroundClip = 'text';
        chatPlaceholder.style.webkitBackgroundClip = 'text';
        chatPlaceholder.style.webkitTextFillColor = 'transparent';
        chatPlaceholder.style.animation = 'shimmer 2s infinite linear';
    }

    // Re-add screenshot attachment
    const chatBox = document.querySelector('.chat-box');
    if (chatBox && !document.querySelector('.chat-attachment')) {
        const chatAttachment = document.createElement('div');
        chatAttachment.className = 'chat-attachment';
        chatAttachment.innerHTML = '<img src="/jsx-tool/images/screenshot-attachment.svg" alt="Button screenshot" class="attachment-image">';
        chatBox.insertBefore(chatAttachment, chatBox.firstChild);
    }

    // Reset send button to gradient
    const sendButton = document.querySelector('.send-button');
    if (sendButton) {
        sendButton.innerHTML = `
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM12.7071 7.29289L16.7071 11.2929C17.0976 11.6834 17.0976 12.3166 16.7071 12.7071C16.3166 13.0976 15.6834 13.0976 15.2929 12.7071L13 10.4142V16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16V10.4142L8.70711 12.7071C8.31658 13.0976 7.68342 13.0976 7.29289 12.7071C6.90237 12.3166 6.90237 11.6834 7.29289 11.2929L11.2929 7.29289C11.6834 6.90237 12.3166 6.90237 12.7071 7.29289Z" fill="url(#paint0_linear_89_9350)"/>
            <defs>
                <linearGradient id="paint0_linear_89_9350" x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#8937F0"/>
                    <stop offset="1" stop-color="#611CB8"/>
                </linearGradient>
            </defs>
        `;
        sendButton.style.animation = 'sendPulse 2s infinite';
    }

    // Reset informative element back to initial state
    let informativeElement = document.getElementById('informativeElement');
    if (informativeElement) {
        informativeElement.style.display = 'inline-block';
        informativeElement.classList.remove('reload-state');
        informativeElement.innerHTML = `
            <div class="informative-content">
                <p class="informative-text">Click on</p>
                <img src="https://www.figma.com/api/mcp/asset/a7687faf-d365-4aa1-962e-bfdb957e33b4" alt="arrow up" class="informative-icon">
                <p class="informative-text">in console to see the magic</p>
            </div>
        `;
    }
}

// Add click handler for reload button
document.addEventListener('DOMContentLoaded', function() {
    const informativeElement = document.getElementById('informativeElement');
    if (informativeElement) {
        informativeElement.addEventListener('click', function() {
            if (this.classList.contains('reload-state')) {
                reloadConsoleState();
            }
        });
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CodeTyper, startCodeTransformAnimation, reloadConsoleState };
}
