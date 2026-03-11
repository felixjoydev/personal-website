/* ── Text corpus ── */
const sentences = [
    "The quick brown fox jumps over the lazy dog near the riverbank.",
    "She sells seashells by the seashore every morning before sunrise.",
    "A journey of a thousand miles begins with a single step forward.",
    "The old oak tree stood alone in the meadow swaying gently in wind.",
    "Every great dream begins with a dreamer who dares to imagine more.",
    "Music is the universal language of mankind heard across all borders.",
    "Time flies over us but leaves its shadow behind for all to see.",
    "Knowledge speaks but wisdom listens carefully before making moves.",
    "Stars cannot shine without darkness surrounding them in the night.",
    "The only way to do great work is to love what you do each day.",
    "In the middle of every difficulty lies a hidden opportunity ahead.",
    "Life is really simple but we insist on making it complicated daily.",
    "Creativity is intelligence having fun while solving real problems.",
    "Simplicity is the ultimate sophistication in design and in life.",
    "The best time to plant a tree was twenty years ago or right now.",
    "Not all those who wander are lost some are just finding their way.",
    "Design is not just what it looks like but how it works in practice.",
    "Good design is obvious while great design is transparent to users.",
    "The details are not the details because they make the whole design.",
    "Innovation distinguishes between a leader and a follower always.",
];

/* ── State ── */
let duration = 30;
let timeLeft = duration;
let timerInterval = null;
let started = false;
let finished = false;
let currentIndex = 0;
let correctCount = 0;
let incorrectCount = 0;
let totalTyped = 0;
let textChars = [];

/* ── DOM ── */
const textDisplay = document.getElementById('text-display');
const timerValue = document.getElementById('timer-value');
const timerFloat = document.getElementById('timer-float');
const timerRing = document.getElementById('timer-ring');
const timerRestart = document.getElementById('timer-restart');
const pills = document.querySelectorAll('.pill');
const modalOverlay = document.getElementById('modal-overlay');
const wpmValue = document.getElementById('wpm-value');
const accuracyValue = document.getElementById('accuracy-value');
const rawValue = document.getElementById('raw-value');
const btnShare = document.getElementById('btn-share');
const btnSave = document.getElementById('btn-save');
const btnRetry = document.getElementById('btn-retry');

/* ── Audio ── */
const AUDIO_POOL_SIZE = 6;
const AUDIO_VOLUME = 0.35;
const FALLBACK_CLICK_DURATION_MS = 110;
const audioPool = [];
let audioIndex = 0;
let audioContext = null;
let audioSpriteBuffer = null;
let audioSpriteLoad = null;
let audioUnlockAttempted = false;

const AUDIO_SPRITE_CLIPS = {
    alpha: [
        { offset: 9.840, duration: 0.09, rate: 1.02, gain: 1.02 },
        { offset: 10.194, duration: 0.095, rate: 1.01, gain: 1.04 },
        { offset: 11.631, duration: 0.09, rate: 1.03, gain: 1.03 },
        { offset: 12.671, duration: 0.09, rate: 1.01, gain: 1.05 },
        { offset: 18.306, duration: 0.10, rate: 0.99, gain: 1.06 },
        { offset: 20.775, duration: 0.09, rate: 1.04, gain: 1.00 },
        { offset: 23.241, duration: 0.095, rate: 1.00, gain: 1.05 },
        { offset: 24.240, duration: 0.095, rate: 1.02, gain: 1.03 },
        { offset: 30.262, duration: 0.10, rate: 0.98, gain: 1.08 },
        { offset: 30.611, duration: 0.09, rate: 1.03, gain: 1.02 },
        { offset: 30.973, duration: 0.09, rate: 1.01, gain: 1.03 },
        { offset: 34.915, duration: 0.11, rate: 0.97, gain: 1.08 },
        { offset: 35.494, duration: 0.09, rate: 1.01, gain: 1.02 },
        { offset: 35.882, duration: 0.09, rate: 1.03, gain: 1.01 },
        { offset: 36.242, duration: 0.09, rate: 1.02, gain: 1.03 },
    ],
    edit: [
        { offset: 15.934, duration: 0.095, rate: 0.96, gain: 1.12 },
        { offset: 17.615, duration: 0.095, rate: 0.95, gain: 1.10 },
        { offset: 17.960, duration: 0.095, rate: 0.97, gain: 1.08 },
        { offset: 20.393, duration: 0.09, rate: 0.98, gain: 1.10 },
    ],
    action: [
        { offset: 18.663, duration: 0.095, rate: 0.95, gain: 1.12 },
        { offset: 19.684, duration: 0.09, rate: 0.97, gain: 1.10 },
        { offset: 23.900, duration: 0.095, rate: 0.96, gain: 1.12 },
        { offset: 35.045, duration: 0.095, rate: 0.94, gain: 1.15 },
    ],
    space: [
        { offset: 18.306, duration: 0.11, rate: 0.90, gain: 1.16 },
        { offset: 24.240, duration: 0.11, rate: 0.91, gain: 1.14 },
        { offset: 30.262, duration: 0.11, rate: 0.89, gain: 1.18 },
        { offset: 34.915, duration: 0.12, rate: 0.88, gain: 1.20 },
    ],
    modifier: [
        { offset: 3.548, duration: 0.075, rate: 1.05, gain: 0.98 },
        { offset: 4.671, duration: 0.075, rate: 1.03, gain: 0.96 },
        { offset: 5.053, duration: 0.075, rate: 1.04, gain: 0.98 },
        { offset: 6.564, duration: 0.075, rate: 1.02, gain: 0.97 },
        { offset: 7.706, duration: 0.075, rate: 1.05, gain: 0.95 },
    ],
    navigation: [
        { offset: 28.245, duration: 0.08, rate: 1.00, gain: 1.00 },
        { offset: 29.582, duration: 0.08, rate: 1.02, gain: 0.99 },
        { offset: 30.611, duration: 0.085, rate: 1.00, gain: 1.02 },
        { offset: 36.585, duration: 0.085, rate: 0.99, gain: 1.01 },
    ],
};
const audioClipIndex = {
    alpha: 0,
    edit: 0,
    action: 0,
    space: 0,
    modifier: 0,
    navigation: 0,
};

function pickAudioSource(oggPath, mp3Path) {
    const probe = document.createElement('audio');
    if (probe.canPlayType('audio/ogg; codecs="vorbis"')) return oggPath;
    if (probe.canPlayType('audio/mpeg')) return mp3Path;
    return oggPath;
}

const AUDIO_SPRITE_SOURCE = pickAudioSource('sounds/sound.ogg', 'sounds/sound.mp3');
const AUDIO_FALLBACK_SOURCE = pickAudioSource('sounds/click.ogg', 'sounds/click.mp3');

function getAudioContext() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!audioContext) audioContext = new Context();
    return audioContext;
}

function decodeAudioData(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
        const copy = arrayBuffer.slice(0);
        const maybePromise = ctx.decodeAudioData(copy, resolve, reject);
        if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(resolve, reject);
        }
    });
}

function loadAudioSprite() {
    const ctx = getAudioContext();
    if (!ctx || audioSpriteBuffer || audioSpriteLoad) return audioSpriteLoad;

    audioSpriteLoad = fetch(AUDIO_SPRITE_SOURCE)
        .then(response => {
            if (!response.ok) {
                throw new Error(`failed to load ${AUDIO_SPRITE_SOURCE}: ${response.status}`);
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => decodeAudioData(ctx, arrayBuffer))
        .then(buffer => {
            audioSpriteBuffer = buffer;
            return buffer;
        })
        .catch(err => {
            console.warn('[audio] sprite load failed:', err);
            return null;
        });

    return audioSpriteLoad;
}

function unlockAudio() {
    if (audioUnlockAttempted) return;
    audioUnlockAttempted = true;

    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'suspended') return;

    ctx.resume().catch(err => {
        audioUnlockAttempted = false;
        console.warn('[audio] resume failed:', err);
    });
}

function initAudio() {
    for (let i = 0; i < AUDIO_POOL_SIZE; i++) {
        const a = new Audio(AUDIO_FALLBACK_SOURCE);
        a.preload = 'auto';
        a.volume = AUDIO_VOLUME;
        a.dataset.stopTimer = '';
        audioPool.push(a);
    }

    loadAudioSprite();
    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio, { passive: true });
}

function getClickFamily(code = '') {
    if (code === 'Space') return 'space';
    if (code === 'Enter' || code === 'Escape' || /^F\d+$/.test(code)) return 'action';
    if (code === 'Backspace' || code === 'Delete' || code === 'Insert') return 'edit';
    if (code.startsWith('Arrow') || ['PageUp', 'PageDown', 'Home', 'End'].includes(code)) {
        return 'navigation';
    }
    if (['Tab', 'CapsLock', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Fn'].includes(code)) {
        return 'modifier';
    }
    return 'alpha';
}

function getClickClip(code = '') {
    const family = getClickFamily(code);
    const clips = AUDIO_SPRITE_CLIPS[family];
    const index = audioClipIndex[family];
    audioClipIndex[family] = (index + 1) % clips.length;
    return { family, ...clips[index] };
}

function applyClipVariation(clip) {
    const jitter = clip.family === 'alpha' ? 0.025 : 0.015;
    const gainJitter = clip.family === 'space' ? 0.02 : 0.035;

    return {
        rate: clip.rate * (1 + ((Math.random() * 2) - 1) * jitter),
        gain: clip.gain * (1 + ((Math.random() * 2) - 1) * gainJitter),
    };
}

function playFallbackClick(code = '') {
    const a = audioPool[audioIndex];
    if (!a) return;
    const clip = getClickClip(code);
    const variation = applyClipVariation(clip);

    if (a.dataset.stopTimer) clearTimeout(Number(a.dataset.stopTimer));
    a.pause();
    a.currentTime = 0;
    a.playbackRate = variation.rate;
    a.volume = Math.min(1, AUDIO_VOLUME * variation.gain);
    a.play().catch(err => console.warn('[audio] fallback play failed:', err));
    a.dataset.stopTimer = String(window.setTimeout(() => {
        a.pause();
        a.currentTime = 0;
        a.playbackRate = 1;
        a.volume = AUDIO_VOLUME;
        a.dataset.stopTimer = '';
    }, FALLBACK_CLICK_DURATION_MS));
    audioIndex = (audioIndex + 1) % AUDIO_POOL_SIZE;
}

function playSpriteClick(code = '') {
    const ctx = getAudioContext();
    if (!ctx || !audioSpriteBuffer || ctx.state === 'suspended') return false;

    const clip = getClickClip(code);
    const variation = applyClipVariation(clip);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const tone = ctx.createBiquadFilter();

    source.buffer = audioSpriteBuffer;
    source.playbackRate.value = variation.rate;
    gain.gain.value = Math.min(1, AUDIO_VOLUME * variation.gain);
    tone.type = clip.family === 'space' ? 'lowshelf' : 'highshelf';
    tone.frequency.value = clip.family === 'space' ? 280 : 2400;
    tone.gain.value = clip.family === 'space' ? 2.5 : 1.8;
    source.connect(tone);
    tone.connect(gain);
    gain.connect(ctx.destination);
    source.start(0, clip.offset, clip.duration);
    return true;
}

function playClick(code = '') {
    unlockAudio();

    if (playSpriteClick(code)) return;

    loadAudioSprite();
    playFallbackClick(code);
}

/* ── Text generation ── */
function generateText() {
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    let text = '';
    for (let i = 0; text.length < 300; i++) {
        if (text) text += ' ';
        text += shuffled[i % shuffled.length];
    }
    return text;
}

function renderText(text) {
    textDisplay.innerHTML = '';
    textDisplay.classList.remove('typing');
    textChars = [];
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'char' + (i === 0 ? ' current' : '');
        span.textContent = text[i];
        span.dataset.index = i;
        textDisplay.appendChild(span);
        textChars.push(span);
    }
}

/* ── Timer ── */
const RING_CIRCUMFERENCE = 18.85; // 2 * π * 3

function startTimer() {
    timerFloat.classList.add('visible');

    // Animate ring: smooth depletion over full duration
    timerRing.style.transition = '';
    timerRing.setAttribute('stroke-dashoffset', '0');
    // Force reflow so the transition starts from 0
    timerRing.getBoundingClientRect();
    // Apply transition and target via class + inline attribute
    timerRing.style.transition = `stroke-dashoffset ${duration}s linear`;
    timerRing.setAttribute('stroke-dashoffset', RING_CIRCUMFERENCE);

    timerInterval = setInterval(() => {
        timeLeft--;
        timerValue.textContent = timeLeft;
        if (timeLeft <= 0) {
            endTest();
        }
    }, 1000);
}

function endTest() {
    clearInterval(timerInterval);
    finished = true;
    const elapsed = duration - timeLeft || duration;
    const minutes = elapsed / 60;
    const wpm = Math.round((correctCount / 5) / minutes);
    const raw = Math.round((totalTyped / 5) / minutes);
    const accuracy = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 0;

    wpmValue.textContent = wpm;
    rawValue.textContent = raw;
    accuracyValue.textContent = accuracy + '%';
    modalOverlay.hidden = false;
}

/* ── Reset ── */
function resetTest() {
    clearInterval(timerInterval);
    started = false;
    finished = false;
    currentIndex = 0;
    correctCount = 0;
    incorrectCount = 0;
    totalTyped = 0;
    timeLeft = duration;
    timerValue.textContent = duration;
    modalOverlay.hidden = true;
    renderText(generateText());
    textDisplay.scrollTop = 0;
    // Hide timer float and reset ring
    timerFloat.classList.remove('visible');
    timerRing.style.transition = '';
    timerRing.setAttribute('stroke-dashoffset', '0');
}

/* ── Keyboard mapping ── */
/* Map event.key values to data-key (event.code) on the keyboard */
const keyElements = {};
document.querySelectorAll('.key[data-key]').forEach(el => {
    keyElements[el.dataset.key] = el;
});

function highlightKey(code, pressed) {
    const el = keyElements[code];
    if (el) {
        if (pressed) el.classList.add('pressed');
        else el.classList.remove('pressed');
    }
}

/* ── Mouse click on keys (visual + sound only) ── */
document.querySelectorAll('.key[data-key]').forEach(el => {
    el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        el.classList.add('pressed');
        playClick(el.dataset.key);
    });
    el.addEventListener('mouseup', () => el.classList.remove('pressed'));
    el.addEventListener('mouseleave', () => el.classList.remove('pressed'));
});

/* ── Scroll to keep current char visible ── */
let cachedLineHeight = 0;
function scrollToCurrent() {
    const el = textChars[currentIndex];
    if (!el) return;
    if (!cachedLineHeight) {
        cachedLineHeight = parseFloat(getComputedStyle(textDisplay).lineHeight);
    }
    const charTop = el.offsetTop;
    const charBottom = charTop + cachedLineHeight;
    const scrollTop = textDisplay.scrollTop;
    const visibleBottom = scrollTop + textDisplay.clientHeight;
    if (charBottom > visibleBottom - cachedLineHeight) {
        textDisplay.scrollTop = charTop - cachedLineHeight;
    }
    if (charTop < scrollTop) {
        textDisplay.scrollTop = Math.max(0, charTop);
    }
}

/* ── Typing handler ── */
document.addEventListener('keydown', (e) => {
    if (finished) {
        e.preventDefault();
        return;
    }

    // Highlight keyboard key
    highlightKey(e.code, true);

    // Prevent default for Tab, Space (scroll), etc during test
    if (e.code === 'Tab' || e.code === 'Space') {
        e.preventDefault();
    }

    // Play sound
    if (started || isPrintable(e) || e.code === 'Backspace') {
        playClick(e.code);
    }

    // Start timer on first real keypress
    if (!started && (isPrintable(e) || e.code === 'Backspace')) {
        started = true;
        textDisplay.classList.add('typing');
        startTimer();
    }

    if (!started) return;

    if (e.code === 'Backspace') {
        e.preventDefault();
        if (currentIndex > 0) {
            currentIndex--;
            textChars[currentIndex + 1]?.classList.remove('current');
            const prev = textChars[currentIndex];
            if (prev.classList.contains('correct')) correctCount--;
            if (prev.classList.contains('incorrect')) incorrectCount--;
            prev.classList.remove('correct', 'incorrect');
            prev.classList.add('current');
            scrollToCurrent();
        }
        return;
    }

    if (!isPrintable(e)) return;

    e.preventDefault();

    if (currentIndex >= textChars.length) return;

    // Space mid-word: skip to next word
    if (e.key === ' ' && textChars[currentIndex].textContent !== ' ') {
        // Mark remaining chars in current word as incorrect
        while (currentIndex < textChars.length && textChars[currentIndex].textContent !== ' ') {
            textChars[currentIndex].classList.remove('current');
            textChars[currentIndex].classList.add('incorrect');
            incorrectCount++;
            totalTyped++;
            currentIndex++;
        }
        // Advance past the space itself
        if (currentIndex < textChars.length && textChars[currentIndex].textContent === ' ') {
            textChars[currentIndex].classList.remove('current');
            textChars[currentIndex].classList.add('correct');
            correctCount++;
            totalTyped++;
            currentIndex++;
        }
        if (currentIndex < textChars.length) {
            textChars[currentIndex].classList.add('current');
            scrollToCurrent();
        }
        if (currentIndex >= textChars.length) endTest();
        return;
    }

    const expected = textChars[currentIndex].textContent;
    const typed = e.key;

    totalTyped++;
    textChars[currentIndex].classList.remove('current');

    if (typed === expected) {
        textChars[currentIndex].classList.add('correct');
        correctCount++;
    } else {
        textChars[currentIndex].classList.add('incorrect');
        incorrectCount++;
    }

    currentIndex++;
    if (currentIndex < textChars.length) {
        textChars[currentIndex].classList.add('current');
        scrollToCurrent();
    }

    if (currentIndex >= textChars.length) {
        endTest();
    }
});

document.addEventListener('keyup', (e) => {
    highlightKey(e.code, false);
});

function isPrintable(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    return e.key.length === 1;
}

/* ── Time pills ── */
pills.forEach(pill => {
    pill.addEventListener('click', () => {
        if (finished) return;
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        duration = parseInt(pill.dataset.time);
        resetTest();
    });
});

/* ── Restart button ── */
timerRestart.addEventListener('click', () => {
    timerRestart.blur();
    resetTest();
});

/* ── Modal actions ── */
btnRetry.addEventListener('click', resetTest);

btnShare.addEventListener('click', () => {
    const wpm = wpmValue.textContent;
    const acc = accuracyValue.textContent;
    const text = encodeURIComponent(
        `I just typed ${wpm} WPM with ${acc} accuracy on felixjoy.me/playground/typewriter/ \u2328\uFE0F`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
});

/* ── Pre-render modal header as bitmap (html2canvas workaround) ── */
function renderHeaderImage(width, height, radius) {
    const c = document.createElement('canvas');
    c.width = width * 2;
    c.height = height * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);

    // Rounded-top rect path
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.arcTo(width, 0, width, radius, radius);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.lineTo(0, radius);
    ctx.arcTo(0, 0, radius, 0, radius);
    ctx.closePath();

    // Drop shadow + gradient fill
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 3;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#e5e5e5');
    grad.addColorStop(1, '#c3c3c3');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    return c.toDataURL('image/png');
}

btnSave.addEventListener('click', () => {
    const wrapper = document.getElementById('modal-wrapper');
    const actions = document.querySelector('.modal-actions');
    const shareLink = document.getElementById('modal-share-link');

    if (typeof html2canvas === 'undefined') return;

    const header = document.querySelector('.modal-header');
    const modal = document.querySelector('.modal');

    // Pre-render header as an <img> so html2canvas can capture it cleanly
    const headerImg = new Image();
    headerImg.src = renderHeaderImage(header.offsetWidth, header.offsetHeight, 24);
    headerImg.style.display = 'block';
    headerImg.style.width = header.offsetWidth + 'px';
    headerImg.style.height = header.offsetHeight + 'px';

    header.hidden = true;
    modal.insertBefore(headerImg, header);

    // Swap title for saved image
    const title = document.querySelector('.modal-title');
    title.textContent = 'My Results';

    // Move offscreen, swap buttons for share link
    const origPosition = wrapper.style.position;
    const origLeft = wrapper.style.left;
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';

    actions.hidden = true;
    shareLink.hidden = false;

    html2canvas(wrapper, {
        backgroundColor: null,
        scale: 2,
    }).then(canvas => {
        // Restore UI
        headerImg.remove();
        header.hidden = false;
        title.textContent = 'Results';
        actions.hidden = false;
        shareLink.hidden = true;
        wrapper.style.position = origPosition;
        wrapper.style.left = origLeft;

        const link = document.createElement('a');
        link.download = 'typewriter-results.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
});

/* ── Logo letter cycle ── */
const logoLetter = document.getElementById('logo-letter');
let letterIndex = 0;
setInterval(() => {
    letterIndex = (letterIndex + 1) % 26;
    logoLetter.textContent = String.fromCharCode(65 + letterIndex);
}, 2000);

/* ── Init ── */
initAudio();
resetTest();
