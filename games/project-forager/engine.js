// engine.js — applies one choice to the run, decides whether the run has ended, and answers the two
// availability questions the rest of the game asks: canAfford (flight) and canPaySpend (colony). No
// resource may ever go below zero, so a choice that cannot be paid for is not on offer.
// CREDITS: the makers' rule is that any option which mentions BUYING something costs credits. So a
// `money` delta is charged wherever it appears, in flight included — it is not a Plan/Colony-only
// currency any more. Nothing in flight charges credits by upkeep; only a purchase does.
import * as T from './tuning.js';

const RESOURCES = ['money', 'food', 'fuel', 'material'];

// Resolve state.missionSize, which is a tuning.js key ('small') or the size object itself.
export function missionSizeOf(state) {
  const size = state.missionSize;
  if (typeof size === 'string') return T.missionSizes[size] ?? T.sizeMedium;
  return size ?? T.sizeMedium;
}

// What one decision costs in upkeep, after the mission size multiplier. The single place the drain maths
// lives: applyChoice charges exactly this and canAfford tests exactly this, so they cannot drift apart.
// Flight upkeep is fuel and food only. Two resources are excluded, for the makers' two separate rules:
//   - `money`: credits are a Plan/Colony currency; the balance never moves in flight.
//   - `material`: material is the ship's stock of building stuff, and the makers' rule is that it is
//     spent only by an option that fixes or builds something. It used to also drain 5 a decision, but
//     nothing in flight ever puts material back, so the drain alone starved the mission: once material
//     fell under one upkeep's worth, NO option on the screen was affordable — including the options that
//     cost no material at all — and the run ended as "Supplies ran out" with food and fuel healthy. A
//     headless sweep saw that kill 131 of 160 launched runs. Flying does not consume building stock.
// Both drains stay named in tuning.js for the makers; neither is charged here.
export function upkeepFor(state) {
  const mult = missionSizeOf(state).drainMultiplier ?? 1;
  return {
    food: T.foodDrain * mult,
    fuel: T.fuelDrain * mult,
  };
}

// The resources a choice leaves behind: its own deltas minus the upkeep every decision pays. Reads state,
// never writes it. applyChoice assigns the result; canAfford only inspects it, so the price the player is
// shown and the price the mission pays are one calculation. Credits are charged like any other resource.
export function projectAfterChoice(state, option) {
  const deltas = option?.deltas ?? {};
  const upkeep = upkeepFor(state);
  const after = {};
  for (const key of RESOURCES) {
    const delta = typeof deltas[key] === 'number' ? deltas[key] : 0;
    after[key] = state[key] + delta - (upkeep[key] ?? 0);
  }
  return after;
}

// Affordability: the choice's deltas AND the per-event upkeep, applied, leave every game resource at or
// above zero. Returns a plain boolean and does not touch state. Shared with applyChoice (above), so the
// number the check tests and the number the choice charges are the same code — including the credit
// rule, so an option is never locked for a money cost it would not actually pay in flight.
export function canAfford(state, option) {
  const after = projectAfterChoice(state, option);
  return RESOURCES.every((key) => after[key] >= 0);
}

// The same rule for an action that spends resources without paying the per-event upkeep — the Colony
// charges no upkeep, so its actions are judged on exactly what they hand over: `deltas`. Same '>= 0'
// rule, one definition, so no action anywhere can drive a resource below zero.
export function canPaySpend(state, deltas = {}) {
  return RESOURCES.every((key) => {
    const delta = deltas[key];
    return typeof delta !== 'number' || state[key] + delta >= 0;
  });
}

// Apply one option: add its deltas, pay the per-event upkeep, advance the date, then check the end.
// Both come from projectAfterChoice, so in flight a `money` delta is dropped and the credit balance
// comes out of this call exactly as it went in.
export function applyChoice(state, option) {
  const after = projectAfterChoice(state, option);
  for (const key of RESOURCES) state[key] = after[key];

  // Only an option that genuinely takes time carries months (a quarantine, a detour). Everything else
  // costs the ship nothing but supplies: the voyage's clock advances in the gap BETWEEN events, which
  // main.js charges, not on the choice itself. Default is zero, not one event's worth.
  state.monthsElapsed += option.months ?? 0;

  if (option.kills === true) {
    state.alive = false;
    if (!state.endReason) state.endReason = 'crew';
  }

  checkEnd(state);
  return state;
}

// End the run and record why, once. `endReason` is the first cause found and is never overwritten.
// Ways to end: a fatal resource at zero, the ten-year deadline, or a killing option (set in
// applyChoice). Running out of time, or building the Comm Link, ends the run as a win.
export function checkEnd(state) {
  if (!state.endReason && T.fatalResources.some((key) => state[key] <= 0)) {
    state.alive = false;
    state.endReason = 'supplies';
  }
  if (!state.endReason && state.monthsElapsed >= T.doomYears * 12) {
    state.alive = false;
    state.endReason = 'deadline';
  }
  if (state.phase === 'colony' && state.colony?.commLink) state.won = true;
  return state;
}
