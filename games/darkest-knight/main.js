// M2: the two-fight gauntlet — title screen, stamina gauge, impact sparks, the fight states, and the
// held hand-over (a line and a beat of silence) between the intro boss and the lord.
import * as THREE from 'three';
import {
  arenaRadius, playerHealthMax, enemyGaugeMax, staminaMax, restartKey, enemySpawnZ,
  impactHeight, impactAlongBlades, stunTime, swingCooldown,
  transitionFadeIn, transitionHold, transitionFadeOut, transitionSilence,
} from './tuning.js';
import { ENEMIES, Enemy } from './enemies.js';
import {
  resolveParry, createFightState, applyOutcome, chargeStamina, canAct, attackEnemy,
  regenerateStamina, breakGuard, tickStun,
} from './combat.js';
import { createPlayer } from './player.js';
import { createUI } from './ui.js';
import { createFx } from './fx.js';
import { createArena } from './art.js';
import { createSfx } from './sfx.js';

const GAME_TITLE = 'Darkest Knight'; // one string: the name on the title screen (meta.json title too)
// The one line held on screen between the two fights. PLACEHOLDER: the makers write the real words; this
// single string is where they go, and nothing else about the hand-over is theirs to touch.
const TRANSITION_LINE = 'Time to get serious';
const OUTCOME_WORDS = {
  perfect: 'PERFECT PARRY', block: 'BLOCK', hit: 'HIT', winded: 'WINDED', wild: 'WILD',
};
const RESTART_KEY = String(restartKey).toLowerCase();
const RESTART_WORD = RESTART_KEY.toUpperCase();
const TITLE_TEXT =
  `${GAME_TITLE}\n\nSpace or right mouse parries. Left mouse or E attacks.\n\nPress any key or click to begin`;
const DEAD_TEXT = `You died — press ${RESTART_WORD} to fight again`;
const WIN_TEXT = `You have killed the lord of the castle.\n\nPress ${RESTART_WORD} to start over`;

// --- world ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#05060a');
scene.fog = new THREE.Fog('#05060a', 4, 24);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// Barely-there cold light; the lantern carried by the player does the rest.
scene.add(new THREE.HemisphereLight('#2b3648', '#08070a', 0.35));
scene.add(new THREE.AmbientLight('#1a1410', 0.4));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(arenaRadius * 6, arenaRadius * 6),
  new THREE.MeshStandardMaterial({ color: '#171214', roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const player = createPlayer(scene, camera, renderer.domElement);
const ui = createUI();
const fx = createFx(scene, camera);
const sfx = createSfx();

// --- the world behind the fight ---
// The tatami hall is where he starts, among the lord's ordinary guards; the golden throne room is the end
// of that road. One arena is built at a time, and the swap is driven by the 'fightchange' hook below.
const arena = createArena(scene);
arena.build('tatami');

// --- the music ---
// THE TRACK SCORES THE WHOLE OF THE LORD'S FIGHT, from the moment he walks in to the moment one of you
// stops moving. It used to arrive at half health only, and worse, it used to CONDUCT him: his next blade
// was scheduled to land on a beat read off the track's own playback position, with the heavy on the
// loudest beat of the bar. The makers asked for the music over the entire fight and for him to attack
// regardless of the beat. The conducting also had to go for a plainer reason than taste — it made his
// ability to attack DEPEND on a sound playing, so a blocked autoplay or a file the browser would not
// decode left the lord standing still for the rest of the fight, which is exactly what was happening.
// His cadence is his own now, in every fight and every phase of it: the track is the room he fights in,
// not the clock he fights to.
const bossMusic = new Audio('assets/audio/boss-theme.wav');
bossMusic.loop = true;
bossMusic.volume = 0.9;

// True for the whole of the last fight, and false the instant it ends either way.
function inFinalFight() {
  return phase === 'fight' && fightIndex === ENEMIES.length - 1 && !state.over && !state.won;
}

// Browsers refuse programmatic playback until the page has been interacted with, and a refused play() is
// SILENT rather than an error — so the boss music could simply never be heard, with nothing anywhere
// saying why. The title screen already takes a keypress to leave, so this spends that gesture: play the
// track once, stop it, and the browser then lets it start on its own when the lord walks in.
let audioUnlocked = false;
let unlocking = false; // one attempt in the air at a time: a press can reach here along two paths at once
function unlockAudio() {
  // Only latch on SUCCESS. Latching on the attempt was wrong: one refused play() would then mean the
  // music never got another chance, and every later press would be thrown away.
  if (audioUnlocked || unlocking || inFinalFight()) return;
  unlocking = true;
  bossMusic.play().then(() => {
    audioUnlocked = true;
    bossMusic.pause();
    bossMusic.currentTime = 0;
  }).catch(() => {
    /* refused again: not latched, so the next press tries again */
  }).then(() => {
    unlocking = false;
  });
}

// Whatever is playing stops the moment the fight is not running: a death, a restart or the win.
function updateMusic() {
  const on = inFinalFight();
  if (on && bossMusic.paused) {
    bossMusic.currentTime = 0;
    bossMusic.play().catch(() => {}); // a browser that refuses audio is not a crash
  } else if (!on && !bossMusic.paused) {
    bossMusic.pause();
    bossMusic.currentTime = 0;
  }
}

// Where the two blades meet: halfway between the player at the origin and the enemy out front, at
// chest height. Built once and reused, so a parry allocates nothing.
const impact = new THREE.Vector3(0, impactHeight, enemySpawnZ * impactAlongBlades);

// --- fight ---
let phase = 'title'; // 'title' | 'fight' | 'transition' | 'won'
let fightIndex = 0; // which of ENEMIES we are on
let enemy = null; // null on the title screen and through the hand-over: every use below is guarded
let state = createFightState(ENEMIES[0]); // the numbers; nothing reads them until a fight begins
let answeredThisAttack = false; // did the player already answer this attack? one mistake, one cost
let attackCooldown = 0; // seconds until the player may cut again: one swing at a time

// The hand-over between the two fights: which part of it is running, how long is left of it, and which
// fight is waiting on the far side. All three are cleared the moment the hand-over ends or is abandoned.
let transitionStage = null; // null | 'in' | 'hold' | 'out' | 'silence'
let transitionTimer = 0; // seconds left in the part that is running
let transitionNext = 0; // the fight index waiting beyond the hand-over

function refreshBars() {
  ui.setHealth(state.playerHealth, playerHealthMax);
  ui.setStamina(state.stamina, staminaMax, !canAct(state)); // the bar itself announces the lockout
  ui.setGauge(state.enemyGauge, (state.enemyConfig && state.enemyConfig.gaugeMax) || enemyGaugeMax);
  ui.setEnemyHealth(state.enemyHealth, (state.enemyConfig && state.enemyConfig.health) || state.enemyHealth,
                    enemy ? enemy.config.name.toUpperCase() : '');
}

function showOutcome(outcome) {
  ui.setOutcome(OUTCOME_WORDS[outcome] || outcome, outcome);
}

// What each outcome looks like on screen: the winded guard never came up, so that one is blood; a wild
// swing connected with nothing, so it gets the faint cold block look instead of blood.
const EFFECT_KIND = { winded: 'hit', wild: 'block' };

function fxKind(outcome) {
  return EFFECT_KIND[outcome] || outcome;
}

// WHERE THE PLAYER'S BLADE LANDS. Every other burst in the game happens at the meeting point in mid-air
// between the two of you, because every other burst is two blades touching. A cut is the one blow that
// got PAST his guard, so it lands on him — at his chest, wherever he has staggered to.
const _cutPoint = new THREE.Vector3();

function cutSpark() {
  _cutPoint.copy(enemy.mesh.position);
  _cutPoint.y += impactHeight;
  fx.parrySpark('cut', _cutPoint);
}

// His guard has just been emptied: he is out for stunTime, and the body has to stop with it — a perfect
// parry can land halfway through his swing, and a player who parried it must never eat that blade.
// While he is out the guard reads 0; the moment the stun ends it snaps back to full (tickStun).
function breakEnemyGuard() {
  breakGuard(state, stunTime);
  if (enemy) enemy.stun();
  answeredThisAttack = false; // there is no attack left in the air to answer
}

// Anything that drains the guard calls this: it is the only way into the stun, and it never restarts one.
function checkGuardBreak() {
  if (state.enemyGauge <= 0 && !state.stunned) breakEnemyGuard();
}

// Fights must not leak: drop the old body and free its geometry and materials.
function disposeEnemy() {
  if (!enemy) return;
  scene.remove(enemy.mesh);
  enemy.mesh.traverse((part) => {
    if (part.geometry) part.geometry.dispose();
    const materials = Array.isArray(part.material) ? part.material : part.material ? [part.material] : [];
    for (const material of materials) material.dispose();
  });
  enemy = null;
}

// One fight from the top: a fresh enemy of the current kind, full health and full wind for the player.
function startFight() {
  disposeEnemy();
  enemy = new Enemy(scene, ENEMIES[fightIndex]);
  enemy.mesh.position.set(0, 0, enemySpawnZ);
  state = createFightState(ENEMIES[fightIndex]); // fresh health, full guard, no stale stun
  answeredThisAttack = false;
  attackCooldown = 0;
  player.reset();
  fx.reset();
  ui.showHud(); // in case this fight is being entered straight out of a hand-over
  ui.setFight(`FIGHT ${fightIndex + 1} / ${ENEMIES.length} — ${ENEMIES[fightIndex].name.toUpperCase()}`);
  ui.setOutcome('READY', 'ready');
  ui.hideMessage(); // the instructions belong to the title screen now, not over the enemy's chest
  refreshBars();
}

// THE HAND-OVER between the two fights. The makers asked for it in as many words: a held moment, a line on
// the screen, and then a beat of silence before the next fight starts. The defeated boss is already gone,
// the HUD is down, the room stays, and every input except R is ignored for as long as it runs. One line
// fades up ('in'), holds ('hold'), fades away ('out'), and then the room sits empty and still ('silence')
// with nothing on screen at all — that pause is the point, so it is a real wait, not a formality.
function beginTransition(nextIndex) {
  disposeEnemy(); // the boss we just killed leaves the scene for good: nothing to look at, nothing to hit
  phase = 'transition';
  transitionNext = nextIndex;
  transitionStage = 'in';
  transitionTimer = transitionFadeIn;
  ui.setFight(''); // no fight label over the hand-over
  ui.hideHud(); // and no HUD: the room, the line, and nothing else
  ui.setMessage(TRANSITION_LINE);
  ui.setMessageOpacity(0); // it comes up from nothing: setMessage always shows at full strength first
}

// One frame of the hand-over. Each part runs its own timer; the overshoot is dropped rather than carried,
// so every part lasts exactly as long as its knob says. Past the last part the world changes.
function updateTransition(dt) {
  transitionTimer = Math.max(0, transitionTimer - dt);
  if (transitionStage === 'in') {
    const k = transitionFadeIn > 0 ? 1 - transitionTimer / transitionFadeIn : 1;
    ui.setMessageOpacity(k);
  } else if (transitionStage === 'out') {
    const k = transitionFadeOut > 0 ? transitionTimer / transitionFadeOut : 0;
    ui.setMessageOpacity(k);
  }
  if (transitionTimer > 0) return;

  if (transitionStage === 'in') {
    ui.setMessageOpacity(1);
    transitionStage = 'hold';
    transitionTimer = transitionHold;
  } else if (transitionStage === 'hold') {
    transitionStage = 'out';
    transitionTimer = transitionFadeOut;
  } else if (transitionStage === 'out') {
    ui.setMessageOpacity(0);
    ui.hideMessage(); // the line is gone: from here the screen is empty
    transitionStage = 'silence';
    transitionTimer = transitionSilence;
  } else {
    // The beat of silence is over, and only now does anything happen: enterFight builds the next enemy
    // and fires 'fightchange', which is the one call site the arena swap hangs off.
    enterFight(transitionNext);
  }
}

// THE FIGHT CHANGE — the one and only place the run moves from one fight to the next, and the one call
// site the world hangs its arena swap off. The index changes here, the new enemy is built here, and
// nothing else advances the run. `fightIndex` is the readable index (0 = the intro boss, 1 = the lord),
// and this fires a 'fightchange' event on window with { index, id, name } so the arena can follow: the
// tatami hall for index 0, the golden throne room for index 1. Past the last enemy the run is simply won.
// Reached through the hand-over when a boss falls, so by the time it runs the silence has already passed.
function enterFight(index) {
  transitionStage = null; // whatever hand-over was running is over: nothing carries into the fight
  transitionTimer = 0;
  if (index >= ENEMIES.length) {
    phase = 'won';
    ui.setMessage(WIN_TEXT);
    return;
  }
  fightIndex = index;
  phase = 'fight';
  startFight();
  window.dispatchEvent(new CustomEvent('fightchange', {
    detail: { index, id: ENEMIES[index].id, name: ENEMIES[index].name },
  }));
}

// The title screen: no enemy at all, and nothing moves until the player presses something.
function toTitle() {
  disposeEnemy();
  transitionStage = null; // a hand-over abandoned halfway leaves nothing behind: no timer, no line
  transitionTimer = 0;
  phase = 'title';
  fightIndex = 0;
  arena.build('tatami'); // the run begins, and begins again, in the hall
  state = createFightState(ENEMIES[0]);
  answeredThisAttack = false;
  attackCooldown = 0;
  player.reset();
  fx.reset();
  ui.showHud();
  ui.setFight('');
  ui.setOutcome('READY', 'ready');
  ui.setMessage(TITLE_TEXT);
  refreshBars();
}

function beginRun() {
  unlockAudio(); // the run begins on a real keypress: the one chance to earn the right to play sound
  enterFight(0);
}

// THE ROOM FOLLOWS THE RUN. `fightchange` is the one hook enterFight fires, and it fires after the
// hand-over's silence rather than at the moment the killing blow lands — so the world turns gold exactly
// when the lord walks in, and not a beat before it.
window.addEventListener('fightchange', (e) => {
  arena.build(e.detail.index === ENEMIES.length - 1 ? 'throne' : 'tatami');
});

// Beat one and the next walks in — but not at once: the run goes through the hand-over first, so the
// next arena is only built once the line has come and gone and the room has gone quiet. Beat the lord
// and there is nothing after him but the win.
function winFight() {
  const next = fightIndex + 1;
  if (next >= ENEMIES.length) enterFight(next);
  else beginTransition(next);
}

// One key, no reload: restart the SAME fight with both sides back to full.
function restart() {
  if (phase === 'title') beginRun(); // R works from the title too
  else if (phase === 'won') toTitle(); // from the win, R starts the run over
  else if (phase === 'transition') toTitle(); // R is the one key the hand-over listens to
  else startFight(); // dead or mid-fight: same fight, both sides full
}

// The one action: press while the blade is coming through. Press early and you block — blood and wind.
// Press into the wind-up or at empty air and it is a wild swing: wind spent, blood untouched.
// Out of wind and the press does not happen at all: no parry, no block, no cut — and nothing spent,
// because there is nothing left to spend. Being wide open with an empty bar is the risk the bar warns of.
function parry() {
  if (phase !== 'fight' || !enemy || state.over || state.won) return;
  if (!canAct(state)) return; // winded: the blade will not come up, not even for a perfect parry
  // The parry itself is weightless: a heavy is judged on the same window. Only the price of a miss (or of
  // a block, which is a swing absorbed rather than stopped) knows the swing was heavy.
  const outcome = applyOutcome(state, resolveParry(enemy.timeSinceSwing, enemy.parryOpensAt), enemy.isHeavy).lastOutcome;
  chargeStamina(state, outcome); // the press spends the wind, whatever it turned out to be
  // Only a press while the blade is actually coming through answers this attack, so the landing frame
  // must not bill it twice. A flail during the wind-up answers nothing: that swing still lands.
  if (enemy.state === 'swing') answeredThisAttack = true;
  checkGuardBreak(); // a perfect parry can empty the guard mid-swing, and that swing must not land
  player.parryLunge();
  showOutcome(outcome);
  ui.flash(fxKind(outcome)); // winded: red blood. wild: the faint cold block look, nothing connected
  fx.parrySpark(fxKind(outcome), impact);
  // Steel on steel only when steel actually met steel. A block is the same clash stopped short; a wild
  // swing touched nothing at all, so it gets no clash — just the empty cold look it already has.
  if (outcome === 'perfect' || outcome === 'block') sfx.parry(outcome === 'perfect');
  refreshBars();
}

function attack() {
  if (phase !== 'fight' || !enemy || state.over || state.won) return;
  if (!canAct(state)) return; // the same lock: no wind, no cut, and nothing spent
  if (attackCooldown > 0) return; // one swing at a time: a second press inside the cooldown is refused
  if (!attackEnemy(state)) return; // only a stunned enemy takes a cut
  attackCooldown = swingCooldown;
  cutSpark(); // blood on him, not in the air: his guard is open and your blade got in
  sfx.bossHurt();
  refreshBars();
  if (state.won) winFight();
}

// --- input ---
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  unlockAudio(); // every press is a chance to earn the right to play sound, and a no-op once earned
  const key = e.key.toLowerCase();

  if (phase === 'title') {
    e.preventDefault();
    beginRun(); // any key begins the run
    return;
  }

  // The hand-over listens to one key and one key only: R. Everything else is swallowed, so a press
  // during the held moment neither parries, nor attacks, nor cuts the silence short.
  if (phase === 'transition') {
    if (key === RESTART_KEY) restart();
    return;
  }

  if (key === ' ' || key === 'spacebar' || key === 'f') {
    e.preventDefault();
    parry();
  } else if (key === 'e') {
    attack();
  } else if (key === RESTART_KEY) {
    restart();
  }
});

const canvas = renderer.domElement;
canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // right mouse is the parry
canvas.addEventListener('mousedown', (e) => {
  if (phase === 'title') {
    beginRun(); // and a click begins too
    return;
  }
  if (phase === 'transition') return; // the hand-over ignores the mouse exactly as it ignores the keys
  if (e.button === 2) {
    e.preventDefault();
    parry();
  } else if (e.button === 0) {
    attack(); // no pointer lock any more, so every left click swings
  }
});

// TOUCH. A phone has neither a keyboard nor a right button, so the two mouse buttons are rebuilt out of
// the two halves of the screen: the LEFT half swings and the RIGHT half parries — the same handedness the
// mouse already uses, left button to swing and right button to parry, so the two schemes are one idea and
// not two. The parry is the card's one action, so it gets the half a right-handed player rests their
// thumb on. preventDefault here is load-bearing: without it the browser follows every tap with a
// synthetic mousedown and the single tap would land two actions.
canvas.style.touchAction = 'none'; // no pinch zoom and no scroll: every touch belongs to the duel
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (phase === 'title') {
    beginRun(); // and a tap begins too
    return;
  }
  if (phase === 'transition') return; // the hand-over ignores touch exactly as it ignores the mouse
  unlockAudio(); // a tap is a user gesture, so it may spend one on the music like a keypress does
  for (const touch of e.changedTouches) {
    if (touch.clientX > innerWidth / 2) parry();
    else attack();
  }
}, { passive: false });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- loop ---
toTitle(); // the game opens on the title screen, not mid-fight

// performance.now() rather than THREE.Clock, which logs a deprecation warning in three.js 0.186.1.
let lastFrame = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0; // a first frame can arrive with dt = 0
  if (dt > 0.1) dt = 0.1; // a backgrounded tab must not teleport the enemy through its wind-up

  player.update(dt);
  fx.update(dt);
  arena.update(dt);

  // The hand-over runs on its own clock, and while it does nothing else in the arena moves at all.
  if (phase === 'transition') updateTransition(dt);

  const fighting = phase === 'fight' && !state.over && !state.won;
  if (fighting) {
    regenerateStamina(state, dt);
    attackCooldown = Math.max(0, attackCooldown - dt);
    // The stun runs on real time. When it ends the guard is already back to full, so he has to come out
    // of the slump on the same frame, in step with the numbers.
    const wasStunned = state.stunned;
    tickStun(state, dt);
    if (wasStunned && !state.stunned && enemy) enemy.release();
  }

  // A death freezes the fight, not the arena: the enemy still settles out of its follow-through.
  if (enemy && phase === 'fight') {
    // HIS OWN CADENCE, in every fight and in every phase of it — the lord included. He is no longer
    // driven by the music: nothing here waits on a beat, and nothing here cares whether the track is
    // playing at all. A boss whose ability to attack depends on a sound is a boss who stops fighting
    // the moment the audio does, and that is precisely what was wrong before.
    const landed = enemy.update(dt); // true on the one frame the swing ends: the blade landing
    if (landed) {
      if (fighting && !answeredThisAttack) {
        // Nobody answered this swing. A heavy costs more to eat, but the parry that could have stopped it
        // was identical — only the landing price differs. The word still tells "he caught me helpless"
        // from "I just stood there".
        const outcome = canAct(state) ? 'hit' : 'winded';
        applyOutcome(state, outcome, enemy.isHeavy);
        showOutcome(outcome);
        ui.flash(fxKind(outcome));
        fx.parrySpark(fxKind(outcome), impact);
        sfx.playerHurt(); // his blade got through: this is the sound of it being you
      }
      answeredThisAttack = false;
    } else if (enemy.state === 'idle') {
      answeredThisAttack = false;
    }
  }

  if (phase === 'title') ui.setMessage(TITLE_TEXT);
  else if (phase === 'won') ui.setMessage(WIN_TEXT);
  else if (phase === 'transition') { /* the line is the hand-over's own business, framed by its own fade */ }
  else if (state.over) ui.setMessage(DEAD_TEXT);
  else ui.hideMessage();

  updateMusic();
  refreshBars();
  ui.tickFps(dt, renderer.info); // does nothing unless ?fps is on the URL
  renderer.render(scene, camera);
});
