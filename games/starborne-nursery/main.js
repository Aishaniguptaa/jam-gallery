// Starborne Nursery: builds the sky scene and wires everything together — the rotating island
// and its heights, the Sky Train, the minnow in its pool, the launch, the Caretaker, the clock
// and the weather. Every module owns its own numbers and its own meshes; this file
// only decides what runs when.
import * as THREE from 'three';
import { createIsland } from './island.js';
import { createDock } from './dock.js';
import { createTrain } from './train.js';
import { createCreature, CREATURE_KINDS } from './creature.js';
import { createLaunch } from './launch.js';
import { createDayNight } from './daynight.js';
import { createWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createSky } from './sky.js';
import { createProps } from './props.js';
import { createCaretaker } from './caretaker.js';
import { createUI } from './ui.js';
import { GameState } from './gamestate.js';
import {
  ROTATE_KEY_SPEED,
  CAMERA_DISTANCE,
  CAMERA_HEIGHT,
  SKY_COLOR,
  TILE_SIZE,
  TILE_HEIGHT,
  PLATFORM_LENGTH,
  TRAIN_RAIL_GROUND_Y,
  BOARD_LEVEL_TOLERANCE,
  FEED_START,
  COINS_START,
  COINS_PER_FEED_SOLD,
  COINS_PER_FEED_BOUGHT,
  COINS_PER_SEED,
  COINS_PER_EGG,
  DECOR_PLOT_COST,
  DECOR_POOL_COST,
  DECOR_TILE_COST,
  KIND_COSTS,
  SEEDS_START,
  GROW_TIME,
  STARLIGHT_PER_HASTE,
  STARLIGHT_PER_LAUNCH,
  HASTE_GROWTH_SECONDS,
  AUTO_SNAP_RANGE,
} from './tuning.js';

// Scene: open sky, no ground plane.
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);

// Camera: fixed, calm three-quarter view down at the island. Only the island turns.
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
camera.position.set(CAMERA_DISTANCE * 0.55, CAMERA_HEIGHT, CAMERA_DISTANCE * 0.8);
camera.lookAt(0, 0, 0);

// Renderer.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// An optional frame-rate readout, off unless the URL ends in ?fps. Somebody checking the game on a
// slower machine can turn it on without us shipping a debug panel nobody asked for. It reports the
// current, average and worst frame rate over the last few seconds, plus the draw calls and
// triangles the renderer is actually issuing: "it feels smooth on my laptop" is not a claim a
// judge can check, and a draw-call count is what tells you whether the sky or the props cost more.
const FPS_SAMPLE_MS = 500;   // how often the readout refreshes
const FPS_WINDOW = 20;       // samples kept for the average and the worst case: ten seconds

const fpsReadout = new URLSearchParams(location.search).has('fps')
  ? document.createElement('div')
  : null;

if (fpsReadout) {
  fpsReadout.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:20;padding:4px 8px;border-radius:8px;' +
    'white-space:nowrap;' +
    'font:600 12px/1.2 system-ui,-apple-system,sans-serif;color:#2b3440;' +
    'background:rgba(255,255,255,0.82);pointer-events:none;font-variant-numeric:tabular-nums';
  document.body.appendChild(fpsReadout);
}

let fpsFrames = 0;
let fpsSince = performance.now();
// A fixed ring of samples, so the average and the minimum cost nothing to keep and update
// allocates nothing. fpsCount fills to FPS_WINDOW and stops, so a quiet start never reads low.
const fpsSamples = new Float32Array(FPS_WINDOW);
let fpsCount = 0;
let fpsNext = 0;

function tickFps() {
  if (!fpsReadout) return;
  fpsFrames += 1;
  const now = performance.now();
  const elapsed = now - fpsSince;
  if (elapsed < FPS_SAMPLE_MS) return;

  const sample = (fpsFrames * 1000) / elapsed;
  fpsSamples[fpsNext] = sample;
  fpsNext = (fpsNext + 1) % FPS_WINDOW;
  if (fpsCount < FPS_WINDOW) fpsCount += 1;

  let total = 0;
  let worst = Infinity;
  for (let i = 0; i < fpsCount; i++) {
    const value = fpsSamples[i];
    total += value;
    if (value < worst) worst = value;
  }

  const drawn = renderer.info.render;
  fpsReadout.textContent =
    Math.round(sample) + ' fps' +
    '  avg ' + Math.round(total / fpsCount) +
    '  min ' + Math.round(worst) +
    '   |   ' + drawn.calls + ' calls, ' + drawn.triangles + ' tris';

  fpsFrames = 0;
  fpsSince = now;
}

// The clock owns the light and the sky: sun position, light colour and sky colour all follow
// it, so nothing else in this file adds a light.
const daynight = createDayNight(scene);

// The island, the train that visits it, the creature that lives on it, and the heads-up display.
const island = createIsland(scene);
const train = createTrain(scene, island);
const creature = createCreature(scene, island);
const launch = createLaunch(scene, island);
const weather = createWeather(scene);

// Sound: a low bed, the weather over it, and a chime when something happens. Every tone is made in
// code, so there is not one audio file in the project and nothing to credit. It stays silent until
// the player starts the game, because a browser will not let a page make noise before they touch
// it - and the title click is both the gesture it wants and the moment the game actually begins.
const audio = createAudio();

// The boarding platform. It is not the island's: it is bolted to the side of the track, and it
// faces in. When the island is turned to line up, its front edge meets the platform's near edge,
// the two decks are at the same height, and the Caretaker walks straight across with no step at
// all. It hangs off the train's rail group, so it turns with the railway and rises and falls with
// the middle tile without either of them telling it to.
const platform = createDock(scene, train);

// The Caretaker walks on the island, which means it walks on whatever island.tileAt and
// island.getSurfaceY say. The platform is not part of island.js, so those two answers are wrapped
// here rather than in either module: the Caretaker is handed this small object in place of the
// island and cannot tell the difference. dock.js never learns it is walkable, and island.js never
// learns the platform exists - which is what keeps both of them one job each.
//
// A platform point reports the DOCK TILE rather than a tile of its own. The deck is level with that
// tile's grass, so it genuinely is that tile's surface carried out over the sky - and saying so
// means the Caretaker walks out and back along the island's own route check, with no route of its
// own to keep in step. tileAt and getSurfaceY are the only two things caretaker.js asks for that
// island.js does not already answer the same way.
const MIDDLE_TILE = island.tiles.find((tile) => tile.x === 0);
// The tile of the island's row that the platform meets. The makers moved the dock off the middle of
// the row and onto the outer tile at the +X end, so everything that used to hang off the middle tile
// hangs off this one instead: the ground the pier reports underfoot, the boarding spot and the edge
// the island snaps round on, and the height that has to meet the deck before anyone can walk out.
// train.js's DOCK_SHIFT_ALONG_RAIL is the other half of the same move - the deck moved to the tile.
const DOCK_TILE = island.tiles.find((tile) => tile.x > 0) || MIDDLE_TILE;

const walkSurface = {
  get angle() { return island.angle; },
  tiles: island.tiles,

  tileAt(worldX, worldZ) {
    const tile = island.tileAt(worldX, worldZ);
    if (tile) return tile;
    return walkablePlatform(worldX, worldZ) ? DOCK_TILE : null;
  },

  // True when this point is out on the platform rather than on the grass. The deck reports the
  // middle tile so that a walk onto it runs along the island's own route check, but the two are not
  // the same ground: the pier is bolted to the railway and never turns. caretaker.js asks this to
  // tell them apart, and without it two things go wrong. A Caretaker standing on the planks is
  // carried round with the island like one standing on the grass - so the island's own drift, or a
  // snap as the platform comes round, slides it sideways off the deck and out over the sky. And a
  // walk from the far end of the pier to an end tile takes the island's own route, which is a
  // straight line from the planks across the corner of the sky instead of a walk in along the deck.
  onPier(worldX, worldZ) {
    return !island.tileAt(worldX, worldZ) && walkablePlatform(worldX, worldZ);
  },

  getSurfaceY(worldX, worldZ) {
    // The island first, so the grass always wins on the seam where the two meet. Off the island,
    // the platform answers; off both, the island's own "nothing here" goes back untouched, and
    // caretaker.js holds the last good height, exactly as it did before the platform existed.
    const surface = island.getSurfaceY(worldX, worldZ);
    if (Number.isFinite(surface)) return surface;
    return walkablePlatform(worldX, worldZ) ? platform.getDeckY(worldX, worldZ) : surface;
  },
};

// The dock tile's own height, in world units: 0 at its starting level, and the island group sits
// at the world origin with no y of its own and a tile group carries no rotation, so its eased y is
// its world y already. This is the one number that says whether the island can still reach the deck.
function dockTileLift() {
  return DOCK_TILE.group.position.y + TILE_HEIGHT - TRAIN_RAIL_GROUND_Y;
}

// Can the island still meet the platform where it is standing? The deck is on a fixed plane and the
// grass top is not, so this is the whole of the height rule: level, and the two decks are one floor.
function levelMeetsDeck() {
  return Math.abs(dockTileLift()) <= BOARD_LEVEL_TOLERANCE;
}

// The platform is bolted to the railway, so it is only a way out of the island while the two are
// actually joined up. Two things have to hold, and they are the makers' own rules.
//
// Lined up: the island has to be facing the track, or the deck is somewhere along the island's side
// rather than off its edge.
//
// Level: the track is nailed to the world and the middle tile is not, so raising or lowering that
// tile lifts the island's edge away from a platform that stays exactly where it is. The makers chose
// this on purpose - the height mechanic reaches the train, and a player who has lifted the middle
// tile has to put it back before anyone can board.
//
// Both are also the only thing standing between the Caretaker and a walk into open sky. Joined up,
// the deck is a floor; otherwise the same world point is nothing at all and the Caretaker's own
// "hold the last good height" takes over.
function walkablePlatform(worldX, worldZ) {
  return train.isAligned() && levelMeetsDeck() && platform.ownsPoint(worldX, worldZ);
}

const caretaker = createCaretaker(scene, walkSurface);

// The sky: one dome, the clouds, the stars and the drifting sparkles. It never picks its own
// colour - it reads whatever the clock just wrote to scene.background - so there is still only
// one thing in charge of the light, and a weather tint still reaches the whole sky.
const sky = createSky(scene);
// The pines, bushes, flowers, mushrooms and stones that dress the tiles. They hang off each tile's
// own group rather than off the island, so a tile that rises takes its garden up with it.
const props = createProps(scene, island);
const ui = createUI();

// Feed, seeds and coins: the player's three stocks. Feed grows when the train docks and only then;
// coins come only from selling feed back to that same train, which also sells feed and seeds back at
// a worse price. None of them is a score - together they are the two sides of one trade.
let feed = FEED_START;
let seeds = SEEDS_START;
let coins = COINS_START;

// The creature's stage as of last frame, so a change can be heard as well as seen. The stage
// advancing is the only thing in the game that happens with no input at all, and a player watching
// the island is very likely to miss it - the chime is the only thing that tells them.
let lastStage = 0;
let muted = false;

// Input 1: click the canvas to select a tile and walk the Caretaker to it. The island does not turn
// on a drag any more - the makers cut it, and A and D are the only way it spins now.
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const CLICK_SLOP = 6;      // pixels of travel that still count as a click and not a drag
// Two island-local z values, because lining the tracks up and boarding the train are two different
// jobs and doing them from one point broke the second one.
//
// The EDGE is where the platform's near end meets the island's own front edge - the island's
// half-width, since the platform's length is measured from exactly there. It is on the grass, so a
// player can always reach it, which is what makes it the right thing to measure the auto-snap from.
// Measure the snap from further out and it would sit over open sky where nobody can stand, and the
// island could never bring itself round.
//
// The BOARDING spot is out ON the platform, half way along it. Distance to that is what holds the
// train, so a hold means someone actually walked out and got on, not just stood on the grass
// watching it.
const PLATFORM_EDGE_Z = TILE_SIZE / 2;
const PLATFORM_BOARD_Z = TILE_SIZE / 2 + PLATFORM_LENGTH * 0.5;

let dragging = false;
let startX = 0;            // where the press went down, so a click can be told from a drag
let startY = 0;

// A click can land on the platform as well as on the grass. The platform hangs inside train.group
// (it is part of the railway, not the island), so both groups are roots of the same raycast and
// clicking the planks walks the Caretaker out onto them like any other ground. A click that lands
// on a train car instead is harmless: it is off the island, so the tile selection clears and
// walkTo simply refuses the route.
const clickRoots = [island.group, train.group];
if (!platform.group.parent) {
  scene.add(platform.group);
  clickRoots.push(platform.group);
}

// Where a click landed on the island, or null if it missed. This hits the tiles themselves, so
// the point already accounts for the island's spin and for tiles sitting at different heights.
function islandPointAt(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(clickRoots, true);
  return hits.length > 0 ? hits[0].point : null;
}

function clickIsland(event) {
  const point = islandPointAt(event);
  if (!point) return;
  // Pointing at a tile selects it: the ring marks it, and R and Q then raise and lower it.
  island.selectTileAt(point.x, point.z);
  // And the Caretaker sets off for wherever you pointed. walkTo refuses a route that the
  // tile heights have closed, and the Caretaker simply stays put.
  caretaker.walkTo(point.x, point.z);
}

// The two things the Caretaker can walk up to and use. Their positions move — the island turns
// and its tiles rise — so they are recomputed every frame into these fixed vectors.
const poolSpot = new THREE.Vector3();
const launchSpot = new THREE.Vector3();
const edgeSpot = new THREE.Vector3();
const boardSpot = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const tileCentre = new THREE.Vector3();

// A point on a tile top, given in island-local coordinates, turned into a world point for the
// island's yaw as it is right now. The island turns and its tiles rise, so anything that needs a
// live position goes through here rather than caching one.
function spotOnTile(localX, localZ, out) {
  tileCentre.set(localX, 0, localZ).applyAxisAngle(AXIS_Y, island.angle);
  // Through the walk surface, not the island, so a spot out on the pier gets the deck's height
  // rather than the island's "nothing there".
  const groundY = walkSurface.getSurfaceY(tileCentre.x, tileCentre.z);
  return out.set(tileCentre.x, Number.isFinite(groundY) ? groundY : 0, tileCentre.z);
}

// The pool is on the middle tile and the Launch pad on the right-hand one; the train's boarding
// spot is out on the platform. Each is one entry built once and reused, with only its `position`
// written to, every frame.
//
// The train comes and goes: it is only an interactable while it is actually standing at the
// platform, and offering a verb that cannot work is worse than offering nothing, so the two lists
// are two fixed arrays rather than one that grows and shrinks - refreshInteractables runs every
// frame and this file does not allocate in the loop.
//
// Decorations are not in this list at all. The makers wanted them anywhere on the island, and a
// point you can be next to is not the same thing as anywhere, so planting is its own key (G) that
// works wherever the Caretaker is standing - see canPlantDecor below.
const poolEntry = { id: 'pool', label: 'the pool', position: poolSpot };
const launchEntry = { id: 'launch', label: 'release them', position: launchSpot };
const trainEntry = { id: 'train', label: 'trade with the train', position: boardSpot };
// The planting beds belong to props.js, so this file never touches their geometry: it borrows each
// bed's own live world position, exactly as it borrows the pool's, and props keeps those vectors
// current as the island turns. Making them interactables like any other is what keeps E the one key
// that uses whatever the Caretaker is standing beside - including a bed bought five minutes in.
const plotEntries = [];
const interactablesPlain = [poolEntry, launchEntry];
const interactablesAtDock = [poolEntry, launchEntry, trainEntry];

// A bed entry carries the bed itself, so E can act on the one the Caretaker is actually standing
// beside rather than on whichever bed happens to be first in the list. A bed bought during play is
// added to both lists the moment it arrives, which is why these are the same arrays refreshInteractables
// has always handed to the Caretaker rather than a fresh list each frame.
function addBedInteractable(bed) {
  const entry = { id: 'plot', label: 'the planting bed', position: bed.position, bed };
  plotEntries.push(entry);
  interactablesPlain.push(entry);
  interactablesAtDock.push(entry);
}

// The bed the island starts with, and every one bought after it - props keeps them all in order, the
// makers' first bed at the front. A bed bought later is added to the same lists as it arrives, so E
// keeps working on the one the Caretaker is standing beside.
props.beds.forEach(addBedInteractable);

function refreshInteractables() {
  // Every spot is recomputed every frame: the island turns, its tiles rise and fall, and the
  // platform is carried round by the railway.
  spotOnTile(0, 0, poolSpot);
  spotOnTile(TILE_SIZE, 0, launchSpot);
  // The platform meets the island's +X end tile now, so both its spots sit on that tile's edge
  // rather than the middle tile's: the edge the snap is measured from, and the boarding spot out on
  // the planks. TILE_SIZE is that tile's own island-local x, which is also the column the deck runs
  // down - the two numbers come from the same move in train.js.
  spotOnTile(TILE_SIZE, PLATFORM_EDGE_Z, edgeSpot);
  spotOnTile(TILE_SIZE, PLATFORM_BOARD_Z, boardSpot);

  caretaker.setInteractables(train.isAtDock() ? interactablesAtDock : interactablesPlain);
}

// Whether a decoration could be planted right now: a seed is in hand and the island has room for
// one more. Both the key and the hint ask this same question, so the sign can never advertise a key
// that would do nothing. Seeds are what the train sells for planting, so the coin price moved to the
// shop with them and this is a stock check now rather than an affordability one.
//
// Room for a decoration is props' canDecorate, not its canPlant: canPlant answers "is some crop bed
// empty", which is the seed key's question, and asking it here refused G whenever every bed happened
// to be planted - a key that stopped working for a reason that had nothing to do with it.
function canPlantDecor() {
  return props.canDecorate() && seeds > 0;
}

// How far the Caretaker is from the platform's near edge, measured across the ground. This is the
// design doc's "snap into place" trigger: get within AUTO_SNAP_RANGE of that one point and the
// island eases itself the last few degrees onto the rail. Only the snap uses a distance - holding
// the train asks the platform whether the Caretaker is standing on it, which needs no radius.
function distanceToEdge() {
  const here = caretaker.getPosition();
  return Math.hypot(here.x - edgeSpot.x, here.z - edgeSpot.z);
}

let wasNearDock = false;   // last frame's test, so the snap fires on arrival and not every frame
let wasTrainHere = false;  // and the same trick for the train's whistle, which has no event of its own

// How hard the wind is blowing, 0..1, read straight off the weather. Only the pines use it, and
// they are the one thing on the island that shows a gale: the rain is in the sky, but the trees
// are what tell you it is windy while you are looking at the ground.
function windStrength() {
  const kind = weather.getKind();
  if (kind === 'storm') return 1;
  if (kind === 'wind') return 0.7;
  return 0;
}

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});

// Nothing needs to happen while the pointer is down any more: the island turns on the keyboard, and
// a press that moves is simply a press that will not count as a click. That is also what stops a
// drag from nudging the island and moving the ground under the Caretaker's feet mid-click.
canvas.addEventListener('pointerup', (e) => {
  const wasDown = dragging;
  dragging = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

  const travel = Math.hypot(e.clientX - startX, e.clientY - startY);
  if (wasDown && travel < CLICK_SLOP && state === 'playing') clickIsland(e);
});

canvas.addEventListener('pointercancel', () => {
  dragging = false;
});

// Input 2: hold A/left or D/right to spin the island.
const held = new Set();
addEventListener('keydown', (e) => held.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// State. The doc has no score, no fail and no ending: the game never stops, so the
// only states are 'title' (before the first click) and 'playing' (from then on).
let state = 'title'; // 'title' | 'playing'

// What the Caretaker is standing beside right now, or null. Reads whatever the last frame's
// refreshInteractables decided, which is why it is safe to call from an event handler.
function nearId() {
  const near = caretaker.getNearby();
  return near ? near.id : null;
}

// Feeding and releasing both have two routes to them - a direct key, and standing in the right
// place and pressing E - and both should sound the same whichever way the player got there. So the
// two of them live here rather than being written out twice and drifting.
function tryFeed() {
  if (!creature.hasEgg() || feed <= 0 || !creature.feed()) return;
  feed -= 1;
  audio.playFeed();
}

function releaseCreature() {
  if (!creature.isGrown()) return;
  launch.start(currentKind);   // the kind tells the launch what sort of animal to leave in the sky
  audio.playLaunch();
}

// --- The shop at the train ---
// E at the train opens one panel and every trade in the game happens inside it, on three tabs:
// Crops (what you carry, eat, and raise), Starlight (what the launched creatures earn you buys more
// kinds of fish), and Decor (more ground to grow on, and pools to look at).
//
// Two currencies, and they never meet: coins buy feed, seeds, eggs and the ground and water to put
// them in; starlight buys kinds of fish. Starlight only ever comes from a launch, so the loop is
// bought egg -> raised minnow -> launch -> light -> a rarer creature in the pool.
//
// The prices are the makers', and they live in tuning.js with the feed and seed prices they belong
// beside: COINS_PER_EGG, DECOR_PLOT_COST, DECOR_POOL_COST and KIND_COSTS.

// This file owns the stocks, the kinds and the island's purchases; the panel owns none of it. Every
// row hands its id over, this changes the numbers and hands the panel a fresh catalogue to draw
// itself from. There is one copy of the truth, so a purchase cannot be counted twice and a stale
// panel cannot show money that is already spent.
let unlockedKinds = new Set(['cloudminnow']);
let currentKind = 'cloudminnow';
// Eggs bought at the train are carried, not dropped in the water, and the makers wanted to be able to
// carry several at once and tell them apart. So this is a tally by kind - kind id -> how many of that
// egg are in the Caretaker's basket - rather than a single egg. Empty is an empty map.
const eggHold = new Map();

// Which panel is up, 'train' or 'pool' - the same panel serves both, and the rule that closes it
// when the Caretaker walks away has to know which one to watch.
let panelOwner = null;

function holdCount(kind) {
  return eggHold.get(kind) || 0;
}

function heldTotal() {
  let n = 0;
  for (const count of eggHold.values()) n += count;
  return n;
}
let tilesBought = 0;    // extra tiles of island bought, on top of the three it starts with
let bedsBuilt = 0;      // extra beds bought, on top of the one the island starts with
let poolsBuilt = 0;
let bedsExhausted = false;   // props said there is nowhere left to put one
let poolsExhausted = false;

function kindName(id) {
  const found = CREATURE_KINDS.find((kind) => kind.id === id);
  return found ? found.name : id;
}

// The catalogue the panel draws: the hold line, and three tabs of rows. Rebuilt on every purchase and
// on every redraw, so the prices, the greyed-out rows and the notes are always about right now.
function shopCatalogue(tab) {
  const kinds = CREATURE_KINDS.map((kind) => {
    const unlocked = unlockedKinds.has(kind.id);
    const worn = unlocked && currentKind === kind.id;
    return {
      id: `kind:${kind.id}`,
      label: kind.name,
      price: unlocked ? 0 : KIND_COSTS[kind.id] || 0,
      currency: 'starlight',
      verb: worn ? 'Hatching' : unlocked ? 'Hatch' : 'Unlock',
      note: worn ? `${kind.blurb} — next in the pool` : kind.blurb,
      state: worn ? 'worn' : unlocked ? 'owned' : 'buy',
    };
  });

  // One egg row per kind that has been unlocked, so the eggs in the basket are told apart by name
  // before they are bought and not only after. The row says how many of that kind are already in the
  // basket, which is the only number that matters once eggs can be carried more than one at a time.
  // They have a tab of their own - the makers asked for it - because buying an egg is the one trade
  // that is not a trade for the garden: it is the errand that starts a creature.
  const eggRows = [...unlockedKinds].map((kind) => ({
    id: `egg:${kind}`,
    label: `An egg · ${kindName(kind)}`,
    price: COINS_PER_EGG,
    currency: 'coins',
    verb: 'Buy',
    note: holdCount(kind) > 0 ? `you carry ${holdCount(kind)}` : 'take it to the pool to place it',
  }));

  return {
    // No tab named unless a caller names one: the panel keeps whichever tab the player was on, so a
    // purchase no longer throws them back to Crops and hides the row they just pressed.
    tab,
    title: 'The sky train',
    flavour: 'It trades in crops, starlight and things for the garden.',
    hold: { coins, starlight: launch.getStarlight(), feed, seeds },
    tabs: [
      { id: 'crops', label: 'Crops', rows: [
        { id: 'feed', key: '1', label: 'Feed', price: COINS_PER_FEED_BOUGHT, currency: 'coins', verb: 'Buy' },
        { id: 'seed', key: '2', label: 'Seed', price: COINS_PER_SEED, currency: 'coins', verb: 'Buy' },
        { id: 'sell', key: '4', label: 'Sell a feed', price: COINS_PER_FEED_SOLD, currency: 'coins', verb: 'Sell' },
      ] },
      { id: 'eggs', label: 'Eggs', rows: eggRows },
      { id: 'starlight', label: 'Starlight', rows: kinds.concat([
        // The makers moved the tile here out of Decor: it is bought with starlight, so it belongs on
        // the tab that spends starlight. A launch pays STARLIGHT_PER_LAUNCH, so the note says where
        // the price comes from - the row is dimmed until there is enough, and a dimmed row with no
        // explanation is the one thing that reads as a broken button.
        {
          id: 'decor:tile',
          label: 'Another island tile',
          price: DECOR_TILE_COST,
          currency: 'starlight',
          verb: 'Add',
          note: `grows the island to ${island.tiles.length + 1} tiles, away from the dock` +
            ` · a launch earns ${STARLIGHT_PER_LAUNCH}`,
        },
      ]) },
      { id: 'decor', label: 'Decor', rows: [
        {
          id: 'decor:bed', label: 'A crop bed', price: DECOR_PLOT_COST, currency: 'coins', verb: 'Add',
          note: bedsExhausted ? 'the island has no room for another'
            : `${bedsBuilt} added · another place to plant`,
          state: bedsExhausted ? 'max' : 'buy',
        },
        {
          id: 'decor:pool', label: 'A pool', price: DECOR_POOL_COST, currency: 'coins', verb: 'Add',
          note: poolsExhausted ? 'the island has no room for another' : 'still water, and somewhere to sit',
          state: poolsExhausted ? 'max' : 'buy',
        },
      ] },
    ],
  };
}

// The pool's panel: the same panel, with the eggs the Caretaker is carrying and nothing to pay. It
// draws itself from the basket, so a kind that has been used up simply stops having a row.
function poolCatalogue() {
  const rows = [...eggHold.entries()].map(([kind, count]) => ({
    id: `pick:${kind}`,
    label: `A ${kindName(kind)} egg`,
    note: count > 1 ? `you carry ${count}` : 'the only one',
    verb: 'Place',
    state: 'buy',
  }));

  // An empty basket still opens the panel, because E at the pool has to answer somehow: a key that
  // does nothing at all reads as a broken key, and the player who has walked all the way to the water
  // deserves to be told where the eggs are.
  if (!rows.length) {
    rows.push({
      id: 'pick:none',
      label: 'You are not carrying any eggs',
      note: 'the train sells them',
      verb: '—',
      state: 'max',
    });
  }

  return {
    tab: 'eggs',
    title: 'The pool',
    flavour: 'Which egg will you put in the water?',
    hold: { coins, starlight: launch.getStarlight(), feed, seeds },
    tabs: [{ id: 'eggs', label: 'Eggs', rows }],
  };
}

// A refused purchase has to say why. The rows now keep their dimmed look but stay pressable, so this
// is the one place that answers a press the player cannot pay for - on the panel's own flavour line,
// right above the price. It exists because the makers pressed Add on the island tile, got nothing at
// all, and reasonably called it broken: a shop that goes silent reads as a bug, not as a price.
function shopRefused(what, price, currency) {
  const held = currency === 'starlight' ? launch.getStarlight() : coins;
  const from = currency === 'starlight'
    ? ` Starlight comes from a launch: ${STARLIGHT_PER_LAUNCH} a release.`
    : ' The train buys a feed back for coins.';
  const catalogue = shopCatalogue();
  catalogue.flavour = `Not quite: ${what} is ${price} ${currency} and you hold ${held}.` + from;
  return catalogue;
}

ui.onShopBuy = (id) => {
  if (id === 'feed') {
    if (coins < COINS_PER_FEED_BOUGHT) return shopRefused('a feed', COINS_PER_FEED_BOUGHT, 'coins');
    coins -= COINS_PER_FEED_BOUGHT;
    feed += 1;
  } else if (id === 'seed') {
    if (coins < COINS_PER_SEED) return shopRefused('a seed', COINS_PER_SEED, 'coins');
    coins -= COINS_PER_SEED;
    seeds += 1;
  } else if (id.startsWith('egg:')) {
    // An egg is the only way anything gets raised, and what is bought is carried rather than dropped
    // in: it used to land in the water the moment it was paid for, which skipped the pool and the
    // walk to it. The makers wanted the placing to be a thing the player does, and to be able to
    // carry more than one egg and tell them apart, so the basket takes any number of any unlocked
    // kind and the pool stays empty until one is chosen at the pool.
    const kind = id.slice(4);
    if (!unlockedKinds.has(kind)) return null;
    if (coins < COINS_PER_EGG) return shopRefused(`a ${kindName(kind)} egg`, COINS_PER_EGG, 'coins');
    coins -= COINS_PER_EGG;
    eggHold.set(kind, holdCount(kind) + 1);
  } else if (id.startsWith('pick:')) {
    // The pool's own panel: the player picked one of the eggs they are carrying. It only ever lands
    // in an empty pool, and the row is gone from the panel afterwards because the picker is redrawn
    // from the basket - an egg that has been placed is not an egg any more.
    const kind = id.slice(5);
    if (creature.hasEgg() || holdCount(kind) < 1) return null;
    if (holdCount(kind) === 1) eggHold.delete(kind);
    else eggHold.set(kind, holdCount(kind) - 1);
    creature.layEgg(kind);
    currentKind = kind;
    audio.playPlant();
    ui.closeShop();
    return null;
  } else if (id.startsWith('kind:')) {
    const kind = id.slice(5);
    if (unlockedKinds.has(kind)) {
      currentKind = kind;                     // already bought: choosing one costs nothing
      creature.setKind(kind);
    } else {
      const cost = KIND_COSTS[kind] || 0;
      if (launch.spendStarlight(cost)) {
        unlockedKinds.add(kind);
        currentKind = kind;
        creature.setKind(kind);
      } else {
        return shopRefused(kindName(kind), cost, 'starlight');
      }
    }
  } else if (id === 'decor:bed') {
    // The island is asked first and the coins are spent second, so a bed that props could not find a
    // home for costs nothing: there is no refund to make because nothing was charged.
    if (bedsExhausted) return null;
    if (coins < DECOR_PLOT_COST) return shopRefused('a crop bed', DECOR_PLOT_COST, 'coins');
    if (!props.addBed()) {
      bedsExhausted = true;
      return shopCatalogue();
    }
    coins -= DECOR_PLOT_COST;
    bedsBuilt += 1;
    addBedInteractable(props.beds[props.beds.length - 1]);
  } else if (id === 'decor:tile') {
    // Another tile of island, bought with starlight - the makers' price is one. It goes on the far
    // end, away from the dock, and it is built by the same code as the three the island started with.
    // The new tile lands off the edge of what the camera frames, so the panel says where it went:
    // a purchase the player cannot see is a purchase that did not happen, which is exactly how the
    // makers read this row the first two times they pressed it.
    if (launch.getStarlight() < DECOR_TILE_COST) {
      return shopRefused('another tile of island', DECOR_TILE_COST, 'starlight');
    }
    if (!island.addTile()) return null;
    launch.spendStarlight(DECOR_TILE_COST);
    tilesBought += 1;
    audio.playBuy();
    const built = shopCatalogue();
    built.flavour = `The island is ${island.tiles.length} tiles wide now - the new one is on the` +
      ' far end, away from the dock.';
    return built;
  } else if (id === 'decor:pool') {
    if (poolsExhausted) return null;
    if (coins < DECOR_POOL_COST) return shopRefused('a pool', DECOR_POOL_COST, 'coins');
    if (!props.addPool()) {
      poolsExhausted = true;
      return shopCatalogue();
    }
    coins -= DECOR_POOL_COST;
    poolsBuilt += 1;
  } else {
    return null;                              // an unknown row is refused rather than guessed at
  }
  audio.playBuy();
  return shopCatalogue();
};

// Selling is the only way coins are earned, and it always costs a meal. That is the whole price.
ui.onShopSell = () => {
  if (feed <= 0) return null;
  feed -= 1;
  coins += COINS_PER_FEED_SOLD;
  audio.playSell();
  return shopCatalogue();
};

// Input 3: the things a player can do, once the game is running. Auto-repeat is ignored, so one
// press is one use.
//   F  feed the minnow - spends one feed, and only if it actually takes the food
//   H  hurry the minnow along at the pool - spends starlight to buy it time
//   L  release a grown minnow from the Launch pad. Starlight is earned only by launching.
//   R  raise the selected tile one step      Q  lower it one step
//   E  use whatever the Caretaker is standing beside. At the train, open the shop.
//   In the shop: the digits press the rows of the tab that is showing, Tab and the arrows move
//   between the three tabs, and E or Escape closes it.
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (state !== 'playing') return;
  const key = e.key.toLowerCase();

  // The shop is modal while it is open: the panel owns every key - its digits press the rows of the
  // tab that is showing, Tab and the arrows move between tabs, E and Escape close it - and this
  // handler only has to make sure nothing else happens. It used to answer 1, 2 and 3 itself, from
  // when the shop was one flat list of three rows; with four rows on three tabs those numbers meant
  // the wrong thing, so the panel answers them now and this file stays out of it.
  if (ui.isShopOpen()) {
    // The panel's own footer promises "E or Escape closes", and the panel only answers Escape. E is
    // the key that opened it, so E is the key a player will try, and a panel that ignores the promise
    // it prints under itself reads as broken however well the Escape key works.
    if (key === 'e') ui.closeShop();
    return;
  }

  if (key === 'f') {
    tryFeed();
  } else if (key === 'h') {
    // Time is the one thing starlight buys, and only at the pool - starlight is spent on the
    // creature, never carried around as a shopping token. spendStarlight refuses if there is not
    // enough, so the creature is never hurried on credit.
    if (nearId() === 'pool' && creature.hasEgg() && launch.spendStarlight(STARLIGHT_PER_HASTE)) {
      creature.haste(HASTE_GROWTH_SECONDS);
    }
  } else if (key === 'l') {
    releaseCreature();
  } else if (key === 'g') {
    // Decorations plant wherever the Caretaker is standing - the spot is chosen by walking to it,
    // which is the verb the game already has. props refuses a point that is off the island, in the
    // pool, on the launch pad or crowded against another decoration, and a refusal costs nothing,
    // so this never takes the coins for a decoration that did not appear.
    const here = caretaker.getPosition();
    if (canPlantDecor() && props.plantDecorAt(here.x, here.z)) {
      seeds -= 1;
      audio.playPlant();
    }
  } else if (key === 'm') {
    // A page that makes noise owes the player a way to stop it. It is not on the sign because the
    // sign is a short line and this is not something a player needs told twice.
    muted = !muted;
    audio.setMuted(muted);
  } else if (key === 'r') {
    // The island's heights are moved straight from the keyboard rather than through a lever on one
    // tile. Click a tile to select it, then R and Q step it up and down. island.js holds the level
    // between TILE_LEVEL_MIN and TILE_LEVEL_MAX and refuses a step past either end, so nothing
    // wraps round and the island cannot be broken.
    island.raiseSelected();
  } else if (key === 'q') {
    island.lowerSelected();
  } else if (key === 'e') {
    // E uses whatever the Caretaker is standing next to. Walk to it first.
    const near = caretaker.getNearby();
    if (!near) return;

    if (near.id === 'pool') {
      // An empty pool with eggs in the basket asks which one goes in: the makers wanted the kinds
      // told apart and chosen, so this is a panel and not a guess at the first egg in the map. With
      // something already swimming there is nothing to place, and E is the feed it always was.
      if (!creature.hasEgg()) {
        ui.openShop(poolCatalogue());   // with an empty basket the panel says so rather than nothing
        panelOwner = 'pool';
      } else {
        tryFeed();
      }
    } else if (near.id === 'launch') {
      releaseCreature();
    } else if (near.id === 'train') {
      // The train's whole trade is the shop: crops, kinds of fish, and things for the island, with
      // the prices on the panel where they can be read before anything is spent.
      // Opening it is also what tells the first train of a run that it has been used: from here it
      // is an ordinary visit with a full window, and the cycle carries on as normal.
      train.noteInteraction();
      ui.openShop(shopCatalogue());
      panelOwner = 'train';
    } else if (near.id === 'plot') {
      // One key for both ends of the bed: a seed goes in while it is empty, and the crop comes out
      // once it is ripe. A picked crop is a feed - the same meal the train sells, grown here - so the
      // bed is the island's own slow way of making food out of a seed that cost less than a feed.
      // It is the bed the Caretaker is beside, not the first one built.
      const bed = near.bed;
      if (bed.harvest()) {
        feed += 1;
        audio.playPick();
      } else if (seeds > 0 && bed.plant()) {
        seeds -= 1;
        audio.playPlant();
      }
    }
  }
});

// Debug: T fast-forwards the clock, so the dusk and the night can be checked in seconds
// instead of waited for. Works in every state, including the title screen.
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key.toLowerCase() === 't') daynight.skipHours();
});

// One line of guidance at the top of the sign, in priority order. None of it is a rule: there is no
// timer, no score and no way to lose.
//
// The list used to be a plain priority order, and that is exactly what went wrong with the tile
// heights. Clicking a tile both selects it and walks the Caretaker onto it, and the pool sits at
// the middle tile's own centre - so the pool prompt fired on every click, and "Press R to raise
// this tile" never got a turn at the bottom of the list. Reordering would only have moved which
// prompt went missing. Both things are true at the same moment and both are worth knowing, so when
// they collide the line says both, short.
// The one line for a middle tile that has been lifted off the platform's plane. It names which way
// the island is off, because "level the tile" is not actionable until you know you are too high or
// too low, and then it names the key - or, if nothing is selected, the thing to do first. It reads
// the selection live, so the same line turns into the instruction the moment a tile is picked.
function levelHint() {
  const side = dockTileLift() > 0 ? 'above' : 'below';
  const fix = island.getSelected() === DOCK_TILE
    ? (dockTileLift() > 0 ? 'Q lowers the dock tile' : 'R raises the dock tile')
    : 'select the dock tile to level it';
  return `The island is ${side} the platform  ·  ${fix}`;
}

function hintFor() {
  if (launch.isBusy()) return '';

  const near = caretaker.getNearby();
  const shift = island.getSelected() ? '  ·  R/Q shift this tile' : '';

  // Standing next to something beats every other hint: it is the one thing you can do here.
  if (near) {
    if (near.id === 'train') {
      // One line, and it is the same line whatever the player is carrying: the shop behind it shows
      // the prices, so this only has to say that the trade is here and how to open it.
      return `E ${near.label}  ·  feed ${COINS_PER_FEED_BOUGHT}, seeds ${COINS_PER_SEED}`;
    }
    if (near.id === 'pool') {
      if (creature.hasEgg()) {
        const hurry = launch.getStarlight() >= STARLIGHT_PER_HASTE ? '  ·  H hurries it along' : '';
        return `E ${near.label}${hurry}${shift}`;
      }
      if (heldTotal() > 0) {
        return heldTotal() === 1
          ? 'E place your egg in the pool'
          : `E choose which egg goes in the pool  ·  you carry ${heldTotal()}`;
      }
      return 'The pool is empty · the train sells eggs';
    }
    if (near.id === 'plot') {
      // The bed says what it can take right now, which is different at each of its three states.
      const bed = near.bed.state();
      if (bed === 'ripe') return 'E pick the crop  ·  it feeds the minnow';
      if (bed === 'growing') return 'The bed is growing  ·  come back in a moment';
      return seeds > 0
        ? `E plant a seed  ·  ripe in ${GROW_TIME} seconds`
        : 'The bed is empty  ·  the train sells seeds';
    }
    return `E ${near.label}${shift}`;
  }

  // Then the train, which outranks the creature hints because a train at the dock is something you
  // can only act on right now, while the pool and the pad will still be there in a minute.
  if (train.isAtDock()) {
    if (train.isHeld()) return 'The train is waiting for you';
    if (!train.isAligned()) return 'Walk out to the platform to line up the tracks';
    // Level goes here as well as below, because this is the moment it costs something and the player
    // is looking at the platform. Falling through to the feed lines while the island was stranded a
    // hand's width above the deck would be the game quietly lying to the player.
    if (!levelMeetsDeck()) return levelHint();
  }

  // And the same thing again before anything is due. A middle tile that has been lifted stops the
  // island reaching the platform whether or not a train is on its way, so the player needs to hear it
  // early enough to do something about it - but underneath the train's own lines, because a train
  // waiting at the dock is still the more urgent thing to answer.
  if (!levelMeetsDeck()) return levelHint();

  // An empty pool outranks the feed lines: there is nothing to feed, and the only way to a new egg is
  // the train's shop, which is worth saying plainly rather than leaving the player pressing F at an
  // empty pool and concluding the game is broken. An egg already bought and being carried says the
  // last step of that errand instead, because the player has done the hard part and only has to walk.
  if (!creature.hasEgg()) {
    if (heldTotal() === 1) return 'Carrying an egg - walk to the pool and press E';
    if (heldTotal() > 1) return `Carrying ${heldTotal()} eggs - walk to the pool and press E`;
    return 'The pool is empty - the train sells eggs';
  }

  // Out of feed is only really out of feed if the train's price is out of reach too: coins are a
  // second way back in, so saying "nothing you can do" while the player could buy a feed would be a
  // lie the game tells about itself.
  if (feed === 0 && coins < COINS_PER_FEED_BOUGHT) return 'Out of feed - the train brings more';
  if (creature.isGrown()) return 'Walk to the Launch pad, or press L';
  if (creature.getHunger() < 0.35) return 'Walk to the pool, or press F to feed';

  // Last, the island itself: the heights, and planting. Both come straight off the keyboard and
  // neither is guessable, so they sit at the bottom of this list and speak up whenever nothing more
  // urgent is going on. They are said together rather than in turn - the last time two prompts
  // competed for this line, one of them never got a turn at all.
  const plant = canPlantDecor()
    ? '  ·  G plants a decoration'
    : seeds === 0 ? '  ·  the train sells seeds' : '';
  if (island.getSelected()) return `R raises this tile, Q lowers it${plant}`;
  return `Click a tile to select it${plant}`;
}

function startRound(name) {
  GameState.setName(name); // blank keeps whatever we had; it is never empty
  train.reset();
  // A run starts with an empty pool: the first egg is bought at the train like every egg after it,
  // which is what makes the shop the first place the game sends you rather than somewhere you find
  // later. clearEgg leaves the water and the rim standing, so the pool still reads as a pool.
  creature.clearEgg();
  creature.setKind(currentKind = 'cloudminnow');
  eggHold.clear();          // a fresh run starts empty-handed, like the pool
  unlockedKinds = new Set(['cloudminnow']);
  launch.reset();
  caretaker.reset();
  island.clearSelection();
  feed = FEED_START;
  seeds = SEEDS_START;
  coins = COINS_START;
  ui.closeShop();           // a fresh run starts with the panel shut, whatever the last one left
  panelOwner = null;
  lastStage = creature.getStage();
  wasNearDock = false;      // a fresh run has not been out to the platform yet
  // The click or the space bar that got us here is also the gesture a browser insists on before a
  // page may make a sound, so this is the one moment the bed can come up without being blocked.
  audio.start();
  ui.setStatus('');
  state = 'playing';
  ui.showPlaying();
}

ui.onStart = (name) => startRound(name);

// Boot: land on the title screen, with the Caretaker's name already in the field if we have one.
state = 'title';
ui.prefillName(GameState.storedName);
ui.showStart();

// Game loop: held keys rotate, the island eases toward its target, then the train ticks.
// The game loop starts here, and nothing else. The scratch hook the jam companion used to test this
// file by hand - window.__jam - went with the probe page before shipping: it was a way into the
// running game for one terminal, and a shipped game should not have one.


const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  if (state === 'playing') {
    if (held.has('a') || held.has('arrowleft')) island.rotateBy(ROTATE_KEY_SPEED * dt);
    if (held.has('d') || held.has('arrowright')) island.rotateBy(-ROTATE_KEY_SPEED * dt);
  }
  island.update(dt); // writes the island transform, so it runs in every state
  caretaker.update(dt); // and the Caretaker keeps walking even if the island moves under it
  refreshInteractables(); // after the island has moved, so the spots are current

  // Boarding, now that the spots are current. Two of the design doc's rules hang off the platform.
  //
  // The hold is not a distance: it is whether the Caretaker is standing on the deck, asked of the
  // platform itself. That makes it exact - on the deck holds the train, on the grass one step short
  // of it does not - and it needs no radius. Not gated on alignment or on level, either: the deck is
  // only somewhere the Caretaker can be at all once the island is lined up AND level with it, so both
  // are implied by standing there.
  const here = caretaker.getPosition();
  train.setHeld(platform.ownsPoint(here.x, here.z));

  // The deck is drawn always. It used to appear only once the tracks lined up, and the makers cut
  // that: a pier you can watch blink in and out of existence was the clearest bug in the scene, and
  // a deck built onto a railway belongs to the railway whatever the island is doing underneath it.
  // Nothing is lost by it, because walkablePlatform below still asks both of the real questions -
  // lined up AND level - before the deck counts as somewhere the Caretaker can stand, so the deck
  // showing does not promise a floor that is not there.

  // Lining it up IS a distance, and it is measured from the platform's near edge - which is the
  // island's own front edge, so it is a point on the grass the Caretaker can walk to whatever way the
  // island happens to be facing. On arrival only: snapping every frame would fight the player's own
  // turning, and they are still allowed to overrule it, because island.rotateBy cancels a snap, so a
  // tap of A or D after this wins.
  // A panel closes when the thing it belongs to is no longer under the Caretaker's feet: the train's
  // when they walk off the platform or the train leaves, the pool's when they step away from the
  // water. It used to be the train's rule for every panel, which shut the pool's the instant it
  // opened - E at the pool brought the picker up and this line took it down again in the same frame,
  // so the one thing the makers asked for was the one thing that could not be seen. Which panel is
  // up is remembered where each of them is opened, because the two are the same panel and the same
  // id would not tell them apart.
  if (ui.isShopOpen()) {
    const strayed = panelOwner === 'pool'
      ? nearId() !== 'pool'
      : (nearId() !== 'train' || !train.isAtDock());
    if (strayed) ui.closeShop();
  }

  const nearDock = distanceToEdge() <= AUTO_SNAP_RANGE;
  if (nearDock && !wasNearDock) island.snapToView(train.getRailAngle());
  wasNearDock = nearDock;

  // Once the ground the Caretaker is standing on stops being ground - the island has drifted off the
  // line, or the middle tile has been lifted away from the deck - there is nothing under them any
  // more and walkTo will refuse every route, so they are set back down on the island rather than left
  // standing in the air. This is the only place in the game that moves the Caretaker without being
  // asked, and it only fires when the alternative is being stranded; turning the island back round,
  // or putting the tile back, undoes it.
  //
  // walkSurface is asked rather than island, because walkSurface answers for the deck as well: a
  // Caretaker legitimately out on the platform is standing on ground, and must not be yanked home
  // for it.
  if (!caretaker.isWalking() && !walkSurface.tileAt(here.x, here.z)) {
    caretaker.reset();
  }

  // Weather keeps its own time, and the sky hears it: a spell tints the sky, a storm flashes it.
  // The clock applies both, so this has to come before daynight.update.
  weather.update(dt);
  // Sound follows the same two things the look does: the weather it can hear, and nothing else that
  // moves on its own. getKind is read once and handed to both, so the wind and the rain can never
  // disagree about what the weather is doing.
  const weatherKind = weather.getKind();
  audio.setWeather(windStrength(), weatherKind === 'rain' || weatherKind === 'storm');
  // The night is a quieter piece of music rather than a different one, and the clock's own smooth
  // daylight ramp is what it leans on - the same ramp the stars fade in across.
  audio.update(dt, daynight.getDayness());
  // The island grinding round on its bearings, and only while the player is actually turning it: a
  // snap or the island's own slow drift is not the player's work, so it makes no noise of its own.
  audio.setTurning(held.has('a') || held.has('arrowleft') || held.has('d') || held.has('arrowright'));
  // The pines lean with it, scaled by how hard it is blowing. Runs in every state, like the
  // island: the weather is not something the player starts.
  props.setWind(windStrength());
  props.update(dt);
  daynight.setWeatherTint(weather.getTint(), weather.getTintAmount());
  daynight.setFlash(weather.getFlash());
  daynight.update(dt); // and the clock runs whether or not the game has started

  // The sky reads the colour the clock just wrote to scene.background. Night comes from the
  // clock's smooth daylight ramp rather than its yes/no isNight(), so the stars fade in across
  // the dusk instead of switching on the instant the sun crosses the horizon.
  sky.setBase(scene.background);
  sky.setNight(1 - daynight.getDayness());
  sky.update(dt);

  if (state === 'playing') {
    const event = train.update(dt);
    // The whistle: heard the moment the train lines up at the berth and again as it pulls out, so a
    // visit announces itself from across the island whether or not the player is watching the rails.
    // Arrival is the dock turning true rather than an event, which is why it is tracked here.
    const trainHere = train.isAtDock();
    if (trainHere && !wasTrainHere) audio.playArrive();
    wasTrainHere = trainHere;
    if (event === 'departed') audio.playDepart();
    // Nothing is handed over when the train arrives. It used to pay out FEED_PER_DOCK feeds the
    // moment it lined up, which the makers cut: food comes from the train's shop or from the
    // planting bed, and a train that fed you for free made both of them pointless. The visit hands
    // back 'departed' and nothing else - there is no score, so there is nothing to lose by it.

    creature.update(dt);

    // The stage changing is the one thing in the game that happens with no input at all, so it is
    // the thing a player is most likely to miss entirely. The chime is what tells them.
    const stage = creature.getStage();
    if (stage !== lastStage) {
      lastStage = stage;
      audio.playGrow();
    }

    // The release finishes and the pool is left empty. That is the loop the makers wanted: a launch
    // earns starlight, and the next egg is bought with coins at the train, so the nursery never
    // refills itself for free. lastStage is re-read here because an empty pool is a stage the chime
    // above must not announce.
    if (launch.update(dt) === 'launched') {
      creature.clearEgg();
      lastStage = creature.getStage();
    }

    ui.setHunger(creature.getHunger());
    ui.setStage(creature.getStageName());
    ui.setFeed(feed);
    ui.setSeeds(seeds);
    ui.setCoins(coins);
    ui.setStarlight(launch.getStarlight());
    ui.setHint(hintFor());

    ui.setCountdown(train.getCountdown());
    // While the train is standing at the berth the sign says how long it will stand there and what
    // to do about it - a stop that visibly ticks down is a stop a player trusts to walk out to. On
    // the deck the clock is held, so there is nothing to count and the line says so instead.
    ui.setStatus(
      train.isAtDock()
        ? (train.isFirstVisit()
            // The first train's clock is stopped, so there is no countdown to show. Saying how long
            // it will stay would be the sign making up a number.
            ? 'The first train is waiting for you'
            : train.isHeld()
              ? 'Train waiting for you'
              : `Train here ${Math.ceil(train.getWaitLeft())}s · walk out and press E`)
        : train.isAligned()
          ? 'Lined up!'
          : ''
    );
  }

  renderer.render(scene, camera);
  tickFps();
});
