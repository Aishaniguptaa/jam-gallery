// Dresses the island's tiles with pines, bushes, flowers, mushrooms and stones, sways the pines in
// the wind, plants the decorations the coins buy wherever the Caretaker is standing, and keeps the
// crop beds: a seed in, a crop out GROW_TIME later, every bed with its own live world position for
// the Caretaker to stand beside. The shop sells more crop beds and a decorative pool or two, each
// one going down on the next free spot of a short fixed list of flat ground. The scatter is laid
// out by a seeded PRNG, so the garden is identical on every launch; only the planting moves, and it
// moves with the player.
import * as THREE from 'three';
import {
  TILE_SIZE,
  TILE_HEIGHT,
  POOL_INSET,
  LAUNCH_PAD_INSET,
  PLATFORM_WIDTH,
  PROP_TRUNK_COLOR,
  PROP_TREE_COLORS,
  PROP_CANOPY_LAYERS,
  PROP_TREE_HEIGHT,
  PROP_TREE_RADIUS,
  PROP_BUSH_COLOR,
  PROP_STONE_COLOR,
  PROP_MUSHROOM_CAP,
  PROP_MUSHROOM_STEM,
  PROP_FLOWERS,
  PROP_PER_TILE,
  PROP_SEED,
  PROP_EDGE_MARGIN,
  GROW_TIME,
  PLOT_SIZE,
  PLOT_SOIL_COLOR,
  PLOT_FRAME_COLOR,
  PLOT_SPROUT_COLOR,
  PLOT_RIPE_COLOR,
  POOL_COLOR,
  POOL_RIM_COLOR,
} from './tuning.js';

const FULL_TURN = Math.PI * 2;
const TILE_HALF = TILE_SIZE / 2;
const OFFSET_LIMIT = TILE_HALF * PROP_EDGE_MARGIN;      // 0.78: no prop centre sits nearer an edge

// --- How far a prop must stay from its tile's centre, where the fixtures are ---
// The card asks for roughly half a tile of clear centre, but half a tile is 1.0 while PROP_EDGE_MARGIN
// already holds every prop centre inside 0.78 - a keep-out that size would rule out every pine and
// bush, so it has to be read as "clear of the things standing there". The widest of those is the pool
// rim at 0.62, and a prop clear of the rim is clear of the pad and the tile's middle too.
const POOL_CLEAR = (TILE_SIZE * POOL_INSET) / 2;        // 0.62: the pool rim, a square footprint
const PAD_CLEAR = TILE_SIZE * LAUNCH_PAD_INSET * 0.5;   // 0.5: the launch pad, a disc
const CENTRE_CLEAR = TILE_SIZE * 0.3;                   // 0.6: the left tile's middle is left open
const LARGE_CLEAR = POOL_CLEAR;                         // the keep-out a pine or a bush also keeps

// --- Prop sizes. The tree's come from the card; the small things around it are this file's own
// numbers, because the card names no size for them. World units throughout. ---
const PINE_TRUNK_SHARE = 0.22;   // of the tree's height: the bare trunk under the lowest cone
const PINE_CANOPY_DROP = 0.7;    // the lowest cone starts this far down the trunk, so there is no gap
const PINE_CONE_SHARE = 0.62;    // of the canopy's span: one cone's height, so the layers overlap
const PINE_TAPER = 0.3;          // of PROP_TREE_RADIUS: how much narrower each layer above the last
const PROP_VARY_MIN = 0.85;      // a prop wanders between these shares of its size, so no two match
const PROP_VARY_SPAN = 0.3;
const BUSH_RADIUS = 0.16;        // of the largest blob in a clump
const BUSH_SQUASH = 0.72;        // how flat the blobs sit
const BUSH_BLOB_SHARE = 0.8;     // the extra blobs, against the first
const BUSH_BLOB_SPREAD = 1.2;    // how far the extras wander, in radii of the first
const BUSH_BLOBS_MIN = 2;        // two or three blobs, no more: it has to read as one clump
const FLOWER_STEM_HEIGHT = 0.18;
const FLOWER_STEM_RADIUS = 0.014;
const FLOWER_HEAD_SIZE = 0.065;
const FLOWER_HEAD_SQUASH = 0.62;
const MUSHROOM_HEIGHT = 0.11;
const MUSHROOM_STEM_RADIUS = 0.03;
const MUSHROOM_CAP_SIZE = 0.085;
const MUSHROOM_CAP_SQUASH = 0.62;
const STONE_SIZE = 0.13;
const STONE_FLAT = 0.78;         // squashed a little, so it sits on the grass rather than balances
const STONE_SEAT = 0.45;         // of its size: how far its centre rides above the grass, so it beds in

// --- The scatter ---
const PROP_GAP = 0.06;           // clear grass left between two small props' footprints
const PINE_GAP = 0.45;           // the wider berth a pine wants, so two canopies never merge
const CANDIDATE_STEPS = 9;       // candidate positions sampled per axis, before anything is filtered
const CANDIDATE_JITTER = 0.6;    // of one grid step: so the scatter never reads as a grid
const GAP_RELAX = [1, 0.5, 0];   // of a prop's gap: how hard it tries before the slot is left empty
const PINE_BAND_INNER = 0.42;    // pines only sample the outer strip, for a treeline along the rim
const PINE_MIN = 2;              // the card's two or three pines on each outer tile
const PINE_EXTRA_DRAW = 2;

// A pine's footprint is only its trunk; its canopy is high above the grass and is allowed to overhang.
const PINE_FOOT = 0.1;
const BUSH_FOOT = 0.24;
const STONE_FOOT = 0.13;
const MUSHROOM_FOOT = 0.09;
const FLOWER_FOOT = 0.06;

// --- The sway. A gale bends the pines hardest and a calm day still breathes, so the amplitude runs
// from SWAY_CALM_SHARE to the whole of SWAY_MAX as the wind goes 0 to 1. ---
const SWAY_MAX = 0.085;          // radians at a full gale: enough to bend a pine, not to fell one
const SWAY_RATE = 0.9;           // radians per second of the sway cycle
const SWAY_CALM_SHARE = 0.25;    // the card's 0.25 + 0.75 * wind, split into its two halves here
const SWAY_WIND_SHARE = 0.75;
const SWAY_CROSS = 0.45;         // a second, slower wave on the other axis, so a gale bends both ways
const SWAY_CROSS_RATE = 0.7;

// --- Decorations: what the coins buy. Eight at most, anywhere on the island, each one planted
// exactly where the Caretaker stands when the key is pressed - the verb the game already has, so
// there is no placement mode, no cursor and no shop. A decoration is a child of the tile it lands
// on, so raising or lowering that tile carries it along, and its height is the tile's own walkable
// top where it stands - seatY's answer, up from the tile group's origin, exactly where the scatter
// is seated.
//
// The sizes below are this file's own: tuning.js is not this file's to add to, so anything it does
// not carry is named here and reported to the makers.
const DECOR_CAP = 8;             // full at eight: two rounds of the three kinds, and eight at
                                 // DECOR_MIN_GAP apart fill the island without crowding it
const DECOR_MIN_GAP = TILE_SIZE * 0.25;   // 0.5: a quarter of a tile between two decoration centres
const DECOR_NUDGE_RINGS = 8;     // how far the search for a clear spot walks out: 8 * 0.07 = 0.56,
                                 // just past DECOR_MIN_GAP, so a spot with a neighbour standing on it
                                 // still has somewhere of its own to go before any of this is refused
const DECOR_NUDGE_STEPS = 16;    // spots tried on each ring: sixteen points of the compass
const DECOR_NUDGE_STEP = 0.07;   // how far apart the rings are: fine enough not to step over a gap
const DECOR_FAN_STEP = 2.399963; // the golden angle: each plant turns its own search by this, so two
                                 // presses in one place fan out instead of landing on top of each other
const DECOR_TURN_STEP = 0.9;     // radians each plant turns by, so no two face the same way
const DECOR_SCALES = [1, 1.06, 0.94, 1.1, 0.97];   // five sizes, and five is coprime with the
                                 // three kinds, so a kind never comes back at the size it left
const DECOR_DECK_KEEP = 0.4;     // of grass in front of the platform's doorway, left clear

// How far each kind reaches out over the ground: its own footprint, and the radius every clearance
// keeps - the island's rim, so nothing overhangs the drop, and the scatter, so nothing lands in a pine.
const CAIRN_FOOT = 0.16;
const CORAL_FOOT = 0.24;
const LANTERN_FOOT = 0.12;

// One warm accent and one lit thing. Everything else is the stone and timber the rest of the island
// is built from, and every other material is a shaded MeshStandardMaterial at roughness 1.
const CORAL_COLOR = '#ef8172';        // coral pink: the accent the night palette asks for
const LANTERN_GLOW_COLOR = '#ffdf9e'; // gold starlight, on the one MeshBasicMaterial in the file

// --- A cairn: stones stacked one on another, tapering ---
const CAIRN_STONES = 3;          // plus a fourth on every other cairn, so the stacks are not a row
const CAIRN_SPARE = 2;
const CAIRN_RADIUS = 0.125;      // the bottom stone's radius, so a stack stands about a knee high
const CAIRN_TAPER = 0.76;        // each stone above is this share of the one under it
const CAIRN_FLAT = 0.6;          // squashed like the scatter's stones, so it stacks instead of rocks
const CAIRN_WOBBLE = 0.018;      // how far off centre a stone sits, so the stack looks hand-built

// --- A coral fan: two flat fans crossed, so the cluster has a shape from every angle ---
const CORAL_FANS = 2;
const CORAL_BLADES = 3;          // blades in one fan, the middle one the longest
const CORAL_SPREAD = 0.42;       // radians the outer blades lean off the middle one
const CORAL_LENGTH = 0.2;        // the middle blade of the first fan, and so the cluster's whole
                                 // height: at the top DECOR_SCALES that reaches 0.22 from the middle,
                                 // which is what CORAL_FOOT keeps clear of its neighbours
const CORAL_SHRINK = 0.8;        // the second fan, against the first
const CORAL_WIDTH = 0.055;       // how broad one blade is
const CORAL_THICK = 0.022;       // how deep it is, so a fan has an edge rather than a line
const CORAL_TURN = 1.15;         // radians between the two fans
const CORAL_STONE = 0.1;         // the stone the cluster grows out of

// --- A lantern post: a stone foot, a timber post, a glowing head and a small stone cap over it ---
const LANTERN_STONE = 0.105;     // the stone it stands on
const LANTERN_POST = 0.42;       // how tall the post is, up to the underside of the light
const LANTERN_POST_WIDTH = 0.028;
const LANTERN_HEAD = 0.085;      // the glowing orb's radius
const LANTERN_CAP = 0.075;       // the little stone roof over it

// --- The planting bed: a slab of turned earth on the left tile, two rows of three sprouts in it ---
// It is the island's own slow way of making food: a seed in, GROW_TIME seconds of growing, and a
// crop to pick that is a feed for the minnow. GROW_TIME, PLOT_SIZE and the four colours are the
// makers' and come from tuning.js; everything below is how the bed is built, named here for the same
// reason the decorations' own sizes are - tuning.js is not this file's to add to.
const PLOT_OFFSET_Z = TILE_SIZE * 0.3;   // 0.6: the bed's centre, out on its tile's +z side, clear
                                         // of the tile's middle where the Caretaker starts
const PLOT_SLAB_DEPTH = 0.09;            // how thick the slab of earth is
const PLOT_SLAB_SINK = 0.03;             // seated this far into the grass, so no seam shows under it
const PLOT_SOIL_TOP = PLOT_SLAB_DEPTH - PLOT_SLAB_SINK;   // 0.06: the soil's face a crop roots in
const PLOT_RAIL_HEIGHT = 0.08;           // the timber edge stands proud of the soil, not level with it
const PLOT_RAIL_THICK = 0.05;            // how thick a rail is: thin, so the soil still reads
const PLOT_PLANT_ROWS = 2;               // the makers' "two rows"
const PLOT_PLANT_COLS = 3;               // of three, which is six plants and six meshes in all
const PLOT_PLANT_HEIGHT = 0.24;          // a full-grown crop: about a knee on the Caretaker
const PLOT_PLANT_WIDTH = 0.07;           // how broad one plant is where it leaves the soil
const PLOT_ROW_GAP = 0.26;               // between the two rows, inside the rails
const PLOT_COL_GAP = 0.24;               // and along a row, so the crop reads as planted, not dumped

// The bed's three states, as the strings main.js asks state() for. Written once here, so a typo
// cannot turn one of them into a state nothing ever leaves.
const PLOT_EMPTY = 'empty';
const PLOT_GROWING = 'growing';
const PLOT_RIPE = 'ripe';

// --- One bed size, for the bed that came with the island and for the ones the shop sells ---
// The makers asked for the two to be the same size, and a little smaller than the 1.125 the island's
// own bed used to be, so more of the island's flat ground can take one.
//
// 0.80 across is that size, and it is measured rather than guessed: the island's own height field was
// read square by square, and the flat crescent beside the makers' bed takes 0.85 of a square and no
// more than that. A bed at 1.125 reaches through the first bed's rails or hangs over a step, and a bed
// resting half on one block and half on the next floats, which is a bug - so 0.80 is the size that
// fits both the place the island's bed already stands and the two places a bought one can. Both beds
// read this one number, so the two sizes cannot drift apart again.
const PLOT_HALF = 0.40;   // 0.80 across; the makers' PLOT_SIZE in tuning.js is left as their number

// How much of its own square a bought bed or pool gives back to the scatter already standing on it.
// The two spare spots were picked off the island's own height field, and the scatter is laid down
// after them: on a real load the nearest bush clips a bed's corner by one or two centimetres, which
// was enough to refuse the purchase and tell the maker the island was full. A couple of centimetres
// of overlap between a bush and a bed's edge is not something anyone can see, and a purchase that
// says "no room" when there is room is. Beds and pools still keep their full distance from each
// other and from the makers' own bed - it is only the scatter that gives way this much.
const DECOR_GIVE_WAY = 0.08;

// Where they go: island-local x and z, the space island.js lays its tiles out in and the same space
// the decorations are checked in below. Both spots were read off island.js's own height field - every
// block either bed's square covers answers the flat TILE_HEIGHT, which is what seatY is asked for
// again at buy time - and both sit 0.1 of a unit in from the left tile's rim, either side of the bed
// that is already there, clear of its rails by 0.14 of a unit and clear of every fixture.
const BED_SPOTS = [
  { x: -3.3, z: -0.3 },   // left tile, tile-local (-0.8, -0.3): out toward the island's own end
  { x: -1.7, z: -0.3 },   // left tile, tile-local (0.8, -0.3): the near side of the first bed
];

// --- A decorative pool ---
// 0.5 across, which is as wide as the flattest free ground on the island takes. Both spots sit in a
// tile's back or front band, the rows of blocks the scatter never reaches: a prop's centre is held
// inside 0.78 of its tile's middle, so the last 0.47 of every tile front and back is clear ground
// whatever the dice do, and both of these are on blocks that answer the flat TILE_HEIGHT.
const POOL_HALF = 0.28;
const POOL_SPOTS = [
  { x: -3.4, z: 0.9 },     // left tile, tile-local (-0.9, 0.9): the front corner, beside the bed
  { x: 1.6, z: -0.9 },     // right tile, tile-local (-0.9, -0.9): the back corner, clear of the pad
];

// A decorative pool's own sizes. creature.js's pool is 1.55 of a tile and a POOL_DEPTH deep; none of
// that travels to a pool a third the size, so these are this file's own. The two colours are the
// makers' own POOL_COLOR and POOL_RIM_COLOR out of tuning.js, so a pool bought from the shop is
// unmistakably the same water the minnow lives in - the blue that reads against the green grass.
const POOL_RIM_WALL = 0.09;          // the stone lip's thickness, along each of its four sides
const POOL_RIM_HEIGHT = 0.09;        // how far the lip stands proud of the grass
const POOL_RIM_SINK = 0.05;          // and how far it beds into it, so no seam shows underneath
const POOL_WATER_CLEARANCE = 0.015;  // the water's face sits this far above the grass...
const POOL_WATER_DEPTH = 0.04;       // ...and its slab reaches this far down inside the lip
const POOL_WATER_SPILL = 0.02;       // it tucks under the lip, so no seam shows at the edge either
const POOL_WATER_OPACITY = 0.85;     // see-through, so a fish in it still reads
const POOL_FISH_COUNT = 2;           // two fish: enough to read as alive, few enough to stay cheap
const POOL_FISH_LENGTH = 0.09;       // nose to tail, against a pool 0.5 across
const POOL_FISH_BODY = 0.03;         // how deep the fish is, so it has a back above the water
const POOL_FISH_BOB = 0.012;         // how far a fish rises and falls as it drifts
const POOL_FISH_BOB_RATE = 1.9;      // radians a second of that bob
const POOL_FISH_RATES = [0.85, -0.6];    // radians a second round the pool, the two fish opposite ways
const POOL_FISH_SHARES = [0.35, 0.52];   // of the water's own half-width: each on its own circle
const POOL_FISH_SURFACE = 0.35;      // of the fish's depth, above the water's face: it breaks the
                                     // surface, the way the minnow in the big pool does
const POOL_FISH_TURN = 0.25;         // radians the nose leads the drift by, so it reads as swimming

// The world point a plant happens at, turned into the island's own space by the island group's own
// worldToLocal - the only honest way to undo the spin. One module-level Vector3 serves every query:
// worldToLocal mutates the vector it is handed, and a plant is a keypress, never a frame.
const PLANT_POINT = new THREE.Vector3();

// mulberry32: a tiny seeded PRNG, so PROP_SEED alone decides the whole garden. Math.random() is never
// used here - the island has to look the same on every launch, not merely similar.
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

// Sizes a prop between PROP_VARY_MIN and PROP_VARY_MIN + PROP_VARY_SPAN of its nominal size.
function vary(rng, size) {
  return size * (PROP_VARY_MIN + rng() * PROP_VARY_SPAN);
}

export function createProps(scene, island) {
  // scene is in every factory's signature here, but the props themselves hang off the tiles' own
  // groups, so a tile's slide carries its garden for free. Nothing in this file touches island.angle
  // or island.group.rotation.y - island.js owns both - and nothing here adds a light, because
  // daynight.js owns every light in the scene.
  const group = new THREE.Group();
  scene.add(group);   // the caller's handle on the props; the grass is what they really stand on

  // --- Where a prop's feet stand ---
  // The makers asked for a stepped, blocky surface, so a tile's walkable top is no longer flat at
  // TILE_HEIGHT across the whole tile: a prop still seated at the flat height would sink into a step
  // or float over one. island.js's height field answers it - tileTopAt(tile, dx, dz), in the same
  // tile-local units every prop below is already placed with - and that answer is the same kind of
  // number as TILE_HEIGHT, so it is a drop-in seat. The interface lands in a parallel build, so a
  // missing one falls back to the flat TILE_HEIGHT this file has always used, and this function
  // stays the single place in the file where a prop's ground height is decided.
  function seatY(tile, dx, dz) {
    return typeof island.tileTopAt === 'function' ? island.tileTopAt(tile, dx, dz) : TILE_HEIGHT;
  }

  // --- Shared shapes and colours: built once and reused by every instance ---
  // There are about thirty props here, so one geometry and one material per kind of shape is the
  // difference between a dozen objects and a few hundred. A prop is varied by scaling its mesh,
  // which is free, and never by building another geometry.
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.075, 1, 6);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const blobGeo = new THREE.SphereGeometry(1, 8, 6);
  const postGeo = new THREE.CylinderGeometry(1, 1, 1, 5);
  const stoneGeo = new THREE.IcosahedronGeometry(1, 0);

  // Flat colours, no textures. The cones and the stone are flat-shaded, so their facets catch the
  // light one by one and the low poly count reads as a choice rather than as a rough edge.
  const trunkMat = new THREE.MeshStandardMaterial({ color: PROP_TRUNK_COLOR, roughness: 1 });
  const canopyMats = PROP_TREE_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })
  );
  const bushMat = new THREE.MeshStandardMaterial({ color: PROP_BUSH_COLOR, roughness: 1 });
  const stemMat = new THREE.MeshStandardMaterial({ color: PROP_MUSHROOM_STEM, roughness: 1 });
  const capMat = new THREE.MeshStandardMaterial({ color: PROP_MUSHROOM_CAP, roughness: 1 });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: PROP_STONE_COLOR,
    roughness: 1,
    flatShading: true,
  });
  const petalMats = PROP_FLOWERS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );

  // The decorations' own shared shapes and colours, built once here and reused by every plant. A
  // coral blade is one unit box scaled flat; a cairn's stones, a coral's foot and a lantern's foot
  // and cap are the very icosahedron the scatter throws about, and a lantern's post is its post. So
  // a plant costs meshes and nothing else, however many times it is pressed.
  const bladeGeo = new THREE.BoxGeometry(1, 1, 1);
  const coralMat = new THREE.MeshStandardMaterial({ color: CORAL_COLOR, roughness: 1 });
  // The one unshaded material in the file: a lantern's head is meant to read as a light of its own,
  // and daynight.js owns every actual light in the scene, so this is colour rather than illumination.
  const glowMat = new THREE.MeshBasicMaterial({ color: LANTERN_GLOW_COLOR });

  // A decorative pool's own shapes: one lip section for the two sides, one for the two ends, and one
  // water slab. Built once and shared by every pool, so the whole island gets four boxes however
  // many are bought. The lip is the launch pad's own stone and the water the minnow's own blue - the
  // two colours the rest of the island already reads pools and pad by.
  const poolWidth = POOL_HALF * 2;
  const poolLipHeight = POOL_RIM_HEIGHT + POOL_RIM_SINK;   // from sunk in to standing proud
  const poolWaterWidth =
    poolWidth - POOL_RIM_WALL * 2 + POOL_WATER_SPILL * 2;   // spills under the lip on every side
  const poolSideGeo = new THREE.BoxGeometry(poolWidth, poolLipHeight, POOL_RIM_WALL);
  const poolEndGeo = new THREE.BoxGeometry(
    POOL_RIM_WALL,
    poolLipHeight,
    poolWidth - POOL_RIM_WALL * 2
  );
  const poolWaterGeo = new THREE.BoxGeometry(
    poolWaterWidth,
    POOL_WATER_DEPTH,
    poolWaterWidth
  );
  const poolRimMat = new THREE.MeshStandardMaterial({ color: POOL_RIM_COLOR, roughness: 1 });
  // The same roughness and the same see-through-ness creature.js gives its own water, so the two
  // pools light alike: this one is a body of water on the grass, not a painted blue square.
  const poolWaterMat = new THREE.MeshStandardMaterial({
    color: POOL_COLOR,
    roughness: 0.3,
    transparent: true,
    opacity: POOL_WATER_OPACITY,
  });

  // --- State. All of it private: the caller gets the group, the wind setter and the update. ---
  const rng = mulberry32(PROP_SEED);
  const tiles = island.tiles || [];
  const placed = [];        // one tile's props at a time: { dx, dz, footprint }
  const canopies = [];      // every pine's canopy group, with the phase it sways on
  let wind = 0;
  let time = 0;

  // --- The planting beds: one factory, so the shop can sell more of them ---
  // Every bed is built by the one function below: a slab of turned earth, four timber rails and six
  // crop meshes, put down at a spot on a tile and given its own clock and its own state. The makers'
  // bed goes through it too, at the same spot and the same size, so nothing about that bed changes.
  //
  // A bed hangs off its own tile's group and stands seatY up from that group's origin - so raising or
  // lowering the tile carries the bed with it, and its world position follows the island's spin
  // without this file ever touching island.angle.
  //
  // The makers' bed's own rectangle stays at the flat TILE_HEIGHT on purpose, and so does anything
  // belonging to the pool's square or the launch pad's disc - island.js keeps those footprints flat at
  // exactly TILE_HEIGHT, precisely so the bed and main.js's own fixtures never have to move for the
  // terrain. Everything scattered or planted on open grass goes through seatY instead.
  const leftTile = tiles.find((tile) => tile.x < 0) || null;

  // The soil and the rails are the coral blades' own unit box and the plants the pines' own cone,
  // scaled - this file's rule for every shape it builds - in one material per flat colour, made once
  // and shared by every bed, so a second bed costs meshes and nothing else.
  const soilMat = new THREE.MeshStandardMaterial({ color: PLOT_SOIL_COLOR, roughness: 1 });
  const frameMat = new THREE.MeshStandardMaterial({ color: PLOT_FRAME_COLOR, roughness: 1 });
  const sproutMat = new THREE.MeshStandardMaterial({ color: PLOT_SPROUT_COLOR, roughness: 1 });
  const ripeMat = new THREE.MeshStandardMaterial({ color: PLOT_RIPE_COLOR, roughness: 1 });

  const beds = [];        // every bed, in the order they went down: beds[0] is the makers' own bed
  const bedTicks = [];    // one tick per bed, for update(): its world position and its growth clock

  // Builds one bed at tile-local (dx, dz) on the given tile, half its width to the middle, and answers
  // with the bed record main.js talks to. `home` is the group it hangs off - normally the tile's own,
  // so the tile carries it. Everything a bed owns lives in here: its meshes, its clock and its state,
  // which is what keeps two beds from ever sharing one crop.
  function addBedAt(home, tile, dx, dz, half) {
    const bed = new THREE.Group();
    bed.position.set(dx, tile ? seatY(tile, dx, dz) : TILE_HEIGHT, dz);
    home.add(bed);

    const width = half * 2;

    const soil = new THREE.Mesh(bladeGeo, soilMat);
    soil.scale.set(width, PLOT_SLAB_DEPTH, width);
    soil.position.y = PLOT_SOIL_TOP - PLOT_SLAB_DEPTH / 2;   // sunk into the grass, top just above it
    bed.add(soil);

    // Four rails: the two long ones run the full width along x, and the two short ones fill the ends
    // between them, so no two rails share a face inside a corner and no edge z-fights. Every number is
    // read off this bed's own half, so a narrower bed gets a frame to match.
    const railY = PLOT_SOIL_TOP + PLOT_RAIL_HEIGHT / 2;   // standing on the soil, not in it
    const railSide = half - PLOT_RAIL_THICK / 2;          // outer face flush with the soil's edge
    const railShort = width - PLOT_RAIL_THICK * 2;        // what is left between the long two
    const railLayout = [
      { x: 0, z: -railSide, sx: width, sz: PLOT_RAIL_THICK },
      { x: 0, z: railSide, sx: width, sz: PLOT_RAIL_THICK },
      { x: -railSide, z: 0, sx: PLOT_RAIL_THICK, sz: railShort },
      { x: railSide, z: 0, sx: PLOT_RAIL_THICK, sz: railShort },
    ];
    for (let i = 0; i < railLayout.length; i++) {
      const rail = new THREE.Mesh(bladeGeo, frameMat);
      rail.scale.set(railLayout[i].sx, PLOT_RAIL_HEIGHT, railLayout[i].sz);
      rail.position.set(railLayout[i].x, railY, railLayout[i].z);
      bed.add(rail);
    }

    // The crop: two rows of three, in the pines' own cone, one shared material per colour. A bed's
    // six plants are its own six meshes - two beds sharing them would show one bed's crop in the
    // other - and each is the same mesh scaled, so a bed costs one geometry and two materials however
    // many crops go through it. Nothing here is random: the rows are laid out by the two loops and
    // stay where they are for the life of the game.
    const crop = [];
    for (let row = 0; row < PLOT_PLANT_ROWS; row++) {
      const z = (row - (PLOT_PLANT_ROWS - 1) / 2) * PLOT_ROW_GAP;
      for (let col = 0; col < PLOT_PLANT_COLS; col++) {
        const x = (col - (PLOT_PLANT_COLS - 1) / 2) * PLOT_COL_GAP;
        const plant = new THREE.Mesh(coneGeo, sproutMat);
        plant.position.set(x, PLOT_SOIL_TOP, z);
        plant.scale.set(PLOT_PLANT_WIDTH, 0, PLOT_PLANT_WIDTH);   // nothing up until a seed goes in
        plant.visible = false;
        bed.add(plant);
        crop.push(plant);
      }
    }

    // This bed's own clock and state. Both are written only from plant(), harvest() and the tick
    // below: the state changes on a keypress or on the clock reaching GROW_TIME, never on a guess.
    let bedState = PLOT_EMPTY;
    let bedGrown = 0;    // seconds the crop in the ground has been growing, against GROW_TIME

    // Every plant set to one share of its full size, from 0 (nothing showing) to 1 (ripe height). The
    // cone is hinged at its middle, so its y is half its height to sit its base on the soil's face.
    // Scale writes only, so a growth clock costs six meshes a frame and allocates nothing.
    function setCropGrowth(share) {
      const plantHeight = PLOT_PLANT_HEIGHT * share;
      const plantWidth = PLOT_PLANT_WIDTH * share;
      for (let i = 0; i < crop.length; i++) {
        const plant = crop[i];
        plant.scale.set(plantWidth, plantHeight, plantWidth);
        plant.position.y = PLOT_SOIL_TOP + plantHeight / 2;
      }
    }

    // The bed's public face. `position` is ONE live vector in world space, kept current by the tick
    // below through the bed's own localToWorld and written into, never replaced: main.js hands this
    // very object to the Caretaker's list of things it can stand beside.
    const position = new THREE.Vector3();
    const record = {
      position,

      state() {
        return bedState;
      },

      // A seed goes in, but only into an empty bed, and the GROW_TIME clock starts from zero here
      // rather than from wherever the last crop left it. True only when a seed has just gone in.
      plant() {
        if (bedState !== PLOT_EMPTY) return false;
        bedState = PLOT_GROWING;
        bedGrown = 0;
        for (let i = 0; i < crop.length; i++) {
          crop[i].material = sproutMat;   // the shared sprout material, swapped back in, not built
          crop[i].visible = true;
        }
        setCropGrowth(0);
        return true;
      },

      // A ripe crop comes out and the bed is empty again. Refused at any other state, so a press that
      // does nothing costs the player nothing.
      harvest() {
        if (bedState !== PLOT_RIPE) return false;
        bedState = PLOT_EMPTY;
        bedGrown = 0;
        for (let i = 0; i < crop.length; i++) crop[i].visible = false;
        return true;
      },
    };

    beds.push(record);

    // The record's position is filled here, once, so it is right from the moment main.js is handed
    // it rather than only after the next frame's tick - main.js puts a newly bought bed on the
    // Caretaker's list of things to stand beside the instant it is bought.
    bed.updateWorldMatrix(true, false);
    bed.localToWorld(position.set(0, 0, 0));

    // One tick per bed, run by update(). The closure is what keeps this bed's group, clock and state
    // its own: one bed's crop cannot advance another's, and neither can show the other's plants.
    bedTicks.push({
      tick(dt) {
        bed.updateWorldMatrix(true, false);
        bed.localToWorld(position.set(0, 0, 0));   // this bed's middle, in world space, in place
        if (bedState !== PLOT_GROWING) return;
        bedGrown += dt;
        let share = bedGrown / GROW_TIME;
        if (share >= 1) {
          share = 1;
          bedState = PLOT_RIPE;
          for (let i = 0; i < crop.length; i++) crop[i].material = ripeMat;
        }
        setCropGrowth(share);
      },
    });

    return record;
  }

  // The bed the makers have always had: the full PLOT_SIZE on the left tile, hung off that tile's own
  // group, put down through the very same factory. It is beds[0], and `plot` points at it because
  // main.js reads props.plot by name.
  const plot = addBedAt(
    leftTile ? leftTile.group : group,
    leftTile,
    0,
    PLOT_OFFSET_Z,
    PLOT_HALF
  );

  // --- One pine: a short trunk with PROP_CANOPY_LAYERS cones stacked up it, darkest at the bottom
  // and palest at the top. The cones hang off their own group, so update() can sway the crown
  // without moving the trunk. Each tree's height and width wander a little, so no two are clones.
  function buildPine(tile, dx, dz) {
    const height = vary(rng, PROP_TREE_HEIGHT);
    const width = vary(rng, PROP_TREE_RADIUS);
    const trunkHeight = height * PINE_TRUNK_SHARE;

    const tree = new THREE.Group();
    tree.position.set(dx, seatY(tile, dx, dz), dz);
    tree.rotation.y = rng() * FULL_TURN;

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(width / PROP_TREE_RADIUS, trunkHeight, width / PROP_TREE_RADIUS);
    trunk.position.y = trunkHeight / 2;
    tree.add(trunk);

    // The crown's origin is where it hinges: down the trunk, so the lowest cone hides the join.
    const canopy = new THREE.Group();
    canopy.position.y = trunkHeight * PINE_CANOPY_DROP;
    tree.add(canopy);

    const span = height - canopy.position.y;
    const layerHeight = span * PINE_CONE_SHARE;
    const layers = Math.max(1, PROP_CANOPY_LAYERS);
    const step = layers > 1 ? (span - layerHeight) / (layers - 1) : 0;
    for (let i = 0; i < layers; i++) {
      const coneWidth = width * (1 - i * PINE_TAPER);
      // Paler with every layer up, so the treeline reads top-lit from any angle.
      const shade = Math.min(canopyMats.length - 1, Math.floor((i * canopyMats.length) / layers));
      const cone = new THREE.Mesh(coneGeo, canopyMats[shade]);
      cone.scale.set(coneWidth, layerHeight, coneWidth);
      cone.position.y = i * step + layerHeight / 2;
      canopy.add(cone);
    }

    canopies.push({ node: canopy, phase: rng() * FULL_TURN });
    return tree;
  }

  // --- One bush: two or three overlapping squashed spheres, so it reads as a single clump ---
  function buildBush(tile, dx, dz) {
    const bush = new THREE.Group();
    bush.position.set(dx, seatY(tile, dx, dz), dz);
    bush.rotation.y = rng() * FULL_TURN;

    const radius = vary(rng, BUSH_RADIUS);
    const blobs = BUSH_BLOBS_MIN + Math.floor(rng() * 2);
    for (let i = 0; i < blobs; i++) {
      const blob = new THREE.Mesh(blobGeo, bushMat);
      const size = i === 0 ? radius : radius * BUSH_BLOB_SHARE;
      // The extras wander off-centre; the first stays put, so the clump always has a middle.
      const wander = i === 0 ? 0 : radius * BUSH_BLOB_SPREAD;
      blob.position.set(
        (rng() - 0.5) * wander,
        size * BUSH_SQUASH,
        (rng() - 0.5) * wander
      );
      blob.scale.set(size, size * BUSH_SQUASH, size);
      bush.add(blob);
    }
    return bush;
  }

  // --- One flower: a hair-thin stem with a small flattened head in one of PROP_FLOWERS ---
  function buildFlower(tile, dx, dz) {
    const flower = new THREE.Group();
    flower.position.set(dx, seatY(tile, dx, dz), dz);
    flower.rotation.y = rng() * FULL_TURN;

    const height = vary(rng, FLOWER_STEM_HEIGHT);
    const stem = new THREE.Mesh(postGeo, bushMat);   // the stem is foliage, so it borrows that green
    stem.scale.set(FLOWER_STEM_RADIUS, height, FLOWER_STEM_RADIUS);
    stem.position.y = height / 2;
    flower.add(stem);

    // The colour is picked per flower, so a cluster of them is never one flat block of colour.
    const petals = petalMats[Math.min(petalMats.length - 1, Math.floor(rng() * petalMats.length))];
    const size = vary(rng, FLOWER_HEAD_SIZE);
    const head = new THREE.Mesh(blobGeo, petals);
    head.position.y = height;
    head.scale.set(size, size * FLOWER_HEAD_SQUASH, size);
    flower.add(head);

    return flower;
  }

  // --- One mushroom: a short pale stem under a squashed cap ---
  function buildMushroom(tile, dx, dz) {
    const mushroom = new THREE.Group();
    mushroom.position.set(dx, seatY(tile, dx, dz), dz);
    mushroom.rotation.y = rng() * FULL_TURN;

    const height = vary(rng, MUSHROOM_HEIGHT);
    const stem = new THREE.Mesh(postGeo, stemMat);
    stem.scale.set(MUSHROOM_STEM_RADIUS, height, MUSHROOM_STEM_RADIUS);
    stem.position.y = height / 2;
    mushroom.add(stem);

    const size = vary(rng, MUSHROOM_CAP_SIZE);
    const cap = new THREE.Mesh(blobGeo, capMat);
    cap.position.y = height * 0.9;   // just over the stem's top, so the cap sits on it and not beside it
    cap.scale.set(size, size * MUSHROOM_CAP_SQUASH, size);
    mushroom.add(cap);

    return mushroom;
  }

  // --- One stone: a tumbled icosahedron, squashed and turned every way, so its facets catch the
  // light differently from its neighbours' ---
  function buildStone(tile, dx, dz) {
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    const size = vary(rng, STONE_SIZE);
    stone.scale.set(
      size * (0.85 + rng() * 0.3),
      size * STONE_FLAT,
      size * (0.85 + rng() * 0.3)
    );
    // Seated a little below its own centre, so it beds into the grass instead of balancing on it.
    // Only the grass under it moves with the terrain; STONE_SEAT is its own, and stays put.
    stone.position.set(dx, seatY(tile, dx, dz) + size * STONE_SEAT, dz);
    stone.rotation.set(rng() * FULL_TURN, rng() * FULL_TURN, rng() * FULL_TURN);
    return stone;
  }

  // --- The decorations the coins buy: built on a keypress, wherever the Caretaker is standing ---
  // The tiles are laid out along island-local x and none of them carries a turn of its own, so every
  // check below is done in island-local units - the rim, the pool, the pad, the deck's doorway and
  // the scatter are all described in that one space - and the owning tile is converted from it at
  // the very end, which is also what puts the decoration on the right tile to be carried up and down.
  const scatter = [];      // every prop on the island: { x, z, foot }, in island-local units
  const decorations = [];  // every plant so far: { x, z }, in the same units, for the gap check
  let planted = 0;         // how many are down: what the cap counts and what picks the next kind

  // The island's own outer rim, read off the row once. The tiles sit edge to edge, so their union is
  // one rectangle and the seams between two of them are not edges at all: this rim is the only place
  // a decoration could hang off, and the only edge a plant is kept clear of.
  let islandLeft = Infinity;
  let islandRight = -Infinity;
  let islandBack = Infinity;
  let islandFront = -Infinity;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    islandLeft = Math.min(islandLeft, tile.x - TILE_HALF);
    islandRight = Math.max(islandRight, tile.x + TILE_HALF);
    islandBack = Math.min(islandBack, tile.z - TILE_HALF);
    islandFront = Math.max(islandFront, tile.z + TILE_HALF);
  }

  // The two fixtures nothing may be planted in, on the same two tiles fixtureGap reads: the pool's
  // square on the middle tile, the launch pad on the right-hand one. Both are centred on their own
  // tile and both keep the tuning insets - POOL_CLEAR and PAD_CLEAR, the very gaps the scatter dodges
  // them with. Both are looked up off the row, so no middle tile simply means no pool to dodge.
  const middleTile = tiles.find((tile) => tile.x === 0) || null;
  const padTile = tiles.find((tile) => tile.x > 0) || null;
  // The tile the deck actually lands on. It used to be the middle one; the dock moved out to the
  // island's far end, so the doorway and the grass under it moved with it.
  const deckTile = tiles.find((tile) => tile.x > 0) || null;

  // The platform's side of the island. The deck is PLATFORM_WIDTH across and its near edge meets the
  // island's front rim on the dock tile - main.js lays the boarding spot at island-local x = the dock
  // tile's own centre, z = TILE_HALF - so that patch of grass is the way on and off the island, and
  // it stays clear. The deck sits on the pad tile's centre, which is where the pad's own square is,
  // so in practice this only ever rules the last hand's width of rim; that is the part that matters.
  function onDeckPatch(x, z) {
    if (!deckTile) return false;
    return Math.abs(x - deckTile.x) <= PLATFORM_WIDTH / 2 && z >= islandFront - DECOR_DECK_KEEP;
  }

  // Inside one of the two fixtures. A square drawn round the round pad refuses a hand's width of
  // grass at its four corners, which is the safe way round: a decoration in the water or on the pad
  // is a bug a player finds in ten seconds, and one a step further out than it needed to be is not.
  function inFixture(x, z) {
    if (
      middleTile &&
      Math.abs(x - middleTile.x) <= POOL_CLEAR &&
      Math.abs(z - middleTile.z) <= POOL_CLEAR
    ) {
      return true;
    }
    return Boolean(
      padTile &&
      Math.abs(x - padTile.x) <= PAD_CLEAR &&
      Math.abs(z - padTile.z) <= PAD_CLEAR
    );
  }

  // On the island at all, keeping `foot` back from the outer rim, so nothing a plant puts down
  // overhangs the drop. The seams between two tiles are well inside that rim, so a spot straddling
  // one is still on the island - which matters, because a tile is only TILE_SIZE across and the
  // Caretaker can stand anywhere on the row.
  function onIsland(x, z, foot) {
    return (
      x >= islandLeft + foot &&
      x <= islandRight - foot &&
      z >= islandBack + foot &&
      z <= islandFront - foot
    );
  }

  // The tile whose own footprint the point stands on: the one tile group that can carry the finished
  // decoration up and down with it. Off every tile there is nothing underfoot to plant on.
  function ownerTile(x, z) {
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (Math.abs(x - tile.x) <= TILE_HALF && Math.abs(z - tile.z) <= TILE_HALF) return tile;
    }
    return null;
  }

  // --- One cairn: stones stacked one on another, tapering, each turned and nudged a little off
  // centre so the stack reads as built rather than machined. Every other cairn gets a fourth stone
  // and DECOR_SCALES sizes it, so a row of them is three different piles.
  function buildCairn(tile, dx, dz, turn, scale) {
    const cairn = new THREE.Group();
    cairn.position.set(dx, seatY(tile, dx, dz), dz);
    cairn.rotation.y = turn;

    const stones = CAIRN_STONES + (planted % CAIRN_SPARE);   // planted is this plant's own index
    let base = 0;   // the height the next stone sits on: the top of the one below it
    for (let i = 0; i < stones; i++) {
      const radius = CAIRN_RADIUS * scale * Math.pow(CAIRN_TAPER, i);
      const half = radius * CAIRN_FLAT;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.scale.set(radius, half, radius);
      stone.position.set(
        Math.sin(i * 2.1) * CAIRN_WOBBLE,
        base + half,
        Math.cos(i * 1.7) * CAIRN_WOBBLE
      );
      stone.rotation.set(i * 0.7, i * 1.3, i * 0.5);   // turned every way, as the scatter's are
      cairn.add(stone);
      base += half * 2;
    }
    return cairn;
  }

  // --- One coral fan: a stone foot with two fans of flat blades crossed over it, the one warm accent
  // in the dark. Each fan is a group carrying its own turn about the vertical, so a blade is only
  // ever tilted about z inside its own fan and the sums stay in two dimensions.
  function buildCoral(tile, dx, dz, turn, scale) {
    const coral = new THREE.Group();
    coral.position.set(dx, seatY(tile, dx, dz), dz);
    coral.rotation.y = turn;

    const foot = new THREE.Mesh(stoneGeo, stoneMat);
    const footSize = CORAL_STONE * scale;
    foot.scale.set(footSize, footSize * 0.45, footSize);
    foot.position.y = footSize * 0.25;   // seated into the grass a little, like the scatter's stones
    foot.rotation.set(0.3, 0.4, 0.2);
    coral.add(foot);

    for (let f = 0; f < CORAL_FANS; f++) {
      const fan = new THREE.Group();
      fan.rotation.y = f * CORAL_TURN;
      coral.add(fan);

      const length = CORAL_LENGTH * scale * Math.pow(CORAL_SHRINK, f);
      for (let b = 0; b < CORAL_BLADES; b++) {
        // The outer blades lean away from the middle one and are a little shorter, so the fan has a
        // round tip rather than three spikes at one height.
        const out = b - (CORAL_BLADES - 1) / 2;
        const tilt = out * CORAL_SPREAD;
        const bladeLength = length * (1 - Math.abs(out) * 0.16);
        const blade = new THREE.Mesh(bladeGeo, coralMat);
        blade.scale.set(CORAL_WIDTH, bladeLength, CORAL_THICK);
        blade.rotation.z = tilt;
        // Hinged at the foot: half a blade along its own lean, which keeps the blades together at
        // the root and spread at the tips, where a fan should be.
        blade.position.set(
          -Math.sin(tilt) * bladeLength * 0.5,
          Math.cos(tilt) * bladeLength * 0.5,
          0
        );
        fan.add(blade);
      }
    }
    return coral;
  }

  // --- One lantern post: a stone foot, a timber post, a glowing head under a small stone cap. The
  // island's own little light at night, and the only thing in this file that reads as lit.
  function buildLantern(tile, dx, dz, turn, scale) {
    const lantern = new THREE.Group();
    lantern.position.set(dx, seatY(tile, dx, dz), dz);
    lantern.rotation.y = turn;

    const foot = new THREE.Mesh(stoneGeo, stoneMat);
    const footSize = LANTERN_STONE * scale;
    foot.scale.set(footSize, footSize * 0.45, footSize);
    foot.position.y = footSize * 0.25;
    lantern.add(foot);

    const postHeight = LANTERN_POST * scale;
    const post = new THREE.Mesh(postGeo, trunkMat);   // the pines' own timber, so the palette holds
    post.scale.set(LANTERN_POST_WIDTH, postHeight, LANTERN_POST_WIDTH);
    post.position.y = postHeight * 0.5;
    lantern.add(post);

    const headSize = LANTERN_HEAD * scale;
    const head = new THREE.Mesh(blobGeo, glowMat);
    head.scale.set(headSize, headSize * 1.15, headSize);
    head.position.y = postHeight + headSize * 0.9;   // tucked onto the post's top, not floating over it
    lantern.add(head);

    const cap = new THREE.Mesh(blobGeo, stoneMat);
    cap.scale.set(LANTERN_CAP * scale, LANTERN_CAP * scale * 0.5, LANTERN_CAP * scale);
    cap.position.y = head.position.y + headSize * 1.5;
    lantern.add(cap);
    return lantern;
  }

  // The three kinds, cycled in this order so the island fills with a mix instead of eight of one
  // thing. A cairn is three or four meshes, a coral fan seven, a lantern four.
  const DECOR_KINDS = [
    { name: 'cairn', foot: CAIRN_FOOT, build: buildCairn },
    { name: 'coral fan', foot: CORAL_FOOT, build: buildCoral },
    { name: 'lantern', foot: LANTERN_FOOT, build: buildLantern },
  ];

  // --- Where a plant actually goes: the spot asked for, or the nearest clear one ---
  // Clear means: on the island, back from the rim, off the pool, off the launch pad, off the patch of
  // grass the platform's doorway stands on, DECOR_MIN_GAP from every decoration already down, and its
  // own footprint clear of every prop already scattered. Only the island's own rim is measured as an
  // edge - the seams between two tiles are ground, not edges - and the prop clearance is the two
  // footprints merely not overlapping, which is all `foot` has to be for the scatter's own gap rule
  // to have meant anything.
  function clear(x, z, foot) {
    if (!onIsland(x, z, foot) || inFixture(x, z) || onDeckPatch(x, z)) return false;
    for (let i = 0; i < decorations.length; i++) {
      const other = decorations[i];
      if (Math.hypot(x - other.x, z - other.z) < DECOR_MIN_GAP) return false;
    }
    for (let i = 0; i < scatter.length; i++) {
      const prop = scatter[i];
      if (Math.hypot(x - prop.x, z - prop.z) < foot + prop.foot) return false;
    }
    return true;
  }

  // The spot to plant at: the one the player chose, or the nearest clear one within a quarter of a
  // tile of it. Nudging is worth the fuss - a spot the player asked for and did not get is a worse
  // answer than the same spot a hand's width to one side - so the search walks out in rings, nearest
  // ring first, and refuses only when the whole reach of it is taken. The rings are laid on a fixed
  // compass turned by the plant's own index, so two presses in one place fan out instead of landing
  // on top of one another, and nothing here ever reaches for Math.random().
  function near(x, z, foot) {
    if (clear(x, z, foot)) return { x, z };
    for (let ring = 1; ring <= DECOR_NUDGE_RINGS; ring++) {
      const radius = ring * DECOR_NUDGE_STEP;
      for (let step = 0; step < DECOR_NUDGE_STEPS; step++) {
        const angle = (step / DECOR_NUDGE_STEPS) * FULL_TURN + planted * DECOR_FAN_STEP;
        const aroundX = x + Math.cos(angle) * radius;
        const aroundZ = z + Math.sin(angle) * radius;
        if (clear(aroundX, aroundZ, foot)) return { x: aroundX, z: aroundZ };
      }
    }
    return null;   // the whole reach of it is taken: refuse rather than plant it in a pine
  }

  // True while at least one bed has nothing growing in it - the seed verb's own question, and the one
  // main.js asks before offering it. It used to mean "this one bed is empty"; it means the same thing
  // across every bed the player has bought, so a seed goes in as long as any bed is free.
  function canPlant() {
    for (let i = 0; i < beds.length; i++) {
      if (beds[i].state() === PLOT_EMPTY) return true;
    }
    return false;
  }

  // True while there is room for one more decoration, island-wide. Once the island is full this stays
  // false for good, so main.js can stop offering the verb rather than offer it and then refuse. This
  // is the decorations' own question, kept apart from canPlant because the seed verb asks a different
  // one now: the decoration key wants this, the seed key wants canPlant.
  function canDecorate() {
    return planted < DECOR_CAP && tiles.length > 0;
  }

  // Plant one decoration where the Caretaker stands and answer with its name - or null if the spot
  // will not take one, which costs the player nothing. main.js owns the key, the price and the hint;
  // this owns the geometry, and a plant is a handful of meshes built once, never per frame.
  function plantDecorAt(worldX, worldZ) {
    if (!canDecorate()) return null;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) return null;

    // The world point into the island's own space through the island group's own worldToLocal, so
    // the spin is undone honestly rather than guessed at with sin and cos, and a plant works whatever
    // angle the island is at and whatever height the tile has eased to. The y is dropped: a plant
    // stands on grass, and every height here is the tile's own.
    island.group.updateWorldMatrix(true, false);
    island.group.worldToLocal(PLANT_POINT.set(worldX, 0, worldZ));

    // Which kind goes down is decided by the plant's own index, before any of the checks, so a
    // refused press never advances the cycle.
    const kind = DECOR_KINDS[planted % DECOR_KINDS.length];

    // The whole island is fair game except the pool, the launch pad, the last hand's width of rim and
    // the patch of grass the platform's doorway stands on. Which of those it is does not matter to the
    // caller: none of them can take a decoration, so all of them answer the same way, and none of them
    // is nudged out of: the player's own spot has to be ground before a decoration is placed at all.
    if (!onIsland(PLANT_POINT.x, PLANT_POINT.z, kind.foot)) return null;
    if (inFixture(PLANT_POINT.x, PLANT_POINT.z)) return null;
    if (onDeckPatch(PLANT_POINT.x, PLANT_POINT.z)) return null;

    // Only crowding is moved out of the way, and only as far as DECOR_MIN_GAP - so a spot with a pine
    // in it plants beside the pine, and the pool, the pad and the rim are never crossed to do it.
    const spot = near(PLANT_POINT.x, PLANT_POINT.z, kind.foot);
    if (!spot) return null;

    // The tile the spot actually ended on, which is the one that carries it: a nudge may have moved it
    // over a seam, and a decoration has to ride the tile it is standing on and no other.
    const tile = ownerTile(spot.x, spot.z);
    if (!tile) return null;   // nothing under it: no tile to plant on and none to carry it

    // Into that tile's own units. The tile record's x and z are island-local units (island.js's own
    // words) and a tile group has no turn of its own, so taking its offset off is exact. The height
    // is this tile's walkable top at that very point - the same seatY the scatter is seated with -
    // up from the group's origin, so raising or lowering the tile carries the decoration with it for
    // free and the stepped grass is what it stands on.
    tile.group.add(
      kind.build(
        tile,
        spot.x - tile.x,
        spot.z - tile.z,
        planted * DECOR_TURN_STEP,
        DECOR_SCALES[planted % DECOR_SCALES.length]
      )
    );
    decorations.push({ x: spot.x, z: spot.z });
    planted += 1;
    return kind.name;
  }

  // --- The spots a purchase puts a bed or a pool on ---
  // Both lists are island-local x and z - the space island.js lays the tiles out in - and both are
  // worked through in order, so the same purchase always takes the same spot. A spot the scatter has
  // grown over, or one already bought, is stepped over rather than searched around: the island has no
  // more flat ground than these few spots, and a short honest list beats a search that could wander a
  // bed onto a step. False means the list is spent, which is what main.js stops offering rows on.
  const bedSpots = BED_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, used: false }));
  const poolSpots = POOL_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, used: false }));

  // The ground already spoken for by a bed or a pool that is down: { x, z, half }, island-local. The
  // makers' own bed is the first entry, so the very first spare bed cannot land on top of it.
  const placement = [
    {
      x: leftTile ? leftTile.x : 0,
      z: (leftTile ? leftTile.z : 0) + PLOT_OFFSET_Z,
      half: PLOT_HALF,
    },
  ];

  // Is the whole square of half-width `half` around tile-local (dx, dz) at one height on this tile?
  // Sampled on a 5x5 grid of points a hair INSIDE the square - a hair, because a sample sitting
  // exactly on a block boundary is read as the block next door, and a spot flush with a step is one
  // this has to refuse. seatY is the one place in this file that decides a height, so a spot that
  // passes this and is then seated with seatY cannot float or sink: its corners, its edges and its
  // middle are all on the one level, which is the proof the makers asked for.
  const FLAT_GRID = [-1, -0.5, 0, 0.5, 1];
  const FLAT_INSET = 0.001;
  function footprintFlat(tile, dx, dz, half) {
    const reach = half - FLAT_INSET;
    const level = seatY(tile, dx, dz);
    for (let i = 0; i < FLAT_GRID.length; i++) {
      for (let j = 0; j < FLAT_GRID.length; j++) {
        const y = seatY(tile, dx + FLAT_GRID[i] * reach, dz + FLAT_GRID[j] * reach);
        if (Math.abs(y - level) > FLAT_INSET) return false;
      }
    }
    return true;
  }

  // Is this a spot a purchase will want? The four spots above are held clear of the scatter, so no
  // pine or bush is ever standing where a bed or a pool has to go. It costs the left tile some of its
  // pines - that crescent along its back is the only flat ground beside the bed already down, and it
  // is exactly where the scatter wants to be - and a bed refused for a bush would be the worse bug.
  function onPurchasableGround(x, z, foot) {
    for (let i = 0; i < bedSpots.length; i++) {
      const spot = bedSpots[i];
      if (Math.hypot(x - spot.x, z - spot.z) < PLOT_HALF + foot) return true;
    }
    for (let i = 0; i < poolSpots.length; i++) {
      const spot = poolSpots[i];
      if (Math.hypot(x - spot.x, z - spot.z) < POOL_HALF + foot) return true;
    }
    return false;
  }

  // Clear grass for a square of half-width `half` at island-local (x, z): no scattered prop's
  // footprint, and no bed or pool already down, may touch it. This is the same "the two footprints
  // merely do not overlap" rule the decorations keep, read off the two lists that know where things
  // stand. `give` is how much of its own square the thing being placed hands back to the scatter - a
  // bed or a pool gives DECOR_GIVE_WAY, so a bush that clips its edge by a centimetre does not refuse
  // a purchase. Bed against bed, and bed against pool, never gives way: those keep their full distance.
  function spotFree(x, z, half, give) {
    const slack = give || 0;
    for (let i = 0; i < scatter.length; i++) {
      const prop = scatter[i];
      if (Math.hypot(x - prop.x, z - prop.z) < half + prop.foot - slack) return false;
    }
    for (let i = 0; i < placement.length; i++) {
      const other = placement[i];
      if (Math.hypot(x - other.x, z - other.z) < half + other.half) return false;
    }
    return true;
  }

  // The next spot in a list that will take a square of half-width `half`, or null when the list is
  // spent. A spot is taken only if it is on a tile, wholly inside that tile, a hand's width in from
  // the rim, clear of the pool, the pad, the deck's doorway and everything already standing, and on
  // one flat height all over.
  function takeSpot(list, half) {
    for (let i = 0; i < list.length; i++) {
      const spot = list[i];
      if (spot.used) continue;
      const tile = ownerTile(spot.x, spot.z);
      if (!tile) continue;
      const dx = spot.x - tile.x;
      const dz = spot.z - tile.z;
      if (Math.abs(dx) + half > TILE_HALF || Math.abs(dz) + half > TILE_HALF) continue;
      if (inFixture(spot.x, spot.z) || onDeckPatch(spot.x, spot.z)) continue;
      if (!spotFree(spot.x, spot.z, half, DECOR_GIVE_WAY)) continue;
      if (!footprintFlat(tile, dx, dz, half)) continue;
      spot.used = true;
      return { tile, dx, dz };
    }
    return null;
  }

  // --- A decorative pool: a stone lip, a plate of still water, and a fish or two drifting ---
  // Built at the spot itself, so the group's origin is the water's middle. Nothing grows in it and
  // nothing is harvested from it: it is a thing to look at, and main.js never asks it for more than
  // that. Its two colours are the makers' own out of tuning.js, so a pool bought from the shop is
  // unmistakably the same water the minnow lives in, and the same blue reads against the green grass.
  const fish = [];   // every fish on every pool: { node, radius, rate, angle, bob, y }
  function buildPool(tile, dx, dz) {
    const pool = new THREE.Group();
    pool.position.set(dx, seatY(tile, dx, dz), dz);

    // The lip: two full-width sides and two ends filling the gap between them, laid out the way the
    // bed's rails are, so no two pieces share a face inside a corner. Its middle sits between sunk in
    // and standing proud, which is what leaves the lip proud of the grass by POOL_RIM_HEIGHT.
    const lipY = (POOL_RIM_HEIGHT - POOL_RIM_SINK) / 2;
    const lipAt = (poolWidth - POOL_RIM_WALL) / 2;
    const lips = [
      { geo: poolSideGeo, x: 0, z: -lipAt },
      { geo: poolSideGeo, x: 0, z: lipAt },
      { geo: poolEndGeo, x: -lipAt, z: 0 },
      { geo: poolEndGeo, x: lipAt, z: 0 },
    ];
    for (let i = 0; i < lips.length; i++) {
      const lip = new THREE.Mesh(lips[i].geo, poolRimMat);
      lip.position.set(lips[i].x, lipY, lips[i].z);
      pool.add(lip);
    }

    // The water: one flat plate whose face sits POOL_WATER_CLEARANCE above the grass, so it reads as
    // water lying in the lip rather than a painted square, and wide enough to tuck under the lip on
    // every side so no seam shows at the edge. Still: nothing moves it but the island's own spin.
    const water = new THREE.Mesh(poolWaterGeo, poolWaterMat);
    water.position.y = POOL_WATER_CLEARANCE - POOL_WATER_DEPTH / 2;
    pool.add(water);

    // The fish: a cone on its side, the way creature.js builds its minnow, each on its own circle at
    // its own rate and its own bob so the two never line up. Each fish is a small group of its own:
    // the group carries the heading and the mesh a fixed quarter turn, which keeps one axis of the
    // turn off the other's sums.
    for (let i = 0; i < POOL_FISH_COUNT; i++) {
      const node = new THREE.Group();
      const body = new THREE.Mesh(coneGeo, poolRimMat);
      body.scale.set(POOL_FISH_BODY, POOL_FISH_LENGTH, POOL_FISH_BODY);
      body.rotation.x = Math.PI / 2;   // the cone's point forward, level with the water
      node.add(body);
      pool.add(node);
      fish.push({
        node,
        radius: poolWaterWidth * 0.5 * POOL_FISH_SHARES[i % POOL_FISH_SHARES.length],
        rate: POOL_FISH_RATES[i % POOL_FISH_RATES.length],
        angle: (i * FULL_TURN) / POOL_FISH_COUNT,
        bob: i * 1.7,   // its own phase, so the two do not rise and fall together
        y: POOL_WATER_CLEARANCE + POOL_FISH_BODY * POOL_FISH_SURFACE,
      });
    }

    tile.group.add(pool);
    return pool;
  }

  // Buy the next crop bed: the same build as the makers' own bed, a little smaller, on the next free
  // spot of the list. It takes its own place in the ground list as it goes down.
  function addBed() {
    const spot = takeSpot(bedSpots, PLOT_HALF);
    if (!spot) return false;
    addBedAt(spot.tile.group, spot.tile, spot.dx, spot.dz, PLOT_HALF);
    placement.push({ x: spot.tile.x + spot.dx, z: spot.tile.z + spot.dz, half: PLOT_HALF });
    return true;
  }

  // Buy the next decorative pool. The same list rules, and the same false when it is spent.
  function addPool() {
    const spot = takeSpot(poolSpots, POOL_HALF);
    if (!spot) return false;
    buildPool(spot.tile, spot.dx, spot.dz);
    placement.push({ x: spot.tile.x + spot.dx, z: spot.tile.z + spot.dz, half: POOL_HALF });
    return true;
  }

  // --- Placing things on a tile: the fixtures to dodge, then the scatter itself ---
  // How much clear grass a point at (dx, dz) has from its tile's fixture. Zero or less means it is
  // standing on it. The pool rim is a square, so its gap is the distance out to the square's edge,
  // negative by how deep inside it the point is; the pad and the open middle are round, so theirs is
  // radial. The left tile has no fixture at all any more, but it keeps its middle clear where the
  // Caretaker starts, so the three tiles read as one tidy row rather than two dressed and one bare.
  function fixtureGap(tile, dx, dz) {
    if (tile.x === 0) {
      const outX = Math.abs(dx) - POOL_CLEAR;
      const outZ = Math.abs(dz) - POOL_CLEAR;
      if (outX <= 0 && outZ <= 0) return Math.max(outX, outZ);
      return Math.hypot(Math.max(outX, 0), Math.max(outZ, 0));
    }
    const centre = Math.hypot(dx, dz) - (tile.x < 0 ? CENTRE_CLEAR : PAD_CLEAR);
    if (tile.x > 0) return centre;
    // The left tile also carries the planting bed, so that tile's gap is the smaller of its open
    // middle and the bed's own keep-out: this is what holds every prop PLOT_SIZE clear of the bed's
    // centre, and with it a hand's width of clear grass all round the rails - a prop standing in the
    // middle of the bed being the one thing a player would find in ten seconds. PLOT_SIZE as a
    // radius, not a width, is the makers' own number read literally: it errs outward. Only this one
    // tile is touched, and a prop left with nowhere to stand is simply not placed (placeOne), so the
    // worst this can do is thin that tile's scatter.
    return Math.min(centre, Math.hypot(dx, dz - PLOT_OFFSET_Z) - PLOT_SIZE);
  }

  // One candidate on an axis: a grid position plus a little jitter, so the scatter never reads as a
  // grid. The grid spans the whole axis, ends included, because a prop's usable strip on the pool
  // tile is only the ledge beside the rim and a grid that stopped short of the edge would miss it.
  // A banded axis samples the outer strip alone, which is where the pines belong.
  function sampleOffset(index, outward, banded) {
    const along = index / (CANDIDATE_STEPS - 1);
    const jittered = along + (rng() - 0.5) * (CANDIDATE_JITTER / (CANDIDATE_STEPS - 1));
    const t = Math.min(1, Math.max(0, jittered));
    const offset = banded
      ? outward * (PINE_BAND_INNER + t * (OFFSET_LIMIT - PINE_BAND_INNER))
      : -OFFSET_LIMIT + t * 2 * OFFSET_LIMIT;
    return Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, offset));   // jitter never leaves the tile
  }

  // Fisher-Yates, driven by the same dice, so the order candidates are tried in is fixed by the seed.
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
  }

  // A pool of placeable offsets for one tile: a jittered grid across the square the margin allows,
  // minus anything standing on the tile's fixture. Pines pass an outward sign instead of 0 and get
  // the outer strip only, so the two rim tiles carry a treeline and the middle stays open.
  function buildCandidates(tile, outward) {
    const list = [];
    for (let i = 0; i < CANDIDATE_STEPS; i++) {
      for (let j = 0; j < CANDIDATE_STEPS; j++) {
        const dx = sampleOffset(i, outward, outward !== 0);
        const dz = sampleOffset(j, 0, false);
        if (Math.abs(dx) > OFFSET_LIMIT || Math.abs(dz) > OFFSET_LIMIT) continue;
        if (fixtureGap(tile, dx, dz) < 0) continue;
        list.push({ dx, dz });
      }
    }
    shuffle(list);
    return list;
  }

  // True if a spot leaves `wanted` clear grass between the prop and everything already down. At
  // zero it still means the two footprints do not overlap at all.
  function leavesRoom(spot, kind, wanted) {
    for (let k = 0; k < placed.length; k++) {
      const other = placed[k];
      const apart = Math.hypot(spot.dx - other.dx, spot.dz - other.dz);
      if (apart - kind.footprint - other.footprint < wanted) return false;
    }
    return true;
  }

  // Drop one prop of a kind on the tile: the first candidate, in shuffled order, that clears the
  // tile's fixture and leaves the kind's gap around everything already down. The pool tile's usable
  // ground is only the ledge beside the rim, so that gap is tried at full width, then at half, then
  // at nothing at all - and a spot that would still overlap is refused, so a slot with nowhere to go
  // is left empty rather than stacked on the prop beside it.
  function placeOne(tile, candidates, kind) {
    for (let pass = 0; pass < GAP_RELAX.length; pass++) {
      const wanted = kind.gap * GAP_RELAX[pass];
      for (let i = 0; i < candidates.length; i++) {
        const spot = candidates[i];
        if (fixtureGap(tile, spot.dx, spot.dz) < kind.footprint) continue;
        if (onPurchasableGround(tile.x + spot.dx, spot.dz, kind.footprint)) continue;
        if (kind.large && Math.hypot(spot.dx, spot.dz) < LARGE_CLEAR) continue;
        if (leavesRoom(spot, kind, wanted)) return spot;
      }
    }
    return null;
  }

  // What can be placed and the room each kind needs. Only the bushy kinds ask for the wide centre
  // clearance; a flower or a mushroom may come as close to a fixture as its own footprint allows.
  const PINE_KIND = { footprint: PINE_FOOT, gap: PINE_GAP, large: true };
  const KINDS = {
    bush: { footprint: BUSH_FOOT, gap: PROP_GAP, large: true, build: buildBush },
    flower: { footprint: FLOWER_FOOT, gap: PROP_GAP, large: false, build: buildFlower },
    mushroom: { footprint: MUSHROOM_FOOT, gap: PROP_GAP, large: false, build: buildMushroom },
    stone: { footprint: STONE_FOOT, gap: PROP_GAP, large: false, build: buildStone },
  };
  // PROP_PER_TILE props a tile, walked from a fixed cycle so every kind turns up on every tile
  // instead of leaving the mix to the dice. The middle tile's cycle carries no bush: the pool reaches
  // 0.62 into every corner and a clump that wide has nowhere to stand clear of it.
  const SMALL_CYCLE = ['bush', 'flower', 'mushroom', 'stone', 'flower', 'mushroom', 'stone', 'flower'];
  const POOL_CYCLE = ['flower', 'mushroom', 'stone', 'flower', 'stone', 'mushroom', 'flower', 'stone'];

  // --- Dress one tile: its pines first, so they claim the rim, then the small scatter around them ---
  function dressTile(tile) {
    placed.length = 0;
    const poolTile = tile.x === 0;

    if (!poolTile) {
      const outward = tile.x > 0 ? 1 : -1;
      const candidates = buildCandidates(tile, outward);
      const count = PINE_MIN + Math.floor(rng() * PINE_EXTRA_DRAW);
      for (let i = 0; i < count; i++) {
        const spot = placeOne(tile, candidates, PINE_KIND);
        if (!spot) continue;   // nowhere left on the rim: a thinner treeline beats a stacked one
        placed.push({ dx: spot.dx, dz: spot.dz, footprint: PINE_KIND.footprint });
        tile.group.add(buildPine(tile, spot.dx, spot.dz));
      }
    }

    // The cycle starts somewhere different on each tile, so the row does not repeat one order.
    const cycle = poolTile ? POOL_CYCLE : SMALL_CYCLE;
    const start = Math.floor(rng() * cycle.length);
    const candidates = buildCandidates(tile, 0);
    for (let i = 0; i < PROP_PER_TILE; i++) {
      const kind = KINDS[cycle[(start + i) % cycle.length]];
      const spot = placeOne(tile, candidates, kind);
      if (!spot) continue;
      placed.push({ dx: spot.dx, dz: spot.dz, footprint: kind.footprint });
      tile.group.add(kind.build(tile, spot.dx, spot.dz));
    }

    // Everything this tile took, in island-local units. A plant has to keep clear of the island's
    // whole scatter and `placed` only ever holds the tile being dressed, so each tile hands its own
    // list over as it finishes and never looks at it again.
    for (let i = 0; i < placed.length; i++) {
      scatter.push({ x: tile.x + placed[i].dx, z: tile.z + placed[i].dz, foot: placed[i].footprint });
    }
  }

  for (let i = 0; i < tiles.length; i++) dressTile(tiles[i]);

  // Weather hands the wind in for the frame. Stored clamped, so a caller passing world units of a
  // gale or nothing at all still lands on a sensible sway.
  function setWind(strength) {
    const value = Number.isFinite(strength) ? strength : 0;
    wind = Math.min(1, Math.max(0, value));
  }

  // Sway the pine crowns. A gale bends them hardest, a calm day still breathes, and the slower cross
  // wave keeps a treeline from swaying as one block. Allocates nothing, so calling it every frame is
  // free.
  function update(dt) {
    time += dt;
    const amplitude = SWAY_MAX * (SWAY_CALM_SHARE + SWAY_WIND_SHARE * wind);
    for (let i = 0; i < canopies.length; i++) {
      const canopy = canopies[i];
      canopy.node.rotation.z = amplitude * Math.sin(time * SWAY_RATE + canopy.phase);
      canopy.node.rotation.x =
        amplitude * SWAY_CROSS * Math.sin(time * SWAY_RATE * SWAY_CROSS_RATE + canopy.phase);
    }

    // --- Every bed, every frame ---
    // One tick per bed, in the order the beds went down, each keeping its own bed's middle current in
    // world space for the Caretaker's list of things it can stand beside and advancing its own crop's
    // clock. The tick reads its bed's localToWorld, so the island's spin and the height of the tile
    // the bed sits on are both read off the hierarchy rather than worked out here with sin and cos.
    for (let i = 0; i < bedTicks.length; i++) bedTicks[i].tick(dt);

    // --- The pools' fish, every frame ---
    // Each fish drifts round its pool's own circle at its own rate and bobs a little as it goes, so a
    // pool a player paid for reads as water rather than a plate of blue. Angles are plain numbers and
    // the turn is one multiply, so a pool's two fish cost four sine calls and nothing allocated.
    for (let i = 0; i < fish.length; i++) {
      const one = fish[i];
      one.angle += one.rate * dt;
      one.node.position.set(
        Math.cos(one.angle) * one.radius,
        one.y + Math.sin(time * POOL_FISH_BOB_RATE + one.bob) * POOL_FISH_BOB,
        Math.sin(one.angle) * one.radius
      );
      // Nose first: the body points along +z inside its own group, so the heading that sends it round
      // the circle is the drift's own tangent, a quarter turn off the radius it is standing on.
      one.node.rotation.y = -one.angle + POOL_FISH_TURN;
    }
  }

  return {
    group,
    setWind,
    update,
    canPlant,
    canDecorate,
    plantDecorAt,
    plot,
    beds,
    addBed,
    addPool,
  };
}
