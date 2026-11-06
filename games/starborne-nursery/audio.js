// The AudioManager: every sound in Starborne Nursery, synthesised in code with the Web Audio API,
// so the game ships no audio files, downloads nothing, and can never lose its voice.
import {
  AUDIO_MASTER_VOLUME,
  AUDIO_FADE_IN,
  AUDIO_BED_LEVEL,
  AUDIO_BED_LOW,
  AUDIO_BED_HIGH,
  AUDIO_WIND_LEVEL,
  AUDIO_RAIN_LEVEL,
  AUDIO_FILTER_CALM,
  AUDIO_FILTER_STORM,
  CHIME_NOTES,
  CHIME_STEP,
  CHIME_DURATION,
  CHIME_LEVEL,
  GROWTH_NOTES,
  LAUNCH_LOW,
  LAUNCH_HIGH,
  LAUNCH_LEVEL,
  LAUNCH_SHIMMER_NOTES,
  LAUNCH_DURATION,
  AUDIO_PAD_LEVEL,
  AUDIO_PAD_TYPE,
  AUDIO_PAD_CHORD_SECONDS,
  AUDIO_PAD_ATTACK,
  AUDIO_PAD_RELEASE,
  AUDIO_PAD_CHORDS,
  AUDIO_MOTIF_LEVEL,
  AUDIO_MOTIF_SCALE,
  AUDIO_MOTIF_GAP_MIN,
  AUDIO_MOTIF_GAP_MAX,
  AUDIO_MOTIF_ATTACK,
  AUDIO_MOTIF_DURATION,
  AUDIO_MOTIF_PAIR_CHANCE,
  AUDIO_MOTIF_PAIR_STEP,
  AUDIO_MOTIF_PAIR_LEVEL,
  AUDIO_MOTIF_STEP_MAX,
  AUDIO_MOTIF_NIGHT_GAP,
  AUDIO_MOTIF_NIGHT_PITCH,
  AUDIO_MOTIF_NIGHT_BELOW,
  AUDIO_MOTIF_NIGHT_LEVEL,
  AUDIO_MOTIF_SEED,
  AUDIO_PLANT_THUD_HZ,
  AUDIO_PLANT_THUD_Q,
  AUDIO_PLANT_THUD_LEVEL,
  AUDIO_PLANT_THUD_DURATION,
  AUDIO_PLANT_THUD_ATTACK,
  AUDIO_PLANT_NOTE,
  AUDIO_PLANT_NOTE_LEVEL,
  AUDIO_PLANT_NOTE_DURATION,
  AUDIO_PLANT_NOTE_ATTACK,
  AUDIO_PICK_NOTES,
  AUDIO_PICK_LEVEL,
  AUDIO_PICK_STEP,
  AUDIO_PICK_DURATION,
  AUDIO_PICK_ATTACK,
  AUDIO_COIN_NOTES,
  AUDIO_COIN_LEVEL,
  AUDIO_COIN_STEP,
  AUDIO_COIN_DURATION,
  AUDIO_COIN_ATTACK,
  AUDIO_SELL_SHIFT,
  AUDIO_WHISTLE_NOTES,
  AUDIO_WHISTLE_LEVEL,
  AUDIO_WHISTLE_GAP,
  AUDIO_WHISTLE_DURATION,
  AUDIO_WHISTLE_ATTACK,
  AUDIO_WHISTLE_CUTOFF,
  AUDIO_WHISTLE_Q,
  AUDIO_CREAK_LEVEL,
  AUDIO_CREAK_HZ,
  AUDIO_CREAK_Q,
  AUDIO_CREAK_WOBBLE_HZ,
  AUDIO_CREAK_WOBBLE_DEPTH,
  AUDIO_CREAK_RAMP,
} from './tuning.js';

// --- Shape, not tune ---
// These few numbers have no home in tuning.js because they shape how a sound is built rather than
// how loud or how long a tuned moment is. They are local on purpose: tuning.js stays the makers'
// file, and the only knob a maker should need to turn is the one already exported there.
const SILENCE = 0.0001;          // exponential ramps cannot reach 0, so they land just above it
const VOICE_TAIL = 0.02;         // seconds a voice may run past its decay before it is stopped
const RAMP_TIME = 0.3;           // seconds constant: how fast gains and the wind filter follow a change
const MUTE_RAMP = 0.05;          // seconds the master takes to move, so muting never clicks
const BED_DETUNE = 4;            // cents the two bed notes are pulled apart, so the pair beats slowly
const BED_BREATHE_RATE = 0.05;   // breaths per second on the bed: one slow swell every 20 seconds
const BED_BREATHE_DEPTH = 0.3;   // how far below its full level the bed dips as it breathes
const NOISE_SECONDS = 2;         // length of the one noise buffer, made once and looped forever
const CHIME_ATTACK = 0.012;      // seconds: soft enough that a chime arrives rather than strikes
const GROWTH_LEVEL = 0.15;       // the growth lift is quieter than a feeding chime (raised with the music)
const GROWTH_DURATION = 0.5;     // ...and shorter than one: a small lift, not a fanfare
const GROWTH_OFFSET = 0.03;      // seconds between the two growth notes, so they land a hair apart
const GROWTH_ATTACK = 0.01;
const SWELL_ATTACK_SHARE = 0.15; // of LAUNCH_DURATION: how long the release swell takes to rise
const SWELL_FADE_SHARE = 0.35;   // and how much of the end is spent fading, rather than stopping dead
const SHIMMER_LEVEL = 0.06;      // the sparkles above the swell are very quiet (raised with the music)
const SHIMMER_DURATION = 1.0;    // seconds each sparkle rings for
const FADE_TO_SILENCE = 0.0001;  // a pad chord ramps to this before it is stopped, since exponentials never reach 0
const FULL_TURN = Math.PI * 2;

// The tune's own dice, the same trick island.js uses for its terrain: a small integer hash, so the
// music is written down rather than drawn. Two integers in, a number in 0..1 out, the same on every
// reload and every machine - which is why it is never Math.random.
function musicHash(a, b) {
  let h = Math.imul(a + AUDIO_MOTIF_SEED, 374761393) ^ Math.imul(b + 19, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noop() {}

// Swallow a promise that may reject: a resume or a close that fails is not worth reporting, and
// an unhandled rejection in the console is worse than the thing it would have reported.
function ignore(result) {
  if (result && typeof result.catch === 'function') result.catch(noop);
}

export function createAudio() {
  // Private state. All of it is null until start() builds it, and stays null forever on a machine
  // with no Web Audio - which is why every method below can run in silence without throwing.
  let ctx = null;
  let master = null;
  let bedGain = null;
  let windSource = null;
  let windFilter = null;
  let windGain = null;
  let noiseBuffer = null;  // the one noise buffer, shared by the wind, a seed's pat and the creak
  let padGain = null;      // the music pad's own bus, so the pad breathes as one and has one level
  let creakSource = null;  // the turning stone: a looping noise band, built once and only faded in and out
  let creakFilter = null;
  let creakGain = null;
  let creakWobble = null;  // its slow wander, built once with it
  let started = false;
  let failed = false;   // audio is unavailable: latched once, and every call after it is a no-op
  let muted = false;
  let bedTime = 0;      // seconds of bed breathing, the only state update() keeps
  // The music's clock. It rides ctx.currentTime, and notes and chords are built when they come due
  // rather than kept in a scheduler, so nothing exists between the moments that make a sound.
  let padIndex = 0;     // which chord is sounding, and therefore which one is next
  let nextPadAt = 0;    // the audio-clock time the next chord is due
  let motifAt = 0;      // and the same for the next motif note: 0 means it has not been armed yet
  let motifStep = 0;    // where in the scale the walk currently stands
  let motifCount = 0;   // how many motif notes have played: the walk's deterministic dice
  let turning = false;  // the island's turn, remembered so setTurning only touches the graph on a change

  // --- Unavailable audio ---
  // Drop the whole graph and latch into the silent state. A browser without Web Audio, or one
  // whose context refuses to build, must still be able to play the game - just quietly.
  function goSilent() {
    ctx = null;
    master = null;
    bedGain = null;
    windSource = null;
    windFilter = null;
    windGain = null;
    noiseBuffer = null;
    padGain = null;
    creakSource = null;
    creakFilter = null;
    creakGain = null;
    creakWobble = null;
    turning = false;
    started = false;
    failed = true;
  }

  // Close a context without ever throwing and without leaving a rejected promise behind.
  function quietClose(context) {
    if (!context) return;
    try {
      ignore(context.close());
    } catch (err) {
      // Already closed, or never really open. Either way, nothing left to do.
    }
  }

  // --- The master ---
  function buildMaster() {
    master = ctx.createGain();
    master.gain.value = AUDIO_MASTER_VOLUME;
    master.connect(ctx.destination);
  }

  // --- The bed ---
  // Two quiet sines a fifth apart, pulled a few cents out of tune with each other, so the pair
  // beats slowly and never settles into the flatness of a held test tone.
  function startDrone(frequency, detuneSign) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.detune.value = detuneSign * BED_DETUNE;
    osc.connect(bedGain);
    osc.start();
  }

  function buildBed() {
    bedGain = ctx.createGain();
    bedGain.gain.value = AUDIO_BED_LEVEL;
    bedGain.connect(master);
    startDrone(AUDIO_BED_LOW, 1);
    startDrone(AUDIO_BED_HIGH, -1);
  }

  // --- The wind ---
  // One short noise buffer, generated once and looped forever, so the every-frame setWeather can
  // never allocate a sample or a node. The filter sets its colour, the gain sets its strength.
  function makeNoiseBuffer() {
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function buildWind() {
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = AUDIO_FILTER_CALM;
    windFilter.Q.value = 0.7;            // a gentle shoulder, so the corner never whistles

    windGain = ctx.createGain();
    windGain.gain.value = 0;             // silence until the weather asks for some

    windSource = ctx.createBufferSource();
    // One buffer, made once and shared: the wind loops it, a seed's pat is a short burst of it, and
    // the stone creak is a band taken out of it, so the whole game carries a single two-second noise.
    noiseBuffer = makeNoiseBuffer();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSource.start();
  }

  // --- The music pad ---
  // A bus of its own under the master, so the pad and the chords that arrive on it share one level.
  function buildMusic() {
    padGain = ctx.createGain();
    padGain.gain.value = AUDIO_PAD_LEVEL;
    padGain.connect(master);
  }

  // One note of one chord. It fades up slowly, holds, then fades out slowly past the moment the next
  // chord arrives, so the two chords share a few seconds and the pad never stops and starts again.
  function padVoice(frequency, when, hold) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = AUDIO_PAD_TYPE;
    osc.frequency.setValueAtTime(frequency, when);

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + AUDIO_PAD_ATTACK);
    const fadeAt = when + Math.max(AUDIO_PAD_ATTACK + 0.1, hold);
    gain.gain.setValueAtTime(1, fadeAt);
    gain.gain.exponentialRampToValueAtTime(FADE_TO_SILENCE, fadeAt + AUDIO_PAD_RELEASE);

    osc.connect(gain);
    gain.connect(padGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(when);
    osc.stop(fadeAt + AUDIO_PAD_RELEASE + VOICE_TAIL);
  }

  function playChord(index, when) {
    const chord = AUDIO_PAD_CHORDS[index % AUDIO_PAD_CHORDS.length];
    for (let i = 0; i < chord.length; i++) padVoice(chord[i], when, AUDIO_PAD_CHORD_SECONDS);
  }

  // --- The motif ---
  // One note, or sometimes two together, built the moment it is due and gone when it has rung. The
  // walk moves a couple of scale steps at most each time, so the tune drifts around a phrase instead
  // of leaping about, and every choice comes from musicHash rather than chance.
  function playMotifNote(dayness) {
    const now = ctx.currentTime;
    const night = 1 - dayness;
    const move = Math.round((musicHash(motifCount, 1) * 2 - 1) * AUDIO_MOTIF_STEP_MAX);
    motifStep = Math.max(0, Math.min(AUDIO_MOTIF_SCALE.length - 1, motifStep + move));

    // After dark the notes drop an octave and come down in level: cosier and lower, never silent.
    const pitch = dayness < AUDIO_MOTIF_NIGHT_BELOW ? AUDIO_MOTIF_NIGHT_PITCH : 1;
    const level = AUDIO_MOTIF_LEVEL * (AUDIO_MOTIF_NIGHT_LEVEL + (1 - AUDIO_MOTIF_NIGHT_LEVEL) * dayness);

    makeVoice('sine', AUDIO_MOTIF_SCALE[motifStep] * pitch, level, now,
      AUDIO_MOTIF_DURATION, AUDIO_MOTIF_ATTACK);

    // Sometimes a second note goes with it, a couple of steps up the scale - which, in a pentatonic
    // scale, is always a fourth or a fifth, so the pair is consonant wherever the walk happens to be.
    if (musicHash(motifCount, 2) < AUDIO_MOTIF_PAIR_CHANCE) {
      const up = Math.min(AUDIO_MOTIF_SCALE.length - 1, motifStep + AUDIO_MOTIF_PAIR_STEP);
      makeVoice('sine', AUDIO_MOTIF_SCALE[up] * pitch, level * AUDIO_MOTIF_PAIR_LEVEL, now,
        AUDIO_MOTIF_DURATION, AUDIO_MOTIF_ATTACK);
    }
  }

  // --- The turning stone ---
  // Built once at start and never again: setTurning only ever moves one gain with a short time
  // constant, so it can be called sixty times a second without allocating anything or clicking. The
  // creak is a narrow band of the shared noise, wandering slowly, so the island grinds round on stone.
  function buildCreak() {
    creakFilter = ctx.createBiquadFilter();
    creakFilter.type = 'bandpass';
    creakFilter.frequency.value = AUDIO_CREAK_HZ;
    creakFilter.Q.value = AUDIO_CREAK_Q;

    creakGain = ctx.createGain();
    creakGain.gain.value = 0;   // silent until the island is turned

    creakSource = ctx.createBufferSource();
    creakSource.buffer = noiseBuffer;
    creakSource.loop = true;

    creakWobble = ctx.createOscillator();
    creakWobble.type = 'sine';
    creakWobble.frequency.value = AUDIO_CREAK_WOBBLE_HZ;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = AUDIO_CREAK_WOBBLE_DEPTH;
    creakWobble.connect(wobbleDepth);
    wobbleDepth.connect(creakFilter.frequency);   // the band's centre wanders with the wobble
    creakWobble.start();

    creakSource.connect(creakFilter);
    creakFilter.connect(creakGain);
    creakGain.connect(master);
    creakSource.start();
  }

  // --- One short voice ---
  // A moment builds its voices when it plays and each voice disconnects itself the moment it ends,
  // so a hundred feedings leave no hundred oscillators humming behind them.
  function makeVoice(type, frequency, level, when, duration, attack) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);

    // A soft attack, then a long exponential decay: a plucked, ringing note rather than a blip.
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    gain.gain.exponentialRampToValueAtTime(SILENCE, when + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(when);
    osc.stop(when + duration + VOICE_TAIL);
  }

  // A short burst of the shared noise, shaped by one filter, that disconnects itself when it ends.
  // The seed's pat and the train's whistle both want a colour rather than a pitch, and a filter is
  // how a noise gets one: a low-pass corner makes the earth, a low-pass on a tone sets the distance.
  function makeNoiseVoice(type, cutoff, q, level, when, duration, attack) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = noiseBuffer;
    src.loop = true;                 // the burst is shorter than the buffer, so it never has to end it
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, when);
    filter.Q.value = q;

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    gain.gain.exponentialRampToValueAtTime(SILENCE, when + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(when);
    src.stop(when + duration + VOICE_TAIL);
  }

  // A whistle: one tone behind a low-pass, which is what makes the train sound far off rather than
  // near. Soft attack and a long fade, so it slides in and away instead of arriving and stopping.
  function makeWhistleVoice(frequency, when) {
    const osc = ctx.createOscillator();
    const tone = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, when);
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(AUDIO_WHISTLE_CUTOFF, when);
    tone.Q.value = AUDIO_WHISTLE_Q;

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(AUDIO_WHISTLE_LEVEL, when + AUDIO_WHISTLE_ATTACK);
    gain.gain.exponentialRampToValueAtTime(SILENCE, when + AUDIO_WHISTLE_DURATION);

    osc.connect(tone);
    tone.connect(gain);
    gain.connect(master);
    osc.onended = () => {
      osc.disconnect();
      tone.disconnect();
      gain.disconnect();
    };
    osc.start(when);
    osc.stop(when + AUDIO_WHISTLE_DURATION + VOICE_TAIL);
  }

  // --- The gate ---
  // Browsers block audio until the player touches something, so nothing at all is created until
  // the title screen's Start button calls this. Safe to call twice: the second call finds it
  // already running and does nothing.
  function start() {
    if (started || failed) return;

    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) {
        failed = true;
        return;
      }
      ctx = new Ctor();
    } catch (err) {
      goSilent();
      return;
    }

    try {
      if (ctx.state === 'suspended') {
        try {
          ignore(ctx.resume());
        } catch (err) {
          // It will come back on the next gesture. The game plays on meanwhile.
        }
      }

      buildMaster();
      buildBed();
      buildWind();     // this makes the one noise buffer the creak also uses...
      buildMusic();
      buildCreak();    // ...so it must come after the wind

      // The bed is faded in from nothing rather than snapped on, so the first sound the player
      // hears eases in under the world.
      const now = ctx.currentTime;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(muted ? 0 : AUDIO_MASTER_VOLUME, now + AUDIO_FADE_IN);

      started = true;
    } catch (err) {
      // A half-built graph would only ever be a source of noise. Close it and go quiet for good.
      const broken = ctx;
      goSilent();
      quietClose(broken);
    }
  }

  function isStarted() {
    return started;
  }

  // --- Weather ---
  // Called every frame by main.js. It only ever nudges two existing AudioParams with a short time
  // constant, so nothing clicks on a gust, and nothing is ever allocated. A strength that is not
  // a finite number is treated as calm rather than handed to the audio graph.
  function setWeather(strength, isRaining) {
    if (!started) return;

    const amount = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0;
    const level = AUDIO_WIND_LEVEL * amount + (isRaining ? AUDIO_RAIN_LEVEL : 0);
    const cutoff = AUDIO_FILTER_CALM + (AUDIO_FILTER_STORM - AUDIO_FILTER_CALM) * amount;
    const now = ctx.currentTime;

    windGain.gain.setTargetAtTime(level, now, RAMP_TIME);
    windFilter.frequency.setTargetAtTime(cutoff, now, RAMP_TIME);
  }

  // --- Feeding: a gentle rising triad, the sound of being cared for ---
  function playFeed() {
    if (!started) return;
    const now = ctx.currentTime;
    for (let i = 0; i < CHIME_NOTES.length; i++) {
      const when = now + i * CHIME_STEP;
      makeVoice('triangle', CHIME_NOTES[i], CHIME_LEVEL, when, CHIME_DURATION, CHIME_ATTACK);
    }
  }

  // --- Growing: two notes a hair apart, brighter and shorter than a feeding chime ---
  function playGrow() {
    if (!started) return;
    const now = ctx.currentTime;
    for (let i = 0; i < GROWTH_NOTES.length; i++) {
      const when = now + i * GROWTH_OFFSET;
      makeVoice('sine', GROWTH_NOTES[i], GROWTH_LEVEL, when, GROWTH_DURATION, GROWTH_ATTACK);
    }
  }

  // --- The release: the one big moment, and the only loud one ---
  function playLaunch() {
    if (!started) return;

    const now = ctx.currentTime;

    // A swell gliding the whole way up. Exponential, not linear: a linear sweep to the top spends
    // most of its time still sounding low, whereas this sounds like a swell actually rising.
    const swell = ctx.createOscillator();
    const swellGain = ctx.createGain();
    swell.type = 'triangle';
    swell.frequency.setValueAtTime(LAUNCH_LOW, now);
    swell.frequency.exponentialRampToValueAtTime(LAUNCH_HIGH, now + LAUNCH_DURATION);

    // Rise, hold, then spend the last of the launch fading away, rather than stopping dead. Both
    // the attack and the fade are shares of LAUNCH_DURATION, so retuning the launch keeps its shape.
    const fadeStart = now + LAUNCH_DURATION * (1 - SWELL_FADE_SHARE);
    swellGain.gain.setValueAtTime(0, now);
    swellGain.gain.linearRampToValueAtTime(LAUNCH_LEVEL, now + LAUNCH_DURATION * SWELL_ATTACK_SHARE);
    swellGain.gain.setValueAtTime(LAUNCH_LEVEL, fadeStart);
    swellGain.gain.exponentialRampToValueAtTime(SILENCE, now + LAUNCH_DURATION);

    swell.connect(swellGain);
    swellGain.connect(master);
    swell.onended = () => {
      swell.disconnect();
      swellGain.disconnect();
    };
    swell.start(now);
    swell.stop(now + LAUNCH_DURATION + VOICE_TAIL);

    // Sparkles above the swell, spaced evenly across the launch, so they arrive in ones and twos.
    const spread = LAUNCH_DURATION / (LAUNCH_SHIMMER_NOTES.length + 1);
    for (let i = 0; i < LAUNCH_SHIMMER_NOTES.length; i++) {
      const when = now + spread * (i + 1);
      const note = LAUNCH_SHIMMER_NOTES[i];
      makeVoice('sine', note, SHIMMER_LEVEL, when, SHIMMER_DURATION, CHIME_ATTACK);
    }
  }

  // --- A seed goes into the bed: a pat of soil ---
  // The filtered noise is the earth taking it; the low sine under it is the weight of the seed, so
  // the sound lands rather than taps.
  function playPlant() {
    if (!started) return;
    const now = ctx.currentTime;
    makeNoiseVoice('lowpass', AUDIO_PLANT_THUD_HZ, AUDIO_PLANT_THUD_Q, AUDIO_PLANT_THUD_LEVEL,
      now, AUDIO_PLANT_THUD_DURATION, AUDIO_PLANT_THUD_ATTACK);
    makeVoice('sine', AUDIO_PLANT_NOTE, AUDIO_PLANT_NOTE_LEVEL, now,
      AUDIO_PLANT_NOTE_DURATION, AUDIO_PLANT_NOTE_ATTACK);
  }

  // --- A crop comes out: two small bright plucks, rising, short ---
  // Deliberately not the feeding chord: two notes, sine, and over in a moment, so a pick is a pick.
  function playPick() {
    if (!started) return;
    const now = ctx.currentTime;
    for (let i = 0; i < AUDIO_PICK_NOTES.length; i++) {
      const when = now + i * AUDIO_PICK_STEP;
      makeVoice('sine', AUDIO_PICK_NOTES[i], AUDIO_PICK_LEVEL, when, AUDIO_PICK_DURATION, AUDIO_PICK_ATTACK);
    }
  }

  // --- The coin clink, and its mirror ---
  // One function builds both, from the one set of notes: buying plays them up and selling plays the
  // same two the other way round and a step lower, so the pair is told apart with the eyes shut.
  function playClink(notes, level) {
    const now = ctx.currentTime;
    for (let i = 0; i < notes.length; i++) {
      const when = now + i * AUDIO_COIN_STEP;
      makeVoice('triangle', notes[i], level, when, AUDIO_COIN_DURATION, AUDIO_COIN_ATTACK);
    }
  }

  function playBuy() {
    if (!started) return;
    playClink(AUDIO_COIN_NOTES, AUDIO_COIN_LEVEL);
  }

  function playSell() {
    if (!started) return;
    const down = [
      AUDIO_COIN_NOTES[1] * AUDIO_SELL_SHIFT,
      AUDIO_COIN_NOTES[0] * AUDIO_SELL_SHIFT,
    ];
    playClink(down, AUDIO_COIN_LEVEL);
  }

  // --- The sky train: one gentle whistle, up as it arrives and down as it pulls out ---
  function playWhistle(reversed) {
    const now = ctx.currentTime;
    for (let i = 0; i < AUDIO_WHISTLE_NOTES.length; i++) {
      const note = reversed
        ? AUDIO_WHISTLE_NOTES[AUDIO_WHISTLE_NOTES.length - 1 - i]
        : AUDIO_WHISTLE_NOTES[i];
      makeWhistleVoice(note, now + i * AUDIO_WHISTLE_GAP);
    }
  }

  function playArrive() {
    if (!started) return;
    playWhistle(false);
  }

  function playDepart() {
    if (!started) return;
    playWhistle(true);
  }

  // --- The island being turned ---
  // Called every frame from main.js with a plain boolean. The graph is already built, so this only
  // moves one gain and only when the answer actually changes: no node is ever made here. The short
  // time constant is what keeps the fade from clicking as the creak comes and goes.
  function setTurning(isTurning) {
    if (!started) return;
    const want = !!isTurning;
    if (want === turning) return;
    turning = want;
    creakGain.gain.setTargetAtTime(want ? AUDIO_CREAK_LEVEL : 0, ctx.currentTime, AUDIO_CREAK_RAMP);
  }

  // --- Muting ---
  // Move the master without ever clicking: cancelAndHold keeps the gain where the fade-in had
  // actually reached, so muting part-way through it does not jump the level.
  function setMuted(value) {
    muted = !!value;   // remembered before start() too, so a muted player stays muted
    if (!started) return;

    const now = ctx.currentTime;
    if (typeof master.gain.cancelAndHoldAtTime === 'function') {
      master.gain.cancelAndHoldAtTime(now);
    } else {
      master.gain.cancelScheduledValues(now);
    }
    master.gain.setTargetAtTime(muted ? 0 : AUDIO_MASTER_VOLUME, now, MUTE_RAMP);
  }

  // --- The per-frame tick ---
  // Exists so main.js has one call each frame. The bed breathes very slowly here, and the music's
  // clock runs: chords and motif notes are built the moment they come due, so nothing exists in
  // between them. dayness is 1 in daylight and 0 at night, and anything that is not a finite number
  // is treated as daylight, so a caller with no clock still gets the tune.
  function update(dt, dayness) {
    if (!started) return;
    if (!Number.isFinite(dt)) return;

    const day = Number.isFinite(dayness) ? Math.min(1, Math.max(0, dayness)) : 1;

    bedTime += dt;
    const breath = 0.5 - 0.5 * Math.sin(bedTime * FULL_TURN * BED_BREATHE_RATE);
    const target = AUDIO_BED_LEVEL * (1 - BED_BREATHE_DEPTH * breath);
    bedGain.gain.setTargetAtTime(target, ctx.currentTime, RAMP_TIME);

    // The music runs on the audio clock rather than on dt. It is the one clock that cannot outrun the
    // sound it is scheduling: a long frame cannot stack a chord or a run of notes on one instant, and
    // while the browser holds the context suspended - its clock frozen at zero until the title click
    // opens it - the tune simply waits rather than gathering up notes to fire all at once later.
    const now = ctx.currentTime;

    // One chord at a time, held until the next is due. A whole chord is built at once, and only every
    // AUDIO_PAD_CHORD_SECONDS, so this is nothing like a node per frame. The next chord is measured
    // from now rather than from the chord before, so a stalled frame can never land two together.
    if (now >= nextPadAt) {
      playChord(padIndex, now);
      padIndex++;
      nextPadAt = now + AUDIO_PAD_CHORD_SECONDS;
    }

    // The motif: sparse, and drawn from the hash rather than the clock so it varies without settling
    // into a bar. Its gaps stretch after dark, which is the whole of the night's touch on the tune.
    if (motifAt === 0) motifAt = now + AUDIO_MOTIF_GAP_MIN;   // armed a few seconds in, not on the first frame
    if (now >= motifAt) {
      playMotifNote(day);
      const gap = AUDIO_MOTIF_GAP_MIN + (AUDIO_MOTIF_GAP_MAX - AUDIO_MOTIF_GAP_MIN) * musicHash(motifCount, 3);
      motifAt = now + gap * (1 + (1 - day) * AUDIO_MOTIF_NIGHT_GAP);
      motifCount++;
    }
  }

  return {
    start,
    update,
    setWeather,
    playFeed,
    playGrow,
    playLaunch,
    playPlant,
    playPick,
    playBuy,
    playSell,
    playArrive,
    playDepart,
    setTurning,
    setMuted,
    isStarted,
  };
}
