// Browser Mockup Component - Sign Up Button State Toggle

// State management
let signUpBtnActive = false;

// Function to toggle sign-up button state
function toggleSignUpBtn() {
  const signUpBtn = document.getElementById('signUpBtn');
  
  if (signUpBtn) {
    if (signUpBtnActive) {
      signUpBtn.classList.remove('active');
      signUpBtnActive = false;
    } else {
      signUpBtn.classList.add('active');
      signUpBtnActive = true;
    }
  }
}

// Export the function so other components can call it
window.toggleSignUpBtn = toggleSignUpBtn;

// Add click event listener to send button only
document.addEventListener('DOMContentLoaded', () => {
  const sendButton = document.getElementById('sendButton');

  // Send button triggers code transformation animation
  if (sendButton) {
    sendButton.addEventListener('click', function() {
      if (typeof startCodeTransformAnimation === 'function') {
        startCodeTransformAnimation();
      }
    });
  }
});
