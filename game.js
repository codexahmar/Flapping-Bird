/* ============================================
   FLAPPING BIRD - Game Logic
   ============================================ */

// Canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseScreen = document.getElementById('pauseScreen');
const finalScoreEl = document.getElementById('finalScore');
const highScoreDisplayEl = document.getElementById('highScoreDisplay');
const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');

// Game constants
const GRAVITY = 0.45;
const FLAP_FORCE = -7.5;
const MAX_FALL_SPEED = 9;
const PIPE_WIDTH = 65;
const PIPE_GAP = 155;
const PIPE_SPACING = 220;
const PIPE_SPEED = 2.8;
const GROUND_HEIGHT = 80;

// Game state
let gameState = 'start'; // start, playing, paused, gameover
let score = 0;
let highScore = parseInt(localStorage.getItem('flappingBirdHighScore')) || 0;
let lastFlapTime = 0;
let animationId;
let shakeIntensity = 0;
let wasAtStart = true;
let wingAngle = 0;
let wingDirection = 1;

// Bird object
const bird = {
  x: 80,
  y: 300,
  width: 45,
  height: 33,
  velocity: 0,
  rotation: 0,
  wingPhase: 0
};

// Environment arrays
let pipes = [];
let groundOffset = 0;
let clouds = [];
let stars = [];
let fireflies = [];
let mountains = [];

/* ============================================
   SOUND SYSTEM - Web Audio API
   ============================================ */

let audioCtx = null;
let isMuted = localStorage.getItem('flappingBirdMuted') === 'true';
let bgMusicGain = null;
let bgMusicOscillators = [];
let hasInteracted = false;

// Initialize audio context on first user interaction
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  hasInteracted = true;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Master gain for global volume control
let masterGain;
function getMasterGain() {
  if (!masterGain && audioCtx) {
    masterGain = audioCtx.createGain();
    masterGain.gain.value = isMuted ? 0 : 0.6;
    masterGain.connect(audioCtx.destination);
  }
  return masterGain;
}

// Toggle mute function
function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('flappingBirdMuted', isMuted);
  muteBtn.classList.toggle('muted', isMuted);

  if (masterGain) {
    masterGain.gain.setValueAtTime(isMuted ? 0 : 0.6, audioCtx.currentTime);
  }

  if (isMuted) {
    stopBackgroundMusic();
  } else if (gameState === 'playing') {
    startBackgroundMusic();
  }
}

// Flap sound - quick rising chirp
let lastFlapSoundTime = 0;
function playFlapSound() {
  if (!hasInteracted) initAudio();
  if (!audioCtx || isMuted) return;

  const now = Date.now();
  if (now - lastFlapSoundTime < 80) return;
  lastFlapSoundTime = now;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(450, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.04);
  osc.frequency.exponentialRampToValueAtTime(350, audioCtx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(getMasterGain());

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
}

// Score sound - pleasant ding/chime
let lastScoreSoundTime = 0;
function playScoreSound() {
  if (!audioCtx || isMuted) return;

  const now = Date.now();
  if (now - lastScoreSoundTime < 80) return;
  lastScoreSoundTime = now;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.04);

  gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(getMasterGain());

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

// Hit/collision sound - low thud
function playHitSound() {
  if (!audioCtx || isMuted) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.12);

  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(getMasterGain());

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

// Game over sound - descending sad tone
function playGameOverSound() {
  if (!audioCtx || isMuted) return;

  const notes = [480, 420, 360, 300];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.12);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.12 + 0.11);

    osc.connect(gain);
    gain.connect(getMasterGain());

    osc.start(audioCtx.currentTime + i * 0.12);
    osc.stop(audioCtx.currentTime + i * 0.12 + 0.12);
  });
}

// Start sound - uplifting chirp sequence
function playStartSound() {
  if (!audioCtx || isMuted) return;

  const notes = [523, 659, 784];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.07);

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.07 + 0.06);

    osc.connect(gain);
    gain.connect(getMasterGain());

    osc.start(audioCtx.currentTime + i * 0.07);
    osc.stop(audioCtx.currentTime + i * 0.07 + 0.07);
  });
}

// Pause sound
function playPauseSound() {
  if (!audioCtx || isMuted) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.setValueAtTime(300, audioCtx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(getMasterGain());

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

// Background ambience - retro synth pad
function startBackgroundMusic() {
  if (!audioCtx || isMuted || bgMusicOscillators.length > 0) return;

  // Low drone
  const droneOsc = audioCtx.createOscillator();
  const droneGain = audioCtx.createGain();
  const droneFilter = audioCtx.createBiquadFilter();

  droneOsc.type = 'sine';
  droneOsc.frequency.value = 55;

  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 180;

  droneGain.gain.value = 0.1;

  droneOsc.connect(droneFilter);
  droneFilter.connect(droneGain);
  droneGain.connect(getMasterGain());

  droneOsc.start();
  bgMusicOscillators.push({ osc: droneOsc, gain: droneGain });

  // Pulsing synth
  const pulseOsc = audioCtx.createOscillator();
  const pulseGain = audioCtx.createGain();
  const pulseFilter = audioCtx.createBiquadFilter();

  pulseOsc.type = 'triangle';
  pulseOsc.frequency.value = 110;

  pulseFilter.type = 'lowpass';
  pulseFilter.frequency.value = 280;

  pulseGain.gain.value = 0.05;

  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.4;
  lfoGain.gain.value = 0.03;

  lfo.connect(lfoGain);
  lfoGain.connect(pulseGain.gain);

  pulseOsc.connect(pulseFilter);
  pulseFilter.connect(pulseGain);
  pulseGain.connect(getMasterGain());

  lfo.start();
  pulseOsc.start();
  bgMusicOscillators.push({ osc: pulseOsc, gain: pulseGain }, { osc: lfo, gain: lfoGain });

  // High shimmer
  const shimmerOsc = audioCtx.createOscillator();
  const shimmerGain = audioCtx.createGain();
  const shimmerFilter = audioCtx.createBiquadFilter();

  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.value = 880;

  shimmerFilter.type = 'highpass';
  shimmerFilter.frequency.value = 500;

  shimmerGain.gain.value = 0.02;

  shimmerOsc.connect(shimmerFilter);
  shimmerFilter.connect(shimmerGain);
  shimmerGain.connect(getMasterGain());

  shimmerOsc.start();
  bgMusicOscillators.push({ osc: shimmerOsc, gain: shimmerGain });
}

function stopBackgroundMusic() {
  bgMusicOscillators.forEach(item => {
    try {
      item.osc.stop();
    } catch (e) {}
  });
  bgMusicOscillators = [];
}

// Button event listeners
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  initAudio();
  toggleMute();
});

pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

if (isMuted) {
  muteBtn.classList.add('muted');
}

/* ============================================
   ENVIRONMENT INITIALIZATION
   ============================================ */

function init() {
  // Initialize clouds
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 40 + Math.random() * 180,
      width: 50 + Math.random() * 50,
      speed: 0.3 + Math.random() * 0.4,
      opacity: 0.05 + Math.random() * 0.08
    });
  }

  // Initialize stars
  stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height - GROUND_HEIGHT - 120),
      size: 0.5 + Math.random() * 2,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.05
    });
  }

  // Initialize fireflies
  fireflies = [];
  for (let i = 0; i < 8; i++) {
    fireflies.push({
      x: 50 + Math.random() * (canvas.width - 100),
      y: 100 + Math.random() * (canvas.height - GROUND_HEIGHT - 200),
      size: 2 + Math.random() * 2,
      glowPhase: Math.random() * Math.PI * 2,
      speedX: 0.2 + Math.random() * 0.3,
      speedY: 0.1 + Math.random() * 0.2,
      angle: Math.random() * Math.PI * 2
    });
  }

  // Initialize mountains
  mountains = [];
  for (let i = 0; i < 5; i++) {
    mountains.push({
      x: i * 120,
      height: 60 + Math.random() * 80,
      width: 100 + Math.random() * 60
    });
  }
}

function resetGame() {
  bird.x = 80;
  bird.y = 280;
  bird.velocity = 0;
  bird.rotation = 0;
  bird.wingPhase = 0;
  pipes = [];
  score = 0;
  shakeIntensity = 0;
  groundOffset = 0;
  wingAngle = 0;
  wingDirection = 1;

  for (let i = 0; i < 3; i++) {
    addPipe(450 + i * PIPE_SPACING);
  }
}

function addPipe(x) {
  const minY = 80;
  const maxY = canvas.height - GROUND_HEIGHT - PIPE_GAP - 80;
  const gapY = minY + Math.random() * (maxY - minY);

  pipes.push({
    x: x,
    gapY: gapY,
    passed: false,
    highlight: 0
  });
}

/* ============================================
   DRAWING FUNCTIONS
   ============================================ */

function drawBackground() {
  // Sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0a0a18');
  gradient.addColorStop(0.3, '#12122a');
  gradient.addColorStop(0.7, '#1a1a35');
  gradient.addColorStop(1, '#0d0d22');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw distant mountains
  drawMountains();

  // Draw stars
  ctx.fillStyle = '#ffffff';
  stars.forEach(star => {
    star.twinkle += star.speed;
    const alpha = 0.3 + Math.sin(star.twinkle) * 0.4;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Draw moon
  drawMoon();

  // Draw clouds
  clouds.forEach(cloud => {
    ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.width * 0.4, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.width * 0.3, cloud.y - 8, cloud.width * 0.3, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.width * 0.6, cloud.y, cloud.width * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw fireflies
  fireflies.forEach(ff => {
    ff.glowPhase += 0.08;
    ff.angle += 0.02;
    ff.x += Math.cos(ff.angle) * ff.speedX;
    ff.y += Math.sin(ff.angle) * ff.speedY * 0.5;

    if (ff.x < -10) ff.x = canvas.width + 10;
    if (ff.x > canvas.width + 10) ff.x = -10;
    if (ff.y < 50) ff.y = canvas.height - GROUND_HEIGHT - 50;
    if (ff.y > canvas.height - GROUND_HEIGHT - 50) ff.y = 50;

    const glow = 0.3 + Math.sin(ff.glowPhase) * 0.4;

    // Glow effect
    const glowGradient = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, ff.size * 4);
    glowGradient.addColorStop(0, `rgba(180, 255, 100, ${glow})`);
    glowGradient.addColorStop(0.5, `rgba(150, 255, 80, ${glow * 0.3})`);
    glowGradient.addColorStop(1, 'rgba(150, 255, 80, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.size * 4, 0, Math.PI * 2);
    ctx.fill();

    // Firefly body
    ctx.fillStyle = `rgba(200, 255, 120, ${0.8 + glow * 0.2})`;
    ctx.beginPath();
    ctx.arc(ff.x, ff.y, ff.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMoon() {
  const moonX = 320;
  const moonY = 60;
  const moonRadius = 25;

  // Moon glow
  const glowGradient = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 2.5);
  glowGradient.addColorStop(0, 'rgba(255, 250, 220, 0.3)');
  glowGradient.addColorStop(0.5, 'rgba(255, 250, 220, 0.1)');
  glowGradient.addColorStop(1, 'rgba(255, 250, 220, 0)');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Moon body
  const moonGradient = ctx.createRadialGradient(moonX - 8, moonY - 8, 0, moonX, moonY, moonRadius);
  moonGradient.addColorStop(0, '#fffef0');
  moonGradient.addColorStop(1, '#e8e4c8');
  ctx.fillStyle = moonGradient;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  // Moon craters
  ctx.fillStyle = 'rgba(200, 195, 170, 0.4)';
  ctx.beginPath();
  ctx.arc(moonX + 5, moonY - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX - 8, moonY + 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX + 10, moonY + 5, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains() {
  ctx.fillStyle = '#151525';
  mountains.forEach((mt, i) => {
    ctx.beginPath();
    ctx.moveTo(mt.x, canvas.height - GROUND_HEIGHT);
    ctx.lineTo(mt.x + mt.width / 2, canvas.height - GROUND_HEIGHT - mt.height);
    ctx.lineTo(mt.x + mt.width, canvas.height - GROUND_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Snow cap
    if (mt.height > 80) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(mt.x + mt.width / 2 - 15, canvas.height - GROUND_HEIGHT - mt.height + 20);
      ctx.lineTo(mt.x + mt.width / 2, canvas.height - GROUND_HEIGHT - mt.height);
      ctx.lineTo(mt.x + mt.width / 2 + 15, canvas.height - GROUND_HEIGHT - mt.height + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#151525';
    }
  });
}

function updateClouds() {
  clouds.forEach(cloud => {
    cloud.x -= cloud.speed;
    if (cloud.x + cloud.width < 0) {
      cloud.x = canvas.width + cloud.width;
      cloud.y = 40 + Math.random() * 180;
    }
  });
}

function drawGround() {
  // Ground base
  ctx.fillStyle = '#1a1a28';
  ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);

  // Grass layer
  const grassGradient = ctx.createLinearGradient(0, canvas.height - GROUND_HEIGHT, 0, canvas.height - GROUND_HEIGHT + 15);
  grassGradient.addColorStop(0, '#1d3a2f');
  grassGradient.addColorStop(1, '#1a1a28');
  ctx.fillStyle = grassGradient;
  ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, 15);

  // Grass blades
  ctx.fillStyle = '#00b894';
  for (let i = 0; i < canvas.width + 20; i += 12) {
    const x = (i - groundOffset) % (canvas.width + 20) - 20;
    const height = 8 + Math.sin(i * 0.5) * 4;
    ctx.beginPath();
    ctx.moveTo(x, canvas.height - GROUND_HEIGHT + 12);
    ctx.lineTo(x + 6, canvas.height - GROUND_HEIGHT + 12 - height);
    ctx.lineTo(x + 12, canvas.height - GROUND_HEIGHT + 12);
    ctx.fill();
  }

  // Ground texture lines
  ctx.strokeStyle = '#252538';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = canvas.height - GROUND_HEIGHT + 25 + i * 12;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Top edge highlight
  ctx.strokeStyle = '#2a3a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - GROUND_HEIGHT);
  ctx.lineTo(canvas.width, canvas.height - GROUND_HEIGHT);
  ctx.stroke();
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
  ctx.rotate(bird.rotation);

  const w = bird.width;
  const h = bird.height;

  // Wing animation
  bird.wingPhase += 0.3;
  const wingOffset = Math.sin(bird.wingPhase) * 3;

  // Body shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 3, w / 2.2, h / 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body gradient
  const bodyGradient = ctx.createRadialGradient(-w * 0.15, -h * 0.15, 0, 0, 0, w / 2);
  bodyGradient.addColorStop(0, '#ffe566');
  bodyGradient.addColorStop(0.5, '#ffd93d');
  bodyGradient.addColorStop(1, '#e6b800');
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2.2, h / 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.15, -h * 0.15, w * 0.25, h * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Wing
  ctx.fillStyle = '#e55a2b';
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, h * 0.1 + wingOffset, w * 0.28, h * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Wing highlight
  ctx.fillStyle = '#ff7a45';
  ctx.beginPath();
  ctx.ellipse(-w * 0.15, h * 0.05 + wingOffset, w * 0.15, h * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Tail feathers
  ctx.fillStyle = '#e55a2b';
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, 0);
  ctx.lineTo(-w * 0.65, -h * 0.15);
  ctx.lineTo(-w * 0.6, 0);
  ctx.lineTo(-w * 0.65, h * 0.15);
  ctx.closePath();
  ctx.fill();

  // Eye white
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.18, -h * 0.12, w * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Eye pupil
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(w * 0.22, -h * 0.1, w * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.18, -h * 0.15, w * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, -h * 0.05);
  ctx.lineTo(w * 0.65, h * 0.02);
  ctx.lineTo(w * 0.35, h * 0.15);
  ctx.closePath();
  ctx.fill();

  // Beak highlight
  ctx.fillStyle = '#ff8c5a';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, -h * 0.05);
  ctx.lineTo(w * 0.5, 0);
  ctx.lineTo(w * 0.35, h * 0.05);
  ctx.closePath();
  ctx.fill();

  // Blush cheek
  ctx.fillStyle = 'rgba(255, 150, 100, 0.3)';
  ctx.beginPath();
  ctx.ellipse(w * 0.1, h * 0.15, w * 0.1, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPipes() {
  pipes.forEach(pipe => {
    const gapCenterY = pipe.gapY;
    const halfGap = PIPE_GAP / 2;

    // Pipe glow
    ctx.shadowColor = 'rgba(0, 184, 148, 0.25)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Top pipe
    drawPipeSection(pipe.x, 0, PIPE_WIDTH, gapCenterY - halfGap, true);

    // Bottom pipe
    drawPipeSection(pipe.x, gapCenterY + halfGap, PIPE_WIDTH, canvas.height - GROUND_HEIGHT - (gapCenterY + halfGap), false);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  });
}

function drawPipeSection(x, y, width, height, isTop) {
  // Pipe body
  const pipeGradient = ctx.createLinearGradient(x, 0, x + width, 0);
  pipeGradient.addColorStop(0, '#2d3436');
  pipeGradient.addColorStop(0.3, '#3d4a5c');
  pipeGradient.addColorStop(0.7, '#3d4a5c');
  pipeGradient.addColorStop(1, '#2d3436');
  ctx.fillStyle = pipeGradient;
  ctx.fillRect(x, y, width, height);

  // Left edge highlight
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(x + 3, y, 4, height);

  // Right edge shadow
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x + width - 4, y, 4, height);

  // Pipe cap
  const capHeight = 25;
  const capY = isTop ? y + height - capHeight : y;

  const capGradient = ctx.createLinearGradient(x - 5, 0, x + width + 5, 0);
  capGradient.addColorStop(0, '#2d3436');
  capGradient.addColorStop(0.2, '#4a5568');
  capGradient.addColorStop(0.8, '#4a5568');
  capGradient.addColorStop(1, '#2d3436');
  ctx.fillStyle = capGradient;
  ctx.fillRect(x - 5, capY, width + 10, capHeight);

  // Cap highlight line
  ctx.fillStyle = '#5a6a7a';
  ctx.fillRect(x + 5, isTop ? capY + 5 : capY + 5, width - 10, 4);
  ctx.fillRect(x + 5, isTop ? capY + capHeight - 8 : capY + capHeight - 8, width - 10, 4);

  // Cap bolts
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(x + 10, capY + capHeight / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + width - 10, capY + capHeight / 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawScore() {
  ctx.font = '28px "Press Start 2P"';
  ctx.textAlign = 'center';

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(score, canvas.width / 2 + 3, 45);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(score, canvas.width / 2, 43);
}

function drawPauseIcon() {
  if (gameState === 'playing') {
    pauseBtn.querySelector('.pause-icon').classList.add('hidden');
    pauseBtn.querySelector('.play-icon').classList.remove('hidden');
  } else if (gameState === 'paused') {
    pauseBtn.querySelector('.pause-icon').classList.remove('hidden');
    pauseBtn.querySelector('.play-icon').classList.add('hidden');
  }
}

/* ============================================
   GAME UPDATE FUNCTIONS
   ============================================ */

function update() {
  if (gameState !== 'playing') return;

  // Bird physics
  bird.velocity += GRAVITY;
  if (bird.velocity > MAX_FALL_SPEED) {
    bird.velocity = MAX_FALL_SPEED;
  }
  bird.y += bird.velocity;

  // Bird rotation based on velocity
  bird.rotation = Math.min(Math.max(bird.velocity * 3.5, -35), 85) * Math.PI / 180;

  // Ceiling collision
  if (bird.y < 0) {
    bird.y = 0;
    bird.velocity = 0;
  }

  // Ground collision
  if (bird.y + bird.height > canvas.height - GROUND_HEIGHT) {
    gameOver();
    return;
  }

  // Update pipes
  pipes.forEach(pipe => {
    pipe.x -= PIPE_SPEED;

    // Score detection
    if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
      pipe.passed = true;
      score++;
      playScoreSound();
    }
  });

  // Remove off-screen pipes
  pipes = pipes.filter(pipe => pipe.x + PIPE_WIDTH > 0);

  // Add new pipes
  if (pipes.length > 0) {
    const lastPipe = pipes[pipes.length - 1];
    if (lastPipe.x < canvas.width - PIPE_SPACING) {
      addPipe(canvas.width);
    }
  }

  // Pipe collision detection
  pipes.forEach(pipe => {
    const birdLeft = bird.x + 6;
    const birdRight = bird.x + bird.width - 6;
    const birdTop = bird.y + 6;
    const birdBottom = bird.y + bird.height - 6;

    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + PIPE_WIDTH;
    const topPipeBottom = pipe.gapY - PIPE_GAP / 2;
    const bottomPipeTop = pipe.gapY + PIPE_GAP / 2;

    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      if (birdTop < topPipeBottom || birdBottom > bottomPipeTop) {
        gameOver();
      }
    }
  });

  // Ground animation
  groundOffset = (groundOffset + PIPE_SPEED) % 12;

  // Screen shake decay
  if (shakeIntensity > 0) {
    shakeIntensity *= 0.9;
  }
}

function draw() {
  ctx.save();

  // Screen shake
  if (shakeIntensity > 0.5) {
    ctx.translate(
      (Math.random() - 0.5) * shakeIntensity,
      (Math.random() - 0.5) * shakeIntensity
    );
  }

  drawBackground();
  updateClouds();
  drawPipes();
  drawGround();
  drawBird();

  if (gameState === 'playing' || gameState === 'paused') {
    drawScore();
  }

  ctx.restore();

  drawPauseIcon();
}

function gameLoop() {
  update();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

/* ============================================
   GAME CONTROL FUNCTIONS
   ============================================ */

function startGame() {
  initAudio();
  gameState = 'playing';
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  resetGame();

  if (wasAtStart) {
    playStartSound();
    wasAtStart = false;
  }

  if (!isMuted) {
    startBackgroundMusic();
  }
}

function gameOver() {
  gameState = 'gameover';
  shakeIntensity = 18;

  playHitSound();

  setTimeout(() => {
    playGameOverSound();
  }, 150);

  stopBackgroundMusic();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flappingBirdHighScore', highScore);
  }

  finalScoreEl.textContent = score;
  highScoreDisplayEl.textContent = `HIGH SCORE: ${highScore}`;

  setTimeout(() => {
    gameOverScreen.classList.remove('hidden');
    wasAtStart = false;
  }, 400);
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    pauseScreen.classList.remove('hidden');
    stopBackgroundMusic();
    playPauseSound();
  } else if (gameState === 'paused') {
    gameState = 'playing';
    pauseScreen.classList.add('hidden');
    if (!isMuted) {
      startBackgroundMusic();
    }
    playPauseSound();
  }
}

function flap() {
  const now = Date.now();
  if (now - lastFlapTime < 80) return;
  lastFlapTime = now;

  if (gameState === 'start') {
    startGame();
  } else if (gameState === 'playing') {
    bird.velocity = FLAP_FORCE;
    playFlapSound();
  } else if (gameState === 'gameover') {
    startGame();
  }
}

/* ============================================
   EVENT LISTENERS
   ============================================ */

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    flap();
  } else if (e.code === 'KeyP') {
    if (gameState === 'playing' || gameState === 'paused') {
      togglePause();
    }
  } else if (e.code === 'Escape') {
    if (gameState === 'playing' || gameState === 'paused') {
      togglePause();
    }
  }
});

canvas.addEventListener('click', (e) => {
  if (gameState === 'paused') {
    togglePause();
  } else {
    flap();
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'paused') {
    togglePause();
  } else {
    flap();
  }
});

startScreen.addEventListener('click', () => {
  if (gameState === 'start') {
    startGame();
  }
});

gameOverScreen.addEventListener('click', () => {
  if (gameState === 'gameover') {
    startGame();
  }
});

pauseScreen.addEventListener('click', () => {
  if (gameState === 'paused') {
    togglePause();
  }
});

window.addEventListener('blur', () => {
  if (gameState === 'playing') {
    togglePause();
  }
});

/* ============================================
   INITIALIZATION
   ============================================ */

init();
gameLoop();