// sky.js — the travelling sky: five stages drawn in code on one canvas, crossfaded when a portal opens.
import * as THREE from 'three';
import { SKY_STAGE_COUNT, SKY_STAGE_SECONDS, SKY_CANVAS_WIDTH, SKY_CANVAS_HEIGHT } from './tuning.js';

// --- SHORTHANDS for the numbers that come from tuning.js, so the drawing code below reads in one line each
const CANVAS_W = SKY_CANVAS_WIDTH;
const CANVAS_H = SKY_CANVAS_HEIGHT;

// --- THE FOG of the corridor's far end. The fog is a darkness the player looks into, with the sky above
// and beyond it, so it takes only this share of the stage's horizon brightness - bright fog dissolved the
// temple into orange haze, and darkened, the stone stays legible against it at every stage.
const FOG_DARKEN = 0.3;           // the fog is this share of the horizon's brightness: stone, not haze

// --- THE LOW SUN of the dusk stage, and the thin haze it leaves at the horizon (which sits at 0.62 of the
// canvas height, the warmest stop of every stage's gradient below)
const SUN_GLOW_X = 0.64;          // the sun stands off to one side of the Hampi horizon
const SUN_GLOW_Y = 0.60;          // low in the frame, just above the haze
const SUN_GLOW_RADIUS = 0.38;     // how far its warmth reaches, as a share of the canvas width
const SUN_GLOW_ALPHA = 0.5;       // soft, so it is a glow and not a disc
const HAZE_TOP = 0.55;            // the warm haze band spans this slice of the canvas...
const HAZE_BOTTOM = 0.72;         // ...and this one, right across its width
const WARM_HAZE_COLOUR = 'rgba(255, 192, 128, 0.42)'; // the band's own colour at its middle

// --- THE STARS: one fixed seed, a few brightness steps, and how many of each field to draw
const STAR_SEED = 0x51c0ffee;     // fixed on purpose, so the stars land in the same places every load
const STAR_ALPHAS = [0.22, 0.36, 0.55, 0.8]; // the handful of brightnesses a star may take
const STAR_SHARP_COUNT = 240;     // the sharp small stars of the airless dark
const STAR_DENSE_COUNT = 640;     // the denser field of the galaxy stage
const BRIGHT_STAR_COUNT = 16;     // the few haloed stars of the galaxies stage
const BRIGHT_STAR_CORE_STYLE = 'rgba(255, 255, 255, 0.95)'; // the hard point inside a bright star's halo

// --- THE CLOUDS of the air stage: two soft bands, each built from a row of overlapping puffs
const CLOUD_BANDS = [
  { y: 0.30, puffs: 7, spread: 0.14, size: 1.0, alpha: 0.30 },
  { y: 0.43, puffs: 9, spread: 0.18, size: 0.8, alpha: 0.22 },
];
const CLOUD_PUFF_RX = 0.16;       // one puff is this wide, of the canvas width...
const CLOUD_PUFF_RY = 0.035;      // ...and this tall, of the canvas height

// --- THE CLOUD BANDS of the opening dusk stage: soft pink, gold and warm-white rows laid across the middle
// of the frame, above the horizon haze, so stage 0 reads like the makers' golden-hour Hampi reference. They
// reuse the air stage's puff stamps, only wider, warmer, and drawn from their own seed (see DUSK_CLOUD_SEED).
const DUSK_CLOUD_BANDS = [
  { y: 0.30, puffs: 6, spread: 0.20, size: 1.20, alpha: 0.20, jitter: 0.030, glowKey: 'cloudPink' },
  { y: 0.39, puffs: 8, spread: 0.24, size: 1.00, alpha: 0.17, jitter: 0.035, glowKey: 'cloudGold' },
  { y: 0.48, puffs: 7, spread: 0.20, size: 0.85, alpha: 0.14, jitter: 0.030, glowKey: 'cloudWarm' },
];
const DUSK_PUFF_RX = 0.17;        // one dusk puff is this wide, of the canvas width...
const DUSK_PUFF_RY = 0.032;       // ...and this tall, of the canvas height: long soft bands, not ovals
const DUSK_PUFF_EDGE = 0.06;      // a band's puffs start this far in from the left edge of the frame...
const DUSK_PUFF_SPAN = 0.88;      // ...and run this share of the canvas width across to the right
const DUSK_CLOUD_SEED = 0x0d05c10d; // its own fixed seed, so these bands never shift the other stages' stars

// --- THE GALAXY of the fourth stage: one soft smear with a brighter core, on a shallow diagonal
const GALAXY_TILT = -0.42;        // how far the band leans across the canvas, in radians
const GALAXY_CX = 0.52;           // where the band crosses, across the canvas
const GALAXY_CY = 0.46;           // and up it
const GALAXY_HALF_LEN = 0.66;     // how far the band reaches along its own axis, of the canvas width
const GALAXY_HALF_THICK = 0.11;   // and how softly it spreads across it, of the canvas height
const GALAXY_ALPHA = 0.8;         // the outer smear's own strength
const GALAXY_CORE_LEN = 0.5;      // the brighter core inside the band reaches this far...
const GALAXY_CORE_THICK = 0.045;  // ...and is this thin
const GALAXY_CORE_ALPHA = 0.85;
const GALAXY_STAR_COUNT = 140;    // small stars dusted through the band, which give it its grain
const GALAXY_STAR_STYLE = 'rgba(222, 230, 255, 0.55)';

// --- THE NEBULA of the last stage: not one clean band but several soft coloured clouds, cut by a dust
// lane, over the densest starfield of all. Cold blues, violets and a touch of magenta and teal, so the
// temple feels deeper than the galaxies - and never gold, which belongs to the pillars' glow alone.
const NEBULA_LOBE_COLOURS = ['magenta', 'violet', 'teal', 'indigo']; // the colours a cloud may take
const NEBULA_LOBE_COUNT = 9;      // how many soft clouds the field is built from
const NEBULA_CENTRE_X = 0.5;      // where the clouds gather, across the canvas
const NEBULA_CENTRE_Y = 0.47;     // and up it
const NEBULA_SPREAD_X = 0.44;     // how far they stray from that centre, of the canvas width
const NEBULA_SPREAD_Y = 0.32;     // and of the canvas height
const NEBULA_LOBE_RX = 0.3;       // one cloud is this wide, of the canvas width...
const NEBULA_LOBE_RY = 0.2;       // ...and this tall, of the canvas height
const NEBULA_ALPHA = 0.5;         // how strongly a cloud's own colour shows
const NEBULA_STAR_COUNT = 900;    // the field behind the clouds: denser than the galaxy stage's
const NEBULA_BRIGHT_STAR_COUNT = 10; // and a handful of haloed stars in front of them
const NEBULA_DUST_TILT = -0.5;    // the lean of the dark dust lane that cuts across the clouds
const NEBULA_DUST_ALPHA = 0.5;    // how much of the dust lane's dark shows
const NEBULA_DUST_LEN = 0.5;      // the lane reaches this far, of the canvas width
const NEBULA_DUST_THICK = 0.05;   // and is this thin, of the canvas height

// --- THE FIVE STAGES, each one further from the world than the last: dusk over Hampi, up through the air,
// the airless dark, the galaxies, and the nebula field. Each stage is a sky gradient from the top of the
// frame down. They run into one another on purpose: the overhead goes deep blue, blue, then dark, and the
// horizon goes warm amber, hazy white, dim blue, then darker and darker - so the five read as one journey
// and not five pictures. A stage's gradient and its horizon colour below ship together, index for index.
const STAGE_STOPS = [
  [ // 0 — dusk over Hampi: blue overhead, pink and soft orange through the middle, warm amber low
    [0.0, '#1d2a58'], [0.24, '#3a4a86'], [0.42, '#8e5178'], [0.54, '#c0655c'],
    [0.62, '#e0913f'], [0.7, '#f0b26a'], [0.82, '#8a4d31'], [1.0, '#38220f'],
  ],
  [ // 1 — up through the air: pale blue overhead fading to hazy white at the horizon
    [0.0, '#2f6fb8'], [0.26, '#5d99d2'], [0.46, '#9cc4e2'], [0.58, '#cfe2ee'],
    [0.62, '#dceaf3'], [0.74, '#e9f2f7'], [1.0, '#c9d8e3'],
  ],
  [ // 2 — the airless dark: near-black blue with only a slight glow left at the horizon
    [0.0, '#04060d'], [0.3, '#060a16'], [0.5, '#0a1022'], [0.62, '#12203c'],
    [0.7, '#0a1224'], [0.86, '#060a15'], [1.0, '#030509'],
  ],
  [ // 3 — the galaxies: near-black, with a dim blue still left at the horizon
    [0.0, '#010208'], [0.4, '#02040c'], [0.62, '#060b18'], [1.0, '#020309'],
  ],
  [ // 4 — the nebula field: deeper still, and the horizon has all but gone out
    [0.0, '#010106'], [0.36, '#02020a'], [0.62, '#04050e'], [1.0, '#010105'],
  ],
];

// The sky's own horizon colour at each stage, one entry per stage in the same order as STAGE_STOPS. This
// stays the sky's colour; the corridor's fog is built from it but darkened well down (FOG_DARKEN above),
// so the temple reads as stone against a darkness instead of dissolving into the sky's own light.
const STAGE_HORIZON = ['#e0913f', '#dceaf3', '#12203c', '#060b18', '#04050e'];

// --- A TINY FIXED-SEED GENERATOR, so the stars and clouds land in the same places on every load.
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- GRADIENT HELPERS, all built once and then reused, so no frame ever makes a new one
function verticalGradient(ctx, stops) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  for (const [at, colour] of stops) gradient.addColorStop(at, colour);
  return gradient;
}

// A soft round glow, white or warm, drawn through the stamps below and reused for every star and cloud.
function softGlow(ctx, centre, edge) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, centre);
  gradient.addColorStop(1, edge);
  return gradient;
}

// A band that fades in and out vertically: the warm haze that sits on the dusk horizon.
function bandGradient(ctx, top, bottom, colour) {
  const gradient = ctx.createLinearGradient(0, top * CANVAS_H, 0, bottom * CANVAS_H);
  gradient.addColorStop(0, 'rgba(255, 186, 120, 0)');
  gradient.addColorStop(0.5, colour);
  gradient.addColorStop(1, 'rgba(255, 186, 120, 0)');
  return gradient;
}

// --- THE SHARED SOFT GLOWS: one white, one warm for the sun, the three warm tints the dusk clouds take, the
// two that make up the galaxy band, the four cold colours the nebula clouds take, and the dark of the dust
// lane that cuts across them. The dusk tints stay soft and never gold-bright: the pillars' glow is the
// brightest warm thing on screen.
function buildGlows(ctx) {
  return {
    white: softGlow(ctx, 'rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0)'),
    warm: softGlow(ctx, 'rgba(255, 228, 182, 0.85)', 'rgba(255, 190, 120, 0)'),
    cloudPink: softGlow(ctx, 'rgba(244, 170, 190, 0.78)', 'rgba(206, 108, 140, 0)'),
    cloudGold: softGlow(ctx, 'rgba(255, 212, 150, 0.78)', 'rgba(238, 166, 96, 0)'),
    cloudWarm: softGlow(ctx, 'rgba(255, 238, 224, 0.72)', 'rgba(228, 186, 168, 0)'),
    galaxy: softGlow(ctx, 'rgba(206, 217, 255, 0.5)', 'rgba(150, 170, 255, 0)'),
    galaxyCore: softGlow(ctx, 'rgba(238, 243, 255, 0.85)', 'rgba(190, 205, 255, 0)'),
    magenta: softGlow(ctx, 'rgba(214, 96, 176, 0.5)', 'rgba(140, 40, 130, 0)'),
    violet: softGlow(ctx, 'rgba(150, 110, 220, 0.5)', 'rgba(80, 50, 160, 0)'),
    teal: softGlow(ctx, 'rgba(80, 190, 190, 0.45)', 'rgba(30, 90, 120, 0)'),
    indigo: softGlow(ctx, 'rgba(90, 112, 210, 0.45)', 'rgba(40, 50, 130, 0)'),
    dust: softGlow(ctx, 'rgba(3, 4, 9, 0.9)', 'rgba(3, 4, 9, 0)'),
  };
}

// --- STAMP: one soft glow laid down at a place and size, in one reusable call. The gradient is a unit
// circle, so scaling it to (rx, ry) is what makes it round, wide, or a long diagonal smear.
function stamp(ctx, gradient, x, y, rx, ry, alpha, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(rx, ry);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// --- THE STAR FIELDS, built once. Stars are grouped by brightness, so a whole group shares one colour
// string and no frame ever builds one per star.
function buildStarBuckets(random, count) {
  const buckets = STAR_ALPHAS.map((alpha) => ({ style: `rgba(255, 255, 255, ${alpha})`, stars: [] }));
  for (let i = 0; i < count; i += 1) {
    const bucket = buckets[Math.floor(random() * buckets.length) % buckets.length];
    bucket.stars.push({ x: random() * CANVAS_W, y: random() * CANVAS_H, s: random() < 0.85 ? 1 : 2 });
  }
  return buckets;
}

// The few brighter stars of the galaxy stage: a small point inside a soft halo.
function buildBrightStars(random, count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: random() * CANVAS_W,
      y: random() * CANVAS_H * 0.9,
      halo: 5 + random() * 14,
      alpha: 0.25 + random() * 0.4,
      core: 2 + random() * 1.5,
    });
  }
  return stars;
}

// The grain inside the galaxy band: stars laid along the band's own diagonal, thicker at its middle.
function buildGalaxyStars(random, count) {
  const stars = [];
  const cos = Math.cos(GALAXY_TILT);
  const sin = Math.sin(GALAXY_TILT);
  for (let i = 0; i < count; i += 1) {
    const along = random() * 2 - 1;                              // how far up the band it sits
    const across = (random() + random() + random() - 1.5) / 1.5; // centre-weighted across the band
    const lx = along * GALAXY_HALF_LEN * CANVAS_W;
    const ly = across * GALAXY_HALF_THICK * CANVAS_H;
    stars.push({
      x: GALAXY_CX * CANVAS_W + lx * cos - ly * sin,
      y: GALAXY_CY * CANVAS_H + lx * sin + ly * cos,
      s: random() < 0.8 ? 1 : 2,
    });
  }
  return stars;
}

// --- THE NEBULA CLOUDS of the last stage, built once: soft coloured lobes gathered round a centre, each
// with its own size, lean and strength, so the field reads as gas rather than as blobs.
function buildNebula(random) {
  const lobes = [];
  for (let i = 0; i < NEBULA_LOBE_COUNT; i += 1) {
    const size = 0.6 + random() * 0.9;
    lobes.push({
      glowKey: NEBULA_LOBE_COLOURS[Math.floor(random() * NEBULA_LOBE_COLOURS.length) % NEBULA_LOBE_COLOURS.length],
      x: (NEBULA_CENTRE_X + (random() - 0.5) * NEBULA_SPREAD_X) * CANVAS_W,
      y: (NEBULA_CENTRE_Y + (random() - 0.5) * NEBULA_SPREAD_Y) * CANVAS_H,
      rx: NEBULA_LOBE_RX * size * CANVAS_W,
      ry: NEBULA_LOBE_RY * size * CANVAS_H,
      rot: (random() - 0.5) * 0.9,
      alpha: NEBULA_ALPHA * (0.55 + random() * 0.6),
    });
  }
  return lobes;
}

// --- THE CLOUD PUFFS of the air stage, built once: a row of overlapping globes per band.
function buildClouds(random) {
  const puffs = [];
  for (const band of CLOUD_BANDS) {
    for (let i = 0; i < band.puffs; i += 1) {
      const along = band.puffs === 1 ? 0.5 : i / (band.puffs - 1);
      puffs.push({
        x: (0.08 + 0.84 * along + (random() - 0.5) * band.spread) * CANVAS_W,
        y: (band.y + (random() - 0.5) * 0.02) * CANVAS_H,
        rx: CLOUD_PUFF_RX * band.size * (0.7 + random() * 0.7) * CANVAS_W,
        ry: CLOUD_PUFF_RY * band.size * (0.7 + random() * 0.7) * CANVAS_H,
        alpha: band.alpha * (0.6 + random() * 0.6),
      });
    }
  }
  return puffs;
}

// --- THE DUSK CLOUD PUFFS of the opening stage, built once from their own seed: warm rows of long, soft,
// overlapping puffs, uneven in place, size and strength, each carrying the tint its band chose.
function buildDuskClouds(random) {
  const puffs = [];
  for (const band of DUSK_CLOUD_BANDS) {
    for (let i = 0; i < band.puffs; i += 1) {
      const along = band.puffs === 1 ? 0.5 : i / (band.puffs - 1);
      puffs.push({
        glowKey: band.glowKey,
        x: (DUSK_PUFF_EDGE + DUSK_PUFF_SPAN * along + (random() - 0.5) * band.spread) * CANVAS_W,
        y: (band.y + (random() - 0.5) * band.jitter) * CANVAS_H,
        rx: DUSK_PUFF_RX * band.size * (0.7 + random() * 0.7) * CANVAS_W,
        ry: DUSK_PUFF_RY * band.size * (0.7 + random() * 0.7) * CANVAS_H,
        alpha: band.alpha * (0.6 + random() * 0.6),
      });
    }
  }
  return puffs;
}

// --- EVERY STAGE'S DRAWING KIT, made once when the sky is built: a sky gradient, plus whatever that
// stage adds on top of it. Nothing here is ever rebuilt, so a fade allocates nothing at all.
function buildStyles(ctx) {
  const random = makeRandom(STAR_SEED);
  const duskRandom = makeRandom(DUSK_CLOUD_SEED); // its own stream, so stage 0 draws nothing from `random`
  return STAGE_STOPS.map((stops, stage) => {
    const style = { sky: verticalGradient(ctx, stops) };
    if (stage === 0) {
      style.sunGlow = true;
      style.haze = bandGradient(ctx, HAZE_TOP, HAZE_BOTTOM, WARM_HAZE_COLOUR);
      style.duskClouds = buildDuskClouds(duskRandom);
    } else if (stage === 1) {
      style.clouds = buildClouds(random);
    } else if (stage === 2) {
      style.stars = buildStarBuckets(random, STAR_SHARP_COUNT);
    } else if (stage === 3) {
      style.stars = buildStarBuckets(random, STAR_DENSE_COUNT);
      style.galaxy = true;
      style.galaxyStars = buildGalaxyStars(random, GALAXY_STAR_COUNT);
      style.brightStars = buildBrightStars(random, BRIGHT_STAR_COUNT);
    } else {
      style.stars = buildStarBuckets(random, NEBULA_STAR_COUNT);
      style.nebula = buildNebula(random);
      style.brightStars = buildBrightStars(random, NEBULA_BRIGHT_STAR_COUNT);
    }
    return style;
  });
}

// --- THE PAINTING STEPS, one small function each, all reading the kits built above.

function paintStars(ctx, buckets, baseAlpha) {
  ctx.globalAlpha = baseAlpha;
  for (const bucket of buckets) {
    if (bucket.stars.length === 0) continue;
    ctx.fillStyle = bucket.style; // the group's brightness is baked into this one string
    for (const star of bucket.stars) ctx.fillRect(star.x, star.y, star.s, star.s);
  }
}

function paintGalaxyStars(ctx, stars, baseAlpha) {
  ctx.globalAlpha = baseAlpha;
  ctx.fillStyle = GALAXY_STAR_STYLE;
  for (const star of stars) ctx.fillRect(star.x, star.y, star.s, star.s);
}

function paintGalaxy(ctx, glows, baseAlpha) {
  const x = GALAXY_CX * CANVAS_W;
  const y = GALAXY_CY * CANVAS_H;
  stamp(ctx, glows.galaxy, x, y, GALAXY_HALF_LEN * CANVAS_W, GALAXY_HALF_THICK * CANVAS_H, GALAXY_ALPHA * baseAlpha, GALAXY_TILT);
  stamp(ctx, glows.galaxyCore, x, y, GALAXY_CORE_LEN * CANVAS_W, GALAXY_CORE_THICK * CANVAS_H, GALAXY_CORE_ALPHA * baseAlpha, GALAXY_TILT);
}

// The nebula field: its coloured clouds first, then a soft dark dust lane laid across them, kept blurry
// and thin so it reads as dust and never as a hard stripe.
function paintNebula(ctx, glows, lobes, baseAlpha) {
  for (const lobe of lobes) {
    stamp(ctx, glows[lobe.glowKey], lobe.x, lobe.y, lobe.rx, lobe.ry, lobe.alpha * baseAlpha, lobe.rot);
  }
  stamp(ctx, glows.dust, NEBULA_CENTRE_X * CANVAS_W, NEBULA_CENTRE_Y * CANVAS_H,
    NEBULA_DUST_LEN * CANVAS_W, NEBULA_DUST_THICK * CANVAS_H, NEBULA_DUST_ALPHA * baseAlpha, NEBULA_DUST_TILT);
}

function paintBrightStars(ctx, glows, stars, baseAlpha) {
  for (const star of stars) {
    stamp(ctx, glows.white, star.x, star.y, star.halo, star.halo, star.alpha * baseAlpha);
    ctx.globalAlpha = baseAlpha;
    ctx.fillStyle = BRIGHT_STAR_CORE_STYLE;
    ctx.fillRect(star.x - star.core * 0.5, star.y - star.core * 0.5, star.core, star.core);
  }
}

function paintClouds(ctx, glows, puffs, baseAlpha) {
  for (const puff of puffs) stamp(ctx, glows.white, puff.x, puff.y, puff.rx, puff.ry, puff.alpha * baseAlpha);
}

// The opening stage's cloud bands: each puff laid in the warm tint its band chose, layered front to back.
function paintDuskClouds(ctx, glows, puffs, baseAlpha) {
  for (const puff of puffs) stamp(ctx, glows[puff.glowKey], puff.x, puff.y, puff.rx, puff.ry, puff.alpha * baseAlpha);
}

// --- ONE STAGE ONTO THE CANVAS, at an overall strength: the sky first, then whatever this stage lays on
// it. A crossfade is this same function run twice, the newcomer over the stage being left.
function paintStage(ctx, glows, style, baseAlpha) {
  if (!style) return;
  ctx.globalAlpha = baseAlpha;
  ctx.fillStyle = style.sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (style.sunGlow) {
    stamp(ctx, glows.warm, SUN_GLOW_X * CANVAS_W, SUN_GLOW_Y * CANVAS_H,
      SUN_GLOW_RADIUS * CANVAS_W, SUN_GLOW_RADIUS * CANVAS_W * 0.5, SUN_GLOW_ALPHA * baseAlpha);
  }
  if (style.haze) {
    ctx.globalAlpha = baseAlpha;
    ctx.fillStyle = style.haze;
    ctx.fillRect(0, HAZE_TOP * CANVAS_H, CANVAS_W, (HAZE_BOTTOM - HAZE_TOP) * CANVAS_H);
  }
  if (style.duskClouds) paintDuskClouds(ctx, glows, style.duskClouds, baseAlpha);
  if (style.clouds) paintClouds(ctx, glows, style.clouds, baseAlpha);
  if (style.stars) paintStars(ctx, style.stars, baseAlpha);
  if (style.galaxy) paintGalaxy(ctx, glows, baseAlpha);
  if (style.galaxyStars) paintGalaxyStars(ctx, style.galaxyStars, baseAlpha);
  if (style.nebula) paintNebula(ctx, glows, style.nebula, baseAlpha);
  if (style.brightStars) paintBrightStars(ctx, glows, style.brightStars, baseAlpha);

  ctx.globalAlpha = 1;
}

// --- SMOOTHSTEP: a fade that starts and ends gently, so a stage change never jerks.
function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// --- CLAMP a stage number into range, and treat anything unreadable as the first stage.
function clampStage(n) {
  const highest = Math.max(0, SKY_STAGE_COUNT - 1);
  const value = Math.floor(Number(n));
  if (!Number.isFinite(value)) return 0;
  return Math.min(highest, Math.max(0, value));
}

// --- A SKY THAT DRAWS NOTHING, for the impossible case where there is no canvas: the game asks it the
// same questions and gets the same safe answers.
function quietSky() {
  return { stage: 0, setStage() {}, update() {} };
}

// --- CREATE SKY: build the canvas, the texture and every gradient once, paint stage 0, and hand back the
// handle main.js drives. Nothing here waits on anything: it is all ready before it returns.
export function createSky(scene) {
  if (typeof document === 'undefined') return quietSky();

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false; // the canvas is repainted often while it fades
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (scene) scene.background = texture;
    return quietSky();
  }

  const glows = buildGlows(ctx);
  const styles = buildStyles(ctx);
  const styleFor = (stage) => styles[stage] || styles[styles.length - 1] || null;

  // The corridor's fog follows the sky's horizon, darkened and eased over the very same crossfade. The
  // hex array above stays the sky's own horizon; only the fog colour applied here is darkened down.
  const fog = scene && scene.fog && scene.fog.color ? scene.fog : null;
  const fogColors = STAGE_HORIZON.map((hex) => new THREE.Color(hex).multiplyScalar(FOG_DARKEN));
  const fogFrom = new THREE.Color();
  const fogTo = new THREE.Color();

  // t is the fade's progress: 1 means settled, and a settled sky never repaints.
  const state = { from: 0, t: 1 };

  function easeFog(t) {
    if (!fog) return;
    fog.color.copy(fogFrom).lerp(fogTo, smoothstep(t));
  }

  // Repaint the canvas for the fade's current progress. Called only while a fade is running.
  function redraw(from, to, t) {
    if (from === to || t >= 1) {
      paintStage(ctx, glows, styleFor(to), 1);
    } else {
      paintStage(ctx, glows, styleFor(from), 1);
      paintStage(ctx, glows, styleFor(to), smoothstep(t)); // the newcomer blended over the one being left
    }
    texture.needsUpdate = true;
  }

  const sky = {
    stage: 0,
    setStage(n) {
      const target = clampStage(n);
      if (target === sky.stage) return; // already there: nothing to do, nothing to repaint
      state.from = sky.stage;
      sky.stage = target;
      state.t = 0;
      if (fog) {
        fogFrom.copy(fog.color);
        fogTo.copy(fogColors[target] || fogColors[0]);
      }
      redraw(state.from, sky.stage, 0); // show the stage being left at once, whatever was mid-fade
    },
    update(dt) {
      if (state.t >= 1) return; // settled: no repaint, and nothing allocated
      const span = SKY_STAGE_SECONDS > 0 ? SKY_STAGE_SECONDS : 0.0001;
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      state.t = Math.min(1, state.t + step / span);
      redraw(state.from, sky.stage, state.t);
      easeFog(state.t);
      if (state.t >= 1) state.from = sky.stage; // the fade is done; further frames do nothing
    },
  };

  // --- FIRST PAINT: stage 0 is on the canvas before the first frame, and the fog already matches it.
  redraw(0, 0, 1);
  if (scene) scene.background = texture;
  if (fog) {
    fog.color.copy(fogColors[0]);
    fogFrom.copy(fog.color);
    fogTo.copy(fog.color);
  }

  return sky;
}
