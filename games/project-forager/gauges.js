// gauges.js — fixed side instrument panels: state-driven ASCII meters plus CSS-only animated windows.
import { startMoney, startFood, startFuel, startMaterial } from './tuning.js';

// Danger threshold: a resource below 25% of its starting load turns red. Red means danger only.
const DANGER_FRACTION = 0.25;

// One meter line is label (6ch) + bar (14 cells) + percent, so it fits a 200px panel at 0.68rem.
const BAR_CELLS = 14;

// Waveform characters. Repeating the strip twice lets the CSS slide of -50% loop seamlessly.
const WAVE_UNIT = '▁▂▃▅▇█▇▅▃▂▁▂▃▄▃▂';
const WAVE_STRIP = WAVE_UNIT.repeat(2);

// Starting loads: the 100% mark and the danger reference for each meter.
const STARTS = { food: startFood, fuel: startFuel, material: startMaterial, money: startMoney };

// The two panel elements, built once and reused on every mount so CSS animations never restart.
let panels = null;

// Small DOM helper: make an element with a class and optional text.
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ASCII title bar with a fixed 26-character width, in the style the rest of the console uses.
function frameLine(title) {
  const dashes = '─'.repeat(Math.max(2, 21 - title.length));
  return `┌─ ${title} ${dashes}┐`;
}

// One instrument window: title line, body, closing line. Title and frame stay static.
function makeWindow(title) {
  const win = el('div', 'gauge-win');
  const body = el('div', 'gauge-win-body');
  win.appendChild(el('div', 'gauge-win-title', frameLine(title)));
  win.appendChild(body);
  win.appendChild(el('div', 'gauge-win-foot', `└${'─'.repeat(24)}┘`));
  return { win, body };
}

// A meter row: the label, the character bar and the percent are separate nodes updated in place.
function makeMeter(label) {
  const line = el('div', 'gauge-meter');
  const bar = el('span', 'gauge-meter-bar', '');
  const pct = el('span', 'gauge-meter-pct', '  0%');
  line.appendChild(el('span', 'gauge-meter-label', label));
  line.appendChild(bar);
  line.appendChild(pct);
  return { line, bar, pct };
}

// A telemetry row: dim label on the left, value on the right.
function makeRow(label) {
  const row = el('div', 'gauge-row');
  const value = el('span', 'gauge-row-value', '—');
  row.appendChild(el('span', 'gauge-row-label', label));
  row.appendChild(value);
  return { row, value };
}

// Build both panels once and cache every node that later updates touch.
function build() {
  const left = el('aside', 'gauge-panel gauge-panel-left');
  const right = el('aside', 'gauge-panel gauge-panel-right');
  left.setAttribute('aria-hidden', 'true');
  right.setAttribute('aria-hidden', 'true');

  // LEFT: life support (the two fatal resources), cargo (material and credits), telemetry.
  const life = makeWindow('LIFE SUPPORT');
  const fuel = makeMeter('FUEL');
  const food = makeMeter('FOOD');
  life.body.appendChild(fuel.line);
  life.body.appendChild(food.line);
  const lampRow = makeRow('O2 GEN');
  lampRow.value.textContent = '';
  const lamp = el('span', 'gauge-lamp', '●');
  lampRow.value.appendChild(lamp);
  lampRow.value.appendChild(el('span', 'gauge-lamp-text', ' ONLINE'));
  life.body.appendChild(lampRow.row);

  const cargo = makeWindow('CARGO HOLD');
  const material = makeMeter('MAT');
  const money = makeMeter('CRED');
  cargo.body.appendChild(material.line);
  cargo.body.appendChild(money.line);
  const scan = el('div', 'gauge-scan');
  scan.appendChild(el('span', 'gauge-scan-fill', ''));
  cargo.body.appendChild(scan);

  const telemetry = makeWindow('TELEMETRY');
  const phase = makeRow('PHASE');
  const stardate = makeRow('STARDATE');
  const status = makeRow('STATUS');
  telemetry.body.appendChild(phase.row);
  telemetry.body.appendChild(stardate.row);
  telemetry.body.appendChild(status.row);

  left.appendChild(life.win);
  left.appendChild(cargo.win);
  left.appendChild(telemetry.win);

  // RIGHT: a decorative sensor feed and a decorative power bus.
  const sensor = makeWindow('SENSOR ARRAY');
  const wave = el('div', 'gauge-wave');
  wave.appendChild(el('span', 'gauge-wave-track', WAVE_STRIP));
  sensor.body.appendChild(wave);
  const sweep = makeRow('SWEEP');
  sweep.value.textContent = '';
  sweep.value.appendChild(el('span', 'gauge-cursor', '+'));
  sensor.body.appendChild(sweep.row);

  const power = makeWindow('POWER BUS');
  const bus = makeRow('MAIN BUS');
  bus.value.textContent = '';
  bus.value.appendChild(el('span', 'gauge-lamp', '●'));
  bus.value.appendChild(el('span', 'gauge-lamp-text', ' LIVE'));
  power.body.appendChild(bus.row);
  const powerScan = el('div', 'gauge-scan');
  powerScan.appendChild(el('span', 'gauge-scan-fill', ''));
  power.body.appendChild(powerScan);

  right.appendChild(sensor.win);
  right.appendChild(power.win);

  if (document.body) {
    document.body.appendChild(left);
    document.body.appendChild(right);
  }

  return { left, right, fuel, food, material, money, phase, stardate, status };
}

// Read a number, or fall back so a partial state never shows a false alarm or throws.
function num(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// Recompute one meter from the value. The bar string is rebuilt each call; nothing is re-created.
function updateMeter(meter, value, start) {
  const safeStart = start > 0 ? start : 1;
  const safeValue = Math.max(0, num(value, start));
  const ratio = Math.min(1, safeValue / safeStart);
  const filled = Math.round(ratio * BAR_CELLS);
  meter.bar.textContent = '█'.repeat(filled) + '░'.repeat(BAR_CELLS - filled);
  meter.pct.textContent = `${String(Math.round(ratio * 100)).padStart(3, ' ')}%`;
  const danger = ratio < DANGER_FRACTION;
  meter.line.classList.toggle('is-danger', danger);
  return danger;
}

// Push the state into the cached nodes; never rebuild, never restart the CSS animations.
function update(state) {
  const s = state || {};

  // Every meter updates first; only then is the danger flag combined (no short-circuit skipping).
  const fuelDanger = updateMeter(panels.fuel, s.fuel, STARTS.fuel);
  const foodDanger = updateMeter(panels.food, s.food, STARTS.food);
  const materialDanger = updateMeter(panels.material, s.material, STARTS.material);
  const moneyDanger = updateMeter(panels.money, s.money, STARTS.money);
  const danger = fuelDanger || foodDanger || materialDanger || moneyDanger;

  panels.phase.value.textContent = String(s.phase || '—').toUpperCase();

  const months = Math.max(0, Math.floor(num(s.monthsElapsed, 0)));
  const year = Math.floor(months / 12);
  const month = months % 12;
  panels.stardate.value.textContent =
    `Y${String(year).padStart(2, '0')} M${String(month).padStart(2, '0')}`;

  let word = 'NOMINAL';
  let extra = '';
  if (s.alive === false) {
    word = 'CRITICAL';
    extra = ' is-danger';
  } else if (s.won === true) {
    word = 'COMPLETE';
    extra = ' is-complete';
  } else if (danger) {
    word = 'CRITICAL';
    extra = ' is-danger';
  }
  panels.status.value.textContent = word;
  panels.status.value.className = `gauge-row-value gauge-status${extra}`;
}

// Public API: mount once, then update in place on every call. Safe with no state at all.
export function mountGauges(state) {
  if (!panels) panels = build();
  if (!panels) return;
  update(state);
}
