// audio.js — the instrument notes: real recorded samples when they have loaded, the synth voices underneath as the fallback that always plays.
import {
  SWARA_FREQUENCIES, INSTRUMENT_VOICES, HIT_FREQUENCY, HIT_TONE, MISS_FREQUENCY, MISS_TONE,
} from './tuning.js';

// --- SAMPLE GAINS, one named constant per instrument, in the game's order (Tabla, Sitar, Flute, Dhol, Santoor).
// Tune these by number here. They move into tuning.js once the layout pass finishes.
const SAMPLE_GAIN_TABLA = 1.0;
const SAMPLE_GAIN_SITAR = 1.0;
const SAMPLE_GAIN_FLUTE = 1.0;
const SAMPLE_GAIN_DHOL = 1.0;
// The tanpura is the quiet one: it peaks around -24 dBFS where the other recordings sit near full scale, so it
// needs a large boost, not a small one. THIS IS THE VALUE MOST LIKELY TO MOVE — tune it by number here.
const SAMPLE_GAIN_TANPURA = 14.0;

const SAMPLE_URLS = [
  './assets/audio/tabla.mp3',
  './assets/audio/sitar.mp3',
  './assets/audio/flute.mp3',
  './assets/audio/dhol.wav',
  './assets/audio/tanpura.mp3', // the Santoor slot is played by the tanpura sample
];
const SAMPLE_GAINS = [
  SAMPLE_GAIN_TABLA, SAMPLE_GAIN_SITAR, SAMPLE_GAIN_FLUTE, SAMPLE_GAIN_DHOL, SAMPLE_GAIN_TANPURA,
];

const SAMPLE_ATTACK_SECONDS = 0.005;  // a hair of fade so a sample never clicks
const SAMPLE_RELEASE_SECONDS = 0.08;  // and a short tail ramp so stopping it never clicks
const SAMPLE_TAIL_SECONDS = 0.02;     // how long past the ramp the source is allowed to run

let context = null;
let instrument = 0; // which voice the notes use: 0 = Tabla, moved on by setInstrument()
const sampleBuffers = [null, null, null, null, null]; // decoded samples, one per instrument slot; null means "use the synth"
let samplesRequested = false; // the fetches start once, on the first unlock

// Browsers block sound until the player has interacted, so main.js calls this on the first keypress.
export function unlockAudio() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
  }
  if (context.state === 'suspended') context.resume();
  loadSamples(); // fire and forget: nothing waits on it and the synth voices carry every note until a sample lands
}

// Kick off the five fetches and decodes, once. A slot that is missing, broken or slow simply stays null.
function loadSamples() {
  if (samplesRequested) return;
  samplesRequested = true;
  for (let index = 0; index < SAMPLE_URLS.length; index += 1) requestSample(SAMPLE_URLS[index], index);
}

function requestSample(url, index) {
  if (!context) return;
  try {
    fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : null)) // a 404 is not an error here, just no sample
      .then((data) => (data ? decodeSample(data) : null))
      .then((buffer) => { if (buffer) sampleBuffers[index] = buffer; })
      .catch(() => {}); // a fetch or decode that fails leaves the slot on its synth voice, quietly
  } catch (error) {
    // even if fetch threw outright, the slot keeps its synth voice
  }
}

function decodeSample(data) {
  try {
    const decoded = context.decodeAudioData(data);
    if (decoded && typeof decoded.then === 'function') return decoded.catch(() => null);
    return Promise.resolve(decoded || null);
  } catch (error) {
    return Promise.resolve(null); // an undecodable file is the same as a missing one
  }
}

// One voice: an oscillator pair shaped by a voice row from tuning.js. Short-lived, so nothing to keep.
function tone(frequency, voice) {
  if (!context) return;
  const now = context.currentTime;
  const base = frequency * (voice.octave ?? 1);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(voice.gain, now + (voice.attack ?? 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);
  gain.connect(context.destination);

  const oscillators = [];
  const main = context.createOscillator();
  main.type = voice.type;
  main.frequency.setValueAtTime(base * (voice.pitchStart ?? 1), now);
  if (voice.pitchStart && voice.pitchStart !== 1) {
    main.frequency.exponentialRampToValueAtTime(base, now + Math.max(0.001, voice.dropTime ?? 0.02));
  }
  main.connect(gain);
  oscillators.push(main);

  if (voice.detuneCents) { // a second string a little out of tune: the buzz of the sitar and the santoor
    const second = context.createOscillator();
    second.type = voice.type;
    second.frequency.setValueAtTime(base, now);
    second.detune.setValueAtTime(voice.detuneCents, now);
    second.connect(gain);
    oscillators.push(second);
  }

  for (const oscillator of oscillators) {
    oscillator.start(now);
    oscillator.stop(now + voice.duration + 0.02);
  }
}

// One recorded note: the sample for the current instrument, sped up or slowed so the seven lanes are the
// seven swaras, through its own gain node at that instrument's level.
function sample(frequency, level) {
  const buffer = sampleBuffers[instrument];
  if (!context || !buffer) return false;
  const now = context.currentTime;
  const rate = frequency / SWARA_FREQUENCIES[0];

  const gain = context.createGain();
  const peak = Math.max(0.0001, level);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + SAMPLE_ATTACK_SECONDS);
  gain.connect(context.destination);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(rate, now);
  source.connect(gain);

  const end = now + buffer.duration / Math.max(0.0001, rate);
  const release = Math.max(now + SAMPLE_ATTACK_SECONDS, end - SAMPLE_RELEASE_SECONDS);
  gain.gain.setValueAtTime(peak, release);
  gain.gain.linearRampToValueAtTime(0.0001, end);

  source.start(now);
  source.stop(end + SAMPLE_TAIL_SECONDS);
  return true;
}

// --- THE ONE PLACE A NOTE IS PLAYED: the sample when it is loaded, the synth voice otherwise.
// index is the portal count: 0 Tabla, then Sitar, Flute, Dhol, Santoor, and it holds on the last one.
export function setInstrument(index) {
  const safe = Number.isFinite(index) ? Math.floor(index) : 0;
  instrument = Math.max(0, Math.min(INSTRUMENT_VOICES.length - 1, safe));
}

export function playNote(laneIndex) {
  const frequency = SWARA_FREQUENCIES[laneIndex];
  if (!frequency) return;
  if (sample(frequency, SAMPLE_GAINS[instrument])) return;
  tone(frequency, INSTRUMENT_VOICES[instrument]);
}

// --- FEEDBACK
export function playHit() {
  tone(HIT_FREQUENCY, HIT_TONE);
}

export function playMiss() {
  tone(MISS_FREQUENCY, MISS_TONE);
}
