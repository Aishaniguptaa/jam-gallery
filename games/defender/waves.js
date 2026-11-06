// waves.js — the wave director: how many drones a wave sends and which corners they come from.
import { WAVE_PLANS } from './tuning.js';

// The four arena corners as sign pairs (x, z). main.js turns these into world positions.
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

// Whole number from min to max, both included.
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// What wave `wave` sends: how many corners to use and how many drones in total.
// Anything past the last band uses the last band (it ends at Infinity).
export function getWavePlan(wave) {
  const band = WAVE_PLANS.find((plan) => wave >= plan.startWave && wave <= plan.endWave)
    ?? WAVE_PLANS[WAVE_PLANS.length - 1];
  return {
    cornerCount: band.corners,
    enemyCount: randomInt(band.minEnemies, band.maxEnemies),
  };
}

// Pick `count` different corners at random, as [signX, signZ] pairs.
export function pickCorners(count) {
  const pool = CORNERS.slice();
  // Fisher-Yates shuffle, then take the front of the deck.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const wanted = Math.max(1, Math.min(count, pool.length));
  return pool.slice(0, wanted);
}
