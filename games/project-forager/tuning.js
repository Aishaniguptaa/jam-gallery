// tuning.js — every tunable number for project-forager in one place. Placeholders: change these first.

// PLAYABLE DEFAULT, with the per-event drains below: sized for up to ~30 decisions after the per-phase cap; the makers tune it.
// Starting resources.
export const startMoney = 1500;
export const startFood = 400;
// PLAYABLE DEFAULT, sized so every world in plan.js is survivable: at 190 the 4-, 5- and 6-year worlds
// ran the tanks dry before arrival (a verification sweep saw only 13/40 runs reach the colony). Numbers
// the makers may revisit — this one only moves the starting fuel, nothing else.
// MEASURED after the affordability rule landed (4 planets x 5 seeds, headless): the tank is no longer what
// ends an early run — the per-event upkeep on material and money is. Tuning pass needed; see the report.
export const startFuel = 400;
export const startMaterial = 150;

// Clock. doomYears * 12 months is the hard deadline.
export const doomYears = 10;
// The voyage between events: after a choice is resolved the ship flies on for a random number of months
// from this range, and only then does the next event come up. The makers' rule is that an ACTION does not
// cost months; the flight does. A 36-month crossing at ~5.5 months a hop is about 7 events; a 72-month
// crossing is about 13.
export const eventGapMonths = { min: 4, max: 7 };
// Kept for the Colony screen's cost lines. The flight no longer uses it as a cadence.
export const monthsPerEvent = 2;

// Cap on decisions in each of Plan / Flight / Colony: reaching it ends the phase (Flight forces arrival
// to the Colony; the Colony ends the run as a loss). Plan never gets near it.
export const maxDecisionsPerPhase = 15;

// Mission size: what you launch with. `drainMultiplier` scales every per-event drain.
// `base` is what the mission already carries at launch, free with the mission cost; `cap` is the most
// the ship can hold (the makers' rule: every size has a ceiling on what you can bring, and you do not
// have to fill it). Everything between base and cap is bought in the Plan phase loadout, at loadPrice
// per unit. Both scale with the size: a bigger ship carries more and burns more.
export const sizeSmall = {
  cost: 200, people: 12, drainMultiplier: 0.7,
  base: { food: 300, fuel: 300, material: 100 },
  cap: { food: 500, fuel: 500, material: 200 },
};
export const sizeMedium = {
  cost: 400, people: 30, drainMultiplier: 1.0,
  base: { food: 400, fuel: 400, material: 150 },
  cap: { food: 700, fuel: 700, material: 300 },
};
export const sizeLarge = {
  cost: 700, people: 60, drainMultiplier: 1.5,
  base: { food: 550, fuel: 550, material: 200 },
  cap: { food: 900, fuel: 900, material: 450 },
};

// Lookup by the key stored in state.missionSize.
export const missionSizes = { small: sizeSmall, medium: sizeMedium, large: sizeLarge };

// Resources that end the run at zero or below ('supplies'). Makers tune this list.
export const fatalResources = ['food', 'fuel'];

// What one event costs you in upkeep, before the size multiplier. Flight upkeep is fuel, food and
// material only: credits are a Plan/Colony currency (spent on the mission and on the colony builds) and
// are excluded from the flight, so the credit balance never moves during it. `moneyDrain` stays named
// for the makers but engine.js no longer charges it in flight.
export const moneyDrain = 12;
export const foodDrain = 6;
export const fuelDrain = 5;
export const materialDrain = 5;

// Plan phase (phase 1). `planBaseYears` is the fixed preparation year that Phase 1 always costs, even
// if the player launches without investigating anything. Each investigation adds `investigateYears` on
// top, so Phase 1 lasts planBaseYears to planBaseYears + (investigations x investigateYears) years — one
// to three years, out of the ten the makers gave the three phases.
export const planBaseYears = 1;
export const investigateYears = 1;
export const planetsKnown = 2;
export const planetsPartial = 2;

// Plan phase loadout: what one press of a LOADOUT "+" buys, and what a unit costs in credits.
// One credit buys one unit of anything — the makers' knob if supplies should cost different amounts.
export const loadStep = { food: 40, fuel: 40, material: 20 }; // units added per press
export const loadPrice = { food: 1, fuel: 1, material: 1 };    // credits charged per unit

// Colony phase build costs. months = time, the rest = resources spent.
export const housingCost = { money: 200, material: 60, months: 6 };
export const foodCost = { money: 150, material: 40, months: 6 };
export const commLinkCost = { money: 300, material: 80, months: 12 };
