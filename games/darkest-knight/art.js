// The two rooms of the castle, painted onto canvases at build time: the dim tatami hall he walks
// through on the way in, and the golden throne room he finally arrives in. Nothing is downloaded.
import * as THREE from 'three';

// --- tunables ---------------------------------------------------------------------------------
// These belong in tuning.js once the makers want to turn them; they sit here as named constants
// because art.js is the only file this builder owns (fx.js and player.js do the same for now).

// The one view every number below answers to: the locked camera sits at the origin at y = 1.6, aimed
// down -Z at an enemy standing at z = -3 whose head is at y = 1.8. Nothing may stand on that line.
const TEX = 512;             // every canvas texture is 512 on a side, and no texture is 1024
const ANISOTROPY = 4;        // enough to keep the long tatami rows and gold panels from smearing

// THE TATAMI HALL — the intro boss. Long, low and cold: a corridor he is passing through, not a
// room he belongs in. The same lantern, beam and shoji panel repeat down its length, and the far
// end is a shut door, not a destination.
const HALL_W = 9.6;              // side walls stand at x = ±4.8
const HALL_H = 5;                // ceiling, deliberately a metre lower than the throne room's
const HALL_FRONT_Z = 4;          // the wall behind the player (never seen: the view is locked forward)
const HALL_BACK_Z = -18;         // the far wall, well past the fog
const HALL_MID_Z = (HALL_FRONT_Z + HALL_BACK_Z) / 2;
const HALL_LEN = HALL_FRONT_Z - HALL_BACK_Z;
const MAT_TILE = 3.82;           // one weave tile = 4 mats across x 2 down, at the real mat size
const SHOJI_W = 1.7;             // one paper panel along the walls
const SHOJI_H = 1.9;
const SHOJI_Y = 1.35;
const HALL_BEAM_Z = [-1, -4.9, -8.8, -12.7, -16.6];
const HALL_COLUMN_Z = [-2.2, -8.2, -14.2];
const HALL_LANTERN_Z = [-4.6, -8.6, -12.6, -16.6];
const HALL_LAMP_Z = [-2.6, -6.6, -10.6, -14.6];

// THE THRONE ROOM — the lord, and only him. Wider, taller, gold, and built on one axis: the carpet, the steps, the
// dais, the gate and the throne all sit dead centre, so the eye is pulled down the room to the seat
// of the man he came for. Warmer, heavier and brighter at the far end than the hall ever is.
const THRONE_W = 11;             // side walls at x = ±5.5
const THRONE_H = 6.2;
const THRONE_FRONT_Z = 3;
const THRONE_BACK_Z = -13.5;     // the glowing gold wall behind the throne, kept inside the fog
const THRONE_MID_Z = (THRONE_FRONT_Z + THRONE_BACK_Z) / 2;
const THRONE_LEN = THRONE_FRONT_Z - THRONE_BACK_Z;
const GOLD_TILE = 2.6;           // one tile of gold leaf panels
const CARPET_W = 3.4;            // the road across the floor, on the axis
const CARPET_FRONT_Z = -3.3;     // starts just behind the enemy: never in front of his body
const DAIS_Z = -7.3;             // centre of the raised platform
const DAIS_D = 4.6;
const DAIS_TOP = 1.25;           // high enough that the seat clears the enemy's head in the frame
const DAIS_FRONT_Z = DAIS_Z + DAIS_D / 2;   // -5.0: three steps up from the floor
const STEP_D = 0.4;
const STEP_H = DAIS_TOP / 3;
const THRONE_Z = -8.2;           // the throne itself, 5 metres behind the enemy
const GATE_Z = -8.4;             // the gold gate framing it: the end of the room
const THRONE_BEAM_Z = [-2, -5.5, -9, -12.5];

// Lights. Three are pooled for the whole arena (see createArena): three.js bakes the light count
// into every shader, so a room claims what it needs and dims the rest rather than adding and removing.
const HALL_LIGHTS = [
  { x: 0, y: 3.0, z: -4.6, color: 0xffab5c, intensity: 12, distance: 13 },   // the low lantern over the fight
  { x: 0, y: 3.0, z: -12.4, color: 0xff9a4e, intensity: 6, distance: 12 },   // one more, two rooms down
  null,                                                                     // dim and cold: the hall keeps no light
];
const THRONE_LIGHTS = [
  { x: 0, y: 3.0, z: -6.6, color: 0xffc06a, intensity: 40, distance: 17 },   // the throne, lit from in front
  { x: 3.4, y: 2.9, z: -4.4, color: 0xffab52, intensity: 16, distance: 13 },  // lantern pair at the steps
  { x: -3.4, y: 2.9, z: -4.4, color: 0xffab52, intensity: 16, distance: 13 },
];

// Drifting air: cold motes in the hall, gold embers in the throne room. Both live behind the enemy
// (z < -4) so nothing ever floats between the camera and him.
const MOTES = { count: 70, x: 4.2, yMin: 0.15, yMax: 4.4, zFront: -4.4, zBack: -16, rise: 0.08, wobble: 0.1 };
const EMBERS = { count: 130, x: 5.0, yMin: 0.1, yMax: 5.6, zFront: -4.2, zBack: -14, rise: 0.35, wobble: 0.35 };

// --- canvas painting --------------------------------------------------------------------------
// Every texture is drawn once per build into a 512x512 canvas and cached by kind and repeat, so two
// objects that want the same paper want the same texture object — one upload, one dispose.

function paperBase(ctx, s, rand) {
  ctx.fillStyle = '#c6b08a';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) { // clouds in the paper, and the damp coming through it
    const x = rand() * s, y = rand() * s, radius = 30 + rand() * 110;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, rgba(92, 78, 52, 0.1 + rand() * 0.14));
    cloud.addColorStop(1, rgba(92, 78, 52, 0));
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, s, s);
  }
  for (let i = 0; i < 600; i++) { // paper fibres
    ctx.strokeStyle = rgba(240, 226, 186, 0.04 + rand() * 0.1);
    ctx.lineWidth = 1;
    const x = rand() * s, y = rand() * s, len = 4 + rand() * 16;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 3);
    ctx.stroke();
  }
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rgba(r, g, b, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
}

function createPalette() {
  const cache = new Map();
  function get(kind, repeatX = 1, repeatY = 1) {
    const key = `${kind}|${repeatX}|${repeatY}`;
    let texture = cache.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = TEX;
      canvas.height = TEX;
      PAINTERS[kind](canvas.getContext('2d'), TEX);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = ANISOTROPY;
      texture.repeat.set(repeatX, repeatY);
      cache.set(key, texture);
    }
    return texture;
  }
  return { get, list: () => Array.from(cache.values()) };
}

const PAINTERS = {
  // Woven straw: one tile is four mats across and two down, so every mat keeps its real 1 x 2 shape.
  weave: (ctx, s) => {
    const rand = rng(11);
    const cols = 4, rows = 2;
    const cw = s / cols, ch = s / rows;
    ctx.fillStyle = '#0c0a07';
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * ch;
        const tone = 0.74 + rand() * 0.34; // every mat is worn a little differently
        ctx.fillStyle = rgba(116 * tone, 104 * tone, 66 * tone, 1); // cold, dusty, greying straw
        ctx.fillRect(x, y, cw, ch);
        for (let i = 0; i < 70; i++) { // the reed: pale fibres running across the short side
          const yy = y + rand() * ch;
          ctx.strokeStyle = rgba(196, 178, 126, 0.04 + rand() * 0.1);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x + cw, yy + (rand() - 0.5) * 3);
          ctx.stroke();
        }
        for (let i = 0; i < 30; i++) { // and the shadow between the fibres
          const yy = y + rand() * ch;
          ctx.strokeStyle = rgba(44, 36, 20, 0.06 + rand() * 0.16);
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x + cw, yy + (rand() - 0.5) * 2);
          ctx.stroke();
        }
        // The heri: the cloth bound down both long sides, and across the short ends where mats meet.
        ctx.fillStyle = '#100c08';
        ctx.fillRect(x, y, 10, ch);
        ctx.fillRect(x + cw - 10, y, 10, ch);
        ctx.fillRect(x, y, cw, 7);
        ctx.fillRect(x, y + ch - 7, cw, 7);
      }
    }
    for (let i = 0; i < 34; i++) { // damp, age and the odd stain over the whole hall floor
      const x = rand() * s, y = rand() * s, radius = 20 + rand() * 90;
      const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
      stain.addColorStop(0, rgba(0, 0, 0, 0.05 + rand() * 0.22));
      stain.addColorStop(1, rgba(0, 0, 0, 0));
      ctx.fillStyle = stain;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  },

  // Loose, aged paper: a lantern's skin, warm and blotchy. No lattice.
  paper: (ctx, s) => {
    const rand = rng(19);
    paperBase(ctx, s, rand);
  },

  // Aged paper behind a kumiko lattice: the cold backlight of the hall.
  shoji: (ctx, s) => {
    const rand = rng(23);
    paperBase(ctx, s, rand);
    const bars = 6, gap = s / bars;
    ctx.strokeStyle = '#2b1e13';
    ctx.lineWidth = 8;
    for (let i = 1; i < bars; i++) {
      ctx.beginPath(); ctx.moveTo(i * gap, 0); ctx.lineTo(i * gap, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * gap); ctx.lineTo(s, i * gap); ctx.stroke();
    }
    for (let i = 1; i < bars; i++) { // the pegs where the lattice crosses
      for (let j = 1; j < bars; j++) {
        ctx.fillStyle = '#20160e';
        ctx.fillRect(i * gap - 7, j * gap - 7, 14, 14);
      }
    }
    ctx.strokeStyle = '#33241a'; // the outer frame
    ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, s, s);
  },

  // Dark timber: planks with grain, knots and old splits. Painted light and tinted down per material.
  wood: (ctx, s) => {
    const rand = rng(31);
    ctx.fillStyle = '#8a6244';
    ctx.fillRect(0, 0, s, s);
    const planks = 5, pw = s / planks;
    for (let p = 0; p < planks; p++) {
      const x = p * pw;
      const tone = 0.72 + rand() * 0.5;
      ctx.fillStyle = rgba(150 * tone, 108 * tone, 78 * tone, 1);
      ctx.fillRect(x, 0, pw, s);
      for (let i = 0; i < 60; i++) { // grain, wobbling down the plank
        const gx = x + 3 + rand() * (pw - 6);
        const dark = rand() < 0.5;
        ctx.strokeStyle = dark ? rgba(60, 38, 22, 0.1 + rand() * 0.22) : rgba(196, 156, 110, 0.06 + rand() * 0.14);
        ctx.lineWidth = 1 + rand() * 2;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        for (let y = 0; y <= s; y += 64) ctx.lineTo(gx + Math.sin((y / s) * 6 + p) * 5, y);
        ctx.stroke();
      }
      for (let i = 0; i < 2; i++) { // knots
        const kx = x + 10 + rand() * (pw - 20), ky = rand() * s;
        ctx.fillStyle = rgba(48, 30, 18, 0.5);
        ctx.beginPath();
        ctx.ellipse(kx, ky, 5 + rand() * 5, 9 + rand() * 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(20,12,7,0.55)'; // the seam between planks
      ctx.fillRect(x, 0, 3, s);
    }
  },

  // A painted, coffered ceiling: gold motifs on black lacquer, dim enough to sit above the fight.
  coffer: (ctx, s) => {
    const rand = rng(43);
    const cells = 4, gap = 30;
    const cell = (s - gap) / cells;
    ctx.fillStyle = '#241a12'; // the beams between the panels
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const x = c * cell + gap, y = r * cell + gap;
        ctx.fillStyle = rgba(30 + rand() * 16, 22 + rand() * 10, 12, 1);
        ctx.fillRect(x, y, cell, cell);
        const gold = 0.5 + rand() * 0.6; // a brushed flower, or just a cloud of gilt
        ctx.strokeStyle = rgba(150 * gold, 112 * gold, 42 * gold, 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.26, 0, Math.PI * 2);
        ctx.stroke();
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + rand();
          ctx.beginPath();
          ctx.moveTo(x + cell / 2, y + cell / 2);
          ctx.lineTo(x + cell / 2 + Math.cos(a) * cell * 0.36, y + cell / 2 + Math.sin(a) * cell * 0.36);
          ctx.stroke();
        }
        ctx.fillStyle = rgba(170 * gold, 128 * gold, 50 * gold, 0.22);
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < cells + 1; i++) { // a stud at every crossing of the beams
      const at = i * (cell + gap) - gap / 2;
      for (let j = 0; j < cells + 1; j++) {
        const bt = j * (cell + gap) - gap / 2;
        ctx.fillStyle = '#7d5f24';
        ctx.beginPath();
        ctx.arc(at + gap / 2, bt + gap / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Gold leaf: squares of beaten metal, seams, worn patches and a long sheen across them.
  gold: (ctx, s) => {
    const rand = rng(57);
    ctx.fillStyle = '#4a3210';
    ctx.fillRect(0, 0, s, s);
    const leaves = 8, lw = s / leaves;
    for (let r = 0; r < leaves; r++) {
      for (let c = 0; c < leaves; c++) {
        const tone = 0.68 + rand() * 0.6;
        ctx.fillStyle = rgba(214 * tone, 158 * tone, 62 * tone, 1);
        ctx.fillRect(c * lw + 1, r * lw + 1, lw - 2, lw - 2);
      }
    }
    for (let i = 0; i < 90; i++) { // where the leaf has rubbed away to the ground
      const x = rand() * s, y = rand() * s;
      ctx.fillStyle = rgba(60, 40, 14, 0.15 + rand() * 0.4);
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + rand() * 18, 2 + rand() * 12, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const sheen = ctx.createLinearGradient(0, s, s, 0); // one broad highlight across the wall
    sheen.addColorStop(0, 'rgba(255,236,178,0)');
    sheen.addColorStop(0.45, 'rgba(255,236,178,0.16)');
    sheen.addColorStop(0.6, 'rgba(255,236,178,0.05)');
    sheen.addColorStop(1, 'rgba(255,236,178,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { // scratches
      ctx.strokeStyle = rgba(255, 226, 150, 0.05 + rand() * 0.12);
      ctx.lineWidth = 1;
      const x = rand() * s, y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 120, y + (rand() - 0.5) * 40);
      ctx.stroke();
    }
  },

  // Polished dark stone for the throne room floor: slabs, grout, a vein of gold in the rock.
  stone: (ctx, s) => {
    const rand = rng(67);
    ctx.fillStyle = '#14120f';
    ctx.fillRect(0, 0, s, s);
    const slabs = 2, sl = s / slabs;
    for (let r = 0; r < slabs; r++) {
      for (let c = 0; c < slabs; c++) {
        const x = c * sl, y = r * sl;
        const tone = 0.8 + rand() * 0.4;
        ctx.fillStyle = rgba(42 * tone, 38 * tone, 34 * tone, 1);
        ctx.fillRect(x + 2, y + 2, sl - 4, sl - 4);
        for (let i = 0; i < 220; i++) { // mottling in the stone
          const px = x + rand() * sl, py = y + rand() * sl;
          ctx.fillStyle = rand() < 0.5 ? rgba(24, 22, 20, 0.2) : rgba(74, 68, 60, 0.14);
          ctx.fillRect(px, py, 1 + rand() * 3, 1 + rand() * 3);
        }
        for (let i = 0; i < 3; i++) { // veins, one of them gilt
          const gilt = rand() < 0.34;
          ctx.strokeStyle = gilt ? rgba(150, 116, 52, 0.3) : rgba(88, 82, 74, 0.18);
          ctx.lineWidth = 1 + rand() * 2;
          ctx.beginPath();
          const vx = x + rand() * sl, vy = y + rand() * sl;
          ctx.moveTo(vx, vy);
          ctx.lineTo(vx + (rand() - 0.5) * sl * 0.8, vy + (rand() - 0.5) * sl * 0.8);
          ctx.stroke();
        }
      }
    }
  },

  // One soft dot, used for both the drifting motes and the embers (the material sets the colour).
  ember: (ctx, s) => {
    const half = s / 2;
    const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.25, 'rgba(255,226,170,0.75)');
    glow.addColorStop(0.6, 'rgba(255,170,80,0.22)');
    glow.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
  },

  // The crown of rays behind the throne: the gold silhouette that makes the far end of the room read.
  halo: (ctx, s) => {
    const rand = rng(89);
    const cx = s / 2, cy = s / 2;
    for (let i = 0; i < 56; i++) { // flames reaching out, of every length, gold to red at the tips
      const a = (i / 56) * Math.PI * 2 + rand() * 0.06;
      const long = i % 2 === 0;
      const reach = (long ? 0.46 : 0.32) * s + rand() * s * 0.05;
      const w = 0.02 + rand() * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - w) * s * 0.16, cy + Math.sin(a - w) * s * 0.16);
      ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
      ctx.lineTo(cx + Math.cos(a + w) * s * 0.16, cy + Math.sin(a + w) * s * 0.16);
      ctx.closePath();
      ctx.fillStyle = rgba(232, 150, 44, 0.3 + rand() * 0.35);
      ctx.fill();
    }
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.42);
    core.addColorStop(0, 'rgba(255,226,150,0.5)');
    core.addColorStop(0.5, 'rgba(230,140,40,0.18)');
    core.addColorStop(1, 'rgba(180,60,10,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,214,140,0.35)'; // the ring the flames stand on
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  },
};

// --- shared geometry helpers -------------------------------------------------------------------
// One unit box, one unit plane and one unit cylinder per build, scaled per object: repeated props
// cost a draw call each and nothing else, and there are only three geometries to dispose.

function box(geometry, material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(geometry.box, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  return mesh;
}

// rx tips the plane onto the floor or the ceiling, ry turns it to face the middle of the room.
function panel(geometry, material, w, h, x, y, z, ry = 0, rx = 0) {
  const mesh = new THREE.Mesh(geometry.plane, material);
  mesh.scale.set(w, h, 1);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, 0);
  return mesh;
}

function column(geometry, material, radius, height, x, z) {
  const mesh = new THREE.Mesh(geometry.cylinder, material);
  mesh.scale.set(radius * 2, height, radius * 2); // the unit cylinder is 1 across and 1 tall
  mesh.position.set(x, height / 2, z);
  return mesh;
}

// A pool of drifting specks: positions are written in place every frame, so update allocates nothing.
function createDrift(palette, options, color, size, opacity, blending) {
  const positions = new Float32Array(options.count * 3);
  const speeds = new Float32Array(options.count);
  const phases = new Float32Array(options.count);
  const span = options.zFront - options.zBack;
  for (let i = 0; i < options.count; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * options.x;
    positions[i * 3 + 1] = options.yMin + Math.random() * (options.yMax - options.yMin);
    positions[i * 3 + 2] = options.zFront - Math.random() * span;
    speeds[i] = options.rise * (0.5 + Math.random());
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometryBuffer = new THREE.BufferGeometry();
  geometryBuffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: palette.get('ember'),
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometryBuffer, material);
  points.frustumCulled = false; // they move every frame; the bounding sphere would be a lie

  let time = 0;
  function tick(dt) {
    time += dt;
    for (let i = 0; i < options.count; i++) {
      const at = i * 3;
      positions[at + 1] += speeds[i] * dt;
      positions[at] += Math.sin(time * 0.7 + phases[i]) * options.wobble * dt;
      if (positions[at + 1] > options.yMax + 0.2) { // out through the ceiling: back to the floor
        positions[at + 1] = options.yMin;
        positions[at + 2] = options.zFront - Math.random() * span;
      }
    }
    geometryBuffer.attributes.position.needsUpdate = true;
  }

  return { points, tick, material, geometry: geometryBuffer };
}

// --- the tatami hall ---------------------------------------------------------------------------
// Cold grey light through shut paper, a low lantern over the fight, and the same three shapes
// repeating into the fog: he is walking through the guards' corridor, and it is not his.
function buildTatamiHall(ctx) {
  const { group, geometry, palette, own } = ctx;
  const W = HALL_W / 2;

  const floor = own(new THREE.MeshStandardMaterial({
    map: palette.get('weave', 3, 6), color: 0x8b929c, roughness: 0.97, metalness: 0,
  }));
  const wood = own(new THREE.MeshStandardMaterial({
    map: palette.get('wood', 11, 2.5), color: 0x322925, roughness: 0.92,
  }));
  const beam = own(new THREE.MeshStandardMaterial({
    map: palette.get('wood', 4, 1), color: 0x4b362b, roughness: 0.88,
  }));
  const ceiling = own(new THREE.MeshStandardMaterial({
    map: palette.get('coffer', 2.4, 5.5), color: 0x5c5852, roughness: 0.9,
  }));
  // The paper itself: moonlight through a shut screen. Cold and low, so the hall never feels grand.
  const paper = own(new THREE.MeshStandardMaterial({
    map: palette.get('shoji', HALL_LEN / SHOJI_W, 1),
    emissiveMap: palette.get('shoji', HALL_LEN / SHOJI_W, 1),
    emissive: 0x8aa8c8,
    emissiveIntensity: 0.24,
    color: 0xb5bcc0,
    roughness: 0.95,
    side: THREE.DoubleSide,
  }));
  // The one warm thing in the room, and only where a lantern hangs.
  const lanternPaper = own(new THREE.MeshStandardMaterial({
    map: palette.get('paper', 1, 1),
    emissiveMap: palette.get('paper', 1, 1),
    emissive: 0xffb262,
    emissiveIntensity: 0.62,
    roughness: 0.95,
  }));
  const dark = own(new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 }));
  const cord = own(new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 1 }));
  // Something is bleeding through the shut doors at the end of the hall.
  const bleed = own(new THREE.MeshBasicMaterial({
    map: palette.get('ember'), color: 0x581414, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
  }));

  // Shell: floor, ceiling, the two long walls, and the shut far end.
  group.add(panel(geometry, floor, 3 * MAT_TILE, 6 * MAT_TILE, 0, 0.02, HALL_MID_Z, 0, -Math.PI / 2));
  group.add(panel(geometry, ceiling, HALL_W, HALL_LEN, 0, HALL_H, HALL_MID_Z, 0, Math.PI / 2));
  for (const side of [1, -1]) {
    group.add(panel(geometry, wood, HALL_LEN, HALL_H, side * W, HALL_H / 2, HALL_MID_Z, side * -Math.PI / 2));
    group.add(panel(geometry, paper, HALL_LEN, SHOJI_H, side * (W - 0.06), SHOJI_Y, HALL_MID_Z, side * -Math.PI / 2));
    group.add(panel(geometry, beam, HALL_LEN, 0.5, side * (W - 0.02), 0.25, HALL_MID_Z, side * -Math.PI / 2));
    group.add(panel(geometry, beam, HALL_LEN, 0.7, side * (W - 0.02), HALL_H - 0.35, HALL_MID_Z, side * -Math.PI / 2));
  }
  group.add(panel(geometry, wood, HALL_W, HALL_H, 0, HALL_H / 2, HALL_BACK_Z));
  // A pair of shut sliding doors, and the red of whatever is behind them.
  group.add(panel(geometry, bleed, 4, 3.2, 0, 1.5, HALL_BACK_Z + 0.12));
  for (const side of [1, -1]) {
    group.add(panel(geometry, beam, 1.05, 2.1, side * 0.56, 1.05, HALL_BACK_Z + 0.06));
  }
  group.add(panel(geometry, beam, 3.1, 0.16, 0, 2.24, HALL_BACK_Z + 0.07));

  // Beams overhead, running both ways: the strong lines that make the hall long.
  for (const z of HALL_BEAM_Z) group.add(box(geometry, beam, HALL_W, 0.36, 0.3, 0, HALL_H - 0.58, z));
  for (const x of [-2.8, 2.8]) group.add(box(geometry, beam, 0.26, 0.34, HALL_LEN, x, HALL_H - 0.42, HALL_MID_Z));
  for (const z of HALL_COLUMN_Z) {
    for (const side of [1, -1]) {
      group.add(box(geometry, wood, 0.44, HALL_H, 0.44, side * (W - 0.24), HALL_H / 2, z));
    }
  }

  // One lantern design, hung four times down the middle. The first lights the fight; the rest are
  // only as bright as they are far away.
  for (const z of HALL_LANTERN_Z) {
    group.add(box(geometry, cord, 0.04, 1.6, 0.04, 0, HALL_H - 0.85, z));
    group.add(box(geometry, dark, 0.5, 0.1, 0.5, 0, HALL_H - 1.7, z));
    group.add(box(geometry, lanternPaper, 0.42, 0.62, 0.42, 0, HALL_H - 2.06, z));
    group.add(box(geometry, dark, 0.46, 0.06, 0.46, 0, HALL_H - 2.4, z));
  }
  // Small cold lamps up on the walls, so the dark between them reads as dark.
  const coldLamp = own(new THREE.MeshStandardMaterial({
    map: palette.get('paper', 1, 1), emissiveMap: palette.get('paper', 1, 1),
    emissive: 0x9ec0e0, emissiveIntensity: 0.3, roughness: 0.95,
  }));
  for (const z of HALL_LAMP_Z) {
    for (const side of [1, -1]) {
      group.add(box(geometry, dark, 0.08, 0.08, 0.3, side * (W - 0.1), 2.78, z));
      group.add(box(geometry, coldLamp, 0.2, 0.28, 0.2, side * (W - 0.26), 2.72, z));
    }
  }

  const drift = createDrift(palette, MOTES, 0x9fb6d0, 0.05, 0.45, THREE.NormalBlending);
  group.add(drift.points);
  ctx.materials.push(drift.material);
  ctx.extraGeometries.push(drift.geometry);

  const phases = [0, 2.1, 4.2];
  let time = 0;
  return (dt) => { // a slow lantern flicker, and the cold air moving
    time += dt;
    for (let i = 0; i < phases.length; i++) {
      const light = ctx.lights[i];
      const base = light.userData.base || 0;
      light.intensity = base * (0.86 + 0.1 * Math.sin(time * 6.3 + phases[i]) + 0.06 * Math.sin(time * 15.7 + phases[i]));
    }
    drift.tick(dt);
  };
}

// --- the throne room --------------------------------------------------------------------------
// ARRIVAL. Everything on the centre line — carpet, steps, dais, gate, throne — and every one of them
// gold, with the light gathered at the far end so the room pulls the eye to the seat and closes in.
function buildThroneRoom(ctx) {
  const { group, geometry, palette, own } = ctx;
  const W = THRONE_W / 2;

  const floor = own(new THREE.MeshStandardMaterial({
    map: palette.get('stone', THRONE_W / 2.4, THRONE_LEN / 2.4), roughness: 0.42, metalness: 0.1,
  }));
  const wallGold = own(new THREE.MeshStandardMaterial({
    map: palette.get('gold', THRONE_LEN / GOLD_TILE, THRONE_H / GOLD_TILE), color: 0xa8813c,
    emissiveMap: palette.get('gold', 8, 3), emissive: 0xffffff, emissiveIntensity: 0.16, roughness: 0.5, metalness: 0.2,
  }));
  const farGold = own(new THREE.MeshStandardMaterial({ // the wall behind the throne: the glow he walked to
    map: palette.get('gold', THRONE_W / GOLD_TILE, THRONE_H / GOLD_TILE), color: 0xb08a48,
    emissiveMap: palette.get('gold', 4, 2), emissive: 0xffd9a0, emissiveIntensity: 0.22,
    roughness: 0.45, metalness: 0.2, fog: false, // held out of the fog on purpose: the end of the road
  }));
  const daisGold = own(new THREE.MeshStandardMaterial({ // the gilt nosing on the stair
    map: palette.get('gold', 1, 1), color: 0xd0a24e, emissiveMap: palette.get('gold', 1, 1),
    emissive: 0xffb860, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.3,
  }));
  const throneGold = own(new THREE.MeshStandardMaterial({
    map: palette.get('gold', 1, 1), color: 0xd6a94f, emissiveMap: palette.get('gold', 1, 1),
    emissive: 0xffc880, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.3,
  }));
  const wood = own(new THREE.MeshStandardMaterial({
    map: palette.get('wood', 8, 2), color: 0x35251a, roughness: 0.9,
  }));
  const beam = own(new THREE.MeshStandardMaterial({
    map: palette.get('wood', 2, 1), color: 0x2a1c12, roughness: 0.9,
  }));
  const ceiling = own(new THREE.MeshStandardMaterial({
    map: palette.get('coffer', THRONE_W / 4, THRONE_LEN / 4), color: 0x7a6030, roughness: 0.88,
  }));
  const carpet = own(new THREE.MeshStandardMaterial({ color: 0x5e1418, roughness: 0.96 }));
  const lanternPaper = own(new THREE.MeshStandardMaterial({
    map: palette.get('paper', 1, 1), emissiveMap: palette.get('paper', 1, 1),
    emissive: 0xffcf8a, emissiveIntensity: 0.95, roughness: 0.95,
  }));
  const steel = own(new THREE.MeshStandardMaterial({ color: 0x98a2ae, metalness: 0.5, roughness: 0.4 }));
  const grip = own(new THREE.MeshStandardMaterial({ color: 0x2a1f1c, roughness: 0.95 }));
  const halo = own(new THREE.MeshBasicMaterial({
    map: palette.get('halo'), transparent: true, opacity: 0.8, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, // the crown of rays is painted light, not fogged air
  }));

  // Shell: a floor of dark stone, a painted ceiling, gold-leaf walls, and the gold wall at the end.
  group.add(panel(geometry, floor, THRONE_W + 1.8, THRONE_LEN + 1.8, 0, 0.02, THRONE_MID_Z, 0, -Math.PI / 2));
  group.add(panel(geometry, ceiling, THRONE_W, THRONE_LEN, 0, THRONE_H, THRONE_MID_Z, 0, Math.PI / 2));
  for (const side of [1, -1]) {
    group.add(panel(geometry, wallGold, THRONE_LEN, THRONE_H, side * W, THRONE_H / 2, THRONE_MID_Z, side * -Math.PI / 2));
    group.add(panel(geometry, wood, THRONE_LEN, 1.2, side * (W - 0.03), 0.6, THRONE_MID_Z, side * -Math.PI / 2));
    group.add(panel(geometry, wood, THRONE_LEN, 0.6, side * (W - 0.03), THRONE_H - 0.3, THRONE_MID_Z, side * -Math.PI / 2));
  }
  group.add(panel(geometry, farGold, THRONE_W, THRONE_H, 0, THRONE_H / 2, THRONE_BACK_Z));
  group.add(box(geometry, beam, THRONE_W + 0.4, 0.7, 0.5, 0, THRONE_H - 0.35, THRONE_BACK_Z + 0.3));
  for (const z of THRONE_BEAM_Z) group.add(box(geometry, beam, THRONE_W, 0.42, 0.36, 0, THRONE_H - 0.66, z));

  // The gate the room ends in: two posts and a lintel dead centre, gold, framing the throne.
  for (const side of [1, -1]) {
    group.add(box(geometry, throneGold, 0.45, 3.9, 0.5, side * 3.3, DAIS_TOP + 1.95, GATE_Z));
    group.add(column(geometry, wood, 0.5, THRONE_H - 0.4, side * 4.7, -5.5));
    group.add(box(geometry, throneGold, 1.3, 0.2, 1.3, side * 4.7, 0.1, -5.5));
  }
  group.add(box(geometry, throneGold, 7.2, 0.55, 0.6, 0, DAIS_TOP + 4.1, GATE_Z));

  // The dais: three steps up from the floor, then the platform they lead onto. Behind z = -3, always.
  const STEP_EDGE = DAIS_FRONT_Z + 3 * STEP_D;   // -3.8: the front of the lowest step
  for (let i = 0; i < 3; i++) {
    const top = STEP_H * (i + 1);
    const centre = DAIS_FRONT_Z + (2.5 - i) * STEP_D;  // -4.0, -4.4, -4.8
    group.add(box(geometry, wood, 7.4, top, STEP_D, 0, top / 2, centre));
    // A gilt nosing along the front of each step: the light catches it and the stair reads at once.
    group.add(box(geometry, daisGold, 7.4, 0.06, 0.07, 0, top - 0.03, centre - STEP_D / 2 + 0.035));
    group.add(panel(geometry, carpet, CARPET_W, STEP_D, 0, top + 0.015, centre, 0, -Math.PI / 2));
  }
  group.add(box(geometry, wood, 7.4, DAIS_TOP, DAIS_D, 0, DAIS_TOP / 2, DAIS_Z));

  // The carpet: the road he walked, floor to steps to the foot of the throne, all on the axis.
  group.add(panel(geometry, carpet, CARPET_W, CARPET_FRONT_Z - STEP_EDGE, 0, 0.03,
                  (CARPET_FRONT_Z + STEP_EDGE) / 2, 0, -Math.PI / 2));
  group.add(panel(geometry, carpet, CARPET_W, DAIS_D, 0, DAIS_TOP + 0.015, DAIS_Z, 0, -Math.PI / 2));

  // Two katana planted either side of the road, blades in the floor, as if left there for him.
  for (const side of [1, -1]) {
    const x = side * 2.1, z = -3.85, lean = side * -0.12;
    const blade = box(geometry, steel, 0.055, 1.5, 0.11, x, 0.75, z);
    const tsuba = box(geometry, grip, 0.26, 0.05, 0.14, x, 1.52, z);
    const hilt = box(geometry, grip, 0.07, 0.36, 0.09, x, 1.73, z);
    for (const part of [blade, tsuba, hilt]) {
      part.rotation.set(-0.05, 0, lean); // leaning out of the floor, away from the road
      group.add(part);
    }
  }

  // The throne, the gate's centre and the brightest thing in the room.
  group.add(box(geometry, throneGold, 2.4, 3.2, 0.45, 0, DAIS_TOP + 1.6, THRONE_Z - 0.65)); // back
  group.add(box(geometry, throneGold, 2.4, 0.55, 1.4, 0, DAIS_TOP + 0.28, THRONE_Z));       // seat
  for (const side of [1, -1]) {
    group.add(box(geometry, throneGold, 0.3, 0.55, 1.35, side * 1.15, DAIS_TOP + 0.5, THRONE_Z));
    group.add(box(geometry, throneGold, 0.62, 0.18, 0.18, side * 1.28, DAIS_TOP + 0.72, THRONE_Z + 0.55));
    group.add(box(geometry, beam, 0.24, 0.24, 0.7, side * 1.28, DAIS_TOP + 0.16, THRONE_Z + 0.1)); // feet
  }
  group.add(box(geometry, throneGold, 3.0, 0.32, 0.7, 0, DAIS_TOP + 3.36, THRONE_Z - 0.7));   // crown band
  group.add(panel(geometry, halo, 5.4, 5.4, 0, DAIS_TOP + 2.1, THRONE_Z - 1.2));             // the rays

  // Tall floor lanterns, their paper lit from inside: the warm pair standing at the steps.
  for (const side of [1, -1]) {
    group.add(box(geometry, beam, 0.16, 2.6, 0.16, side * 3.4, 1.3, -4.4));
    group.add(box(geometry, beam, 0.62, 0.12, 0.62, side * 3.4, 2.66, -4.4));
    group.add(box(geometry, lanternPaper, 0.5, 0.72, 0.5, side * 3.4, 3.0, -4.4));
    group.add(box(geometry, beam, 0.56, 0.1, 0.56, side * 3.4, 3.4, -4.4));
    group.add(box(geometry, beam, 0.14, 2.2, 0.14, side * 4.5, 1.1, -9.2));
    group.add(box(geometry, lanternPaper, 0.42, 0.6, 0.42, side * 4.5, 2.5, -9.2));
  }

  const drift = createDrift(palette, EMBERS, 0xffb15a, 0.11, 0.85, THREE.AdditiveBlending);
  group.add(drift.points);
  ctx.materials.push(drift.material);
  ctx.extraGeometries.push(drift.geometry);

  const phases = [0.4, 2.7, 4.9];
  let time = 0;
  return (dt) => { // three lantern flickers out of step, and the embers rising through the gold
    time += dt;
    for (let i = 0; i < phases.length; i++) {
      const light = ctx.lights[i];
      const base = light.userData.base || 0;
      const beat = 0.9 + 0.07 * Math.sin(time * 5.4 + phases[i]) + 0.05 * Math.sin(time * 13.1 + phases[i]);
      light.intensity = base * beat;
    }
    drift.tick(dt);
  };
}

// --- the arena --------------------------------------------------------------------------------
export function createArena(scene) {
  // Three lights for the whole arena, built here and never removed: three.js bakes the number of
  // lights into every shader it compiles, so a room claims them and dims them again on dispose
  // instead of adding and removing them (fx.js keeps its impact flashes in a pool for the same
  // reason). Before the first build they sit at intensity 0 and cost nothing but a slot.
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 1, 2);
    light.userData.base = 0;
    scene.add(light);
    lights.push(light);
  }

  let room = null; // { group, tick, geometries, materials, textures }

  function dispose() {
    for (const light of lights) {
      light.intensity = 0;
      light.userData.base = 0;
    }
    if (!room) return;
    scene.remove(room.group);
    for (const item of room.geometries) item.dispose();
    for (const item of room.materials) item.dispose();
    for (const item of room.textures) item.dispose();
    room = null;
  }

  function build(kind) {
    dispose(); // the old room always goes first: nothing can double up

    const geometry = {
      box: new THREE.BoxGeometry(1, 1, 1),
      plane: new THREE.PlaneGeometry(1, 1),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, false),
    };
    const palette = createPalette();
    const group = new THREE.Group();
    group.name = `arena-${kind}`;
    const materials = [];
    const extraGeometries = [];
    const ctx = {
      group, geometry, palette, lights, materials, extraGeometries,
      own: (material) => { materials.push(material); return material; },
    };

    // Any kind other than 'throne' is the hall, the room the run starts in.
    const tick = kind === 'throne' ? buildThroneRoom(ctx) : buildTatamiHall(ctx);

    const setting = kind === 'throne' ? THRONE_LIGHTS : HALL_LIGHTS;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const want = setting[i];
      if (!want) {
        light.userData.base = 0;
        light.intensity = 0;
        continue;
      }
      light.position.set(want.x, want.y, want.z);
      light.color.setHex(want.color);
      light.distance = want.distance;
      light.userData.base = want.intensity;
      light.intensity = want.intensity;
    }

    scene.add(group);
    room = {
      kind,
      group,
      tick,
      geometries: [geometry.box, geometry.plane, geometry.cylinder, ...extraGeometries],
      materials,
      textures: palette.list(),
    };
  }

  function update(dt) {
    if (room) room.tick(dt); // cheap only: a light's intensity and one buffer of drifting specks
  }

  return { build, update, dispose };
}
