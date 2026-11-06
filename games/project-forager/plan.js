// plan.js — the Plan phase: ten randomized worlds in three survey tiers in a compact list beside a
// spinning ASCII sphere whose size, surface family, ring and tint differ per world, one orbital probe
// that reveals every remaining reading at once, then mission size, loadout and LAUNCH.

import {
  doomYears,
  planBaseYears,
  investigateYears,
  sizeSmall,
  sizeMedium,
  sizeLarge,
  missionSizes,
  loadStep,
  loadPrice,
} from './tuning.js';

const SIZE_CHOICES = [
  { key: 'small', size: sizeSmall },
  { key: 'medium', size: sizeMedium },
  { key: 'large', size: sizeLarge },
];

const RESOURCE_LABELS = { money: 'CREDITS', food: 'FOOD', fuel: 'FUEL', material: 'MATERIAL' };

// Ten worlds per run in the makers' three survey tiers. The tier list is dealt out in random order (then
// the worlds are sorted nearest-first), so a row's tier cannot be read off its position in the list.
const WORLD_COUNT = 10;
const TIER_PLAN = ['full', 'full', 'full', 'partial', 'partial', 'partial',
  'redacted', 'redacted', 'redacted', 'redacted'];
const STAT_KEYS = ['travelMonths', 'materialRichness'];
const REDACTED = '████';

// The three supplies the Plan-phase loadout can top up (credits are the currency, not a loadable supply).
const LOADOUT_KEYS = ['food', 'fuel', 'material'];

// A short list of catalogue prefixes; a name is one prefix, a random number and a class letter.
const NAME_PREFIXES = ['KEPLER', 'GLIESE', 'WOLF', 'LUV', 'TEAGARDEN-STAR', 'TRAPPIST', 'PROXIMA', 'ROSS', 'HAT-P', 'TOI'];
const NAME_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Sphere grid and shading ramp. Each planet gets its own grid size, so worlds read at a glance as
// different objects; the first ramp character is empty space so the dark limb fades to black.
const SPHERE_MIN_ROWS = 10;
const SPHERE_MAX_ROWS = 14;
const SPHERE_ASPECT = 1.75; // monospace cells are taller than wide, so ~1.75:1 reads as a round disc
const SPHERE_FRAMES = 6;
const SPHERE_RAMP = [' ', '.', ',', ':', '*', 'o', 'O', '#', '@'];
const RING_CHAR = '=';

// The three surface families: blotchy rock, a cratered crust of many small blobs, and a banded gas giant.
const FAMILIES = ['rock', 'crater', 'gas'];
// A restrained 80s-telemetry palette, one tint per world. No danger red.
const TINTS = ['#3ff0d0', '#8fb6d9', '#e8b45a', '#b79cff'];

// The worlds for this run. Generated once, then kept stable across every redraw of the screen.
let generatedWorlds = null;

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

// Integer in [min, max], both ends included.
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// The same STARDATE / deadline format ui.js uses, so the clock reads the same across phases.
function stardate(state) {
  const year = Math.floor(state.monthsElapsed / 12) + 1;
  const month = (state.monthsElapsed % 12) + 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `STARDATE Y${pad(year)} M${pad(month)}`;
}

// A catalogue designation no other world this run already uses.
function freshName(taken) {
  for (let tries = 0; tries < 200; tries++) {
    const prefix = NAME_PREFIXES[randomInt(0, NAME_PREFIXES.length - 1)];
    const number = randomInt(100, 9999);
    const letter = NAME_LETTERS[randomInt(0, NAME_LETTERS.length - 1)];
    const name = `${prefix}-${number}${letter}`;
    if (!taken.has(name)) return name;
  }
  return `DEEP-FIELD-${randomInt(100000, 999999)}`; // never expected; guarantees a unique fallback
}

// A shuffled copy, for dealing the tiers out at random.
function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Build this run's worlds: ten unique catalogue names, travel 36-72 months and richness 0.6-1.4, dealt
// three full surveys, three partial and four redacted at random, then sorted nearest first.
// Called once per run; resetPlanets() clears it.
function buildWorlds() {
  const taken = new Set();
  const tiers = shuffled(TIER_PLAN);
  const worlds = [];
  for (let i = 0; i < WORLD_COUNT; i++) {
    const name = freshName(taken);
    taken.add(name);
    const tier = tiers[i];
    const hidden = tier === 'redacted'
      ? STAT_KEYS.slice()
      : tier === 'partial'
        ? [STAT_KEYS[randomInt(0, STAT_KEYS.length - 1)]]
        : [];
    worlds.push({
      id: `world-${i + 1}`,
      name,
      tier,
      hidden, // the stats this world is still hiding; one investigation clears all of them
      revealed: false,
      travelMonths: randomInt(36, 72),
      materialRichness: randomInt(6, 14) / 10, // one decimal place
      surface: null, // the ASCII surface recipe, drawn lazily and stable across redraws
    });
  }

  worlds.sort((a, b) => a.travelMonths - b.travelMonths);

  // Every world gets its own look, and no two worlds on the screen may share the same one: on a
  // collision the surface is redrawn from a salted seed (size, family, ring and tint all included).
  const seen = new Set();
  for (const planet of worlds) {
    let surface = buildSurface(planet, 0);
    for (let attempt = 1; seen.has(lookKey(surface)) && attempt < 60; attempt++) {
      surface = buildSurface(planet, attempt);
    }
    seen.add(lookKey(surface));
    planet.surface = surface;
  }
  return worlds;
}

// What makes two spheres tell apart at a glance: their grid, family, ring and tint.
function lookKey(surface) {
  return `${surface.cols}x${surface.rows}/${surface.family}/${surface.ring ? 'ring' : 'none'}/${surface.tint}`;
}

// The worlds to show right now, generated on first use in a run.
export function ensureWorlds() {
  if (!generatedWorlds) generatedWorlds = buildWorlds();
  return generatedWorlds;
}

// Called by the restart path: the next renderPlan builds a brand-new set of worlds.
export function resetPlanets() {
  generatedWorlds = null;
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

function dateBar(state) {
  const pad = (n) => String(n).padStart(2, '0');
  const left = Math.max(0, doomYears * 12 - state.monthsElapsed);
  const bar = el('section', 'dates');
  bar.append(el('span', 'stamp', stardate(state)));
  bar.append(el('span', 'stamp', `EARTH DEADLINE Y${pad(doomYears)} M12  T-${left}M`));
  return bar;
}

// A stat the player has not paid to learn reads as redacted blocks until the survey is complete.
function statLine(planet) {
  const hidden = (key) => !planet.revealed && planet.hidden.includes(key);
  const travel = hidden('travelMonths') ? `${REDACTED} MO` : `${planet.travelMonths} MO`;
  const rich = hidden('materialRichness') ? REDACTED : planet.materialRichness.toFixed(1);
  return `TRAVEL ${travel}   RICHNESS ${rich}`;
}

// The tag beside each row names its survey tier, or says it is complete once investigated.
function tierTag(planet) {
  if (planet.revealed) return 'SURVEY COMPLETE';
  if (planet.tier === 'redacted') return 'REDACTED';
  if (planet.tier === 'partial') return 'PARTIAL SURVEY';
  return 'FULL SURVEY';
}

// A stable 32-bit seed from the planet's name and richness, so each world gets its own surface.
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32): the same planet always draws the same surface, every redraw.
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normalize an angle into one turn, so longitude wraps cleanly around the equator.
function wrapAngle(a) {
  const turn = Math.PI * 2;
  return ((a % turn) + turn) % turn;
}

// Cheap deterministic value noise: same cell in, same 0-1 value out, every frame and every redraw.
function cellNoise(seed, x, y) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

// The planet's surface recipe, drawn from its name, richness and a retry salt: its own grid size,
// surface family, tint, optional ring, continents or craters, coastline grain and shading falloff.
// Two different planets therefore draw obviously different spheres.
function buildSurface(planet, attempt) {
  const seed = hashSeed(`${planet.name}|${planet.materialRichness}|${attempt}`);
  const rand = makeRandom(seed);
  const rows = SPHERE_MIN_ROWS + Math.floor(rand() * (SPHERE_MAX_ROWS - SPHERE_MIN_ROWS + 1));
  const cols = Math.round(rows * SPHERE_ASPECT);
  const family = FAMILIES[Math.floor(rand() * FAMILIES.length)];
  const tint = TINTS[Math.floor(rand() * TINTS.length)];
  const ring = rand() < 0.5;

  const blobs = [];
  const count = family === 'crater' ? 7 + Math.floor(rand() * 5) : 2 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    blobs.push({
      lon: rand() * Math.PI * 2,
      lat: (rand() - 0.5) * 2.2, // clear of the poles
      radius: family === 'crater' ? 0.14 + rand() * 0.22 : 0.34 + rand() * 0.46,
      weight: 0.45 + rand() * 0.55,
    });
  }
  const capRoll = rand();
  return {
    seed,
    rows,
    cols,
    family,
    tint,
    ring,
    blobs,
    bands: 6 + Math.floor(rand() * 8), // coastline grain: 6..13 cells round the equator
    gasBands: 3.5 + rand() * 3, // 3-6 latitude stripes for a gas giant
    hasCap: family !== 'gas' && capRoll < 0.5,
    capLat: 1.0 + rand() * 0.3, // radians from the equator; caps reach in from both poles
    ringTilt: (rand() < 0.5 ? -1 : 1) * (0.08 + rand() * 0.18), // shallow slope across the disc
    ringThickness: 0.07 + rand() * 0.06, // about one or two rows, in disc space
    ringWobble: 0.12 + rand() * 0.18, // how far the ring slides per frame, so it turns with the disc
    ringPhase: rand() * Math.PI * 2,
    falloff: 0.7 + rand() * 0.9, // 0.7 soft terminator .. 1.6 hard one
    albedo: 0.4 + rand() * 0.32, // ocean brightness
  };
}

function surfaceFor(planet) {
  if (!planet.surface) planet.surface = buildSurface(planet, 0);
  return planet.surface;
}

// Angular distance between two points on the sphere, for continent caps.
function angularDistance(lon, lat, lon0, lat0) {
  const d = Math.sin(lat) * Math.sin(lat0)
    + Math.cos(lat) * Math.cos(lat0) * Math.cos(wrapAngle(lon - lon0));
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

// How solid the ground is at one point: 0 for open ground, up to 1 at a continent's heart. Gas giants
// read as latitude bands instead of land; craters and rock share the blob code with different scales.
function landAt(surface, lon, lat) {
  if (surface.family === 'gas') {
    // Horizontal stripes, warped by longitude so they flow and turn with the disc. Kept in a narrow
    // brightness band so the stripes read instead of the whole face blowing out to the brightest glyph.
    const warp = Math.sin(lon * 2 + surface.ringPhase) * 0.14 + Math.sin(lon * 3.7) * 0.06;
    const v = 0.5 + 0.5 * Math.sin((lat + warp) * surface.gasBands);
    return 0.1 + v * 0.5;
  }
  let land = 0;
  for (const blob of surface.blobs) {
    const grain = (cellNoise(surface.seed, Math.floor(wrapAngle(lon) / (Math.PI * 2) * surface.bands),
      Math.floor((lat / Math.PI + 0.5) * surface.bands)) - 0.5) * 0.4;
    const edge = blob.radius + grain;
    const d = angularDistance(lon, lat, blob.lon, blob.lat);
    if (d < edge) {
      const core = 1 - d / edge; // 1 at the centre, 0 at the coast
      land = Math.max(land, blob.weight * (0.45 + 0.55 * core));
    }
  }
  if (surface.hasCap && Math.abs(lat) > surface.capLat) land = Math.max(land, 0.9);
  return Math.min(1, land);
}

// True where the planet's ring crosses the grid. The line slopes across the disc and slides a little
// with the spin, with travelling gaps, so the ring visibly turns with the planet.
function ringAt(surface, nx, ny, spin) {
  if (!surface.ring) return false;
  const line = surface.ringTilt * nx + Math.sin(spin + surface.ringPhase) * surface.ringWobble;
  if (Math.abs(ny - line) > surface.ringThickness) return false;
  const u = (nx + 1) / 2; // position along the ring
  const phase = (((u - spin / (Math.PI * 2)) % 1) + 1) % 1;
  return phase > 0.16; // a gap that travels round the ring each frame
}

// One frame of the planet as ASCII text: a shaded disc, lit from the upper left, on this planet's own
// grid and with its own surface turned a further 1/6 of the way round per frame, so the stack reads as
// rotation. The ring, where present, is drawn over the disc and across the grid.
function sphereFrame(planet, frame) {
  const surface = surfaceFor(planet);
  const { rows, cols } = surface;
  const spin = (frame / SPHERE_FRAMES) * Math.PI * 2;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const lines = [];

  for (let y = 0; y < rows; y++) {
    const ny = (y - cy) / (rows / 2); // -1 top .. 1 bottom
    let line = '';
    for (let x = 0; x < cols; x++) {
      const nx = (x - cx) / (cols / 2); // -1 left .. 1 right
      const ring = ringAt(surface, nx, ny, spin);
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) { line += ring ? RING_CHAR : ' '; continue; }
      if (ring) { line += RING_CHAR; continue; }

      const nz = Math.sqrt(1 - r2); // front face of the sphere
      const lon = wrapAngle(Math.atan2(nx, nz) + spin);
      const lat = Math.asin(-ny); // top of the frame is latitude +90
      const land = landAt(surface, lon, lat);

      // Land or bright bands are brighter than open ocean; the lighting is shared, so every world keeps
      // the same lit-ball-with-a-dark-limb silhouette.
      const albedo = surface.albedo + land * 0.62;
      const lit = Math.max(0, nx * -0.55 + ny * -0.5 + nz * 0.67);
      const shade = Math.min(1, Math.pow(lit, surface.falloff) * 1.5 * albedo);
      const index = Math.min(SPHERE_RAMP.length - 1, Math.floor(shade * SPHERE_RAMP.length));
      line += SPHERE_RAMP[index];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// Inject the rotation CSS once. style.css is not ours to edit, so the sphere's animation lives here.
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || !document.head) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-plan-sphere', 'true');
  style.textContent = `
.plan-planets { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; margin-top: 0.75rem; }
.plan-planets .options { flex: 1 1 22rem; min-width: 17rem; }
.plan-sphere { flex: 0 0 auto; position: relative; min-height: 18em; }
.plan-sphere-frame, .plan-sphere-placeholder {
  margin: 0;
  font-family: var(--mono, monospace);
  font-size: 0.8rem;
  line-height: 1;
  letter-spacing: 0;
  white-space: pre;
  color: var(--teal, #3ff0d0);
}
.plan-sphere-frame {
  position: absolute;
  inset: 0 auto auto 0;
  opacity: 0;
  animation: plan-sphere-cycle 2.4s steps(1) infinite;
}
.plan-sphere-frame-0 { position: relative; inset: auto; animation-delay: 0s; }
.plan-sphere-frame-1 { animation-delay: 0.4s; }
.plan-sphere-frame-2 { animation-delay: 0.8s; }
.plan-sphere-frame-3 { animation-delay: 1.2s; }
.plan-sphere-frame-4 { animation-delay: 1.6s; }
.plan-sphere-frame-5 { animation-delay: 2s; }
.plan-sphere-placeholder { color: var(--teal-dim, #1f9c85); }
@keyframes plan-sphere-cycle {
  0% { opacity: 1; }
  16.667% { opacity: 0; }
  100% { opacity: 0; }
}
.plan-row.plan-row-selected {
  border-color: var(--line-strong, rgba(63, 240, 208, 0.55));
  background: rgba(63, 240, 208, 0.08);
  color: var(--teal-bright, #c6fff3);
}
.plan-row.plan-row-selected .option-key { color: var(--teal-bright, #c6fff3); }
/* Ten worlds: every row stays on one line, clipped rather than wrapped. */
.plan-row .option-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* One probe for the whole screen, under the list: its full label is allowed to wrap. */
.plan-probe { margin-top: 0.4rem; }
.plan-probe .option-key { color: var(--teal-bright, #c6fff3); }
.plan-probe .option-label { white-space: normal; overflow: visible; }
@media (prefers-reduced-motion: reduce) {
  .plan-sphere-frame { animation: none; opacity: 0; }
  .plan-sphere-frame-0 { opacity: 1; }
}
`;
  document.head.appendChild(style);
}

// The selected planet as a stack of ASCII frames; before a choice, a quiet placeholder instead.
function sphereView(planet) {
  const wrap = el('div', 'plan-sphere');
  if (!planet) {
    wrap.append(el('pre', 'plan-sphere-placeholder',
      '        .  .\n     .        .\n   .   NO WORLD   .\n     .  SELECTED .\n        .  .'));
    return wrap;
  }
  const tint = surfaceFor(planet).tint; // style.css is not ours to edit, so the tint is inline
  for (let i = 0; i < SPHERE_FRAMES; i++) {
    const frame = el('pre', `plan-sphere-frame plan-sphere-frame-${i}`, sphereFrame(planet, i));
    frame.style.color = tint;
    wrap.append(frame);
  }
  return wrap;
}

// The whole planet section: the sphere beside a compact one-row-per-world list, each row showing its
// travel time and richness (or redacted blocks) and a >> marker when it is the one being planned for,
// then a single orbital probe row for the whole screen.
function planetSection(chosenPlanet, onChoose, onProbe) {
  const section = el('section', 'event');
  section.append(el('p', 'event-text', 'PLANET SELECTION — choose where to send the mission.'));
  section.append(el('p', 'event-text',
    'Partial surveys hide one reading and redacted worlds hide both. One orbital probe reveals every hidden reading on every world and costs a year on the clock.'));

  const body = el('div', 'plan-planets');
  body.append(sphereView(chosenPlanet));

  const list = el('div', 'options');
  ensureWorlds().forEach((planet, i) => {
    const selected = chosenPlanet === planet;
    const row = el('button', selected ? 'option plan-row plan-row-selected' : 'option plan-row');
    row.type = 'button';
    row.setAttribute('aria-pressed', selected ? 'true' : 'false');
    row.append(el('span', 'option-key', selected ? '>>' : String(i + 1).padStart(2, '0')));
    row.append(el('span', 'option-label',
      `${selected ? 'SELECTED: ' : ''}${planet.name} — ${statLine(planet)} [${tierTag(planet)}]`));
    row.addEventListener('click', () => onChoose(planet));
    list.append(row);
  });

  // One probe for the whole screen: it reveals every reading still hidden anywhere on the list. Once
  // nothing is hidden it is locked and dimmed, and pressing it again does nothing.
  const hiddenLeft = ensureWorlds().some((planet) => !planet.revealed && planet.hidden.length > 0);
  const probe = el('button', 'option plan-probe');
  probe.type = 'button';
  probe.disabled = !hiddenLeft;
  if (!hiddenLeft) {
    probe.classList.add('option-locked');
    probe.style.opacity = '0.4';
  }
  probe.append(el('span', 'option-key', '??'));
  probe.append(el('span', 'option-label',
    `LAUNCH ORBITAL PROBE — SPEND ${investigateYears} YEAR${investigateYears === 1 ? '' : 'S'}, REVEAL EVERY REMAINING READING`));
  probe.addEventListener('click', () => {
    if (hiddenLeft) onProbe();
  });
  list.append(probe);

  body.append(list);
  section.append(body);
  return section;
}

// Draw the Plan screen into #screen. `onReady()` fires once, after a launch has been applied.
export function renderPlan(state, onReady) {
  const root = document.getElementById('screen');
  if (!root) return;

  injectStyles();
  for (const planet of ensureWorlds()) planet.revealed = false;

  let chosenPlanet = null;
  let chosenSize = null;
  let launched = false;
  // How many loadout steps of each supply the player has bought. Lives in this closure so it survives
  // every redraw of the Plan screen; only LAUNCH applies it to state.
  let loadSteps = { food: 0, fuel: 0, material: 0 };

  // Units bought and their credit cost, both derived from the per-press step and price in tuning.js.
  function loadoutUnits(key) { return loadSteps[key] * loadStep[key]; }
  function loadoutCost() {
    return LOADOUT_KEYS.reduce((sum, key) => sum + loadoutUnits(key) * loadPrice[key], 0);
  }

  // One orbital probe reveals every reading still hidden on any world, all at once, for a single year on
  // the clock. The `probed` latch and the empty-pending guard mean it can never charge the year twice.
  let probed = false;
  function onProbe() {
    const pending = ensureWorlds().filter((planet) => !planet.revealed && planet.hidden.length > 0);
    if (probed || pending.length === 0) return;
    probed = true;
    state.monthsElapsed += investigateYears * 12;
    for (const planet of pending) planet.revealed = true;
    draw();
  }

  function sizeCard() {
    const card = el('section', 'event');
    card.append(el('p', 'event-text', 'MISSION SIZE — what you launch with. Bigger crews cost more and drain faster.'));
    const options = el('div', 'options');

    SIZE_CHOICES.forEach((choice, i) => {
      const selected = chosenSize === choice.key;
      const button = el('button', 'option');
      button.type = 'button';
      button.append(el('span', 'option-key', selected ? '>>' : String(i + 1).padStart(2, '0')));
      button.append(el('span', 'option-label',
        `${selected ? 'SELECTED: ' : ''}${choice.key.toUpperCase()} — COST ${choice.size.cost} CR   CREW ${choice.size.people}   DRAIN x${choice.size.drainMultiplier.toFixed(1)}`));
      button.addEventListener('click', () => { chosenSize = choice.key; draw(); });
      options.append(button);
    });

    card.append(options);
    return card;
  }

  // The MISSION LOADOUT card: spend credits now to top up FOOD / FUEL / MATERIAL on top of the base
  // stock the ship already carries. It is inert (one line, no buttons) until a mission size is chosen,
  // because the budget it spends against is what is left after the mission's cost is paid.
  function loadCard() {
    const card = el('section', 'event');

    if (!chosenSize) {
      card.append(el('p', 'event-text', 'MISSION LOADOUT — choose a mission size first to load extra supplies.'));
      return card;
    }

    const size = missionSizes[chosenSize];
    const missionCost = size.cost;
    const budget = state.money - missionCost; // the player never spends past the credits left after launch
    const total = loadoutCost();

    card.append(el('p', 'event-text',
      'MISSION LOADOUT — the mission already carries the base stock. Spend credits to load up to the cap. You do not have to fill it.'));

    const rows = el('div', 'options');
    for (const key of LOADOUT_KEYS) {
      const units = loadoutUnits(key);
      const cost = units * loadPrice[key];
      const carried = size.base[key] + units; // what the ship would actually leave with
      const room = size.cap[key] - carried; // how much more it can hold
      const row = el('div', 'option');
      row.append(el('span', 'option-label',
        `${RESOURCE_LABELS[key]}: ${num(carried)} OF ${num(size.cap[key])} CAP   LOADED +${units}   COST ${cost} CR`));

      const minus = el('button', 'option');
      minus.type = 'button';
      minus.append(el('span', 'option-key', '-'));
      minus.disabled = loadSteps[key] === 0; // nothing loaded yet: the step is inert
      minus.addEventListener('click', () => {
        if (loadSteps[key] === 0) return;
        loadSteps[key] -= 1;
        draw();
      });

      const stepCost = loadStep[key] * loadPrice[key];
      const full = room < loadStep[key]; // the hold is full: no more of this fits
      const affordable = total + stepCost <= budget;
      const plus = el('button', 'option');
      plus.type = 'button';
      plus.append(el('span', 'option-key', '+'));
      plus.disabled = full || !affordable;
      if (full || !affordable) { // Full hold or an unpayable step: disabled, dimmed, changes nothing.
        plus.classList.add('option-locked');
        plus.style.opacity = '0.4';
      }
      plus.addEventListener('click', () => {
        if (full || !affordable) return;
        loadSteps[key] += 1;
        draw();
      });

      row.append(minus);
      row.append(plus);
      rows.append(row);
    }
    card.append(rows);

    card.append(el('p', 'event-text', `LOADOUT COST ${total} CR`));
    card.append(el('p', 'event-text',
      `CREDITS AFTER LAUNCH AND LOAD: ${num(state.money - missionCost - total)} CR`));

    const actions = el('div', 'options');
    const reset = el('button', 'option');
    reset.type = 'button';
    reset.append(el('span', 'option-key', '00'));
    reset.append(el('span', 'option-label', 'RESET LOADOUT'));
    reset.addEventListener('click', () => {
      loadSteps = { food: 0, fuel: 0, material: 0 };
      draw();
    });
    actions.append(reset);
    card.append(actions);

    return card;
  }

  function launchCard() {
    const card = el('section', 'event');
    const ready = Boolean(chosenPlanet && chosenSize);
    const missionCost = chosenSize ? missionSizes[chosenSize].cost : 0;
    const loadout = loadoutCost();
    const spend = missionCost + loadout; // the total LAUNCH will charge: mission cost plus the loadout
    // You cannot spend money you do not have: the launch is locked while the credits on hand are short
    // of what it will charge, exactly as it is locked before a planet and a size are chosen.
    const payable = ready && state.money >= spend;

    const line = !ready
      ? 'CHOOSE A PLANET AND A MISSION SIZE TO LAUNCH.'
      : payable
        ? `READY: ${chosenPlanet.name} / ${chosenSize.toUpperCase()} — TOTAL SPEND ${spend} CR (MISSION ${missionCost} + LOADOUT ${loadout}), ${num(state.money - spend)} CR LEFT AFTER LAUNCH`
        : `NOT ENOUGH CREDITS: ${chosenPlanet.name} / ${chosenSize.toUpperCase()} COSTS ${spend} CR AND YOU HOLD ${num(state.money)} CR.`;
    card.append(el('p', 'event-text', line));
    if (!payable) {
      card.append(el('p', 'status', ready ? '[ LAUNCH LOCKED — SHORT ON CREDITS ]' : '[ LAUNCH LOCKED ]'));
    }

    const options = el('div', 'options');
    const launch = el('button', 'option');
    launch.type = 'button';
    launch.disabled = !payable;
    if (ready && !payable) {
      // Same dimmed state the flight's unaffordable options use (style.css is not ours to edit).
      launch.classList.add('option-locked');
      launch.style.opacity = '0.4';
    }
    launch.append(el('span', 'option-key', '>>'));
    launch.append(el('span', 'option-label', 'LAUNCH — BEGIN FLIGHT PHASE'));
    launch.addEventListener('click', () => {
      const charge = missionSizes[chosenSize].cost + loadoutCost(); // the number the card displayed as TOTAL SPEND
      if (launched || !ready || state.money < charge) return;
      launched = true;
      state.planet = chosenPlanet;
      state.missionSize = chosenSize;
      state.money -= charge;
      // The ship leaves with its mission's base stock plus whatever the player bought, never above the
      // mission's cap. Assigned rather than added, so the base stock follows the chosen size.
      const load = missionSizes[chosenSize];
      state.food = load.base.food + loadoutUnits('food');
      state.fuel = load.base.fuel + loadoutUnits('fuel');
      state.material = load.base.material + loadoutUnits('material');
      // Phase 1 always costs the fixed preparation year, whatever the player investigated. Added on top
      // of any investigations already paid for (each of those advanced the clock when it was taken), so
      // the Plan phase closes at month 12, 24 or 36.
      state.monthsElapsed += planBaseYears * 12;
      state.phase = 'flight';
      onReady();
    });
    options.append(launch);
    card.append(options);
    return card;
  }

  function draw() {
    root.textContent = '';
    root.append(el('header', 'screen-header', 'PROJECT FORAGER // MISSION PLANNING'));
    root.append(resourceBar(state));
    root.append(dateBar(state));

    root.append(planetSection(
      chosenPlanet,
      (planet) => { chosenPlanet = planet; draw(); },
      onProbe,
    ));
    root.append(sizeCard());
    root.append(loadCard());
    root.append(launchCard());
  }

  draw();
}
