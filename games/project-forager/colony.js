// colony.js — the Colony phase: build HOUSING, then FOOD, then the COMM LINK, while repeated gather/ration actions keep the settlement supplied.
// Every action is gated by what it actually spends, so nothing can drive a resource below zero; if not one
// action on the screen can be paid for, the run has starved. Each action counts against the per-phase cap,
// and hitting that cap ends the run as a loss.

import { doomYears, monthsPerEvent, housingCost, foodCost, commLinkCost, maxDecisionsPerPhase } from './tuning.js';
import { checkEnd, canPaySpend } from './engine.js';

// --- PLACEHOLDER TUNING ----------------------------------------------------------
// These belong in tuning.js (the M3 tuning pass); they sit here only because this task
// may not edit that file. Every number the makers might want to change is named.
export const GATHER_MONTHS = 3;         // time one GATHER MATERIAL action burns off the doom clock
export const GATHER_BASE_MATERIAL = 18; // material gathered before the planet's richness scales it
export const RATION_MONTHS = 2;         // time one GROW / RATION FOOD action burns
export const RATION_FOOD = 25;          // food added by one ration action

const RESOURCE_LABELS = { money: 'CREDITS', food: 'FOOD', fuel: 'FUEL', material: 'MATERIAL' };

// The order costs are printed in, so every cost reads the same way down the list (as in ui.js).
const COST_ORDER = ['money', 'food', 'fuel', 'material'];

// The milestone list, in the only order the settlement can build it.
const STEPS = [
  { key: 'housing', label: 'HOUSING', cost: housingCost },
  { key: 'food', label: 'FOOD', cost: foodCost },
  { key: 'commLink', label: 'COMM LINK', cost: commLinkCost },
];

// Only class names that style.css already defines are used below, plus `option-locked`, which this task
// dims with an inline style because style.css is not ours to edit.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function num(value) {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 1e-9 ? String(rounded) : value.toFixed(1);
}

// The same STARDATE the rest of the game prints, so the doom clock is visibly the same clock.
function stardate(state) {
  const year = Math.floor(state.monthsElapsed / 12) + 1;
  const month = (state.monthsElapsed % 12) + 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `STARDATE Y${pad(year)} M${pad(month)}`;
}

// The resource bar, the date bar and the cost line are the markup and wording ui.js uses.
function resourceBar(state) {
  const bar = el('section', 'resources');
  for (const key of Object.keys(RESOURCE_LABELS)) {
    const cell = el('div', 'resource');
    cell.append(el('span', 'resource-label', RESOURCE_LABELS[key]));
    cell.append(el('span', 'resource-value', num(state[key])));
    bar.append(cell);
  }
  return bar;
}

function dateBar(state) {
  const pad = (n) => String(n).padStart(2, '0');
  const left = Math.max(0, doomYears * 12 - state.monthsElapsed);
  const bar = el('section', 'dates');
  bar.append(el('span', undefined, stardate(state)));
  bar.append(el('span', undefined, `EARTH DEADLINE Y${pad(doomYears)} M12  T-${left}M`));
  return bar;
}

// "CREDITS -200  MATERIAL -60  6 MO" — same format, signs and units ui.js's costLine prints,
// so nothing on this screen is chooseable blind.
function costLine(deltas, months) {
  const parts = [];
  for (const key of COST_ORDER) {
    const value = deltas[key];
    if (typeof value !== 'number') continue;
    parts.push(`${RESOURCE_LABELS[key]} ${value > 0 ? '+' : ''}${num(value)}`);
  }
  parts.push(`${num(months ?? monthsPerEvent)} MO`);
  return parts.join('  ');
}

// One clickable row: key, label, and the price it will charge printed under the label. An action the
// settlement cannot pay for is disabled and dimmed with its price still on screen — the makers' rule is
// that you cannot spend what you do not have, and the player can see what they are short of. A refused
// row does nothing at all, so it costs nothing.
function optionButton(action) {
  const button = el('button', action.unaffordable ? 'option option-locked' : 'option');
  button.type = 'button';
  button.disabled = !action.available;
  if (action.unaffordable) button.style.opacity = '0.4'; // style.css is not ours to edit: dim inline

  button.append(el('span', 'option-key', action.key));
  const body = el('span');
  body.append(el('span', undefined, action.label));
  body.append(document.createElement('br'));
  body.append(el('span', undefined, action.price));
  if (action.unaffordable) {
    body.append(document.createElement('br'));
    body.append(el('span', undefined, '[ CANNOT AFFORD ]'));
  }
  button.append(body);

  button.addEventListener('click', () => {
    if (!action.available) return; // refused: nothing is spent
    action.onPress();
  });
  return button;
}

// The planet we landed on, and how rich it is in material — this is what GATHER scales with.
function planetLine(state) {
  const name = state.planet?.name ?? 'UNKNOWN WORLD';
  const richness = Number(state.planet?.materialRichness ?? 1);
  return `LANDED: ${name}   RICHNESS ${richness.toFixed(1)}`;
}

// A build step can start only once every step before it is finished.
function unlocked(state, index) {
  return STEPS.slice(0, index).every((step) => state.colony[step.key] === true);
}

// Draw the Colony screen into #screen. `onUpdate()` fires exactly once per player action, after
// engine.js has had its say, so the caller can re-check the run and redraw.
export function renderColony(state, onUpdate) {
  const root = document.getElementById('screen');
  if (!root) return;

  const richness = Number(state.planet?.materialRichness ?? 1);
  const gathered = Math.max(1, Math.round(GATHER_BASE_MATERIAL * richness));

  // One player action: apply it, let engine.js judge the run, count it against the phase cap, redraw,
  // then hand back to the caller. The cap never lets the colony keep playing past 15 decisions: the
  // 15th action ends the run as a loss, before onUpdate() re-checks it.
  function act(apply) {
    apply();
    checkEnd(state);
    state.phaseDecisions += 1;
    if (state.alive && !state.won && state.phaseDecisions >= maxDecisionsPerPhase) {
      state.alive = false;
      state.endReason = 'colony';
    }
    // draw() hands the starved run back to the caller itself, so it is never handed over twice.
    if (draw()) onUpdate();
  }

  // The three build steps in build order. `spend` is exactly what the step hands over, so the same shared
  // check judges the price the button prints: `available` is what the player may press, `unaffordable` is
  // the dimmed state this task adds.
  function buildActions() {
    return STEPS.map((step, index) => {
      const done = state.colony[step.key] === true;
      const inOrder = unlocked(state, index);
      const spend = { money: -step.cost.money, material: -step.cost.material };
      const affordable = canPaySpend(state, spend);
      return {
        key: String(index + 1).padStart(2, '0'),
        label: `${step.label}${done ? ' — COMPLETE' : ''}`,
        price: done ? '[ BUILT ]' : costLine(spend, step.cost.months),
        available: !done && inOrder && affordable,
        unaffordable: !done && inOrder && !affordable,
        onPress: () => act(() => {
          state.money -= step.cost.money;
          state.material -= step.cost.material;
          state.monthsElapsed += step.cost.months;
          state.colony[step.key] = true;
        }),
      };
    });
  }

  // The loop: two repeatable actions that move a resource back up — always at the cost of months off the
  // doom clock, so arriving starved is recoverable but never free. Neither one spends a resource (they
  // only add), so the rule cannot refuse them: the clock is what they are judged against.
  function survivalActions() {
    const gather = { material: gathered };
    const ration = { food: RATION_FOOD };
    const gatherPayable = canPaySpend(state, gather);
    const rationPayable = canPaySpend(state, ration);
    return [
      {
        key: '01',
        label: 'GATHER MATERIAL',
        price: costLine(gather, GATHER_MONTHS),
        available: gatherPayable,
        unaffordable: !gatherPayable,
        onPress: () => act(() => {
          state.material += gathered;
          state.monthsElapsed += GATHER_MONTHS;
        }),
      },
      {
        key: '02',
        label: 'GROW / RATION FOOD',
        price: costLine(ration, RATION_MONTHS),
        available: rationPayable,
        unaffordable: !rationPayable,
        onPress: () => act(() => {
          state.food += RATION_FOOD;
          state.monthsElapsed += RATION_MONTHS;
        }),
      },
    ];
  }

  // Every action on the screen, so the buttons and the starvation check can never disagree.
  function allActions() {
    return [...buildActions(), ...survivalActions()];
  }

  function buildCard() {
    const card = el('section', 'event');
    card.append(el('p', 'event-text', 'COLONY ESTABLISHMENT — build in order: housing, then food, then the comm link home.'));

    const options = el('div', 'options');
    buildActions().forEach((action) => options.append(optionButton(action)));
    card.append(options);

    const firstLocked = STEPS.findIndex((step, index) => !state.colony[step.key] && !unlocked(state, index));
    if (firstLocked !== -1) {
      card.append(el('p', 'status', `[ ${STEPS[firstLocked].label} LOCKED — FINISH EARLIER STEPS FIRST ]`));
    }
    return card;
  }

  function survivalCard() {
    const card = el('section', 'event');
    card.append(el('p', 'event-text', 'SURVIVAL OPERATIONS — repeatable. Both cost time off the deadline.'));

    const options = el('div', 'options');
    survivalActions().forEach((action) => options.append(optionButton(action)));
    card.append(options);
    return card;
  }

  // Returns true when the colony screen was drawn, false when the run starved instead and the caller must
  // draw the summary. A cause engine.js already recorded (the deadline, the cap) is never overwritten.
  function draw() {
    // The rule at its limit: if no action on this screen can be paid for and the run has not been won,
    // the settlement has starved. Record why before handing over.
    if (state.alive && !state.won && !allActions().some((action) => action.available)) {
      state.alive = false;
      state.endReason = 'supplies';
      onUpdate();
      return false;
    }

    root.textContent = '';
    root.append(el('header', 'screen-header', 'PROJECT FORAGER // COLONY ESTABLISHMENT'));
    root.append(resourceBar(state));
    root.append(dateBar(state));

    const brief = el('section', 'event');
    brief.append(el('p', 'event-text', planetLine(state)));
    brief.append(el('p', 'event-text', `DEADLINE IN ${Math.max(0, doomYears * 12 - state.monthsElapsed)} MONTHS. BUILD THE COMM LINK TO REACH EARTH.`));
    root.append(brief);

    root.append(buildCard());
    root.append(survivalCard());
    return true;
  }

  draw();
}
