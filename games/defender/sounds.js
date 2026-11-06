// sounds.js — the game's three sound effects, made with the Web Audio API. No audio files.

// Volumes and lengths live here, not in tuning.js: this file owns the sounds.
const MASTER_VOLUME = 0.45;      // the whole game's volume, on one gain node
const NOISE_SECONDS = 0.5;       // length of the white-noise buffer the shot and hit share
const SHOOT_GAIN = 0.16;
const HIT_GAIN = 0.4;
const DAMAGE_GAIN = 0.5;

let audio = null;      // the AudioContext, created on the first user gesture
let master = null;     // everything is played through this gain node
let noise = null;      // one buffer of white noise, reused by every burst

// Call once, from the first pointerdown: browsers will not start audio before a gesture.
export function initAudio() {
  if (audio) {
    if (audio.state === 'suspended') audio.resume(); // e.g. the tab was hidden
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return; // no Web Audio: the game still plays, just silently
  audio = new AudioContextClass();

  master = audio.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(audio.destination);

  const length = Math.floor(audio.sampleRate * NOISE_SECONDS);
  noise = audio.createBuffer(1, length, audio.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
}

// A short, bright tick out of the barrel.
export function playShoot() {
  if (!audio) return;
  const now = audio.currentTime;

  const osc = audio.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1700, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.07);

  const highpass = audio.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(520, now);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(SHOOT_GAIN, now);
  gain.gain.exponentialRampToValueAtTime(0.0003, now + 0.08);

  osc.connect(highpass).connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + 0.09);
}

// An enemy breaking up: a crunchy noise burst with a short low thump under it.
export function playHit() {
  if (!audio) return;
  const now = audio.currentTime;

  const burst = audio.createBufferSource();
  burst.buffer = noise;

  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(1500, now);
  band.frequency.exponentialRampToValueAtTime(200, now + 0.22);

  const burstGain = audio.createGain();
  burstGain.gain.setValueAtTime(HIT_GAIN, now);
  burstGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.26);

  burst.connect(band).connect(burstGain).connect(master);
  burst.start(now);
  burst.stop(now + 0.3);

  const thump = audio.createOscillator();
  thump.type = 'triangle';
  thump.frequency.setValueAtTime(170, now);
  thump.frequency.exponentialRampToValueAtTime(55, now + 0.2);

  const thumpGain = audio.createGain();
  thumpGain.gain.setValueAtTime(HIT_GAIN * 0.6, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);

  thump.connect(thumpGain).connect(master);
  thump.start(now);
  thump.stop(now + 0.24);
}

// The base taking a hit: one low thud.
export function playDamage() {
  if (!audio) return;
  const now = audio.currentTime;

  const osc = audio.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.32);

  const lowpass = audio.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(600, now);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(DAMAGE_GAIN, now);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.4);

  osc.connect(lowpass).connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + 0.42);
}
