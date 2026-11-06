// main.js — the one draw() dispatcher: it shows Plan, Flight, Colony or the end-of-run summary from state,
// counts decisions per phase against the cap, hands ui.js the affordability check every option is drawn
// with, and owns the "R" restart.
import { state, resetState } from './state.js';
import { maxDecisionsPerPhase, eventGapMonths } from './tuning.js';
import { applyChoice, canAfford, checkEnd } from './engine.js';
import { flightEvents } from './events.js';
import { render } from './ui.js';
import { renderPlan, resetPlanets } from './plan.js';
import { renderColony } from './colony.js';
import { mountGauges } from './gauges.js';

// The pool plays in a shuffled order. The queue empties as events are shown; when it runs out we
// shuffle the pool again ("recycle"). Recycling is expected: the makers' target is about 50
// decisions a run and the drafted pool holds 10 flight events.
let queue = [];
let currentEvent = null; // what is on screen this turn
let lastShownId = null; // the previous turn's event, so the same one never shows twice in a row
let firstOfRunId = null; // the event that opened the last run, so a new run opens on a different one

function shuffled(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Fill the queue with the whole pool in a random order. `avoidId` is pushed off the front, so the
// turn after a recycle (or after a restart) is not the event we just showed.
function refill(avoidId) {
  queue = shuffled(flightEvents);
  if (avoidId !== null && queue.length > 1 && queue[0].id === avoidId) queue.push(queue.shift());
}

// This turn's event: the next one in the queue, reshuffling the pool when the queue is empty.
function nextEvent() {
  if (queue.length === 0) refill(lastShownId);
  const event = queue.shift();
  lastShownId = event.id;
  return event;
}

// Arrival ends the flight: once the mission has flown the chosen planet's full travel time we land,
// and the Colony phase takes over. One named function on purpose — this is a tuning decision the
// makers may revisit.
function checkArrival(state) {
  if (state.phase !== 'flight') return false;
  if (!state.planet) return false;
  if (!state.alive || state.won) return false;
  if (state.monthsElapsed < state.planet.travelMonths) return false;
  state.phase = 'colony';
  state.phaseDecisions = 0; // entering the Colony phase: its own decision count starts fresh
  return true;
}

// The voyage between two events. The makers' rule: an action does not cost months, so the flight clock
// advances here instead — a random 4 to 7 months of flying, then the next event pops up. The deadline is
// re-checked because the gap itself can run the mission out of time.
function advanceFlight(state) {
  if (!state.alive || state.won) return;
  if (state.phase !== 'flight') return;
  const { min, max } = eventGapMonths;
  state.monthsElapsed += min + Math.floor(Math.random() * (max - min + 1));
  checkEnd(state);
}

function onChoose(option) {
  applyChoice(state, option);
  advanceFlight(state);
  checkArrival(state);
  // Count this decision in the phase it was made in. If the run is still in Flight and has hit the
  // cap, the phase ends here and the mission lands early — a voyage can never run past the cap.
  state.phaseDecisions += 1;
  if (state.alive && !state.won && state.phase === 'flight' && state.phaseDecisions >= maxDecisionsPerPhase) {
    state.phase = 'colony';
    state.phaseDecisions = 0;
  }
  currentEvent = null; // this turn's event is spent; the flight branch below fetches the next one
  draw();
}

// The availability check ui.js draws its options with: an option the mission cannot pay for is locked,
// and an event with no payable option at all starves the run (both handled inside ui.js).
function canPay(option) {
  return canAfford(state, option);
}

// Plan phase handed over: the launch is applied, so open the flight on the next event.
function onReady() {
  state.monthsAtLaunch = state.monthsElapsed; // the flight-path strip measures the voyage from here
  state.phaseDecisions = 0; // entering the Flight phase: its decision count starts fresh
  currentEvent = nextEvent();
  firstOfRunId = currentEvent.id;
  draw();
}

// One dispatcher: what is on screen follows the phase held in state.
export function draw() {
  // The instrument panels either side of the game. They live outside #screen (every phase wipes that),
  // so they are mounted once and updated in place on every draw.
  mountGauges(state);

  if (state.phase === 'plan') {
    renderPlan(state, onReady);
    return;
  }

  // The run is over, whichever phase it ended in: ui.js shows the summary instead.
  if (!state.alive || state.won) {
    render(state, currentEvent, onChoose, canPay);
    return;
  }

  if (state.phase === 'colony') {
    renderColony(state, () => draw());
    return;
  }

  // Flight: make sure there is an event on screen — the next one in the queue, or the one this
  // turn was already drawn with.
  if (!currentEvent) currentEvent = nextEvent();
  render(state, currentEvent, onChoose, canPay);
}

// A fresh run, from any phase: state, queue and current event wiped, then back to the Plan screen.
function newRun() {
  resetState();
  resetPlanets(); // every run rolls a fresh set of worlds and stats
  queue = [];
  currentEvent = null;
  lastShownId = null;
  refill(firstOfRunId); // fresh shuffle, still opened off the last run's first event
  draw();
}

// "R" starts a fresh run from anywhere on the page.
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'r') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  newRun();
});

newRun();
