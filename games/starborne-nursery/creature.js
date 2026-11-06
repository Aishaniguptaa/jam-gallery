// The pool set into the island's middle tile, and the creature that may or may not be in it: the
// pool can be left EMPTY, and four kinds of creature can be laid in it, each with hunger, growth
// and four stages.
import * as THREE from 'three';
import {
  POOL_COLOR,
  POOL_RIM_COLOR,
  POOL_INSET,
  POOL_DEPTH,
  CREATURE_BOB,
  CREATURE_BOB_RATE,
  HUNGER_START,
  HUNGER_RATE,
  FEED_AMOUNT,
  GROWTH_HUNGER_MIN,
  GROWTH_TIMES,
  TILE_SIZE,
  TILE_HEIGHT,
} from './tuning.js';

// --- The pool, in island-local coordinates (the middle tile sits at x = 0) ---
// island.js builds every tile as a solid box, so the middle tile's grass top is one
// unbroken face at y = TILE_HEIGHT: a water surface sunk below that face would simply be
// hidden by it. So the pool reads from the other side of the same line - a stone rim
// standing POOL_DEPTH proud of the grass, with the water surface POOL_DEPTH below the
// rim's top. The water sits level with the grass, the recess is the same 0.22, and the
// basin walls are real geometry, so it still looks dug into the tile.
const SURFACE_CLEARANCE = 0.02;               // lift off the grass top, so the two faces never tie
const WATER_Y = TILE_HEIGHT + SURFACE_CLEARANCE;  // the surface, just clear of the grass top
const RIM_TOP_Y = WATER_Y + POOL_DEPTH;       // the lip, one pool depth above the water
const RIM_BOTTOM_Y = WATER_Y - POOL_DEPTH;    // and one pool depth below it
const POOL_WIDTH = TILE_SIZE * POOL_INSET;    // outside edge of the rim
const RIM_WALL = POOL_WIDTH * 0.15;           // thickness of the lip
const POOL_HOLE = POOL_WIDTH - RIM_WALL * 2;  // the opening the water fills
const WATER_SPILL = RIM_WALL * 0.5;           // water tucks under the lip, so there are no seams
const WATER_OPACITY = 0.7;                    // see-through enough to follow a diving minnow

// --- The creature's four stages, smallest first. Every kind is built on these same shapes. ---
const STAGE_NAMES = ['Egg', 'Hatchling', 'Juvenile', 'Adult'];
const STAGE_COLORS = ['#efe7d2', '#cfe0ec', '#b9d9f0', '#9fd2f7'];  // paler to a little brighter
const STAGE_RADII = [0.1, 0.15, 0.21, 0.28];
const FIN_TILT = 0.22;                        // radians the side fins droop

const FULL = 0.999;                           // hunger at or above this refuses food
const MAX_STAGE = STAGE_NAMES.length - 1;     // 3: Adult

// --- The kinds of creature a maker can raise ---
// The shop, the coins and the prices live in ui.js and main.js; this list is only what a kind IS: a
// name a maker would say out loud, the one line that sits beside it in the shop row, and the colours
// that tell it apart. Body and fins are one colour per growth stage, in the same order as
// STAGE_NAMES, because a kind has to show at every stage and not only once it has grown.
//
// The first entry is the Cloud minnow the game has always had, and its colours are exactly the ones
// already on the meshes: STAGE_COLORS above for body and fins alike (they used to share one
// material), and tuning's own POOL_COLOR for the water. Its shape is untouched too. The three after
// it are not cousins in shape any more: each has its own silhouette, built in this file from the
// same low-poly primitives and the same four stages - the Duskfin tall with one big dorsal sail, the
// Emberfin round and short with a cone for a tail, and the whale long and blunt-headed with a wide
// fluke. The whale is also the same stages wearing a `scale`, because the makers asked for the one
// you unlock last to be the biggest thing in the pool at every stage, not only once it has grown.
export const CREATURE_KINDS = [
  {
    id: 'cloudminnow',
    name: 'Cloud Minnow',
    blurb: 'The small pale drift the nursery started with.',
    body: STAGE_COLORS,
    fins: STAGE_COLORS,   // this one's fins have always been its body's own colour
    water: POOL_COLOR,    // and its pool is the pool: tuning's number, not a second copy of it
  },
  {
    id: 'duskfin',
    name: 'Duskfin',
    blurb: 'A violet cousin that keeps the evening in its fins.',
    body: ['#ded4ef', '#b6a6dd', '#8f77c9', '#6d54ab'],
    fins: ['#c9bce6', '#a48fd1', '#7d63b8', '#5a419b'],
    water: '#4b4f96',
  },
  {
    id: 'emberfin',
    name: 'Emberfin',
    blurb: 'A warm cousin that carries a little sunset in the pool.',
    body: ['#f7e3ce', '#f2c39a', '#e79b66', '#d4743f'],
    fins: ['#ecccaa', '#e3ab7d', '#d1824e', '#b95c2c'],
    water: '#3f8f8c',
  },
  // The last kind to unlock, and the largest thing in the pool at every stage. Scale is its own
  // optional knob and it is the only kind that carries one: the other three leave it out and so
  // keep the size they have always had, to the last vertex. Its blues run from a pale sky slate at
  // the egg down to deep water at the adult, and it is the calmest read of the four - one solid
  // mass, fewer edges, nothing bright on it.
  {
    id: 'whalekin',
    name: 'Sky Whale',
    blurb: 'A deep cousin, lit from underneath and in no hurry at all.',
    body: ['#cbdbe9', '#8fb0cd', '#4f7799', '#2c4664'],
    fins: ['#b2c7db', '#6d93b4', '#3c5f7f', '#1e3349'],
    water: '#2c4863',
    scale: 1.5,
  },
];

// What a pool wears before anyone chooses anything, and where a missing or unknown id lands.
const DEFAULT_KIND = CREATURE_KINDS[0];

// An id in, a kind out, always something usable: the shop and the save-less state in main.js hand
// this whatever they have, and a typo should leave a cloud minnow rather than nothing at all.
function resolveKind(kindId) {
  return CREATURE_KINDS.find((kind) => kind.id === kindId) || DEFAULT_KIND;
}

// One flat box per wall: two long sides facing +/-x, two short ends between them.
function createRim() {
  const rim = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: POOL_RIM_COLOR, roughness: 1 });
  const height = RIM_TOP_Y - RIM_BOTTOM_Y;
  const y = (RIM_TOP_Y + RIM_BOTTOM_Y) / 2;
  const offset = (POOL_WIDTH - RIM_WALL) / 2;
  const sideGeo = new THREE.BoxGeometry(POOL_WIDTH, height, RIM_WALL);
  const endGeo = new THREE.BoxGeometry(RIM_WALL, height, POOL_HOLE);

  [1, -1].forEach((sign) => {
    const side = new THREE.Mesh(sideGeo, material);
    side.position.set(0, y, sign * offset);
    rim.add(side);

    const end = new THREE.Mesh(endGeo, material);
    end.position.set(sign * offset, y, 0);
    rim.add(end);
  });

  return rim;
}

// The water: one slab whose top face is the surface and whose sides hide inside the rim. The mesh
// itself comes back out, because a change of kind recolours the pool as well as the creature.
function createWater() {
  const size = POOL_HOLE + WATER_SPILL * 2;
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(size, POOL_DEPTH, size),
    new THREE.MeshStandardMaterial({
      color: POOL_COLOR,
      roughness: 0.3,
      transparent: true,
      opacity: WATER_OPACITY,
    })
  );
  water.position.set(0, WATER_Y - POOL_DEPTH / 2, 0);
  return water;
}

// --- Geometry and materials, made once and shared ---------------------------------------------
// Four kinds times four stages is sixteen small models built at startup, and they all come from the
// same four primitives at a handful of sizes: one buffer and one material per size/colour, handed
// round, rather than sixteen private copies of everything.
const geoCache = new Map();

function cachedGeometry(key, build) {
  let geometry = geoCache.get(key);
  if (!geometry) {
    geometry = build();
    geoCache.set(key, geometry);
  }
  return geometry;
}

const materialCache = new Map();

// One lit, double-sided material per colour. Nothing recolours a material in place any more - a
// kind's colours are fixed when its models are built - so a colour can safely be shared, and a kind
// that uses the same colour for body and fins (the Cloud minnow, exactly as before) shares one.
function litMaterial(color) {
  let material = materialCache.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide });
    materialCache.set(color, material);
  }
  return material;
}

// A fin: a thin plane, double-sided so it never blinks out when the island turns.
function createFin(width, height, material) {
  return new THREE.Mesh(
    cachedGeometry(`plane:${width.toFixed(4)}:${height.toFixed(4)}`, () => new THREE.PlaneGeometry(width, height)),
    material
  );
}

// The soft body every kind starts from: one squashed sphere. The squash is the kind's own, so a
// taller fish and a longer whale are the same primitive read two ways.
function addBody(group, radius, sx, sy, sz, material) {
  const body = new THREE.Mesh(
    cachedGeometry(`sphere:${radius.toFixed(4)}`, () => new THREE.SphereGeometry(radius, 16, 12)),
    material
  );
  body.scale.set(sx, sy, sz);
  group.add(body);
  return body;
}

// A pair of pectoral fins, at a kind's own height, reach and droop.
function addPectorals(group, radius, width, height, out, up, tilt, material) {
  [1, -1].forEach((sign) => {
    const fin = createFin(radius * width, radius * height, material);
    fin.position.set(sign * radius * out, radius * up, 0);
    fin.rotation.y = Math.PI / 2;
    fin.rotation.z = sign * tilt;
    group.add(fin);
  });
}

// --- One silhouette per kind -------------------------------------------------------------------
// Each builder lays one stage of one kind into a group, using STAGE_RADII as its scale - so a
// juvenile is still smaller than an adult, and an egg is still the same egg for everyone: the four
// kinds share a stage and a size, never a shape. The colours handed in are the kind's own pair for
// that stage, so even the egg shows which cousin is in the pool.
//
// The Cloud minnow is the makers' first creature, and it is built here to the vertex it always was:
// soft round drift, two small side fins once it hatches, a dorsal and a flat tail once it is grown.
function buildCloudMinnow(stage, radius, bodyMaterial, finMaterial, group) {
  addBody(group, radius, 1, 0.85, 1.2, bodyMaterial);

  if (stage >= 1) {
    addPectorals(group, radius, 1.1, 0.7, 0.9, 0, FIN_TILT, finMaterial);
  }

  if (stage >= MAX_STAGE) {
    const dorsal = createFin(radius * 1.1, radius * 0.9, finMaterial);
    dorsal.position.set(0, radius * 0.7, 0);
    dorsal.rotation.y = Math.PI / 2;
    group.add(dorsal);

    const tail = createFin(radius, radius * 1.1, finMaterial);
    tail.position.set(0, 0, -radius * 1.3);
    group.add(tail);
  }
}

// The Duskfin: a tall, deep body that hangs rather than darts, and one big dorsal fin from the
// moment it hatches - a low ridge as a juvenile, a full sail with a fan tail by the time it is
// grown.
function buildDuskfin(stage, radius, bodyMaterial, finMaterial, group) {
  addBody(group, radius, 0.85, 1.2, 1.3, bodyMaterial);

  if (stage >= 1) {
    addPectorals(group, radius, 0.85, 0.55, 0.75, -0.25, FIN_TILT * 1.6, finMaterial);

    const grown = stage >= MAX_STAGE;
    const dorsal = createFin(radius * 0.85, radius * (grown ? 2 : 1.3), finMaterial);
    dorsal.position.set(0, radius * (grown ? 1.15 : 1), 0);
    dorsal.rotation.y = Math.PI / 2;
    group.add(dorsal);
  }

  if (stage >= MAX_STAGE) {
    const tail = createFin(radius * 0.9, radius * 0.9, finMaterial);
    tail.position.set(0, 0, -radius * 1.5);
    group.add(tail);
  }
}

// The Emberfin: short, round and already moving, with a solid cone for a tail where the others wear
// a flat fin - the one silhouette of the four whose tail is a lump rather than a blade.
function buildEmberfin(stage, radius, bodyMaterial, finMaterial, group) {
  addBody(group, radius, 1.05, 1, 0.8, bodyMaterial);

  if (stage >= 1) {
    addPectorals(group, radius, 0.8, 0.6, 0.8, -0.1, FIN_TILT * 2, finMaterial);

    const grown = stage >= MAX_STAGE;
    const wide = radius * (grown ? 0.85 : 0.55);
    const long = radius * (grown ? 0.9 : 0.6);
    const tail = new THREE.Mesh(
      cachedGeometry(`cone:${wide.toFixed(4)}:${long.toFixed(4)}`, () => new THREE.ConeGeometry(wide, long, 8)),
      finMaterial
    );
    tail.rotation.x = -Math.PI / 2;   // the tip points back, out of the stubby body
    tail.position.set(0, 0, -radius * 0.9);
    group.add(tail);
  }

  if (stage >= MAX_STAGE) {
    const dorsal = createFin(radius * 0.7, radius * 0.6, finMaterial);
    dorsal.position.set(0, radius * 0.85, 0);
    dorsal.rotation.y = Math.PI / 2;
    group.add(dorsal);
  }
}

// The Sky Whale: the long broad mass the makers asked to stay huge (its own scale is written on the
// group below), a blunt box of a head carried out in front, and two flat blades where a fish would
// wear a vertical tail fin. Fewest edges of the four, and nothing bright on it.
function buildWhale(stage, radius, bodyMaterial, finMaterial, group) {
  addBody(group, radius, 1.2, 0.95, 1.45, bodyMaterial);

  if (stage >= 1) {
    const head = new THREE.Mesh(
      cachedGeometry(
        `box:${(radius * 1.9).toFixed(4)}:${(radius * 0.95).toFixed(4)}:${(radius * 0.8).toFixed(4)}`,
        () => new THREE.BoxGeometry(radius * 1.9, radius * 0.95, radius * 0.8)
      ),
      bodyMaterial
    );
    head.position.set(0, 0, radius * 1.05);
    group.add(head);

    addPectorals(group, radius, 1.3, 0.6, 0.85, -0.3, FIN_TILT, finMaterial);

    [1, -1].forEach((sign) => {
      const fluke = createFin(radius * 1.2, radius * 0.6, finMaterial);
      fluke.position.set(sign * radius * 0.55, 0, -radius * 1.5);
      fluke.rotation.x = Math.PI / 2;   // laid flat, so the tail reads as a fluke and not a fin
      fluke.rotation.z = sign * 0.3;    // and swept, so the pair fans out wide
      group.add(fluke);
    });
  }

  if (stage >= MAX_STAGE) {
    const dorsal = createFin(radius * 0.5, radius * 0.5, finMaterial);
    dorsal.position.set(0, radius * 0.7, -radius * 0.5);
    dorsal.rotation.y = Math.PI / 2;
    group.add(dorsal);
  }
}

// Which builder draws which kind. A kind added later without one falls back to the Cloud minnow's
// shape in its own colours, rather than arriving as nothing at all.
const SHAPES = {
  cloudminnow: buildCloudMinnow,
  duskfin: buildDuskfin,
  emberfin: buildEmberfin,
  whalekin: buildWhale,
};

// One kind's model for one stage, built once at startup and toggled with visible. The group carries
// the kind's own colours (its body colour and its fin colour for this stage) and the kind's own
// optional scale - written here, on the finished group, so one scale still grows the built meshes
// together and keeps every fin where the body put it, and a kind without the field lands on 1.
function createStage(kindIndex, stageIndex) {
  const kind = CREATURE_KINDS[kindIndex];
  const group = new THREE.Group();

  (SHAPES[kind.id] || buildCloudMinnow)(
    stageIndex,
    STAGE_RADII[stageIndex],
    litMaterial(kind.body[stageIndex]),
    litMaterial(kind.fins[stageIndex]),
    group
  );

  group.scale.setScalar(kind.scale || 1);
  group.visible = false;
  return group;
}

export function createCreature(scene, island) {
  // scene is part of every factory's signature here, but the pool and the minnow hang off
  // island.group instead, so the island's spin carries them for free. Nothing in this file
  // touches island.angle or island.group.rotation.y: island.js owns both of those.
  const group = new THREE.Group();
  island.group.add(group);

  // The middle tile can be raised and lowered now, so the pool has to ride it. Look the tile up
  // by its local x rather than by index, so a reordered island can never silently move the pool.
  const poolTile = island.tiles ? island.tiles.find((t) => t.x === 0) : null;

  group.add(createRim());
  const water = createWater();
  group.add(water);

  // The creature sits in the water over the middle tile. body is the piece the bob moves, and it is
  // also the piece an empty pool hides: the rim and the water above are never touched by that.
  const body = new THREE.Group();
  body.position.set(0, WATER_Y, 0);
  group.add(body);

  // One group per stage, per kind: sixteen small models built once at startup, each already wearing
  // its own kind's colours and scale. Only the kind being worn, at the stage it is at, is visible -
  // everything else costs a bit of memory and nothing per frame.
  const kindGroups = CREATURE_KINDS.map((unusedKind, kindIndex) =>
    STAGE_NAMES.map((unusedStage, stageIndex) => {
      const stageGroup = createStage(kindIndex, stageIndex);
      body.add(stageGroup);
      return stageGroup;
    })
  );

  // State.
  let hunger = HUNGER_START;
  let stage = 0;
  let growth = 0;      // seconds banked in the current stage
  let bobTime = 0;     // this file's own seconds counter, for the bob
  let kind = DEFAULT_KIND;    // which of CREATURE_KINDS this pool is wearing
  let kindIndex = 0;          // and where that kind sits in CREATURE_KINDS, for the stage groups
  let eggPresent = true;      // the game still starts with an egg in the pool

  // The one visible model: this kind, at this stage. One pass over sixteen groups, on a stage change
  // or a change of kind, rather than per frame.
  function showStage() {
    kindGroups.forEach((stages, k) => {
      stages.forEach((stageGroup, index) => {
        stageGroup.visible = k === kindIndex && index === stage;
      });
    });
  }

  // Wear a kind: the pool water changes colour and the creature swaps to that kind's models. The
  // models themselves are not rebuilt or recoloured - each kind's shapes and per-stage colours were
  // fixed when they were built - so this is one colour and one visibility pass, safe to call on an
  // empty pool (the water still changes colour).
  function applyKind(nextKind) {
    kind = nextKind;
    kindIndex = CREATURE_KINDS.indexOf(kind);   // resolveKind guarantees a real entry, so never -1
    water.material.color.set(kind.water);
    showStage();
  }

  // A missing or unknown id falls back to the Cloud minnow, the same way layEgg does, so the two
  // ways of choosing a kind can never disagree about what happens on a bad id.
  function setKind(kindId) {
    applyKind(resolveKind(kindId));
    return kind.id;
  }

  function getKind() {
    return kind.id;
  }

  // The one place a stage is entered. Ordinary growth and a bought hurry both come through here,
  // because the stage counter, the cleared progress and the mesh swap have to move together: if
  // they drifted apart the creature would sit at a new stage still wearing the old model.
  function advanceStage() {
    stage += 1;
    growth = 0;
    showStage();
  }

  function update(dt) {
    // Ride the tile first: when the middle tile is raised or lowered, the pool goes up with it. An
    // empty pool is still a pool, so this happens whether or not there is a creature in it.
    if (poolTile) group.position.y = poolTile.group.position.y;

    // An empty pool has nothing to grow, nothing to get hungry and nothing to bob. One early return
    // rather than a check on every line below, so an empty pool cannot leak state by a frame.
    if (!eggPresent) return;

    bobTime += dt;

    hunger = Math.max(0, hunger - HUNGER_RATE * dt);

    // Growth only while the creature is fed; each stage takes GROWTH_TIMES[stage] seconds.
    if (stage < MAX_STAGE && hunger > GROWTH_HUNGER_MIN) {
      growth += dt;
      if (growth >= GROWTH_TIMES[stage]) advanceStage();
    }

    body.position.y = WATER_Y + Math.sin(bobTime * CREATURE_BOB_RATE) * CREATURE_BOB;
  }

  // Back to a fresh egg: stage 0, hunger full, and in the pool. A release finishing gets here, and
  // so does a bought egg - both mean "there is a new creature here now". It also brings an empty
  // pool back, which is what main.js means by it today: reset always leaves something to raise.
  function reset() {
    eggPresent = true;
    body.visible = true;
    hunger = HUNGER_START;
    stage = 0;
    growth = 0;
    bobTime = 0;
    showStage();
    body.position.y = WATER_Y;
  }

  // The pool with nothing in it: the creature is not drawn, and update() stops touching its state.
  // The rim and the water stay exactly as they are - an empty pool is a state, not a dismantling.
  // Hunger reads 0 rather than a stale half-full number, so every dial on an empty pool says empty.
  function clearEgg() {
    eggPresent = false;
    body.visible = false;
    hunger = 0;
    stage = 0;
    growth = 0;
  }

  function hasEgg() {
    return eggPresent;
  }

  // A bought egg arrives. The kind is worn straight away, then reset() gives the same fresh start a
  // new run gets, so a bought Cloud minnow and the one the game opens with behave identically.
  function layEgg(kindId) {
    setKind(kindId);
    reset();
    return kind.id;
  }

  function feed() {
    if (!eggPresent) return false;   // there is nothing in the pool to feed
    if (hunger >= FULL) return false;
    hunger = Math.min(1, hunger + FEED_AMOUNT);
    return true;
  }

  // A bought hurry: seconds of growth pushed straight into the current stage. Growth is normally
  // earned by eating, so update() gates it on GROWTH_HUNGER_MIN; starlight is not food, so this has
  // deliberately no hunger check and lands on an empty creature. One hurry can carry through more
  // than one stage, so it walks the same advance path update() uses, paying each stage in turn and
  // handing the remainder on. Returns the stage it ends on.
  function haste(seconds) {
    if (!eggPresent) return stage;   // an empty pool has no grower to hurry: nothing to change
    if (stage >= MAX_STAGE) return stage;   // already an adult: there is nothing left to hurry

    // NaN, Infinity, zero and negatives are not a real hurry, so they leave the creature untouched.
    if (!Number.isFinite(seconds) || seconds <= 0) return stage;

    let remaining = seconds;
    while (stage < MAX_STAGE) {
      // Seconds this stage still owes. update() keeps growth below the threshold between frames, so
      // this is positive in practice; the max() only stops a stray value from paying the hurry back.
      const owed = Math.max(0, GROWTH_TIMES[stage] - growth);
      if (remaining < owed) break;
      remaining -= owed;
      advanceStage();   // clears growth, so the next stage starts from nothing
    }

    // Leftover time banks into whatever stage the hurry stopped in. At MAX_STAGE there is no next
    // stage to bank toward, so the remainder is dropped instead of being stranded anywhere.
    if (stage < MAX_STAGE) growth += remaining;
    return stage;
  }

  function getHunger() {
    return eggPresent ? hunger : 0;   // an empty pool is not half fed, it is unfed
  }

  function getStage() {
    return stage;
  }

  function getStageName() {
    // The display name of the state, which for an empty pool is the empty pool: the heads-up meter
    // reads "Empty" rather than an "Egg" that is not there.
    return eggPresent ? STAGE_NAMES[stage] : 'Empty';
  }

  function isGrown() {
    return eggPresent && stage === MAX_STAGE;
  }

  showStage();
  applyKind(DEFAULT_KIND);   // start in the Cloud minnow's own colours, the ones already on the meshes

  return {
    group,
    update,
    reset,
    feed,
    getHunger,
    getStage,
    getStageName,
    isGrown,
    haste,
    // The empty pool, and the kinds a pool can wear.
    hasEgg,
    clearEgg,
    layEgg,
    setKind,
    getKind,
  };
}
