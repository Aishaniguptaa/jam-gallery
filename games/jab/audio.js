// audio.js — generated sound effects using the Web Audio API. No files, no licenses needed.
let audioCtx = null;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function t0() {
  ensureContext();
  return audioCtx.currentTime;
}

function noiseBuffer(duration) {
  const samples = Math.ceil(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, samples, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoise({ duration = 0.2, volume = 0.2, filterFreq = 2000, filterType = 'lowpass', attack = 0.005 }) {
  const t = t0();
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer(duration);
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(t);
  source.stop(t + duration + 0.02);
}

function playTone({ type = 'sine', startFreq = 440, endFreq = 440, duration = 0.2, volume = 0.2, attack = 0.005 }) {
  const t = t0();
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t);
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
  }
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playShoot(element = 'fire') {
  if (!audioCtx) ensureContext();
  switch (element) {
    case 'water':
      // Soft rushing burst.
      playNoise({ duration: 0.18, volume: 0.14, filterFreq: 1800, filterType: 'bandpass', attack: 0.01 });
      playTone({ type: 'sine', startFreq: 600, endFreq: 300, duration: 0.15, volume: 0.08 });
      break;
    case 'earth':
      // Heavy low thud.
      playNoise({ duration: 0.28, volume: 0.26, filterFreq: 350, attack: 0.005 });
      playTone({ type: 'square', startFreq: 90, endFreq: 45, duration: 0.25, volume: 0.12 });
      break;
    default: // fire
      // Sharp crackle.
      playNoise({ duration: 0.12, volume: 0.18, filterFreq: 3000, attack: 0.002 });
      playTone({ type: 'sawtooth', startFreq: 1100, endFreq: 400, duration: 0.12, volume: 0.1 });
  }
}

export function playHit(element = 'fire') {
  if (!audioCtx) ensureContext();
  const base = element === 'earth' ? 200 : element === 'water' ? 1200 : 2200;
  playNoise({ duration: 0.12, volume: 0.18, filterFreq: base, attack: 0.002 });
  playTone({ type: 'triangle', startFreq: base, endFreq: base * 0.4, duration: 0.1, volume: 0.08 });
}

export function playDeath() {
  if (!audioCtx) ensureContext();
  // Cracking stone + descending drone.
  playNoise({ duration: 0.45, volume: 0.25, filterFreq: 600, attack: 0.005 });
  playTone({ type: 'sawtooth', startFreq: 160, endFreq: 30, duration: 0.5, volume: 0.18 });
}

export function playAbsorb(element = 'fire') {
  if (!audioCtx) ensureContext();
  const freq = element === 'earth' ? 220 : element === 'water' ? 520 : 880;
  playTone({ type: 'sine', startFreq: freq * 0.6, endFreq: freq, duration: 0.25, volume: 0.12, attack: 0.02 });
  playNoise({ duration: 0.2, volume: 0.08, filterFreq: freq * 2, filterType: 'bandpass', attack: 0.02 });
}

export function resumeAudio() {
  ensureContext();
}
