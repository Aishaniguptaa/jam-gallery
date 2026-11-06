// Canvas-generated surface textures for the island's three bands - grass, soil and stone. Each one
// is drawn in code at load time from its band's own colour in tuning.js, so there is nothing to
// download and a maker retuning GRASS_COLOR still retunes its grain.
import * as THREE from 'three';

// --- The canvas, and how big one repeat is ---
const CANVAS_SIZE = 256;       // px. One repeat covers about a world unit, so this is already finer
                               // than the screen; a larger canvas would only cost memory.
const DEFAULT_REPEAT = 2;      // repeats across the canvas, when the caller does not say otherwise
const ANISOTROPY = 4;          // modest: the island is seen at a shallow angle, and this is what stops
                               // the far end of a band turning to mush. three clamps it down to the
                               // renderer's own limit, so the renderer never has to be passed in here.
const FULL_TURN = Math.PI * 2; // radians in a circle
const RING_STEPS = 4;          // flat rings per soft patch: its edge lands in faint steps
const OVAL_STEPS = 16;         // corners in the polygon that stands in for an oval

// --- The shape of a mark ---
// A mark is worked out once, as points measured from its own centre, and only then placed. The dice
// are thrown while the shape is made and never while it is drawn: a mark that reaches past the
// canvas has to come back in on the far side exactly like the piece that left, or the repeat shows a
// seam where the two halves fail to line up.
const PATCH_MIN = 0.45;        // a patch is between this share of its radius and the whole of it
const PATCH_SQUASH_MIN = 0.6;  // and leans on one axis by between this and 1.4, so no two are round
const PATCH_SQUASH_SPAN = 0.8;
const PATCH_SQUASH_MAX = PATCH_SQUASH_MIN + PATCH_SQUASH_SPAN;
// The rings are never quite concentric: each one is shrunk and turned a little off the one outside
// it. A set of true concentric ovals draws a visible outline of itself - a patch a few pixels wide
// reads as a shape rather than as softness - and that outline repeated on every patch is what turns
// mottling into wallpaper.
const PATCH_RING_WOBBLE = 0.15;  // of its own radius
const PATCH_RING_TURN = 0.5;     // radians

// Fixed seeds, one per surface, so the grain is identical on every launch. Math.random() is never
// used in this file: the island has to look the same each time, exactly as props.js's garden does.
const GRASS_SEED = 7331;
const SOIL_SEED = 24601;
const ROCK_SEED = 31337;

// --- Grass: soft mottling and a dusting of blades. Nothing here has an edge or an outline ---
const GRASS_PATCH_COUNT = 55;      // soft patches, lighter and darker than the base, overlapping
const GRASS_PATCH_RADIUS = 54;     // px at the largest. Soft and wide, so the cap reads as mottled
const GRASS_PATCH_ALPHA = 0.13;    // and never as blotchy. Four flat rings at this alpha stack to a
                                   // patch centre of about 0.43, which is the weight the mottling wants
const GRASS_PATCH_PALE_SHARE = 0.55;
const GRASS_LIGHT = 0.2;           // how far a lighter patch leans toward white, as a share of the way
const GRASS_DARK = 0.18;           // and how far a darker one leans toward black
const GRASS_BLADE_COUNT = 900;     // the dusting of specks
const GRASS_BLADE_MIN = 3;         // px long, one or two wide, so a spec reads as a blade
const GRASS_BLADE_SPAN = 5;
const GRASS_BLADE_ALPHA = 0.3;
const GRASS_BLADE_LIGHT = 0.3;
const GRASS_BLADE_DARK = 0.22;
const GRASS_PALE_SHARE = 0.7;      // most blades catch the light; the rest read as shadow between them
const GRASS_BLADE_WIDTH = 0.3;     // the share of them drawn a second pixel wide

// --- Soil: a fine tooth, clods, and little stones. Slightly more contrast than the grass ---
const SOIL_PATCH_COUNT = 46;       // the clods the soil is broken into, mostly darker than it
const SOIL_PATCH_RADIUS = 62;
const SOIL_PATCH_ALPHA = 0.13;
const SOIL_PATCH_PALE_SHARE = 0.42;
const SOIL_DARK = 0.24;
const SOIL_LIGHT = 0.2;
const SOIL_GRAIN_COUNT = 2800;     // 1px specks: the fine tooth of turned earth
const SOIL_GRAIN_ALPHA = 0.4;
const SOIL_GRAIN_LIGHT = 0.3;
const SOIL_GRAIN_DARK = 0.36;
const SOIL_PEBBLE_COUNT = 170;     // small stones
const SOIL_PEBBLE_MIN = 1.5;       // px radius
const SOIL_PEBBLE_SPAN = 4.5;
const SOIL_PEBBLE_ALPHA = 0.5;
const SOIL_PEBBLE_PALE_SHARE = 0.55;
const SOIL_PEBBLE_LIGHT = 0.34;
const SOIL_PEBBLE_DARK = 0.3;

// --- Stone: flat angular plates and short dark cracks. The hardest, most broken band ---
const ROCK_FACET_COUNT = 12;       // plates of slightly different tone, straight-edged and flat
const ROCK_FACET_RADIUS = 130;     // px: big enough that one plate spans the band's visible strip
const ROCK_FACET_ALPHA = 0.35;
const ROCK_FACET_PALE_SHARE = 0.45;
const ROCK_FACET_LIGHT = 0.14;
const ROCK_FACET_DARK = 0.16;
const ROCK_FACET_MIN_POINTS = 4;   // corners on a plate: enough to read as broken, no more
const ROCK_FACET_MAX_POINTS = 6;
const ROCK_FACET_JITTER = 0.6;     // radians a corner may wander off an even spacing
const ROCK_FACET_REACH_MIN = 0.55; // a corner sits this far out, of the plate's nominal radius
const ROCK_FACET_REACH_SPAN = 0.65;
const ROCK_GRAIN_COUNT = 1400;     // a little tooth over the plates, so they are not glass
const ROCK_GRAIN_ALPHA = 0.3;
const ROCK_GRAIN_LIGHT = 0.26;
const ROCK_GRAIN_DARK = 0.34;
const ROCK_CRACK_COUNT = 52;       // short breaks wandering across the stone
const ROCK_CRACK_ALPHA = 0.5;
const ROCK_CRACK_DARK = 0.45;
const ROCK_CRACK_WIDTH = 1.5;      // px
const ROCK_CRACK_STEPS_MIN = 2;    // segments in a crack
const ROCK_CRACK_STEP_SPAN = 3;
const ROCK_CRACK_SEG_MIN = 5;      // px per segment, so a crack stays short
const ROCK_CRACK_SEG_SPAN = 11;
const ROCK_CRACK_TURN = 1.5;       // radians a crack may bend by, step to step

// --- Colours ---
// Every mark a surface wears is derived from that surface's own base colour and nothing else: the
// same hue, nudged a little toward white or toward black. No second hue is ever mixed in, so a
// greensward stays green whichever way the dice fall.
function readHex(hex) {
  const value = parseInt(String(hex).replace('#', ''), 16);
  const safe = Number.isFinite(value) ? value : 0x808080;   // an unreadable colour is a mid grey
  return { r: (safe >> 16) & 255, g: (safe >> 8) & 255, b: safe & 255 };
}

// A colour the same hue as the base: positive amounts lean toward white, negative toward black.
function shade(base, amount) {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return {
    r: Math.round(base.r + (target - base.r) * t),
    g: Math.round(base.g + (target - base.g) * t),
    b: Math.round(base.b + (target - base.b) * t),
  };
}

function rgba(colour, alpha) {
  return 'rgba(' + colour.r + ',' + colour.g + ',' + colour.b + ',' + alpha + ')';
}

// --- Shapes ---
// An oval, as the polygon that stands in for it: squashed on one axis and turned. Sixteen sides is
// indistinguishable from a true oval at this size, and it lets a patch, a pebble and a plate share
// one drawing path.
function ovalRing(rx, ry, turn, scale) {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const points = [];
  for (let i = 0; i < OVAL_STEPS; i++) {
    const a = (i / OVAL_STEPS) * FULL_TURN;
    const px = Math.cos(a) * rx * scale;
    const py = Math.sin(a) * ry * scale;
    points.push({ x: px * cos - py * sin, y: px * sin + py * cos });
  }
  return points;
}

// A soft patch: the same oval at decreasing sizes, the largest first, so the flat rings composite
// into an edge that fades away without a single gradient over it. Each ring sits a little off the
// one outside it, which is what keeps the stack from drawing a shape of its own (see above).
function patchShape(rng, radius, colour, alpha) {
  const rx = radius * (PATCH_MIN + rng() * (1 - PATCH_MIN));
  const ry = rx * (PATCH_SQUASH_MIN + rng() * PATCH_SQUASH_SPAN);
  const turn = rng() * FULL_TURN;
  const rings = [];
  for (let i = 0; i < RING_STEPS; i++) {
    const scale = (1 - i / RING_STEPS) * (1 - rng() * PATCH_RING_WOBBLE);
    rings.push(ovalRing(rx, ry, turn + (rng() - 0.5) * PATCH_RING_TURN, scale));
  }
  return { rings, reach: rx * PATCH_SQUASH_MAX, colour, alpha };
}

// A stone: one flat oval in a single tone. A pebble never gets a lit side and a shaded one - a ball
// this small would read as a photograph, and everything else in this game is flat.
function pebbleShape(rng, radius, colour, alpha) {
  const rx = radius;
  const ry = radius * (PATCH_SQUASH_MIN + rng() * PATCH_SQUASH_SPAN);
  const turn = rng() * FULL_TURN;
  return { rings: [ovalRing(rx, ry, turn, 1)], reach: rx * PATCH_SQUASH_MAX, colour, alpha };
}

// A plate: a flat polygon of straight edges in its own tone, so the stone reads as rock broken into
// facets rather than as a smooth surface.
function facetShape(rng, radius, colour, alpha) {
  const corners = ROCK_FACET_MIN_POINTS +
    Math.floor(rng() * (ROCK_FACET_MAX_POINTS - ROCK_FACET_MIN_POINTS + 1));
  const points = [];
  let reach = 0;
  for (let i = 0; i < corners; i++) {
    const turn = (i / corners) * FULL_TURN + (rng() - 0.5) * ROCK_FACET_JITTER;
    const r = radius * (ROCK_FACET_REACH_MIN + rng() * ROCK_FACET_REACH_SPAN);
    reach = Math.max(reach, r);
    points.push({ x: Math.cos(turn) * r, y: Math.sin(turn) * r });
  }
  return { rings: [points], reach, colour, alpha, stroke: 0 };
}

// A crack: a short line that bends as it goes, so it reads as a break in the stone and not as
// something ruled across it. A stroke rather than a fill, so it carries the width the others do not.
function crackShape(rng, colour, alpha) {
  const points = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  let turn = rng() * FULL_TURN;
  let reach = 0;
  const steps = ROCK_CRACK_STEPS_MIN + Math.floor(rng() * ROCK_CRACK_STEP_SPAN);
  for (let i = 0; i < steps; i++) {
    turn += (rng() - 0.5) * ROCK_CRACK_TURN;
    const length = ROCK_CRACK_SEG_MIN + rng() * ROCK_CRACK_SEG_SPAN;
    x += Math.cos(turn) * length;
    y += Math.sin(turn) * length;
    points.push({ x, y });
    reach = Math.max(reach, Math.hypot(x, y));
  }
  return { rings: [points], reach, colour, alpha, stroke: ROCK_CRACK_WIDTH };
}

// --- Placing marks ---
// One mark, at one point. A shape carrying a stroke is drawn as a line; everything else is a flat
// fill, which is what keeps the whole look toon.
function drawShape(ctx, shape, x, y) {
  ctx.globalAlpha = shape.alpha;
  for (let r = 0; r < shape.rings.length; r++) {
    const points = shape.rings[r];
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const px = x + points[i].x;
      const py = y + points[i].y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if (shape.stroke) {
      ctx.strokeStyle = rgba(shape.colour, 1);
      ctx.lineWidth = shape.stroke;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(shape.colour, 1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// One mark, placed - and placed again on the far side of the canvas if it reaches past an edge, so
// the seam of a repeat never crosses it. Only the offsets the mark's own size can reach are used, so
// most marks are drawn once and the ones on an edge two or four times. Every mark here reaches less
// than CANVAS_SIZE, which is what makes one copy per axis enough.
function wrapped(ctx, shape, x, y) {
  const xs = [x];
  const ys = [y];
  if (x - shape.reach < 0) xs.push(x + CANVAS_SIZE);
  else if (x + shape.reach > CANVAS_SIZE) xs.push(x - CANVAS_SIZE);
  if (y - shape.reach < 0) ys.push(y + CANVAS_SIZE);
  else if (y + shape.reach > CANVAS_SIZE) ys.push(y - CANVAS_SIZE);
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < ys.length; j++) drawShape(ctx, shape, xs[i], ys[j]);
  }
}

// A scatter of soft patches. Each one is either the lighter tone or the darker one, so the surface is
// mottled both ways and its average stays near the base colour instead of drifting dark.
function scatterPatches(ctx, rng, count, radius, light, dark, alpha, paleShare) {
  for (let i = 0; i < count; i++) {
    const x = rng() * CANVAS_SIZE;
    const y = rng() * CANVAS_SIZE;
    const colour = rng() < paleShare ? light : dark;
    wrapped(ctx, patchShape(rng, radius, colour, alpha), x, y);
  }
}

// The fine tooth: 1px specks, half of them lighter than the base and half darker. Plain rectangles,
// because there are thousands of them and a speck has no shape worth the work - nor a side worth
// wrapping, since half a pixel at an edge is not a seam.
function scatterGrain(ctx, rng, count, light, dark, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.5 + rng() * 0.5);
    ctx.fillStyle = rgba(rng() < 0.5 ? light : dark, 1);
    ctx.fillRect(rng() * CANVAS_SIZE, rng() * CANVAS_SIZE, 1, 1);
  }
}

// The dusting of blades: short thin vertical marks, most of them a touch paler than the grass, so the
// cap reads as something growing on it rather than as a painted plane.
function scatterBlades(ctx, rng, count, light, dark, alpha, paleShare) {
  for (let i = 0; i < count; i++) {
    const height = GRASS_BLADE_MIN + rng() * GRASS_BLADE_SPAN;
    const wide = rng() < GRASS_BLADE_WIDTH ? 2 : 1;
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6);
    ctx.fillStyle = rgba(rng() < paleShare ? light : dark, 1);
    ctx.fillRect(rng() * CANVAS_SIZE, rng() * CANVAS_SIZE, wide, height);
  }
}

// The base colour goes down first, and every mark above it is that same colour nudged. The texture
// therefore carries the coloured surface itself, which is why the material wearing it keeps its own
// color at white: a colour texture tinted by a colour would be the colour multiplied by itself, and
// that reads as mud.
function fillBase(ctx, base) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgba(base, 1);
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

// mulberry32: the same tiny seeded PRNG props.js scatters its garden with, so one seed number alone
// decides the whole surface.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The one place a texture is made ---
// Every surface below funnels through here, so the four details that are easy to get subtly wrong -
// the canvas, sRGB, the wrapping and the filtering - are set in exactly one place. A browser with no
// canvas, or a canvas that will not draw, gets null back so the caller can keep its flat colour
// instead of the island failing to build.
function buildTexture(seed, repeatX, repeatY, draw) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const x = Number.isFinite(repeatX) && repeatX > 0 ? repeatX : DEFAULT_REPEAT;
  const y = Number.isFinite(repeatY) && repeatY > 0 ? repeatY : x;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, mulberry32(seed));
    const texture = new THREE.CanvasTexture(canvas);
    // Without this a colour texture is read as if it were linear, and every band renders washed out.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(x, y);
    texture.anisotropy = ANISOTROPY;
    texture.needsUpdate = true;
    return texture;
  } catch (error) {
    return null;
  }
}

// --- Grass: the living cap, read mostly from above ---
export function createGrassTexture(baseColor, repeatX = DEFAULT_REPEAT, repeatY = repeatX) {
  return buildTexture(GRASS_SEED, repeatX, repeatY, (ctx, rng) => {
    const base = readHex(baseColor);
    fillBase(ctx, base);
    scatterPatches(
      ctx, rng, GRASS_PATCH_COUNT, GRASS_PATCH_RADIUS,
      shade(base, GRASS_LIGHT), shade(base, GRASS_DARK),
      GRASS_PATCH_ALPHA, GRASS_PATCH_PALE_SHARE
    );
    scatterBlades(
      ctx, rng, GRASS_BLADE_COUNT,
      shade(base, GRASS_BLADE_LIGHT), shade(base, GRASS_BLADE_DARK),
      GRASS_BLADE_ALPHA, GRASS_PALE_SHARE
    );
  });
}

// --- Soil: the warm band under the cap, read from the side ---
export function createSoilTexture(baseColor, repeatX = DEFAULT_REPEAT, repeatY = repeatX) {
  return buildTexture(SOIL_SEED, repeatX, repeatY, (ctx, rng) => {
    const base = readHex(baseColor);
    fillBase(ctx, base);
    scatterGrain(
      ctx, rng, SOIL_GRAIN_COUNT,
      shade(base, SOIL_GRAIN_LIGHT), shade(base, SOIL_GRAIN_DARK),
      SOIL_GRAIN_ALPHA
    );
    scatterPatches(
      ctx, rng, SOIL_PATCH_COUNT, SOIL_PATCH_RADIUS,
      shade(base, SOIL_LIGHT), shade(base, SOIL_DARK),
      SOIL_PATCH_ALPHA, SOIL_PATCH_PALE_SHARE
    );
    for (let i = 0; i < SOIL_PEBBLE_COUNT; i++) {
      const x = rng() * CANVAS_SIZE;
      const y = rng() * CANVAS_SIZE;
      const radius = SOIL_PEBBLE_MIN + rng() * SOIL_PEBBLE_SPAN;
      const pale = rng() < SOIL_PEBBLE_PALE_SHARE;
      const colour = shade(base, pale ? SOIL_PEBBLE_LIGHT : -SOIL_PEBBLE_DARK);
      wrapped(ctx, pebbleShape(rng, radius, colour, SOIL_PEBBLE_ALPHA), x, y);
    }
  });
}

// --- Stone: the band the block was torn out of, read from the side and from below ---
export function createRockTexture(baseColor, repeatX = DEFAULT_REPEAT, repeatY = repeatX) {
  return buildTexture(ROCK_SEED, repeatX, repeatY, (ctx, rng) => {
    const base = readHex(baseColor);
    fillBase(ctx, base);
    // The plates go down first, each one wrapped, so a plate running off an edge comes back in on the
    // far side and the repeat has no seam cut through the broken rock.
    for (let i = 0; i < ROCK_FACET_COUNT; i++) {
      const x = rng() * CANVAS_SIZE;
      const y = rng() * CANVAS_SIZE;
      const radius = ROCK_FACET_RADIUS * (0.55 + rng() * 0.45);
      const pale = rng() < ROCK_FACET_PALE_SHARE;
      const colour = shade(base, pale ? ROCK_FACET_LIGHT : -ROCK_FACET_DARK);
      wrapped(ctx, facetShape(rng, radius, colour, ROCK_FACET_ALPHA), x, y);
    }
    scatterGrain(
      ctx, rng, ROCK_GRAIN_COUNT,
      shade(base, ROCK_GRAIN_LIGHT), shade(base, ROCK_GRAIN_DARK),
      ROCK_GRAIN_ALPHA
    );
    const crackColour = shade(base, -ROCK_CRACK_DARK);
    for (let i = 0; i < ROCK_CRACK_COUNT; i++) {
      const x = rng() * CANVAS_SIZE;
      const y = rng() * CANVAS_SIZE;
      wrapped(ctx, crackShape(rng, crackColour, ROCK_CRACK_ALPHA), x, y);
    }
  });
}
