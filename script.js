// Tab switching functionality
const bookCallBtn = document.getElementById('bookCallBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const calWidget = document.getElementById('calWidget');
const messageWidget = document.getElementById('messageWidget');

bookCallBtn.addEventListener('click', function() {
    bookCallBtn.classList.add('active');
    sendMessageBtn.classList.remove('active');
    calWidget.classList.add('active');
    messageWidget.classList.remove('active');
});

sendMessageBtn.addEventListener('click', function() {
    sendMessageBtn.classList.add('active');
    bookCallBtn.classList.remove('active');
    messageWidget.classList.add('active');
    calWidget.classList.remove('active');
});

// Update time dynamically with blinking colon
function updateTime() {
    const now = new Date();
    const seconds = now.getSeconds();
    const irelandTime = now.toLocaleTimeString('en-US', {
        timeZone: 'Europe/Dublin',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    // Replace colon with span for blinking effect
    const [hours, minutes] = irelandTime.split(':');
    const colon = seconds % 2 === 0 ? ':' : '<span style="opacity: 0">:</span>';
    document.querySelector('.time-text').innerHTML = hours + colon + minutes + ' IST';
}

updateTime();
setInterval(updateTime, 1000); // Update every second for blinking colon

// Form submission handling with Web3Forms
const form = document.getElementById('messageWidget');
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    formData.append("access_key", "0c71c93c-63fe-4959-a07d-f753ad983ab4");

    const originalText = submitBtn.textContent;

    submitBtn.textContent = "Sending...";
    submitBtn.disabled = true;

    try {
        const response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            submitBtn.textContent = "Sent!";
            form.reset();
            setTimeout(() => {
                submitBtn.textContent = originalText;
            }, 2000);
        } else {
            submitBtn.textContent = "Error";
            setTimeout(() => {
                submitBtn.textContent = originalText;
            }, 2000);
        }

    } catch (error) {
        submitBtn.textContent = "Error";
        setTimeout(() => {
            submitBtn.textContent = originalText;
        }, 2000);
    } finally {
        submitBtn.disabled = false;
    }
});

// Cal.com inline widget initialization
(function (C, A, L) { 
    let p = function (a, ar) { a.q.push(ar); }; 
    let d = C.document; 
    C.Cal = C.Cal || function () { 
        let cal = C.Cal; 
        let ar = arguments; 
        if (!cal.loaded) { 
            cal.ns = {}; 
            cal.q = cal.q || []; 
            d.head.appendChild(d.createElement("script")).src = A; 
            cal.loaded = true; 
        } 
        if (ar[0] === L) { 
            const api = function () { p(api, arguments); }; 
            const namespace = ar[1]; 
            api.q = api.q || []; 
            if(typeof namespace === "string"){
                cal.ns[namespace] = cal.ns[namespace] || api;
                p(cal.ns[namespace], ar);
                p(cal, ["initNamespace", namespace]);
            } else p(cal, ar); 
            return;
        } 
        p(cal, ar); 
    }; 
})(window, "https://app.cal.com/embed/embed.js", "init");

Cal("init", "15min", {origin:"https://app.cal.com"});

Cal.ns["15min"]("inline", {
    elementOrSelector:"#my-cal-inline-15min",
    config: {"layout":"month_view","theme":"light"},
    calLink: "felix-joy-zkizzh/15min",
});

Cal.ns["15min"]("ui", {"cssVarsPerTheme":{"light":{"cal-brand":"#303030","cal-bg":"#EBEBEB","cal-bg-emphasis":"#EBEBEB","cal-bg-subtle":"#EBEBEB"}},"hideEventTypeDetails":false,"layout":"month_view","theme":"light"});
