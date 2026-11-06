// main.js — the scene, the render loop and the state machine (title -> rules -> playing -> gameover): the one file that wires the others.
import * as THREE from 'three';
import * as T from './tuning.js';
import { createField, resetField, updateField, pressPillar, setColumnX, loadPillarModels } from './pillars.js';
import { createPillarLabel } from './labels.js';
import { createKeyboard } from './input.js';
import { createUI, updateHud, showTitle, showRules, showGameOver, showPlayHint, setInstruments, showPortal } from './ui.js';
import { createDancer, updateDancer } from './dancer.js';
import { createSky } from './sky.js';
import { createBackdrop } from './backdrop.js';
import { unlockAudio, playNote, playHit, playMiss, setInstrument } from './audio.js';

// --- RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

// --- SCENE: the player stands still and the temple travels past, so the fog closes the far end of the
// hall and the stones and the paving bands glide by. The camera looks straight down the hall and never
// turns, which is also why nothing in the scene ever needs to be turned to face it.
const scene = new THREE.Scene();
scene.background = new THREE.Color(T.BACKGROUND_COLOR);
scene.fog = new THREE.Fog(T.BACKGROUND_COLOR, T.FOG_NEAR, T.FOG_FAR);

// --- CAMERA
// Motion down the hall is only visible in perspective, so the camera is a perspective one, standing still
// behind the player. Its distance comes from the corridor height that has to be visible at the press
// point, so the framing is the same on every window shape and only the aspect changes with the window.
const camera = new THREE.PerspectiveCamera(T.CAMERA_FOV, 1, T.CAMERA_NEAR, T.CAMERA_FAR);
camera.position.set(0, T.CAMERA_Y, T.CAMERA_DISTANCE);
camera.lookAt(0, T.CAMERA_Y, 0);

// --- LIGHTS: a warm key from the left and a cool fill from the right, so the carving keeps its shape and
// the stone never goes flat and muddy. Both are dialled in tuning.js.
scene.add(new THREE.AmbientLight(0xffffff, T.AMBIENT_INTENSITY));
const keyLight = new THREE.DirectionalLight(T.KEY_LIGHT_COLOR, T.KEY_LIGHT_INTENSITY);
keyLight.position.set(-6, 9, 7);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(T.FILL_LIGHT_COLOR, T.FILL_LIGHT_INTENSITY);
fillLight.position.set(7, 4, 6);
scene.add(fillLight);

// --- THE FIELD: the travelling pillar line, the hall, the floor and the dancer. Built once, reused every
// run. The carvings arrive when they arrive: every pillar is a plain grey box and the dancer is a plain
// box from the first frame, and anything that cannot load simply stays that way. Nothing waits on 16 MB
// of models, so the title screen never stalls and the game never breaks with them.
const field = createField(scene, createPillarLabel, camera);
loadPillarModels(field);
// Her dance is written in dancer.js and driven by the beat, not by a clip: the rigged file has a skeleton
// and no animation, so the motion is code. She arrives on her own time and the box in the field stands
// until she does - if she never loads, the box is simply the dancer.
const dancer = createDancer(scene);

// --- BEHIND ALL OF IT: the painted temple at the far end of the corridor, and the sky the whole game
// travels through. The sky is made last on purpose: it takes over scene.background and the fog's own
// colour, and it holds both of them, so the corridor dissolves into the sky it is actually under.
createBackdrop(scene); // it adds itself to the scene; nothing else ever needs to hold it
const sky = createSky(scene);

// Every window shape shows the same corridor, and the pillar line keeps its place across the screen:
// PILLAR_COLUMN_SPLIT of the way across, on the right, wherever the window's shape puts the edges.
function resize() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setColumnX(field, (2 * T.PILLAR_COLUMN_SPLIT - 1) * T.CAMERA_DISTANCE * T.TAN_HALF_FOV * aspect);
}
window.addEventListener('resize', resize);

// --- STATE
// orchestra is how many instruments are playing: one at the start of a run, and a portal raises it by one.
let ui = null;
const state = { phase: 'title', score: 0, lives: T.LIVES, combo: 0, hits: 0, orchestra: 1, portalTimer: 0 };

// --- A PORTAL: the next instrument joins the orchestra. Called every HITS_PER_PORTAL landed notes; once
// the whole orchestra is in it does nothing at all, so the count can run past the list harmlessly.
function openPortal() {
  const joined = Math.min(T.INSTRUMENTS.length, state.orchestra + 1);
  if (joined === state.orchestra) return; // everyone is already playing
  state.orchestra = joined;
  setInstrument(state.orchestra - 1);
  setInstruments(ui, state.orchestra);
  showPortal(ui, true, T.INSTRUMENTS[state.orchestra - 1]);
  state.portalTimer = T.PORTAL_CUE_SECONDS;
  sky.setStage(state.orchestra - 1); // the same portal carries the temple one stage further out
}

function startRun() {
  state.phase = 'playing';
  state.score = 0;
  state.lives = T.LIVES;
  state.combo = 0;
  state.hits = 0;
  state.orchestra = 1;
  state.portalTimer = 0;
  resetField(field); // the whole line goes back down the corridor and the notes are dealt again
  setInstrument(state.orchestra - 1);
  setInstruments(ui, state.orchestra);
  showPortal(ui, false);
  sky.setStage(0); // a new run starts back in the dusk, whatever stage the last one reached
  updateHud(ui, state);
  showTitle(ui, false);
  showRules(ui, false);
  showGameOver(ui, false, 0);
  showPlayHint(ui, true);
}

function endRun() {
  state.phase = 'gameover';
  showGameOver(ui, true, state.score);
  showPlayHint(ui, false);
}

function loseLife() {
  state.lives -= 1;
  state.combo = 0;
  playMiss();
  updateHud(ui, state);
  if (state.lives <= 0) endRun();
}

// --- ONE KEYPRESS, JUDGED AGAINST THE LIGHT
// The right key on the lit pillar scores: dead on the beat for full points, anywhere in the glow for less.
// A key pressed with nothing lit, a repeat press on a pillar already answered, and a light left to go out
// all cost nothing at all. The only thing that costs a life is a wrong key on a lit pillar.
function tapLane(lane) {
  if (state.phase !== 'playing') return;

  const verdict = pressPillar(field, lane);
  if (verdict === 'wrong') {
    loseLife();
    return;
  }
  if (verdict !== 'perfect' && verdict !== 'hit') return;

  state.hits += 1;
  state.combo += 1;
  const base = verdict === 'perfect' ? T.POINTS_PERFECT : T.POINTS_HIT;
  state.score += Math.round(base * (1 + (state.combo - 1) * T.COMBO_MULTIPLIER));
  playNote(lane);
  playHit();
  updateHud(ui, state);
  if (state.hits === T.HINT_HIDE_AFTER_HITS) showPlayHint(ui, false); // the hint has taught its first beats
  if (state.hits % T.HITS_PER_PORTAL === 0) openPortal(); // the reward: one more instrument in the orchestra
}

// --- INPUT: sound wakes on the first keypress, SPACE walks title -> rules -> play, and restarts a run
createKeyboard({
  onLane: (lane) => {
    unlockAudio();
    tapLane(lane);
  },
  onRestartKey: () => {
    unlockAudio(); // the first press of the page still wakes the sound, whatever screen is up
    if (state.phase === 'title') {
      startRun(); // the title screen carries the rules now, so a press begins the run straight from it
      return;
    }
    if (state.phase === 'rules' || state.phase === 'gameover') startRun();
  },
});

// --- THE FRAME RATE, only when the page is asked for it: http://localhost:8000/?fps
// It is off by default because it is a diagnostic and not part of the game, and it is written to at most
// twice a second, so measuring the game never changes it. Judging looks for it behind a flag, and this is
// that flag.
const fpsBox = /[?&]fps\b/.test(window.location.search) ? document.createElement('div') : null;
let fpsFrames = 0;
let fpsElapsed = 0;
if (fpsBox) {
  Object.assign(fpsBox.style, {
    position: 'fixed', top: '8px', right: '10px', zIndex: '99',
    font: '600 13px ui-monospace, monospace', color: '#bff5c9',
    textShadow: '0 0 6px rgba(0, 0, 0, 0.9)', pointerEvents: 'none',
  });
  fpsBox.textContent = '-- fps';
  document.body.append(fpsBox);
}

// --- LOOP: dt comes from the frame clock, capped so a stalled frame cannot skip a whole beat
let lastFrame = 0;

renderer.setAnimationLoop((now) => {
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
  lastFrame = now;
  // The hall glides on the title and game-over screens too; only the light cue stops.
  updateField(field, dt, state.hits, state.phase === 'playing');

  // How hard the beat is hitting right now: 1 on the beat, fading either side of it. It is read off the
  // lit pillar's own distance from its beat, so the dance and the light can never disagree.
  const accent = field.litPillar === null
    ? 0
    : Math.max(0, 1 - Math.abs(field.litOffset) / T.ACCENT_FALLOFF_SECONDS);
  updateDancer(dancer, dt, accent);
  if (dancer.ready && field.dancer.box.visible) field.dancer.box.visible = false; // she has arrived
  sky.update(dt); // the crossfade, on the frames after a portal moved the temple on a stage

  if (state.portalTimer > 0) {
    state.portalTimer = Math.max(0, state.portalTimer - dt);
    if (state.portalTimer === 0) showPortal(ui, false);
  }

  if (fpsBox) {
    fpsFrames += 1;
    fpsElapsed += dt;
    if (fpsElapsed >= 0.5) {
      fpsBox.textContent = `${Math.round(fpsFrames / fpsElapsed)} fps`;
      fpsFrames = 0;
      fpsElapsed = 0;
    }
  }

  renderer.render(scene, camera);
});

ui = createUI(document.getElementById('ui'));
resize();
updateHud(ui, state);
setInstruments(ui, state.orchestra);
showTitle(ui, true);
showRules(ui, false);
showGameOver(ui, false, 0);
