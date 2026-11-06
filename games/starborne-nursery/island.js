// Builds the floating island: three chunky cut-open blocks in one rotatable group, each one a
// grass-topped tile. Each tile is its own group, so it can be raised or lowered, and the two outer
// tiles hide a cave underneath while the centre one hangs a longer stone root below its own base,
// so the three read as one block with a keel rather than three blocks lined up. The grass, the soil
// and the stone each wear a canvas-drawn grain from textures.js, coloured by the band's own
// constant in tuning.js.
//
// The grass top is not one flat plate: each tile carries a grid of voxel columns over its cap, so
// its surface steps in flat-faced blocks where it is free to and stays exactly on TILE_HEIGHT
// everywhere the game stands on it. getSurfaceY reads that height field, so the Caretaker, the
// props and main.js's own spots all walk up and over the steps.
import * as THREE from 'three';
import {
  TILE_SIZE,
  TILE_HEIGHT,
  GRASS_COLOR,
  GRASS_LIP_COLOR,
  DIRT_COLOR,
  ROCK_COLOR,
  GRASS_LAYER,
  DIRT_LAYER,
  GRASS_OVERHANG,
  DIRT_TAPER,
  ROCK_TAPER,
  ROTATE_SMOOTHING,
  SNAP_EASE,
  ISLAND_DRIFT_DEG,
  TILE_LEVEL_STEP,
  TILE_LEVEL_START,
  TILE_LEVEL_MIN,
  TILE_LEVEL_MAX,
  TILE_SLIDE_TIME,
  CAVE_COLOR,
  CAVE_DEPTH,
  CAVE_REVEAL_LEVEL,
  CENTRE_ROCK_DROP,
  FOCUS_RING_COLOR,
  FOCUS_RING_RADIUS,
  POOL_INSET,
  LAUNCH_PAD_INSET,
  PLATFORM_WIDTH,
  PLOT_SIZE,
  TERRAIN_LEVEL,
  TERRAIN_STEP,
  TERRAIN_MAX_UP,
  TERRAIN_SPINE,
  TERRAIN_GRASS_COLOR,
  TERRAIN_ROCK_COLOR,
} from './tuning.js';
import { createGrassTexture, createSoilTexture, createRockTexture } from './textures.js';

const TILE_COUNT = 3;              // tiles in a row along X
const LIP_HEIGHT = 0.05;           // world units of bright grass under the cap, so the overhang reads
const SETTLED = 1e-4;              // radians close enough to stop a snap
const TEXTURE_SPAN = 1;            // world units one repeat of a band's texture covers (see below)

// A band's material: the texture it was given, or the plain colour if there was no canvas to draw
// one on. roughness stays 1 on both, so a textured band and a flat one still light alike.
function bandMaterial(texture, color) {
  return texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
    : new THREE.MeshStandardMaterial({ color, roughness: 1 });
}

// --- Tile heights ---
// Level 1 is where the tiles have always sat, so level 1 is y = 0 and a level is worth one
// TILE_LEVEL_STEP. A slide uses the same frame-rate-independent line as the island's spin, so one
// smoothing number does the whole job: TILE_SLIDE_TIME seconds should leave 1% of the gap.
const SLIDE_EASE = 1 - Math.pow(0.01, 1 / (60 * TILE_SLIDE_TIME));
const SLIDE_SETTLED = 0.005;       // world units close enough to call a slide finished

// --- The island is never quite still ---
// The makers' ISLAND_DRIFT_DEG, converted once from degrees per second. The track is fixed in the
// world now, so nothing would come off the line on its own, and lining the tracks up would be a thing
// the player did once at the start and never again. A slow turn puts it back in their hands: the
// island slips out of line between visits and has to be brought round again.
//
// The drift is added to the island's TARGET angle, not to its angle, which is what keeps it honest.
// The ease below then carries the island after its target at the same smoothing as a player's drag,
// so a drift and a drag are one motion and neither can make the other judder. The lag that costs is
// a fraction of a degree at this rate - the ease closes 99% of any gap in a few tenths of a second,
// while the target moves a fraction of one degree in that time.
//
// It is a constant direction, always the same way round, so the island reads as drifting in a current
// rather than fidgeting. It is never resisted and never accelerates: nothing accumulates, and the
// player's drag is always simply added on top of it.
const DEG = Math.PI / 180;
const DRIFT_PER_SECOND = ISLAND_DRIFT_DEG * DEG;   // radians per second

// --- The cave under a raised tile ---
// island.js builds tiles as solid boxes, so a cave cut into one would simply be swallowed by it -
// the same problem creature.js met with its pool and launch.js with its pad. So the mouth is built
// the other way round: a dark box that sits in the space the tile leaves behind when it rises.
// CAVE_TUCK reaches up inside the tile, which buries the mouth's top face in the tile's own solid
// stone (so no two faces ever tie), leaving a CAVE_DEPTH-tall opening below the underside. The mouth
// is inset from the tile's edges so it reads as an opening torn under the tile - though the stone
// band tapers in further than that (ROCK_TAPER below CAVE_INSET), so the mouth's top sliver sits a
// hair proud of the stone's own sides.
const CAVE_INSET = 0.9;            // cave footprint as a fraction of one tile
const CAVE_TUCK = 0.06;            // how far the mouth's top reaches up inside the tile

// --- The longer root under the centre tile ---
// CENTRE_ROCK_DROP in tuning.js is how far the keel reaches below the tile's own base; these three
// shape it, and they stay here because they are the shape of this one silhouette rather than
// anything the makers retune. The root is a stack of boxes, each one narrower than the one above,
// so it tapers to a torn tip instead of hanging as a slab. ROOT_TUCK does the same job CAVE_TUCK
// does: every face in the stack that could tie against something else - the first step's top against
// the tile's own underside, and each later step's top against the step above it - is pushed up
// inside the solid mass over it, so the taper's shoulders stay crisp and nothing ever z-fights.
const ROOT_STEPS = 3;              // boxes in the stack: enough steps to taper, few enough to stay chunky
const ROOT_TIP_TAPER = 0.5;        // the tip's width as a fraction of the top step's
const ROOT_TUCK = 0.06;            // how far a step's top reaches up inside the solid mass above it

// --- The mark that shows where the player pointed ---
// A small ring, sitting on the grass at the exact spot the last click landed in. It is the whole
// of the pointing feedback: the tile it falls inside is what Q and R will move, so one small mark
// answers both "where am I sending the Caretaker" and "which tile have I got hold of".
const RING_LIFT = 0.02;            // lift off the grass top, so the two faces never tie
const RING_BAND = 0.3;             // band thickness as a fraction of the mark's width: at this size
                                   // a thin band would be lost, so it is thick enough to read
const RING_OPACITY = 0.85;         // it is a highlight, not an object - but it is a small one now

// --- The stepped terrain: a height field over each tile's grass top ---
// The makers wanted the island's surface broken up rather than left as one flat plate, in the same
// voxel, low-poly language as the rest of the block: quantised steps, flat faces, no ramps and no
// textures. So each tile carries a grid of TERRAIN_STEP-wide columns over its grass cap, and every
// column either stays exactly on TILE_HEIGHT or stands a whole number of TERRAIN_LEVELs above it.
// Nothing ever steps below the cap: the grass top is the base the island grows from.
//
// The heights are drawn from a small integer hash of the tile and the column's place in the grid,
// never from Math.random or the clock, so a reload shows exactly the same island. The grid is built
// once, when the island is made, and both the blocks and tileTopAt read it afterwards - so a table
// lookup is all getSurfaceY ever costs, and the shape the eye sees cannot drift from the shape the
// Caretaker stands on.
const TERRAIN_COLS = Math.round(TILE_SIZE / TERRAIN_STEP);   // blocks across a tile: 5 at TILE_SIZE 2.5
const TERRAIN_LAST = TERRAIN_COLS - 1;
const TERRAIN_MID = (TERRAIN_COLS - 1) / 2;   // the grid line through the tile's own centre
// How far a block's base reaches down inside the grass cap. Flush, its own bottom face would tie
// with the cap's top face and the two would flicker; buried, the cap hides it and the step reads as
// one solid piece of ground rather than a slab laid on top.
const TERRAIN_TUCK = 0.04;
// The planting bed's centre out on the left tile's +z side. props.js owns the placement (its own
// PLOT_OFFSET_Z is TILE_SIZE * 0.3) and does not export it; island.js needs it for one thing only,
// keeping the bed's own footing flat, and the two numbers are one number, so they move together.
const PLOT_OFFSET_Z = TILE_SIZE * 0.3;

// A small integer hash: three small integers in, a number in 0..1 out. The multiplies are Math.imul
// so every step stays inside 32 bits and the same three numbers give the same answer on every
// machine and every reload - which is the whole point, because the island's shape is drawn from it.
function terrainHash(a, b, c) {
  let h = Math.imul(a + 7, 374761393) ^ Math.imul(b + 11, 668265263) ^ Math.imul(c + 3, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The regions that stay at exactly TILE_HEIGHT, and the one rule in here that is not negotiable: the
// pool's square, the launch pad's disc, the planting bed's rectangle, the strip along each tile's
// z centre that the Caretaker walks, and the strip the sky-train deck lands on all sit on this
// ground, and getSurfaceY is what every one of them trusts. Everything else on a tile may step.
//
// dx and dz are a column's own centre, in island-local units from the tile's centre. They land on
// block boundaries wherever the region does - the spine is 0.75 either way, one and a half blocks -
// so no flat region ends part-way through a block and no block is half flat.
function terrainIsFlat(tileX, dx, dz) {
  if (Math.abs(dz) <= TILE_SIZE * TERRAIN_SPINE) return true;   // the line the Caretaker walks
  if (tileX === 0) {
    const pool = (TILE_SIZE * POOL_INSET) / 2;                  // the pool's square, on the middle tile
    if (Math.abs(dx) <= pool && Math.abs(dz) <= pool) return true;
  } else if (tileX > 0) {
    // The launch pad's disc, and then the doorway: main.js lays the boarding walk at the dock tile's
    // own +z edge, where the deck's top is level with the grass. A block standing on that strip
    // would put a step in the one walk across that has to be flat, so it stays flat too.
    if (Math.hypot(dx, dz) <= TILE_SIZE * LAUNCH_PAD_INSET * 0.5) return true;
    if (dz > 0 && Math.abs(dx) <= PLATFORM_WIDTH / 2) return true;
  } else {
    const half = PLOT_SIZE / 2;                                 // the planting bed, on the left tile
    if (Math.abs(dx) <= half && Math.abs(dz - PLOT_OFFSET_Z) <= half) return true;
  }
  return false;
}

// One band's profile across a tile: two mounds of terraces, each a peak that steps down a level per
// block either side, with the taller one winning wherever the two overlap. Two mounds instead of one
// is what stops a band reading as a stamped-out pyramid, and where they sit and how tall they are
// come from the tile's own hash - so a tile's two bands differ, and the three tiles of the row
// differ from each other.
function bandUp(tileIndex, band, i) {
  const tall = 2 + Math.floor(terrainHash(tileIndex, band, 1) * 2);    // 2 or 3 levels
  const tallAt = Math.floor(terrainHash(tileIndex, band, 2) * TERRAIN_COLS);
  const low = 1 + Math.floor(terrainHash(tileIndex, band, 3) * 2);     // 1 or 2
  const lowAt = Math.floor(terrainHash(tileIndex, band, 4) * TERRAIN_COLS);
  const up = Math.max(tall - Math.abs(i - tallAt), low - Math.abs(i - lowAt), 0);
  return Math.min(up, TERRAIN_MAX_UP);
}

// The height of one column of one tile's grid, in whole levels above TILE_HEIGHT; zero means flat
// ground, which is the grass cap itself with no block above it at all.
//
// Only the front and back bands of a tile step. The rows between them are the tile's spine - the
// flat strip the pool, the pad, the bed and the Caretaker's walk all sit in - so they are left alone
// for that reason, not because a shape happened to run out there.
function columnUp(tileIndex, tileX, i, j) {
  if (j > 0 && j < TERRAIN_LAST) return 0;
  const dx = (i - TERRAIN_MID) * TERRAIN_STEP;
  const dz = (j - TERRAIN_MID) * TERRAIN_STEP;
  if (terrainIsFlat(tileX, dx, dz)) return 0;
  return bandUp(tileIndex, j === 0 ? 0 : 1, i);
}

export function createIsland(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- The tile's cross-section ---
  // One cut-open block, built as three stacked bands, widest at the top: the living grass cap lips
  // over the warm soil, and the soil tucks in over the grey stone the block was torn out of. The
  // three layer fractions are fractions of TILE_HEIGHT and sum to 1, so the grass top face lands
  // exactly on TILE_HEIGHT - that is the face every other module reads back through getSurfaceY,
  // and the one the pool, the pad, the props and the Caretaker all rest on. It is pinned there by
  // measuring the cap down from the top rather than stacking heights up from the base, so rounding
  // in the fractions can never drag the surface off the number everyone else trusts.
  const rockHeight = TILE_HEIGHT * (1 - GRASS_LAYER - DIRT_LAYER);
  const dirtHeight = TILE_HEIGHT * DIRT_LAYER;
  const grassHeight = TILE_HEIGHT * GRASS_LAYER;
  const grassTop = TILE_HEIGHT;
  const grassBottom = grassTop - grassHeight;

  // --- Texture grain ---
  // One repeat covers TEXTURE_SPAN world units, so the grain is the same physical size on every
  // band. A box hands every one of its faces the same 0..1 range of its texture, so a single repeat
  // count cannot suit all of a band's faces at once. The grass cap is read from above, where the top
  // face is a square, so its two repeats match. The soil and the stone are read from the side, where
  // a face is TILE_SIZE wide but only a fraction of a tile tall - repeating those the same on both
  // axes squashes the grain flat, and a squashed grain reads as horizontal streaks, so their Y
  // repeat is their own share of TILE_HEIGHT and the grain stays the same size in both directions.
  const grassRepeat = (TILE_SIZE * GRASS_OVERHANG) / TEXTURE_SPAN;
  const dirtRepeatX = (TILE_SIZE * DIRT_TAPER) / TEXTURE_SPAN;
  const dirtRepeatY = dirtHeight / TEXTURE_SPAN;
  const rockRepeatX = (TILE_SIZE * ROCK_TAPER) / TEXTURE_SPAN;
  const rockRepeatY = rockHeight / TEXTURE_SPAN;

  const rockGeo = new THREE.BoxGeometry(TILE_SIZE * ROCK_TAPER, rockHeight, TILE_SIZE * ROCK_TAPER);
  const dirtGeo = new THREE.BoxGeometry(TILE_SIZE * DIRT_TAPER, dirtHeight, TILE_SIZE * DIRT_TAPER);
  const grassGeo = new THREE.BoxGeometry(
    TILE_SIZE * GRASS_OVERHANG,
    grassHeight,
    TILE_SIZE * GRASS_OVERHANG
  );
  // The lip: a thin bright slab sharing the cap's footprint, hung directly under the cap's underside
  // so the overhang reads from the side and from below. It laps over the top of the soil band there,
  // and it is the widest thing under the grass, so the eye catches the overhang rather than a seam.
  const lipGeo = new THREE.BoxGeometry(
    TILE_SIZE * GRASS_OVERHANG,
    LIP_HEIGHT,
    TILE_SIZE * GRASS_OVERHANG
  );
  // One texture and one material for each of the three bands, built here and shared by all three
  // tiles: three textures and four materials for the whole island, never one of each per tile. Each
  // texture is drawn from its band's own colour in tuning.js, with that colour baked into the canvas,
  // which is why the material's own color stays white - tinting the map as well would multiply the
  // colour by itself and the band would read as mud, and retuning GRASS_COLOR would then mean
  // retuning two things to get one right.
  const rockTex = createRockTexture(ROCK_COLOR, rockRepeatX, rockRepeatY);
  const dirtTex = createSoilTexture(DIRT_COLOR, dirtRepeatX, dirtRepeatY);
  const grassTex = createGrassTexture(GRASS_COLOR, grassRepeat, grassRepeat);
  const rockMat = bandMaterial(rockTex, ROCK_COLOR);
  const dirtMat = bandMaterial(dirtTex, DIRT_COLOR);
  const grassMat = bandMaterial(grassTex, GRASS_COLOR);
  // The lip stays flat: it is LIP_HEIGHT tall, so a texture there is wasted work and, at that size,
  // would only shimmer as the island turns.
  const lipMat = new THREE.MeshStandardMaterial({ color: GRASS_LIP_COLOR, roughness: 1 });

  // Both caves share one geometry and material. The mouth is unlit: it stands for a hole, and a
  // hole should not pick up the sun or the day/night light - it stays dark either way.
  const caveGeo = new THREE.BoxGeometry(
    TILE_SIZE * CAVE_INSET,
    CAVE_DEPTH,
    TILE_SIZE * CAVE_INSET
  );
  const caveMat = new THREE.MeshBasicMaterial({ color: CAVE_COLOR });

  // --- The stepped terrain's one block ---
  // One box and one material, shared by every column of all three tiles: a unit box scaled to each
  // block's own footprint and height, so there is nothing per-block to build and nothing to throw
  // away. The material carries no map - the request was flat faces, and a grain on a block half a
  // unit across would only shimmer as the island turns.
  //
  // The two colours are painted into the shared geometry's own vertex colours: the cap's green on
  // the top face, the broken stone on the other five faces. That is what makes a step read as a
  // step from the side without a second material or a mesh per face.
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const blockTopColor = new THREE.Color(TERRAIN_GRASS_COLOR);
  const blockSideColor = new THREE.Color(TERRAIN_ROCK_COLOR);
  const blockColors = [];
  // BoxGeometry hands its faces over in this order, four vertices each: +X, -X, +Y, -Y, +Z, -Z.
  for (let face = 0; face < 6; face++) {
    const shade = face === 2 ? blockTopColor : blockSideColor;
    for (let v = 0; v < 4; v++) blockColors.push(shade.r, shade.g, shade.b);
  }
  blockGeo.setAttribute('color', new THREE.Float32BufferAttribute(blockColors, 3));
  const blockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

  // --- The longer root under the centre tile ---
  // One unit box, scaled once per step, is the whole geometry of the root. A box hands every one of
  // its faces the same 0..1 range of its map whatever its size, so a box cut to each step's width
  // and this one box scaled to each step's width wear the rock grain identically: there is nothing
  // to gain from cutting three, and this way the root is one geometry for the whole island. It
  // borrows the rock band's own material, so the root is unmistakably the same stone the tile was
  // broken off at rather than a second grey that nearly matches.
  const rootGeo = new THREE.BoxGeometry(1, 1, 1);

  // The one mark, sitting in island-local space on whichever tile was clicked.
  const focusRing = new THREE.Mesh(
    new THREE.RingGeometry(FOCUS_RING_RADIUS * (1 - RING_BAND), FOCUS_RING_RADIUS, 24),
    new THREE.MeshBasicMaterial({
      color: FOCUS_RING_COLOR,
      transparent: true,
      opacity: RING_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  focusRing.rotation.x = -Math.PI / 2;   // lie the ring flat, like a marker on the grass
  focusRing.visible = false;
  group.add(focusRing);

  // Levels, in island-local world units: level 1 is y = 0, where the tiles have always sat.
  function levelToY(level) {
    return (level - TILE_LEVEL_START) * TILE_LEVEL_STEP;
  }

  // Tiles at x = -1, 0, +1 in tile units, so the middle tile is the pivot.
  // Each public record is plain - { x, z, level, group, hasCave } - so a slide's own state
  // (its target height and whether it is still moving) lives here, keyed by that record.
  const internals = new Map();
  // Each tile's own height field: TERRAIN_COLS * TERRAIN_COLS whole levels, indexed row by row as
  // j * TERRAIN_COLS + i. Kept beside the tiles rather than on the plain public record, the same way
  // a slide's own state is, and read-only once the island is built.
  const terrainGrids = new Map();
  const tiles = [];
  const first = -Math.floor(TILE_COUNT / 2);

  // One tile, built at island-local x and numbered `index` - the number its own ground is hashed
  // from, so no two tiles carry the same hills. The makers' three come out of the loop below; a
  // fourth, bought later, comes out of this same function, which is what keeps a bought tile from
  // being a special case that walks or stands differently from the ones it sits beside.
  function buildTile(x, index) {
    const tileGroup = new THREE.Group();
    tileGroup.position.set(x, levelToY(TILE_LEVEL_START), 0);
    group.add(tileGroup);

    // Bottom up, so each band's underside lands on the face below it: stone sits on the tile
    // group's own origin, the soil rides on the stone, and the cap is measured down from TILE_HEIGHT
    // so its top face is the height every other module expects.
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(0, rockHeight / 2, 0);
    tileGroup.add(rock);

    const dirt = new THREE.Mesh(dirtGeo, dirtMat);
    dirt.position.set(0, rockHeight + dirtHeight / 2, 0);
    tileGroup.add(dirt);

    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.set(0, grassTop - grassHeight / 2, 0);
    tileGroup.add(grass);

    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.position.set(0, grassBottom - LIP_HEIGHT / 2, 0);
    tileGroup.add(lip);

    const hasCave = x !== 0;   // the middle tile carries the pool, so it has no room for a cave
    let cave = null;
    if (hasCave) {
      cave = new THREE.Mesh(caveGeo, caveMat);
      cave.position.set(0, CAVE_TUCK - CAVE_DEPTH / 2, 0);
      cave.visible = TILE_LEVEL_START >= CAVE_REVEAL_LEVEL;
      tileGroup.add(cave);
    }

    // The middle tile's longer root. Only here, because the middle tile is the island's anchor: it
    // carries the pool, the Caretaker starts beside it and the pier hangs off it, so it is the tile
    // the eye reads the island's mass from. The space below it is free - it is the one tile with no
    // cave - so the root can hang straight down the middle of the group's own origin.
    //
    // y = 0 in here is the underside of the rock band, and the root reaches no higher than its own
    // tuck inside that band (ROOT_TUCK against a rock band rockHeight tall), so no band above it
    // moves: the grass top stays exactly TILE_HEIGHT up and getSurfaceY keeps answering what it has
    // always answered. Nothing walks or stands on the root; it is silhouette, not ground.
    if (x === 0) {
      const stepHeight = CENTRE_ROCK_DROP / ROOT_STEPS;
      const baseWidth = TILE_SIZE * ROCK_TAPER;   // flush with the tile's own stone, so the join vanishes
      for (let s = 0; s < ROOT_STEPS; s++) {
        // Step s is (s + 1)/ROOT_STEPS of the way down the taper, so the widths are even and the
        // widest is the one that leaves the tile.
        const width = baseWidth * (1 - (1 - ROOT_TIP_TAPER) * ((s + 1) / ROOT_STEPS));
        const top = ROOT_TUCK - s * stepHeight;   // reaches up inside the mass above, never tying on it
        const bottom = -(s + 1) * stepHeight;     // the last step's bottom is the tip: -CENTRE_ROCK_DROP
        const step = new THREE.Mesh(rootGeo, rockMat);
        step.scale.set(width, top - bottom, width);
        step.position.set(0, (top + bottom) / 2, 0);
        tileGroup.add(step);
      }
    }

    // --- This tile's stepped ground ---
    // The grid is drawn first and the blocks are then cut from that same grid, so what the eye sees
    // and what tileTopAt answers are one shape and cannot drift apart. The blocks hang off the
    // TILE's own group, not the island's: a tile that slides up or down carries its broken ground
    // with it, and every other module keeps reading the group it always read. A column that stands
    // on the flat level gets no block at all - the grass cap is already its top face.
    const grid = new Int8Array(TERRAIN_COLS * TERRAIN_COLS);
    for (let j = 0; j < TERRAIN_COLS; j++) {
      for (let col = 0; col < TERRAIN_COLS; col++) {
        const up = columnUp(index, x, col, j);
        grid[j * TERRAIN_COLS + col] = up;
        if (up === 0) continue;
        const block = new THREE.Mesh(blockGeo, blockMat);
        // The block runs from TERRAIN_TUCK down inside the cap up to its own top, so its top face
        // is exactly `up` levels above TILE_HEIGHT and no gap can read through underneath it.
        block.scale.set(TERRAIN_STEP, up * TERRAIN_LEVEL + TERRAIN_TUCK, TERRAIN_STEP);
        block.position.set(
          (col - TERRAIN_MID) * TERRAIN_STEP,
          TILE_HEIGHT + (up * TERRAIN_LEVEL - TERRAIN_TUCK) / 2,
          (j - TERRAIN_MID) * TERRAIN_STEP
        );
        tileGroup.add(block);
      }
    }

    const tile = { x, z: 0, level: TILE_LEVEL_START, group: tileGroup, hasCave };
    tiles.push(tile);
    internals.set(tile, { targetY: levelToY(TILE_LEVEL_START), moving: false, cave });
    terrainGrids.set(tile, grid);
    return tile;
  }

  for (let i = 0; i < TILE_COUNT; i++) buildTile((first + i) * TILE_SIZE, i);

  let snapping = false;   // private: true while a snapToView is still easing
  let selected = null;    // private: the tile record the mark is following, or null
  // Where the click landed, in island-local x and z. The mark goes here rather than at the tile's
  // own centre: the player pointed at a spot on the ground, and the tile is only what that spot
  // happens to select. Kept as one vector, written in place, because a click is a rare event.
  const markLocal = new THREE.Vector3();
  const settledTiles = []; // private: this frame's finished slides, reused so update allocates nothing

  const scratchLocal = new THREE.Vector3();
  const scratchTop = new THREE.Vector3();

  // A world point, converted into the island group's own space. The group spins, so this is the
  // only honest way to compare a click against tile coordinates. worldToLocal mutates the vector
  // it is handed and returns it, so one scratch vector serves every query.
  function toIslandLocal(worldX, worldZ) {
    group.updateWorldMatrix(true, false);   // use the spin as it is right now, not last frame's
    return group.worldToLocal(scratchLocal.set(worldX, 0, worldZ));
  }

  function findTile(worldX, worldZ) {
    const local = toIslandLocal(worldX, worldZ);
    const half = TILE_SIZE / 2;
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (Math.abs(local.x - tile.x) <= half && Math.abs(local.z - tile.z) <= half) return tile;
    }
    return null;
  }

  // The LOCAL y of the walkable top at a point on a tile - the height the ground is at, measured in
  // the tile's own units. dx and dz are island-local offsets from that tile's centre, the same
  // convention props.js already uses when it sets something down on a tile
  // (tree.position.set(dx, TILE_HEIGHT, dz)). Flat ground answers TILE_HEIGHT; a stepped block
  // answers TILE_HEIGHT plus one TERRAIN_LEVEL per level it stands.
  //
  // This is the one place the height field is read. getSurfaceY calls this very function and only
  // adds the tile group's own lift, so the two agree to the millimetre by construction - and props.js
  // sets decorations down with this, so a tree stands on the same block top the Caretaker walks on.
  // No allocation: the grid was built once and this is an array lookup.
  function tileTopAt(tile, dx, dz) {
    const grid = terrainGrids.get(tile);
    if (!grid) return TILE_HEIGHT;
    let i = Math.floor((dx + TILE_SIZE / 2) / TERRAIN_STEP);
    let j = Math.floor((dz + TILE_SIZE / 2) / TERRAIN_STEP);
    if (i < 0) i = 0; else if (i > TERRAIN_LAST) i = TERRAIN_LAST;
    if (j < 0) j = 0; else if (j > TERRAIN_LAST) j = TERRAIN_LAST;
    return TILE_HEIGHT + grid[j * TERRAIN_COLS + i] * TERRAIN_LEVEL;
  }

  // Move a tile to a new level. The level is the tile's own integer height; the group's y is what
  // eases, and it is still on its way for the next TILE_SLIDE_TIME seconds.
  function setLevel(tile, level) {
    tile.level = level;
    const state = internals.get(tile);
    state.targetY = levelToY(level);
    state.moving = true;
  }

  const island = {
    group,
    angle: 0,
    targetAngle: 0,
    tiles,
    onTileMoved: null,
    // The tiles, left to right. { x, z, level, group, hasCave }: x and z are island-local units
    // and level is the fixed height the tile is heading for, not where it has eased to yet. The
    // stepped ground they carry is read through tileTopAt, never off the record.

    // The walkable top at a point on one of `tiles`, in that tile's own local units: dx and dz are
    // island-local offsets from its centre, and the answer is TILE_HEIGHT on flat ground and higher
    // where a block stands. It is the same answer getSurfaceY gives at that point - the two are one
    // function - and it is what props.js sets things down on.
    tileTopAt,

    rotateBy(deltaRadians) {
      snapping = false;
      island.targetAngle += deltaRadians;
    },

    snapToView(radians) {
      snapping = true;
      island.targetAngle = radians;
    },

    tileAt(worldX, worldZ) {
      return findTile(worldX, worldZ);
    },

    getSurfaceY(worldX, worldZ) {
      const tile = findTile(worldX, worldZ);
      if (!tile) return null;
      // findTile has just left the query point in the shared scratch vector, in island-local units,
      // so the offset from the tile's own centre costs no second transform and no allocation - and
      // the height it feeds is the stepped one, not one flat plate for the whole tile.
      const top = tileTopAt(tile, scratchLocal.x - tile.x, scratchLocal.z - tile.z);
      // The surface sits that far above the tile group's origin, and the tile may be mid-slide, so
      // read its live transform rather than the level it is heading for.
      tile.group.updateWorldMatrix(true, false);
      return scratchTop.set(0, top, 0).applyMatrix4(tile.group.matrixWorld).y;
    },

    selectTileAt(worldX, worldZ) {
      selected = findTile(worldX, worldZ);   // off the island clears the selection
      // The click arrives in world coordinates because that is what a raycast hands back, and the
      // mark has to live in the island's own frame so it stays put while the island turns. The
      // matrix is refreshed first: a click can land between two frames.
      if (selected) {
        group.updateWorldMatrix(true, false);
        group.worldToLocal(markLocal.set(worldX, 0, worldZ));
      }
      return selected;
    },

    getSelected() {
      return selected;
    },

    clearSelection() {
      selected = null;
    },

    setSelectedLevel(level) {
      if (!selected) return null;
      const wanted = Math.min(TILE_LEVEL_MAX, Math.max(TILE_LEVEL_MIN, Math.round(level)));
      if (wanted === selected.level) return null;
      setLevel(selected, wanted);
      return selected;
    },

    raiseSelected() {
      if (!selected || selected.level >= TILE_LEVEL_MAX) return null;
      setLevel(selected, selected.level + 1);
      return selected;
    },

    lowerSelected() {
      if (!selected || selected.level <= TILE_LEVEL_MIN) return null;
      setLevel(selected, selected.level - 1);
      return selected;
    },

    // Buy another tile, and it appears at the island's far end - the end away from the dock, so the
    // platform, the tracks and the one walk across the deck are left exactly as they were. It is the
    // same build as the makers' three, down to the grass, the soil and the cave under it, and the
    // ground it carries is hashed from its own number so it grows its own hills rather than repeating
    // the tile beside it. Returns the new tile, or null if it could not be built.
    addTile() {
      if (!tiles.length) return null;
      return buildTile(tiles[0].x - TILE_SIZE, tiles.length);
    },

    update(dt) {
      // The island's own slow turn, before the ease reads the target. It runs in every state,
      // including the title screen, so the first thing a player sees is an island that is alive.
      island.targetAngle += DRIFT_PER_SECOND * dt;

      const smoothing = snapping ? SNAP_EASE : ROTATE_SMOOTHING;
      island.angle += (island.targetAngle - island.angle) * (1 - Math.pow(1 - smoothing, dt * 60));
      if (snapping && Math.abs(island.targetAngle - island.angle) < SETTLED) {
        island.angle = island.targetAngle;
        snapping = false;
      }
      island.group.rotation.y = island.angle;

      // Tiles ease toward their own height, one smoothing number for all three. A tile that has
      // never been raised or lowered has moving === false, so it can never fire onTileMoved.
      const ease = 1 - Math.pow(1 - SLIDE_EASE, dt * 60);
      let settledCount = 0;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const state = internals.get(tile);

        if (state.moving) {
          const y = tile.group.position.y;
          const next = y + (state.targetY - y) * ease;
          if (Math.abs(state.targetY - next) < SLIDE_SETTLED) {
            tile.group.position.y = state.targetY;
            state.moving = false;
            settledTiles[settledCount++] = tile;
          } else {
            tile.group.position.y = next;
          }
        }

        // The cave is a fixed part of the tile, so showing it is a plain toggle off the level.
        if (state.cave) state.cave.visible = tile.level >= CAVE_REVEAL_LEVEL;
      }

      // The mark rides the selected tile's current height, so it never gets left behind by a
      // slide - and it goes with the selection the moment nothing is selected. Its own height comes
      // from the height field at the spot it marks, not from the flat level: a click that landed on
      // a stepped block would otherwise bury the ring inside it.
      if (selected) {
        focusRing.visible = true;
        const markTop = tileTopAt(selected, markLocal.x - selected.x, markLocal.z - selected.z);
        focusRing.position.set(
          markLocal.x,
          selected.group.position.y + markTop + RING_LIFT,
          markLocal.z
        );
      } else {
        focusRing.visible = false;
      }

      // Only now, with the cave and the ring already up to date for the frame the slide ended,
      // do the callbacks go out. onTileMoved is the caller's to assign, so guard the call.
      for (let i = 0; i < settledCount; i++) {
        if (typeof island.onTileMoved === 'function') island.onTileMoved(settledTiles[i]);
      }
      settledTiles.length = 0;
    },
  };

  return island;
}
