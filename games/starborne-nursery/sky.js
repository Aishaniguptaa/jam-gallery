// The look of the sky: one gradient dome, a faint nebula wash, cloud banks, stars in depth and motes.
import * as THREE from 'three';
import {
  SKY_DOME_RADIUS,
  SKY_ZENITH_DEEPEN,
  SKY_HORIZON_LIFT,
  CLOUD_COUNT,
  CLOUD_COLOR,
  CLOUD_OPACITY,
  CLOUD_SPAN,
  CLOUD_HEIGHT_MIN,
  CLOUD_HEIGHT_MAX,
  CLOUD_SIZE_MIN,
  CLOUD_SIZE_MAX,
  CLOUD_RISE,
  CLOUD_DRIFT,
  CLOUD_NIGHT_TINT,
  STAR_COUNT,
  STAR_COLOR,
  STAR_SIZE,
  STAR_OPACITY,
  STAR_TWINKLE,
  STAR_SPAN,
  STAR_FLOOR,
  MOTE_COUNT,
  MOTE_COLOR,
  MOTE_SIZE,
  MOTE_RISE,
  MOTE_SPAN,
  MOTE_TOP,
  TILE_HEIGHT,
} from './tuning.js';

// --- The dome ---
const DOME_WIDTH_SEGMENTS = 32;      // a 32x16 ball is plenty for a gradient this soft
const DOME_HEIGHT_SEGMENTS = 16;
// Linear from bottom to top would spend the pale half of the ramp on the part of the sphere
// that sits under the island and out of frame. The power bends the ramp so the brightness holds
// up at the horizon the camera actually sees, then deepens quickly on the way to the zenith.
const SKY_RAMP_POWER = 1.8;

// --- The colour guard ---
// Per-channel difference below which the sky colour counts as unchanged, roughly one step of an
// 8-bit channel. The clock rewrites its colour every frame; most frames it barely moves.
const COLOR_EPSILON = 1 / 512;

// --- The clouds ---
const CLOUD_PUFFS_MIN = 3;
const CLOUD_PUFFS_MAX = 5;
// The ring's inner edge, as a fraction of CLOUD_SPAN. The camera sits about 20 units out from the
// origin, and a puff can reach inward by half a cloud's width, so the ring starts at half of
// CLOUD_SPAN: a cloud may drift behind the island, never between it and the eye.
const CLOUD_INNER_SHARE = 0.5;
const CLOUD_PUFF_SPREAD = 0.55;      // how far puffs sit off their cloud's centre, of its width
const CLOUD_PUFF_MIN = 0.5;          // smallest puff, as a fraction of the cloud's width
const CLOUD_PUFF_FLATTEN = 0.7;      // the extra squash on top of CLOUD_RISE
const CLOUD_PUFF_DEPTH = 0.85;       // puff depth vs its width, so puffs read as rounded, not flat

// --- The soft dot ---
// Every star and every mote is one point, and a point with no map is a square: at the sizes the
// bright stars and the drift motes take, that reads as a tile. So one soft round dot is drawn into
// a canvas here and shared by all three fields. It is drawn in code - no file, no download.
const DOT_TEXTURE_SIZE = 64;
const DOT_CORE = 0.45;               // radius the dot is still solid inside, of its own half-width

// --- The nebula ---
// A second, slightly smaller dome inside the first whose vertex colours are a broad noise field:
// deep violet bleeding into blue with a warm coral seam. It is additive, so the near-black parts
// of the field add nothing at all and there is no edge anywhere to see - and because it only ever
// adds, the clock's own sky colour still shows through underneath it untouched. The noise is baked
// into the vertices once; there is no texture in this, only geometry and arithmetic.
const NEBULA_RADIUS_SHARE = 0.94;    // of SKY_DOME_RADIUS: inside the dome, so it can never poke through
const NEBULA_WIDTH_SEGMENTS = 96;    // the wash is soft, but the field is not: at 32 segments the
const NEBULA_HEIGHT_SEGMENTS = 48;   // patches come out as straight-edged bands across the sky
const NEBULA_OPACITY = 0.5;          // the wash at full night, before the field's own falloff
const NEBULA_DIM = 0.004;            // below this it is not drawn at all
const NEBULA_FADE_POWER = 1.35;      // over 1: the wash arrives after the stars, once the sky is dark
const NEBULA_TURN = 0.0012;          // radians per second, one slow turn in about ninety minutes
const NEBULA_THRESHOLD = 0.62;       // how much of the field is black: a wash, not a screen of colour
const NEBULA_STRENGTH = 0.3;         // brightness of the densest part, so the whole thing stays subliminal
const NEBULA_WARM_CUT = 0.52;        // where the field's colour turns from violet-blue to coral
const NEBULA_COOL = '#5b3fbe';       // violet, for the cold reaches of the field
const NEBULA_MID = '#2f5bd0';        // blue, through the middle of it
const NEBULA_WARM = '#cf6f5f';       // and a coral seam where the field is densest
const NEBULA_NOISE_SCALE = 1;        // size of the patches: higher is a finer, busier wash
const NEBULA_NOISE_FINE = 2;         // how much finer the third octave is than the first two

// --- The stars ---
const STAR_BREATH = 0.15;            // how far the field's opacity breathes, at full night
const STAR_DIM = 0.002;              // opacity at or below which the field is skipped entirely
// Under 1, so the field is already well up part way through dusk: the sky stops reading as flat
// daylight blue the moment it starts to go, rather than flipping to night at the end of the ramp.
const STAR_FADE_POWER = 0.62;
// The camera is fixed and looks down at the island, so the only sky a player ever sees is the band
// BELOW the celestial horizon - the void the diorama floats over. STAR_FLOOR on its own keeps every
// star above that band, where nothing can see it, so the field is dropped by this much below it.
const STAR_CAP_DROP = 0.9;
const STAR_MIST_RATIO = 1.8;         // faint far dust, as a multiple of the makers' STAR_COUNT
const STAR_MIST_COUNT = Math.round(STAR_COUNT * STAR_MIST_RATIO);
const STAR_MIST_ALPHA = 0.34;        // and how bright the brightest speck of that dust may be
const STAR_BRIGHT_COUNT = 14;        // the handful of big warm ones that carry the eye
const STAR_DUST_COLOR = '#93a7ff';   // the dust runs blue-violet at one end...
const STAR_DUST_PALE = '#dfe7ff';    // ...and cool white at the other
const STAR_COOL_COLOR = '#c8d6ff';   // the middle layer runs cool white through...
const STAR_BRIGHT_COLOR = '#ffd9a0'; // ...the near few run gold through...
const STAR_CORAL_COLOR = '#ff9f8f';  // ...to coral, per the palette's list of night colours
// Three populations in one cloud. Each entry is: how many, the size and orbit as [min, max] as
// shares of STAR_SIZE and STAR_SPAN, the two ends of its colour spread, how hard the pick leans
// to the first end (an exponent on a uniform random), and the brightness range baked into alpha.
// Size, colour and brightness spread together is what reads as depth; a flat shell reads as paper.
const STAR_LAYERS = [
  {
    count: STAR_MIST_COUNT,
    size: [0.4, 0.75],
    radius: [0.98, 1.02],
    from: STAR_DUST_COLOR,
    to: STAR_DUST_PALE,
    bias: 1.6,
    alpha: [0.18, STAR_MIST_ALPHA],
  },
  {
    count: STAR_COUNT,
    size: [0.8, 1.2],
    radius: [0.9, 1],
    from: STAR_COOL_COLOR,
    to: STAR_COLOR,
    bias: 0.8,
    alpha: [0.5, 1],
  },
  {
    count: STAR_BRIGHT_COUNT,
    size: [1.5, 2.2],
    radius: [0.84, 0.9],
    from: STAR_BRIGHT_COLOR,
    to: STAR_CORAL_COLOR,
    bias: 0.7,
    alpha: [0.85, 1],
  },
];

// --- The motes ---
// tuning.js names no mote opacity: the stars own STAR_OPACITY, and the motes have to read as a
// suggestion beside them, so they get their own much fainter number here.
const MOTE_OPACITY = 0.32;
const MOTE_BOTTOM = TILE_HEIGHT;     // they rise from the island's grass top, not from its middle
const MOTE_CLIMB = MOTE_TOP - MOTE_BOTTOM;
const MOTE_COOL = '#d6f2ff';         // a few of the warm specks lean pale aqua, like the sea life
const MOTE_COOL_SHARE = 0.45;        // how far toward that aqua the coolest of them leans
const MOTE_ALPHA_MIN = 0.45;         // the faintest speck's brightness, of the field's own opacity

// --- The drifting motes ---
// The sketches ask for fish and jellyfish drifting loosely around the blocks. This is the cheap
// half of that: a slow ring of large, very faint, luminous specks out past the island, each on its
// own orbit and its own slow wander up and down, so they never move as a group. Nothing here is a
// creature - it is light, at the size and pace of something drifting.
const DRIFT_COUNT = 34;
const DRIFT_SIZE = 1.05;             // large next to the rising motes: light rather than grit
const DRIFT_OPACITY = 0.18;          // by day...
const DRIFT_NIGHT_OPACITY = 0.4;     // ...and by night, when a luminous thing should glow
const DRIFT_ALPHA_MIN = 0.3;         // the faintest of them, of that opacity
const DRIFT_RADIUS_MIN = 22;         // out past the island, so the blocks pass in front of them
const DRIFT_RADIUS_MAX = 36;         // and short of the cloud ring, so the two never mix
const DRIFT_HEIGHT_MIN = -8;         // some hang in the void under the island's underside...
const DRIFT_HEIGHT_MAX = 8;          // ...and some ride level with its grass
const DRIFT_ORBIT = 0.55;            // world units per second at the mean radius: a very slow turn
const DRIFT_SPEED_SPREAD = 0.35;     // how far either side of that a single mote's speed may sit
const DRIFT_BOB = 1.2;               // world units of slow vertical wander
const DRIFT_BOB_RATE = 0.22;         // radians per second of that wander
const DRIFT_COOL = '#7fc9ff';        // a luminous cool blue...
const DRIFT_WARM = '#ffab6e';        // ...with warm ones among it, so the ring is not one colour

const FULL_TURN = Math.PI * 2;

// One soft round dot, from a canvas: opaque in the middle, nothing at the rim, so an additive
// point has no edge to give itself away as a square.
function buildDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = DOT_TEXTURE_SIZE;
  canvas.height = DOT_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  const half = DOT_TEXTURE_SIZE * 0.5;
  const gradient = context.createRadialGradient(half, half, half * DOT_CORE, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.45)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, DOT_TEXTURE_SIZE, DOT_TEXTURE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// A dome-only sphere whose vertex colours carry the vertical ramp, baked once. Everything the
// clock does to the sky per frame is then one material colour, which multiplies these vertices.
function buildDome() {
  const geometry = new THREE.SphereGeometry(
    SKY_DOME_RADIUS,
    DOME_WIDTH_SEGMENTS,
    DOME_HEIGHT_SEGMENTS
  );
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    // -1 at the bottom of the ball, +1 at the top, then biased so the lift hugs the horizon.
    const height = THREE.MathUtils.clamp(position.getY(i) / SKY_DOME_RADIUS, -1, 1);
    const up = Math.pow((height + 1) * 0.5, SKY_RAMP_POWER);
    const shade = (1 + SKY_HORIZON_LIFT) * (1 - up) + (1 - SKY_ZENITH_DEEPEN) * up;
    colors[i * 3] = shade;             // one scalar on all three channels: a pure brightness ramp
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: false,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // The camera sits inside this ball, so it is never off screen; and it is painted before
  // everything else and writes no depth, so it can never hide a thing.
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, material };
}

// A cheap smooth field over a unit direction: three octaves of sine and cosine, which is all the
// noise a wash this soft needs, and it costs nothing to bake. Build time only - never per frame.
function fieldNoise(x, y, z) {
  const s = NEBULA_NOISE_SCALE;
  const f = NEBULA_NOISE_FINE;
  return (
    Math.sin(x * s * 1.7 + y * s * 2.3 + 0.9) * Math.cos(z * s * 1.9 - 0.6) +
    Math.sin(y * s * 3.1 - z * s * 1.3 + 2.2) * Math.cos(x * s * 2.7 + 1.1) +
    0.6 * Math.sin(x * s * f * 1.8 + z * s * f * 1.4 + 3.7) * Math.sin(y * s * f * 1.6 + 0.4)
  ) / 2.2;                             // roughly -1..1
}

// The nebula: one sphere of baked noise, additive, drawn after the dome and before the stars.
function buildNebula() {
  const radius = SKY_DOME_RADIUS * NEBULA_RADIUS_SHARE;
  const geometry = new THREE.SphereGeometry(radius, NEBULA_WIDTH_SEGMENTS, NEBULA_HEIGHT_SEGMENTS);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const cool = new THREE.Color(NEBULA_COOL);
  const mid = new THREE.Color(NEBULA_MID);
  const warm = new THREE.Color(NEBULA_WARM);
  const shade = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / radius;
    const y = position.getY(i) / radius;
    const z = position.getZ(i) / radius;

    // Density, thresholded so most of the sphere adds exactly nothing. A wash with a floor under it
    // would lift the whole sky and grey out the dusk; one that is mostly black reads as patches of
    // light instead, which is the thing worth seeing.
    const raw = fieldNoise(x, y, z) * 0.5 + 0.5;
    const over = Math.max(0, raw - NEBULA_THRESHOLD) / (1 - NEBULA_THRESHOLD);
    const density = Math.pow(over, 1.7);

    // A second, much slower field decides whether this patch is the cold violet or the warm coral.
    const warmth = THREE.MathUtils.clamp(
      fieldNoise(x * 0.55 + 3.1, y * 0.55 - 1.7, z * 0.55 + 0.6) * 0.5 + 0.5,
      0,
      1
    );
    if (warmth < NEBULA_WARM_CUT) {
      shade.copy(cool).lerp(mid, warmth / NEBULA_WARM_CUT);
    } else {
      shade.copy(mid).lerp(warm, (warmth - NEBULA_WARM_CUT) / (1 - NEBULA_WARM_CUT));
    }

    // Colour and density are baked together as one brightness per vertex, so the material's own
    // opacity is a single fading knob for the whole wash.
    const strength = density * NEBULA_STRENGTH;
    colors[i * 3] = shade.r * strength;
    colors[i * 3 + 1] = shade.g * strength;
    colors[i * 3 + 2] = shade.b * strength;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,              // the camera is inside it, so the far wall is the one to paint
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -999;             // right after the dome, and behind every star
  mesh.visible = false;                // full day: a nebula has no business in a blue sky
  return { mesh, material };
}

// One cloud: a handful of squashed puffs sharing the geometry and the material with every other
// cloud, scattered around a centre. Its ring position is returned so update can drift it.
function buildCloud(geometry, material) {
  const cloud = new THREE.Group();
  const width = THREE.MathUtils.lerp(CLOUD_SIZE_MIN, CLOUD_SIZE_MAX, Math.random());
  const puffs = Math.round(
    THREE.MathUtils.lerp(CLOUD_PUFFS_MIN, CLOUD_PUFFS_MAX, Math.random())
  );

  for (let i = 0; i < puffs; i++) {
    const puff = new THREE.Mesh(geometry, material);
    const puffWidth = width * THREE.MathUtils.lerp(CLOUD_PUFF_MIN, 1, Math.random());
    const puffHeight = puffWidth * CLOUD_RISE * CLOUD_PUFF_FLATTEN;
    const along = puffs > 1 ? i / (puffs - 1) - 0.5 : 0;   // spread evenly, then jiggle
    puff.scale.set(puffWidth, puffHeight, puffWidth * CLOUD_PUFF_DEPTH);
    puff.position.set(
      (along + (Math.random() - 0.5) * 0.2) * width * CLOUD_PUFF_SPREAD,
      (Math.random() - 0.5) * puffHeight * 0.6,
      (Math.random() - 0.5) * width * 0.2
    );
    cloud.add(puff);
  }

  cloud.rotation.y = Math.random() * FULL_TURN;  // so the puffs never all face the same way

  const angle = Math.random() * FULL_TURN;
  const radius = THREE.MathUtils.lerp(CLOUD_SPAN * CLOUD_INNER_SHARE, CLOUD_SPAN, Math.random());
  const height = THREE.MathUtils.lerp(CLOUD_HEIGHT_MIN, CLOUD_HEIGHT_MAX, Math.random());
  place(cloud, angle, radius, height);
  return { cloud, angle, radius, height };
}

// Write a cloud's ring position. Kept apart from buildCloud so update can reuse it.
function place(cloud, angle, radius, height) {
  cloud.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
}

// Every star in one cloud, over the upper cap of a ball. Picking y uniformly over [STAR_FLOOR, 1]
// and sweeping an angle gives an even scatter across the cap, and leaves nothing under a floating
// island. Colour is four channels: rgb is the star's own colour and alpha its brightness, which is
// what lets one cloud hold pale dust and a few bright lights at once.
function buildStars(texture) {
  let total = 0;
  for (const layer of STAR_LAYERS) total += layer.count;

  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 4);
  const sizes = new Float32Array(total);
  const yMin = THREE.MathUtils.clamp(STAR_FLOOR - STAR_CAP_DROP, -1, 1);
  const from = new THREE.Color();
  const to = new THREE.Color();
  const shade = new THREE.Color();

  let star = 0;
  for (const layer of STAR_LAYERS) {
    from.set(layer.from);
    to.set(layer.to);
    for (let n = 0; n < layer.count; n++) {
      const y = THREE.MathUtils.lerp(yMin, 1, Math.random());
      const radius =
        THREE.MathUtils.lerp(layer.radius[0], layer.radius[1], Math.random()) * STAR_SPAN;
      const ring = Math.sqrt(Math.max(0, 1 - y * y)) * radius;
      const angle = Math.random() * FULL_TURN;
      positions[star * 3] = Math.sin(angle) * ring;
      positions[star * 3 + 1] = y * radius;
      positions[star * 3 + 2] = Math.cos(angle) * ring;

      shade.copy(from).lerp(to, Math.pow(Math.random(), layer.bias));
      colors[star * 4] = shade.r;
      colors[star * 4 + 1] = shade.g;
      colors[star * 4 + 2] = shade.b;
      colors[star * 4 + 3] = THREE.MathUtils.lerp(layer.alpha[0], layer.alpha[1], Math.random());
      sizes[star] = THREE.MathUtils.lerp(layer.size[0], layer.size[1], Math.random());
      star += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));   // rgb + brightness
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    map: texture,
    size: STAR_SIZE,                   // the per-star aSize attribute scales this
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,  // starlight adds to the sky; it never greys it out
    depthWrite: false,
    fog: false,
    opacity: 0,
  });

  // PointsMaterial carries one size for the whole cloud, so the per-star size is folded in by
  // rewriting the single line of the stock vertex shader that sets the point size. If a later three
  // renames that line the patch simply does not land and every star falls back to STAR_SIZE - a
  // uniform field, which is still a sky.
  const STOCK_POINT_SIZE = 'gl_PointSize = size;';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aSize;\n' + shader.vertexShader.replace(
      STOCK_POINT_SIZE,
      'gl_PointSize = size * aSize;'
    );
  };

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;      // the field is far wider than its own bounding sphere
  points.visible = false;            // full day: not drawn at all
  return { points, material };
}

// Motes: a loose column of warm specks near the island, each with its own height so they never
// recycle in step. Heights live in the buffer and are rewritten as they rise.
function buildMotes(texture) {
  const positions = new Float32Array(MOTE_COUNT * 3);
  const colors = new Float32Array(MOTE_COUNT * 4);
  const warm = new THREE.Color(MOTE_COLOR);
  const cool = new THREE.Color(MOTE_COOL);
  const shade = new THREE.Color();

  for (let i = 0; i < MOTE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * MOTE_SPAN;
    positions[i * 3 + 1] = MOTE_BOTTOM + Math.random() * MOTE_CLIMB;
    positions[i * 3 + 2] = (Math.random() - 0.5) * MOTE_SPAN;

    // MOTE_COLOR stays the makers' colour: it is the warm anchor these all hang off.
    shade.copy(warm).lerp(cool, Math.random() * MOTE_COOL_SHARE);
    colors[i * 4] = shade.r;
    colors[i * 4 + 1] = shade.g;
    colors[i * 4 + 2] = shade.b;
    colors[i * 4 + 3] = THREE.MathUtils.lerp(MOTE_ALPHA_MIN, 1, Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const material = new THREE.PointsMaterial({
    map: texture,
    vertexColors: true,               // MOTE_COLOR is the anchor these were mixed from, not a tint here
    size: MOTE_SIZE,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: MOTE_OPACITY,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material, attribute: geometry.attributes.position, positions };
}

// Put one drift mote where its orbit and its wander currently hold it. Shared by the build and by
// the per-frame update, so the two can never disagree about where the ring is.
function placeDrift(positions, index, angle, radius, height, wander) {
  const base = index * 3;
  positions[base] = Math.sin(angle) * radius;
  positions[base + 1] = height + Math.sin(wander) * DRIFT_BOB;
  positions[base + 2] = Math.cos(angle) * radius;
}

// The drifting ring: large faint lights on their own orbits, out past the island. Every mote's
// orbit lives in its own small array so update only ever writes positions - nothing is allocated
// once the ring is built.
function buildDrift(texture) {
  const positions = new Float32Array(DRIFT_COUNT * 3);
  const colors = new Float32Array(DRIFT_COUNT * 4);
  const angle = new Float32Array(DRIFT_COUNT);
  const radius = new Float32Array(DRIFT_COUNT);
  const height = new Float32Array(DRIFT_COUNT);
  const wander = new Float32Array(DRIFT_COUNT);   // this mote's own phase in the slow rise and fall
  const speed = new Float32Array(DRIFT_COUNT);
  const cool = new THREE.Color(DRIFT_COOL);
  const warm = new THREE.Color(DRIFT_WARM);
  const shade = new THREE.Color();

  for (let i = 0; i < DRIFT_COUNT; i++) {
    angle[i] = Math.random() * FULL_TURN;
    radius[i] = THREE.MathUtils.lerp(DRIFT_RADIUS_MIN, DRIFT_RADIUS_MAX, Math.random());
    height[i] = THREE.MathUtils.lerp(DRIFT_HEIGHT_MIN, DRIFT_HEIGHT_MAX, Math.random());
    wander[i] = Math.random() * FULL_TURN;
    speed[i] = THREE.MathUtils.lerp(1 - DRIFT_SPEED_SPREAD, 1 + DRIFT_SPEED_SPREAD, Math.random());
    placeDrift(positions, i, angle[i], radius[i], height[i], wander[i]);

    shade.copy(cool).lerp(warm, Math.random());
    colors[i * 4] = shade.r;
    colors[i * 4 + 1] = shade.g;
    colors[i * 4 + 2] = shade.b;
    colors[i * 4 + 3] = THREE.MathUtils.lerp(DRIFT_ALPHA_MIN, 1, Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const material = new THREE.PointsMaterial({
    map: texture,
    vertexColors: true,
    size: DRIFT_SIZE,
    sizeAttenuation: true,
    transparent: true,
    blending: THREE.AdditiveBlending,  // light drifting past, not grit drifting past
    depthWrite: false,
    fog: false,
    opacity: DRIFT_OPACITY,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    material,
    attribute: geometry.attributes.position,
    positions,
    angle,
    radius,
    height,
    wander,
    speed,
  };
}

export function createSky(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- The dome ---
  const dome = buildDome();
  group.add(dome.mesh);

  // --- The nebula ---
  const nebula = buildNebula();
  group.add(nebula.mesh);

  // Scratch colours, built once: update must not allocate, and the caller's colour is a live
  // object it mutates every frame, so it is never stored here - only copied from.
  const incoming = new THREE.Color();
  const shown = new THREE.Color(1, 1, 1);
  const cloudBase = new THREE.Color(CLOUD_COLOR);
  const cloudNight = new THREE.Color(CLOUD_NIGHT_TINT);

  // --- The clouds ---
  // One geometry and one material for every puff in the sky, so all 22 clouds tint together.
  const puffGeometry = new THREE.SphereGeometry(0.5, 8, 6);
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: CLOUD_COLOR,
    transparent: true,
    opacity: CLOUD_OPACITY,
    depthWrite: false,
    fog: false,                     // unlit and never shaded: the sun light belongs to the island
  });

  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const entry = buildCloud(puffGeometry, cloudMaterial);
    clouds.push(entry);
    group.add(entry.cloud);
  }

  // --- The stars and the motes ---
  // One dot texture for all three point fields: points are squares without it.
  const dot = buildDotTexture();

  const stars = buildStars(dot);
  group.add(stars.points);

  const motes = buildMotes(dot);
  group.add(motes.points);

  const drift = buildDrift(dot);
  group.add(drift.points);

  // State the callers drive.
  let night = 0;                     // 0 full day, 1 full night
  let nightShown = -1;               // the night amount the skies were last painted with
  let elapsed = 0;                   // seconds of star breathing, and of the nebula's slow turn

  // The clock rewrites one Color instance every frame, so the argument is copied and compared
  // rather than trusted: a non-Color is ignored outright, and a colour that has not really moved
  // is not uploaded again.
  function setBase(color) {
    // A Color-like value needs all three channels: half a colour would poison the dome.
    if (!color || !Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) {
      return;
    }
    incoming.setRGB(color.r, color.g, color.b);
    if (
      Math.abs(incoming.r - shown.r) < COLOR_EPSILON &&
      Math.abs(incoming.g - shown.g) < COLOR_EPSILON &&
      Math.abs(incoming.b - shown.b) < COLOR_EPSILON
    ) {
      return;
    }
    shown.copy(incoming);
    dome.material.color.copy(shown);  // one assignment redraws the whole baked gradient
  }

  function setNight(amount) {
    if (!Number.isFinite(amount)) return;   // a bad number leaves the last night standing
    night = THREE.MathUtils.clamp(amount, 0, 1);
  }

  // The one cloud material every puff shares is re-tinted from the night amount, so the whole
  // bank goes violet-grey together and no puff holds a colour of its own.
  function paintNight() {
    cloudMaterial.color.copy(cloudBase).lerp(cloudNight, night);
  }

  function update(dt) {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    elapsed += step;

    // Clouds: a constant world speed, so the angular rate depends on how far out the ring is.
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      cloud.angle += (CLOUD_DRIFT / cloud.radius) * step;
      // One full turn, then start again. Modulo, not subtraction: a stalled tab can hand us a
      // step big enough to clear the full turn several times over.
      if (cloud.angle >= FULL_TURN) cloud.angle %= FULL_TURN;
      place(cloud.cloud, cloud.angle, cloud.radius, cloud.height);
    }

    // Motes: rise, then drop back to the bottom of the column, keeping their own spacing.
    const positions = motes.positions;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const y = i * 3 + 1;
      positions[y] += MOTE_RISE * step;
      // Same reason as the clouds: a long step can clear the whole column at once.
      if (positions[y] > MOTE_TOP) {
        positions[y] = MOTE_BOTTOM + ((positions[y] - MOTE_BOTTOM) % MOTE_CLIMB);
      }
    }
    motes.attribute.needsUpdate = true;

    // The drifting ring: the same constant world speed as the clouds, per mote, plus each one's
    // own slow wander - so the ring loosens and tightens instead of turning like a wheel.
    for (let i = 0; i < DRIFT_COUNT; i++) {
      drift.angle[i] += (DRIFT_ORBIT * drift.speed[i] / drift.radius[i]) * step;
      if (drift.angle[i] >= FULL_TURN) drift.angle[i] %= FULL_TURN;
      placeDrift(
        drift.positions,
        i,
        drift.angle[i],
        drift.radius[i],
        drift.height[i],
        drift.wander[i] + elapsed * DRIFT_BOB_RATE
      );
    }
    drift.attribute.needsUpdate = true;
    const driftOpacity = THREE.MathUtils.lerp(DRIFT_OPACITY, DRIFT_NIGHT_OPACITY, night);
    if (driftOpacity !== drift.material.opacity) drift.material.opacity = driftOpacity;

    // The nebula: a wash that only belongs to a dark sky, so it follows the night on a slower
    // curve than the stars do, and turns slowly enough that a minute of watching barely shows it.
    nebula.mesh.rotation.y += NEBULA_TURN * step;
    const wash = Math.pow(night, NEBULA_FADE_POWER) * NEBULA_OPACITY;
    if (wash !== nebula.material.opacity) nebula.material.opacity = wash;
    nebula.mesh.visible = wash > NEBULA_DIM;

    // Stars: opacity follows the night, with a small breath so the sky is never quite static.
    // Both the level and the breath scale with the night, so the field is dead still by day. The
    // night amount is bent by a power under 1 first, which is what brings the field up through the
    // dusk rather than leaving the sky flat blue until the sun is well down.
    const field = Math.pow(night, STAR_FADE_POWER);
    const breath = 1 + Math.sin(elapsed * STAR_TWINKLE) * STAR_BREATH * field;
    const opacity = THREE.MathUtils.clamp(field * STAR_OPACITY * breath, 0, 1);
    if (opacity !== stars.material.opacity) stars.material.opacity = opacity;
    stars.points.visible = opacity > STAR_DIM;   // full day: skip the draw entirely

    if (night !== nightShown) {
      paintNight();
      nightShown = night;
    }
  }

  return { group, setBase, setNight, update };
}
