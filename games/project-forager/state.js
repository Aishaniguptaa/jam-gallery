// state.js — the run: resources, clock, phase (starts in 'plan'), planet, mission size, decisions taken this phase, and the end flags.
import { startMoney, startFood, startFuel, startMaterial } from './tuning.js';

// One object, mutated in place, so every module can `import { state }` and see changes.
export const state = {
  money: startMoney,
  food: startFood,
  fuel: startFuel,
  material: startMaterial,
  monthsElapsed: 0,
  monthsAtLaunch: 0, // the month the Flight phase opened on, so the flight-path strip measures from launch
  phaseDecisions: 0, // decisions taken in the current phase; capped by tuning.js maxDecisionsPerPhase
  phase: 'plan', // 'plan' | 'flight' | 'colony' — a run opens on the Plan screen
  planet: null, // set in the Plan phase (M3)
  missionSize: 'medium', // a key of tuning.js missionSizes
  alive: true,
  won: false,
  endReason: null, // 'supplies' | 'deadline' | 'crew' | 'colony' — set when the run ends
  colony: { housing: false, food: false, commLink: false }, // M3 build flags
};

// Wipe the run back to a fresh start. Same object identity as above.
export function resetState() {
  state.money = startMoney;
  state.food = startFood;
  state.fuel = startFuel;
  state.material = startMaterial;
  state.monthsElapsed = 0;
  state.monthsAtLaunch = 0;
  state.phaseDecisions = 0;
  state.phase = 'plan';
  state.planet = null;
  state.missionSize = 'medium';
  state.alive = true;
  state.won = false;
  state.endReason = null;
  state.colony.housing = false;
  state.colony.food = false;
  state.colony.commLink = false;
  return state;
}
