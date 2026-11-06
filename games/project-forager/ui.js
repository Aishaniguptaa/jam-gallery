// ui.js — draws the flight telemetry screen: resources, date (with the arrival countdown), the flight
// path strip, the event and its options (each with its cost, locked and dimmed when the mission cannot
// pay for it), the starved end when no option at all is affordable, and the end-of-run summary. The
// option cost line prices only what the phase can actually spend: credits are omitted in flight, since
// they are a Plan/Colony currency and nothing in flight charges them.
import { doomYears } from './tuning.js';
import { missionSizeOf, canAfford } from './engine.js';
import { flightPath } from './flightpath.js';

const RESOURCE_LABELS = { money: 'CREDITS', food: 'FOOD', fuel: 'FUEL', material: 'MATERIAL' };

// The order costs are printed in, so every option reads the same way down the list.
const COST_ORDER = ['money', 'food', 'fuel', 'material'];

// Keep integers clean, and only show a decimal when a value actually has one.
function num(value) {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 1e-9 ? String(rounded) : value.toFixed(1);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function header() {
  return el('header', 'screen-header', 'PROJECT FORAGER // FLIGHT TELEMETRY');
}

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

// STARDATE Y## M## — one helper, so the date bar and the summary always agree on the format.
function stardate(state) {
  const year = Math.floor(state.monthsElapsed / 12) + 1;
  const month = (state.monthsElapsed % 12) + 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `STARDATE Y${pad(year)} M${pad(month)}`;
}

function dateBar(state) {
  const pad = (n) => String(n).padStart(2, '0');
  const left = Math.max(0, doomYears * 12 - state.monthsElapsed);

  const bar = el('section', 'dates');
  bar.append(el('span', 'stamp', stardate(state)));
  bar.append(el('span', 'stamp', `EARTH DEADLINE Y${pad(doomYears)} M12  T-${left}M`));
  // How far the planet still is. Only once a planet is chosen, and never below zero.
  if (state.planet) {
    const toArrival = Math.max(0, Math.round(state.planet.travelMonths - state.monthsElapsed));
    bar.append(el('span', 'stamp', `ARRIVAL IN ${toArrival}M`));
  }
  return bar;
}

// What this option costs: the resources it spends (only the ones it actually touches) and, only when it
// really costs time, the months it burns. "CREDITS -100  FOOD -20  2 MO" — the player must be able to
// price a choice at a glance. Actions cost no time by default now, so a zero or absent `months` prints
// nothing at all (never "0 MO"), and a choice with no price reads "NO COST".
// Every resource the option touches is printed, credits included: the makers' rule is that anything
// which mentions buying costs credits, and a cost the player cannot see is a cost they cannot weigh.
function costLine(option, state) {
  const deltas = option.deltas ?? {};
  const parts = [];
  for (const key of COST_ORDER) {
    const value = deltas[key];
    if (typeof value !== 'number') continue;
    parts.push(`${RESOURCE_LABELS[key]} ${value > 0 ? '+' : ''}${num(value)}`);
  }
  if (typeof option.months === 'number' && option.months > 0) parts.push(`${num(option.months)} MO`);
  return parts.length > 0 ? parts.join('  ') : 'NO COST';
}

// One option row. Label over cost, stacked inside the button, so the price reads before the click. An
// option the mission cannot pay for is disabled and dimmed — but its label and its price line stay on
// screen, plus the reason, so the player sees exactly what they are missing out on and why.
function optionButton(option, index, onChoose, canPay, state) {
  const affordable = canPay(option) === true;

  const button = el('button', 'option');
  button.type = 'button';
  button.append(el('span', 'option-key', String(index + 1).padStart(2, '0')));

  const body = el('span', 'option-body');
  body.append(el('span', 'option-label', option.label));
  body.append(document.createElement('br'));
  body.append(el('span', 'option-cost', costLine(option, state)));
  if (!affordable) {
    body.append(document.createElement('br'));
    body.append(el('span', 'option-cost', '[ CANNOT AFFORD ]'));
  }
  button.append(body);

  if (affordable) {
    button.addEventListener('click', () => onChoose(option));
  } else {
    button.disabled = true;
    button.classList.add('option-locked');
    button.style.opacity = '0.4'; // style.css is not ours to edit, so the dim is inline
  }
  return button;
}

// The colour of the real mission's lane in flightpath.js. style.css is not ours to edit, so the tie
// between this event and the track it belongs to is drawn inline.
const MISSION_COLOUR = '#3ff0d0';

function eventBlock(event, onChoose, canPay, state) {
  const block = el('section', 'event');
  // Which mission this decision belongs to: the same teal as the middle lane's track and ship. The fleet
  // lanes above and below are cosmetic other missions, not this one.
  const missionName = state?.planet?.name ?? 'UNASSIGNED';
  block.style.borderLeft = `4px solid ${MISSION_COLOUR}`;
  const mission = el('p', 'stamp', `MISSION ▸ ${missionName}`);
  mission.style.color = MISSION_COLOUR;
  mission.style.letterSpacing = '0.08em';
  block.append(mission);
  block.append(el('p', 'event-text', event.text));

  const list = el('div', 'options');
  event.options.forEach((option, i) => list.append(optionButton(option, i, onChoose, canPay, state)));

  block.append(list);
  return block;
}

// Why the run ended, in plain words, from the reason engine.js recorded: supplies, the deadline, the
// colony running out of time, or a choice that lost the mission (the fallback, which also covers a
// state with no reason set).
function endReason(state) {
  if (state.endReason === 'supplies') return 'Supplies ran out';
  if (state.endReason === 'deadline') return 'The ten-year deadline passed';
  if (state.endReason === 'colony') return 'The colony ran out of time';
  return 'The mission was lost in flight';
}

// The end-of-run screen. It replaces the event and its options: the run is over, so nothing is left
// to choose and there are no option buttons on screen.
function summary(state) {
  const size = missionSizeOf(state);
  const sizeLabel = typeof state.missionSize === 'string' ? state.missionSize.toUpperCase() : 'SELECTED';

  const box = el('section', 'event');
  box.append(el('p', state.won ? 'status status-win' : 'status',
    state.won ? '[ CONTACT ESTABLISHED ]' : '[ SIGNAL LOST ]'));
  // Only explain the failure on a loss — a win has no reason to report, and printing one under
  // "[ CONTACT ESTABLISHED ]" read as if the mission had failed.
  if (!state.won) box.append(el('p', 'event-text', endReason(state)));
  box.append(el('p', 'stamp', stardate(state)));
  box.append(el('p', 'stamp', `MISSION SIZE: ${sizeLabel}   CREW: ${size.people}`));
  box.append(resourceBar(state));
  // A button as well as the key, so the run can be restarted by tap or click — the R key alone left
  // anyone playing on a phone stuck on this screen. It fires the same "R" main.js listens for, so there
  // is one restart path, not two.
  const again = el('button', 'option');
  again.type = 'button';
  again.append(el('span', 'option-key', '>>'));
  again.append(el('span', 'option-label', 'START A NEW RUN'));
  again.addEventListener('click', () => {
    if (typeof window !== 'undefined' && typeof KeyboardEvent === 'function') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    }
  });
  box.append(again);
  box.append(el('p', 'status', 'OR PRESS R'));
  return box;
}

// Draw the whole screen from scratch into #screen. `canPay` is the affordability predicate main.js hands
// over (engine.canAfford bound to the live state); it defaults to exactly that, so a caller passing only
// three arguments still gets the makers' rule.
export function render(state, event, onChoose, canPay = (option) => canAfford(state, option)) {
  const root = document.getElementById('screen');
  if (!root) return;
  root.textContent = '';

  root.append(header());

  if (!state.alive || state.won) {
    root.append(summary(state));
    return;
  }

  // The rule taken to its limit: if not one option on this event can be paid for, the mission has
  // starved. The run ends here and the summary draws in place of the event and its options.
  const options = event?.options ?? [];
  if (!options.some((option) => canPay(option) === true)) {
    state.alive = false;
    state.endReason = 'supplies';
    root.append(summary(state));
    return;
  }

  // The flight path sits between the clock strip and the event: where the ship is, then what happens next.
  // flightPath() guards a missing planet itself, so a state with no destination still draws quietly.
  root.append(resourceBar(state), dateBar(state), flightPath(state, state.monthsAtLaunch), eventBlock(event, onChoose, canPay, state));
}
