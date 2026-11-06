// Parry resolution and the numbers of one fight: windows, gauge, health, stamina, damage.

import {
  perfectParryOpensAt,
  gaugeDrainPerfect,
  blockDamage,
  heavyBlockDamage,
  playerHealthMax,
  hitDamage,
  heavyHitDamage,
  staminaMax,
  blockStaminaCost,
  staminaRegenPerSecond,
  staminaRegenDelay,
  attackDamage,
} from './tuning.js';

// The argument is seconds since the swing began, counting up from 0.
// A perfect parry is only possible once the blade is actually coming through — the last stretch of
// the swing. Press earlier than that, while the guard is still back, and you only block: a block
// costs you blood and drains the enemy nothing, so timing is the whole game.
// A press with no swing in progress at all — empty air, or a flail during the wind-up — is a wild
// swing: a wasted press. It costs wind, never blood, because nothing connected.
export function resolveParry(timeSinceSwing, opensAt = perfectParryOpensAt) {
  if (timeSinceSwing === null || timeSinceSwing === undefined) return 'wild';
  if (timeSinceSwing >= opensAt) return 'perfect';
  return 'block';
}

export function createFightState(config) {
  return {
    enemyConfig: config,
    playerHealth: playerHealthMax,
    stamina: staminaMax,
    staminaHold: 0, // seconds left before stamina starts coming back
    enemyHealth: config.health,
    enemyGauge: config.gaugeMax,
    stunned: false, // his guard is broken: he is out, and open to cuts
    stunLeft: 0, // seconds of that left, in real time
    lastOutcome: null,
    over: false,
    won: false,
  };
}

// His guard has broken: he is out for `duration` seconds. The stun is real time, not his attack cadence,
// and while it lasts he does nothing at all — the window is the reward for breaking the guard.
export function breakGuard(state, duration) {
  state.stunned = true;
  state.stunLeft = duration;
  return state;
}

// Ticks the stun down. When it runs out the guard snaps back to full and he comes to: from that moment
// he cannot be hurt again until the guard is broken a second time.
export function tickStun(state, dt) {
  if (!state.stunned) return state;
  state.stunLeft = Math.max(0, state.stunLeft - dt);
  if (state.stunLeft === 0) {
    state.stunned = false;
    state.enemyGauge = state.enemyConfig ? state.enemyConfig.gaugeMax : state.enemyGauge;
  }
  return state;
}

// Out of wind means out of options. Below the price of a block the player cannot guard, cannot cut and
// cannot even parry perfectly: nothing at all. The threshold is the block's own price, not exactly 0 —
// the bar refills within a frame of reaching 0, so a zero-gate would be an invisible state.
export function canAct(state) {
  return state.stamina >= blockStaminaCost;
}

// What an outcome does to health and to the guard — the wind is spent separately, by chargeStamina,
// because only a press spends it, and only a press that could happen at all (see canAct). A perfect
// parry is free: no wind and the guard drains, so timing stays the skilled answer. A block costs blood.
// 'winded' is not a press at all: it is his blade landing on a player with no wind left to answer with.
// A 'wild' swing does nothing at all — a mistake, never a wound.
// `heavy` is whether the swing in question is a heavy: a heavy is parried exactly like a light, but every
// way it touches the player costs more. A block on a heavy costs heavyBlockDamage; a heavy landing costs
// heavyHitDamage, whether it caught a block that was too early or a player who could not act at all.
// Guard drain is unaffected — a block, heavy or not, drains no guard.
export function applyOutcome(state, outcome, heavy = false) {
  if (outcome === 'perfect') {
    state.enemyGauge = Math.max(0, state.enemyGauge - gaugeDrainPerfect);
  } else if (outcome === 'block') {
    state.playerHealth = Math.max(0, state.playerHealth - (heavy ? heavyBlockDamage : blockDamage));
  } else if (outcome === 'hit') {
    state.playerHealth = Math.max(0, state.playerHealth - (heavy ? heavyHitDamage : hitDamage));
  } else if (outcome === 'winded') {
    state.playerHealth = Math.max(0, state.playerHealth - (heavy ? heavyHitDamage : hitDamage));
  }

  // What actually happened, so a blade landing on an exhausted player reports 'winded', not 'hit'.
  state.lastOutcome = outcome;
  if (state.playerHealth <= 0) state.over = true;
  return state;
}

// Every press that is not a perfect parry spends wind, and the visible drop is what teaches the player
// why the blade will not come up next time. Only presses that happened call this: a swing landing on a
// player who never pressed is not a press, and neither is a press made while canAct is false — there is
// nothing left to spend, so it costs nothing.
export function chargeStamina(state, appliedOutcome) {
  if (appliedOutcome === 'perfect') return state; // free, and always available
  state.stamina = clamp(state.stamina - blockStaminaCost, 0, staminaMax);
  state.staminaHold = staminaRegenDelay;
  return state;
}

// Stamina comes back on its own, but only once the hold left by the last press has run out, so a spent
// press stings for a moment. Safe with dt = 0 (a first frame can arrive with no time elapsed).
export function regenerateStamina(state, dt) {
  if (state.staminaHold > 0) {
    state.staminaHold = Math.max(0, state.staminaHold - dt);
    return state;
  }
  state.stamina = clamp(state.stamina + staminaRegenPerSecond * dt, 0, staminaMax);
  return state;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// A cut only bites while he is actually stunned. An empty guard alone is not enough: the window closes
// when the stun ends, and the guard refilling takes an un-stunned enemy back out of reach at once.
export function attackEnemy(state) {
  if (!state.stunned) return false;
  state.enemyHealth = Math.max(0, state.enemyHealth - attackDamage);
  if (state.enemyHealth <= 0) state.won = true;
  return true;
}
