// flightpath.js — the Flight phase telemetry strip: an inline SVG voyage from EARTH to the destination
// planet, with the ship blinking along the path, one tick per voyage year, and the distance / ETA /
// stardate readout underneath. Reads only the `state` it is handed.
// Drawing geometry, in SVG user units. Not game tuning: the viewBox scales the strip to any width.
const W = 760;
const H = 158;
const X0 = 80; // x of the EARTH end of the path
const X1 = 680; // x of the destination end
const PATH_Y = 74; // the real mission's path line's y
const FLEET_UP_Y = 34; // the lane above the real mission
const FLEET_DOWN_Y = 114; // the lane below it
const LANE_MIN = 0.1; // fleet markers never reach their own track ends
const LANE_MAX = 0.9;
const SEP_Y = 130;
const READOUT_Y = 148;
const SVG_NS = 'http://www.w3.org/2000/svg';

// The real mission's teal, matching --teal in style.css. style.css is not ours to edit, so the lane
// colours below are inline SVG attributes.
const MAIN_COLOUR = '#3ff0d0';

// The two fleet-mate lanes. Cosmetic only: nothing here is ever read back into `state`, and no rule,
// resource or event looks at them. The real mission is the middle lane; these are other missions of the
// fleet passing on their own clocks.
const FLEET_LANES = [
  { lane: 'upper', y: FLEET_UP_Y, colour: '#ffb454', drift: 0.0015, shift: 3 }, // amber
  { lane: 'lower', y: FLEET_DOWN_Y, colour: '#ff6ec7', drift: 0.0025, shift: 13 }, // magenta
];
const FLEET_DESIGNATIONS = ['MERIDIAN', 'PALE HORSE', 'SURVEYOR', 'KESTREL', 'LONG SHOT', 'TALLOW'];

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// Y## M## — the same maths as ui.js's date bar, so the strip and the bar can never disagree.
function stardate(monthsElapsed) {
  const year = Math.floor(monthsElapsed / 12) + 1;
  const month = (monthsElapsed % 12) + 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `Y${pad(year)} M${pad(month)}`;
}

// FNV-1a over the planet name. The screen redraws on every click, so a fleet lane's designation, ETA and
// position must be a pure function of the destination — otherwise the lane teleports on every render.
function planetHash(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

// A fleet lane's position along its own track: a hash-derived base plus a slow cosmetic drift with the
// calendar, clamped short of both ends, and nudged off the real ship (and off the other lane) so no two
// markers ever sit on top of each other.
function laneFraction(base, drift, monthsElapsed, avoid) {
  const target = base + monthsElapsed * drift;
  const near = (value) => avoid.some((other) => Math.abs(value - other) < 0.06);
  for (const nudge of [0, 0.12, -0.24, 0.36]) {
    const fraction = Math.min(LANE_MAX, Math.max(LANE_MIN, target + nudge));
    if (!near(fraction)) return fraction;
  }
  return Math.min(LANE_MAX, Math.max(LANE_MIN, target));
}

// The strip. `monthsAtLaunch` is the month the Flight phase opened on. No field of state records it, so
// it defaults to 0: the voyage is then measured from month 0, exactly as main.js's arrival check
// (monthsElapsed >= travelMonths) and ui.js's "ARRIVAL IN" stamp measure it, so the ship docks with the
// clock instead of disagreeing with it. A caller that does know the launch month can pass it.
export function flightPath(state, monthsAtLaunch = 0) {
  const planet = state?.planet;
  if (!planet) return el('p', 'stamp fp-empty', 'FLIGHT PATH — NO DESTINATION LOCKED');

  const launchMonth = Number.isFinite(monthsAtLaunch) ? monthsAtLaunch : 0;
  const monthsElapsed = Number.isFinite(state.monthsElapsed) ? state.monthsElapsed : 0;
  const arrivalMonth = Number.isFinite(planet.travelMonths) && planet.travelMonths > 0
    ? planet.travelMonths : 12;
  // The voyage is measured FROM LAUNCH, not from month zero: the Plan phase has already burned up to
  // three years before the ship leaves, and main.js ends the flight at absolute month `travelMonths`.
  // So the strip's own length is what is left between the two, and the ship starts at the Earth end.
  const travel = Math.max(1, arrivalMonth - launchMonth);

  const flown = Math.max(0, monthsElapsed - launchMonth);
  const progress = clamp01(flown / travel);
  const shipX = X0 + progress * (X1 - X0);
  const distance = Math.round(progress * 100);
  const eta = Math.max(0, Math.round(travel - flown));

  // The fleet lanes, derived only from the planet's name and the calendar. `taken` keeps the two
  // companions off the real ship and off each other.
  const hash = planetHash(typeof planet.name === 'string' ? planet.name : '');
  const taken = [progress];
  const fleet = FLEET_LANES.map((spec) => {
    const base = 0.18 + ((hash >>> spec.shift) % 31) / 100;
    const etaMonths = 3 + ((hash >>> (spec.shift + 7)) % 22);
    const designation = FLEET_DESIGNATIONS[(hash >>> (spec.shift + 4)) % FLEET_DESIGNATIONS.length];
    const fraction = laneFraction(base, spec.drift, monthsElapsed, taken.slice());
    taken.push(fraction);
    return { ...spec, etaMonths, designation, fraction };
  });

  const svg = svgEl('svg', {
    class: 'flightpath',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': `Flight path from Earth to ${planet.name}, ${distance} percent flown, alongside two fleet lanes`,
  });

  // Frame and the bare voyage line, EARTH end to destination end. The stroke is inline so the real
  // lane's colour is readable even where style.css is out of our hands.
  svg.append(svgEl('rect', { class: 'fp-frame', x: 0.5, y: 0.5, width: W - 1, height: H - 1 }));

  // The two companion lanes first, so the real mission's track and ship draw on top.
  for (const lane of fleet) {
    svg.append(svgEl('line', {
      class: `fp-fleet-track fp-lane-track lane-${lane.lane}`,
      x1: X0, y1: lane.y, x2: X1, y2: lane.y,
      stroke: lane.colour, 'stroke-width': 1, 'stroke-opacity': 0.55, 'stroke-dasharray': '5 5',
    }));

    const name = svgEl('text', {
      class: `fp-fleet-name lane-${lane.lane}`,
      x: 20, y: lane.y, dy: '0.35em',
      fill: lane.colour, 'font-size': 10, 'letter-spacing': '0.08em',
    });
    name.textContent = lane.designation;
    svg.append(name);

    const laneEta = svgEl('text', {
      class: `fp-fleet-eta lane-${lane.lane}`,
      x: W - 20, y: lane.y, dy: '0.35em', 'text-anchor': 'end',
      fill: lane.colour, 'font-size': 10, 'letter-spacing': '0.08em',
    });
    laneEta.textContent = `ETA ${String(lane.etaMonths).padStart(2, '0')} MO`;
    svg.append(laneEta);

    const marker = svgEl('text', {
      class: `fp-fleet-ship fp-lane-marker lane-${lane.lane}`,
      x: (X0 + lane.fraction * (X1 - X0)).toFixed(1), y: lane.y, dy: '0.35em', 'text-anchor': 'middle',
      fill: lane.colour, 'font-size': 12,
    });
    marker.textContent = '◆';
    svg.append(marker);
  }

  svg.append(svgEl('line', {
    class: 'fp-track fp-lane-track lane-main',
    x1: X0, y1: PATH_Y, x2: X1, y2: PATH_Y,
    stroke: MAIN_COLOUR, 'stroke-width': 1, 'stroke-opacity': 0.55,
  }));
  // The flown part of the line: brighter, so progress reads without reading a number.
  svg.append(svgEl('line', { class: 'fp-flown', x1: X0, y1: PATH_Y, x2: shipX.toFixed(1), y2: PATH_Y }));

  // One tick per year of the voyage, the year number under each. Kept short so the tick row clears the
  // lower lane rather than overlapping it.
  const years = Math.min(12, Math.max(1, Math.round(travel / 12)));
  for (let year = 1; year <= years; year += 1) {
    const tickX = X0 + clamp01((year * 12) / travel) * (X1 - X0);
    svg.append(svgEl('line', { class: 'fp-tick', x1: tickX.toFixed(1), y1: PATH_Y - 5, x2: tickX.toFixed(1), y2: PATH_Y + 5 }));
    const label = svgEl('text', { class: 'fp-tick-label', x: tickX.toFixed(1), y: PATH_Y + 18, 'text-anchor': 'middle' });
    label.textContent = `Y${year}`;
    svg.append(label);
  }

  // Earth end: a short end bar and the name above the line.
  svg.append(svgEl('line', { class: 'fp-marker', x1: X0, y1: PATH_Y - 12, x2: X0, y2: PATH_Y + 12 }));
  const origin = svgEl('text', { class: 'fp-origin', x: X0, y: PATH_Y - 22, 'text-anchor': 'middle' });
  origin.textContent = 'EARTH';
  svg.append(origin);

  // Destination end: a small diamond marker and the planet's name above the line.
  svg.append(svgEl('path', {
    class: 'fp-dest-glyph',
    d: `M${X1} ${PATH_Y - 7} l7 7 -7 7 -7 -7 z`,
    fill: 'none',
  }));
  const destination = svgEl('text', { class: 'fp-dest', x: X1, y: PATH_Y - 22, 'text-anchor': 'end' });
  destination.textContent = planet.name;
  svg.append(destination);

  // The ship: a blinking glyph sitting exactly on the path at its progress point. `dy` centres the glyph
  // on the line and works in every browser, unlike dominant-baseline.
  const ship = svgEl('text', {
    class: 'fp-ship fp-lane-marker lane-main',
    x: shipX.toFixed(1), y: PATH_Y, dy: '0.35em', 'text-anchor': 'middle',
  });
  ship.textContent = '▲';
  svg.append(ship);

  // Readout row under the paths, in its own cells: distance, ETA, stardate. Three cells rather than one
  // string because SVG collapses runs of spaces, and instrument spacing has to be exact.
  svg.append(svgEl('line', { class: 'fp-sep', x1: 20, y1: SEP_Y, x2: W - 20, y2: SEP_Y }));
  const cells = [
    [20, `DISTANCE ${distance}%`],
    [300, `ETA ${eta} MO`],
    [580, stardate(monthsElapsed)],
  ];
  for (const [x, text] of cells) {
    const readout = svgEl('text', { class: 'fp-readout', x, y: READOUT_Y });
    readout.textContent = text;
    svg.append(readout);
  }

  return svg;
}
