// The Caretaker: a small hooded figure in a white robe who walks to wherever the player points, across the tile tops, and offers an interact prompt near anything usable.
import * as THREE from 'three';
import {
  CARETAKER_SPEED,
  CARETAKER_HEIGHT,
  CARETAKER_HOOD_COLOR,
  CARETAKER_CAPE_COLOR,
  CARETAKER_ROBE_COLOR,
  CARETAKER_HAIR_COLOR,
  CARETAKER_STAR_COLOR,
  CARETAKER_SKIN_COLOR,
  CARETAKER_EYE_COLOR,
  CARETAKER_TURN_RATE,
  CARETAKER_ARRIVE,
  CARETAKER_START_TILE,
  INTERACT_RANGE,
  STEP_MAX_RISE,
} from './tuning.js';
// TILE_SIZE and TILE_HEIGHT are deliberately not imported: a tile record's x and z are already
// island-local world units, and every height in this file comes from island.getSurfaceY.

// --- The figure: the shapes the makers drew (context/caretaker.png) ---------------------------
// They measured their own sketch in fractions of the whole figure's height, and those fractions are
// what is written below, multiplied by CARETAKER_HEIGHT - so the figure still stretches exactly
// CARETAKER_HEIGHT, from the soles of the bare feet to the point of the hood, if that one number in
// tuning.js is turned. Its ground is y = 0: the group sits ON the tile, so every height here is
// measured up from the soles.
//
// +Z is the figure's own forward. main.js sets group.rotation.y from atan2(dx, dz), so the face, the
// bangs and the clasp are all built on the +Z side, or she walks backwards. She faces +Z, so her
// LEFT is +X and her right is -X: that is what the hair and the one visible eye are placed against.
//
// Shapes only - no lights, no textures, nothing loaded, nothing random.
const ROUND_SEGMENTS = 16;   // sides on anything wide enough to show its facets
const DOT_SEGMENTS = 8;      // the eye and the mouth are a few pixels across: fewer sides, same look
const SPHERE_RINGS = 10;     // rings from pole to pole on a full sphere

// Bare legs, straight and close together, running up behind the hem so no join shows under it.
const LEG_RADIUS = CARETAKER_HEIGHT * 0.030;
const LEG_FOOT_RADIUS = CARETAKER_HEIGHT * 0.024;
const LEG_TOP_Y = CARETAKER_HEIGHT * 0.33;
const LEG_X = CARETAKER_HEIGHT * 0.045;

// The robe: a plain A-line, hem at 0.20 of the height, collar at 0.58. The hem is the widest thing
// on the figure, 0.57 of the height across.
const ROBE_HEM_Y = CARETAKER_HEIGHT * 0.20;
const ROBE_TOP_Y = CARETAKER_HEIGHT * 0.58;
const ROBE_HEM_RADIUS = CARETAKER_HEIGHT * 0.285;
const ROBE_TOP_RADIUS = CARETAKER_HEIGHT * 0.083;

// The capelet: a shorter cone over the shoulders, its hem on the robe's own collar line so the two
// meet without a seam, and its top at the shoulder line, 0.70 of the height. It is the widest cloth
// on her - 0.45 of the height across at the hem - and it leans out gently rather than flaring, so it
// reads as something draped and not as a plate.
const CAPE_HEM_Y = ROBE_TOP_Y;
const CAPE_TOP_Y = CARETAKER_HEIGHT * 0.70;
const CAPE_HEM_RADIUS = CARETAKER_HEIGHT * 0.210;
const CAPE_TOP_RADIUS = CARETAKER_HEIGHT * 0.110;
// How far the capelet's cloth leans out for every unit it drops. The clasp is pinned to that cloth,
// so it has to know the slope: without it the star would hang in the air in front of the chest.
const CAPE_SLOPE = (CAPE_HEM_RADIUS - CAPE_TOP_RADIUS) / (CAPE_TOP_Y - CAPE_HEM_Y);

// The neck: skin, and only as long as the gap it fills. The collar hides its bottom and the chin
// hides its top, so it is never a shape of its own.
const NECK_RADIUS = CARETAKER_HEIGHT * 0.027;
const NECK_Y = CARETAKER_HEIGHT * 0.645;
const NECK_LENGTH = CARETAKER_HEIGHT * 0.19;

// The head. Chin at 0.69 of the height and centre at 0.77: a big head on a short body, which is the
// chibi proportion the makers asked for.
const HEAD_RADIUS = CARETAKER_HEIGHT * 0.072;
const HEAD_Y = CARETAKER_HEIGHT * 0.769;

// Hair: a bob worn just off the head. It is spun almost a whole turn, with a gap left at the front
// for the face, and that gap sits off-centre - 11 degrees to her right of straight ahead, round to
// 34 degrees to her left - so the hair falls beside her right cheek and past the far corner of the
// one visible eye. A sphere's own phi runs from her right, through the front, to her left.
const HAIR_RADIUS = HEAD_RADIUS + CARETAKER_HEIGHT * 0.013;
const BOB_TOP_THETA = 0.0;                  // the bob starts at the crown itself, so no scalp shows
const BOB_HEM_THETA = 2.45;                 // and stops at the jaw
const BOB_FACE_START = Math.PI / 2 - 0.20;
const BOB_FACE_END = Math.PI / 2 + 0.60;

// The fringe: a second shell, a little outside the bob, worn as a whole cap over the crown that
// stops high, just above the eye line. It is tipped toward her right, so its edge sweeps down over
// that side of the face and rides up over the other - and being a whole cap rather than a strip, it
// cannot leave a gap anywhere for scalp to show through.
const BANGS_RADIUS = HAIR_RADIUS + CARETAKER_HEIGHT * 0.007;
const BANGS_HEM_THETA = 1.50;
const BANGS_SWEEP = 0.45;                   // radians it is tipped toward her right

// The face: two features and no more, both small. They are placed by direction off the head's own
// surface, so turning HEAD_RADIUS or HEAD_Y moves them with the head rather than leaving them behind.
const EYE_YAW = 0.34;                       // radians round the face from straight ahead, to her left
const EYE_PITCH = 0.04;                     // and barely above the centre line
const EYE_RADIUS = CARETAKER_HEIGHT * 0.011;
const EYE_SINK = CARETAKER_HEIGHT * 0.005;  // how far it sits into the skin, so it reads as a lid
const MOUTH_YAW = 0.10;
const MOUTH_PITCH = -0.34;
const MOUTH_SCALE = 0.42;                   // the mouth dot, as a share of the eye's own size

// The clasp: a small gold four-pointed star on the capelet's front, just under the hood's opening,
// where the makers put it. Four points out and four notches in.
const STAR_Y = CARETAKER_HEIGHT * 0.655;
const STAR_OUTER_RADIUS = CARETAKER_HEIGHT * 0.047;
const STAR_INNER_RADIUS = CARETAKER_HEIGHT * 0.016;
const STAR_DEPTH = CARETAKER_HEIGHT * 0.018;
const STAR_LIFT = CARETAKER_HEIGHT * 0.012;  // how far its middle stands off the cloth

// The bell sleeves: each hangs from under the capelet, out and down, widening all the way, so the
// hand inside is hidden. They hang close enough to the robe's own side to lie against it, and their
// cuffs are the widest part of the figure after the hem.
const SLEEVE_TOP_Y = CARETAKER_HEIGHT * 0.667;
const SLEEVE_X = CARETAKER_HEIGHT * 0.106;
const SLEEVE_TILT = 0.52;                   // radians out from straight down
const SLEEVE_LENGTH = CARETAKER_HEIGHT * 0.30;
const SLEEVE_TOP_RADIUS = CARETAKER_HEIGHT * 0.056;
const SLEEVE_CUFF_RADIUS = CARETAKER_HEIGHT * 0.100;
const SLEEVE_CUFF_X = SLEEVE_X + Math.sin(SLEEVE_TILT) * SLEEVE_LENGTH;
const SLEEVE_CUFF_Y = SLEEVE_TOP_Y - Math.cos(SLEEVE_TILT) * SLEEVE_LENGTH;

// The hood, as two shells off one outline. The crown is spun the whole way round and closes the top;
// the sides hang below it with a wedge left out of the front, and that wedge is the opening the face
// shows through. Pairs are [radius, height], both as fractions of the figure's height, from the rim
// at the shoulders up. They meet at 0.870, so the two shells share that ring and show no seam.
//
// The outline is what makes it a hood rather than a box: it stands straight for the first hand's
// width below the rim, then sweeps steadily in. 0.870 is where the front opening ends, and it is set
// just above the hair's crown (0.78 of the height) so the hood frames her face with only a finger's
// width of shadow over it rather than an empty cavern; the last tenth of the height then closes to
// the makers' soft point at the top of the whole figure.
const HOOD_SIDE_PROFILE = [
  [0.200, 0.618], [0.200, 0.668], [0.197, 0.712], [0.192, 0.752],
  [0.184, 0.790], [0.174, 0.824], [0.166, 0.848], [0.157, 0.870],
];
const HOOD_CROWN_PROFILE = [
  [0.157, 0.870], [0.140, 0.902], [0.116, 0.930], [0.086, 0.953],
  [0.053, 0.972], [0.024, 0.987], [0.006, 0.997], [0.002, 1.000],
];
const HOOD_FACE_GAP = 1.70;                 // radians of the front left open for the face

// LatheGeometry wants its outline as Vector2s in world units: pairs scaled here, once, at build.
function latheProfile(pairs) {
  return pairs.map((pair) => new THREE.Vector2(pair[0] * CARETAKER_HEIGHT, pair[1] * CARETAKER_HEIGHT));
}

// --- Turning: CARETAKER_TURN_RATE is the share of the remaining angle it closes per second ---
// At 60 fps that is this much per frame, and update() then puts it through the house's
// frame-rate-independent ease, (1 - Math.pow(1 - smoothing, dt * 60)), so the swing holds
// its timing at any frame rate. Clamped, so an out-of-range knob snaps instead of breaking.
const TURN_SMOOTHING = Math.min(1, CARETAKER_TURN_RATE / 60);

// --- Reading the world ---
const INTERACT_RANGE_SQUARED = INTERACT_RANGE * INTERACT_RANGE;
const PROMPT_PREFIX = 'Press E to ';
const Y_AXIS = new THREE.Vector3(0, 1, 0);   // one shared up axis, so nothing is built per call

// Wrap any angle into -PI..PI, so the Caretaker always turns the short way to face where it walks.
function wrapAngle(radians) {
  const a = (radians + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
}

// Turn a world x/z point about the Y axis, in place. This is the rotation island.group.rotation.y
// applies, written out so a point can be carried round with the island without allocating a
// Vector3 and without touching the island's own transform.
function rotateAboutY(point, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = point.x;
  const z = point.z;
  point.x = x * cos + z * sin;
  point.z = -x * sin + z * cos;
}

export function createCaretaker(scene, island) {
  // This is the one piece of the game the island does not carry: it walks around, so it goes
  // straight into the scene and every position in this file is a world position. Nothing here
  // ever writes island.angle or island.group.rotation.y — island.js owns both, and this file
  // only reads island.angle to turn a tile's island-local centre into a world point.
  const group = new THREE.Group();
  scene.add(group);

  // One material per colour and one geometry per shape, each shared by every mesh that uses it: the
  // two legs are one geometry, the two sleeves are another. The hood, the bob and the bangs are open
  // shells - you can see their inside from the front - so those two materials are drawn both sides.
  const hoodMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_HOOD_COLOR, roughness: 1, side: THREE.DoubleSide });
  const capeMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_CAPE_COLOR, roughness: 1 });
  const robeMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_ROBE_COLOR, roughness: 1 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_HAIR_COLOR, roughness: 1, side: THREE.DoubleSide });
  const starMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_STAR_COLOR, roughness: 1 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_SKIN_COLOR, roughness: 1 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: CARETAKER_EYE_COLOR, roughness: 1 });

  // A point on the head's own surface: yaw round the face from straight ahead, positive toward her
  // left, and pitch up from its centre. The eye and the mouth are both placed with it, so neither
  // can drift off the head if HEAD_RADIUS or HEAD_Y moves.
  function onFace(yaw, pitch, radius) {
    return new THREE.Vector3(
      Math.cos(pitch) * Math.sin(yaw) * radius,
      HEAD_Y + Math.sin(pitch) * radius,
      Math.cos(pitch) * Math.cos(yaw) * radius
    );
  }

  // Bare legs. They start inside the robe and come out under the hem, so there is no join to see.
  const legGeometry = new THREE.CylinderGeometry(LEG_RADIUS, LEG_FOOT_RADIUS, LEG_TOP_Y, ROUND_SEGMENTS, 1);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, skinMaterial);
    leg.position.set(LEG_X * side, LEG_TOP_Y / 2, 0);
    group.add(leg);
  }

  // The neck: shorter than the gap it fills, so the chin hides its top and the collar its bottom.
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(NECK_RADIUS, NECK_RADIUS, NECK_LENGTH, ROUND_SEGMENTS, 1),
    skinMaterial
  );
  neck.position.y = NECK_Y;
  group.add(neck);

  // The robe, and the capelet over its shoulders: two closed cones, so neither can show sky through
  // it from any angle. The robe's own caps are buried in the legs below and the capelet above.
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(ROBE_TOP_RADIUS, ROBE_HEM_RADIUS, ROBE_TOP_Y - ROBE_HEM_Y, ROUND_SEGMENTS, 1),
    robeMaterial
  );
  robe.position.y = (ROBE_HEM_Y + ROBE_TOP_Y) / 2;
  group.add(robe);

  const capelet = new THREE.Mesh(
    new THREE.CylinderGeometry(CAPE_TOP_RADIUS, CAPE_HEM_RADIUS, CAPE_TOP_Y - CAPE_HEM_Y, ROUND_SEGMENTS, 1),
    capeMaterial
  );
  capelet.position.y = (CAPE_HEM_Y + CAPE_TOP_Y) / 2;
  group.add(capelet);

  // The head, the bob over it and the bangs across the front of it. A sphere's own phi runs from her
  // right, through the front, to her left, so the bob is one whole turn minus the gap left for the
  // face - and that gap starts sooner on her right than it ends on her left, because the bangs come
  // across and cover that side.
  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_RADIUS, ROUND_SEGMENTS, SPHERE_RINGS), skinMaterial);
  head.position.y = HEAD_Y;
  group.add(head);

  const bob = new THREE.Mesh(
    new THREE.SphereGeometry(
      HAIR_RADIUS, ROUND_SEGMENTS, SPHERE_RINGS,
      BOB_FACE_END, Math.PI * 2 - (BOB_FACE_END - BOB_FACE_START),
      BOB_TOP_THETA, BOB_HEM_THETA - BOB_TOP_THETA
    ),
    hairMaterial
  );
  bob.position.y = HEAD_Y;
  group.add(bob);

  // The fringe, tipped toward her right: its lower edge drops over that eye and lifts clear of the
  // other one. The tilt is a rotation about the mesh's own origin, which is the head's centre, so the
  // shell stays exactly on the sphere it was cut from.
  const bangs = new THREE.Mesh(
    new THREE.SphereGeometry(BANGS_RADIUS, ROUND_SEGMENTS, SPHERE_RINGS, 0, Math.PI * 2, 0, BANGS_HEM_THETA),
    hairMaterial
  );
  bangs.position.y = HEAD_Y;
  bangs.rotation.z = BANGS_SWEEP;
  group.add(bangs);

  // The one visible eye and the dot of a mouth, both sunk into the skin so only a shallow shape of
  // each shows. They share one geometry: the mouth is the same dot, scaled down.
  const dotGeometry = new THREE.SphereGeometry(EYE_RADIUS, DOT_SEGMENTS, DOT_SEGMENTS / 2);
  const eye = new THREE.Mesh(dotGeometry, eyeMaterial);
  eye.position.copy(onFace(EYE_YAW, EYE_PITCH, HEAD_RADIUS - EYE_SINK));
  eye.scale.set(1, 0.5, 0.8);                 // flattened to a half-closed lens
  group.add(eye);

  const mouth = new THREE.Mesh(dotGeometry, eyeMaterial);
  mouth.position.copy(onFace(MOUTH_YAW, MOUTH_PITCH, HEAD_RADIUS - EYE_SINK));
  mouth.scale.setScalar(MOUTH_SCALE);
  group.add(mouth);

  // The hood: a crown spun the whole way round to close the top, and sides hung below it with the
  // face's opening left out. A lathe's own zero angle faces +Z, so starting it half a gap in leaves
  // the gap exactly on the front, where the face is.
  const hoodCrown = new THREE.Mesh(
    new THREE.LatheGeometry(latheProfile(HOOD_CROWN_PROFILE), ROUND_SEGMENTS),
    hoodMaterial
  );
  group.add(hoodCrown);

  const hoodSides = new THREE.Mesh(
    new THREE.LatheGeometry(
      latheProfile(HOOD_SIDE_PROFILE), ROUND_SEGMENTS,
      HOOD_FACE_GAP / 2, Math.PI * 2 - HOOD_FACE_GAP
    ),
    hoodMaterial
  );
  group.add(hoodSides);

  // The clasp. Its outline takes four points and four notches in turn, so it is one face rather than
  // four triangles meeting at the middle, and it is extruded a little so it does not disappear when
  // it is seen edge-on.
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? STAR_OUTER_RADIUS : STAR_INNER_RADIUS;
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const starGeometry = new THREE.ExtrudeGeometry(starShape, { depth: STAR_DEPTH, bevelEnabled: false });
  starGeometry.translate(0, 0, -STAR_DEPTH / 2);   // centred, so it straddles the cloth it is pinned to
  const star = new THREE.Mesh(starGeometry, starMaterial);
  // It is leaned back at the capelet's own slope, so it lies along the cloth, and lifted off it along
  // that slope's normal - up and forward - by its own thickness, so no point of it sinks inside.
  const clothRadius = CAPE_TOP_RADIUS + (CAPE_TOP_Y - STAR_Y) * CAPE_SLOPE;
  const clothLean = Math.atan(CAPE_SLOPE);
  star.position.set(0, STAR_Y + Math.sin(clothLean) * STAR_LIFT, clothRadius + Math.cos(clothLean) * STAR_LIFT);
  star.rotation.x = -clothLean;
  group.add(star);

  // The bell sleeves. One geometry, and the left one is the right one turned the other way: each
  // hangs from under the capelet, tips outward as it drops, and widens, so the hand inside is hidden.
  const sleeveGeometry = new THREE.CylinderGeometry(SLEEVE_TOP_RADIUS, SLEEVE_CUFF_RADIUS, SLEEVE_LENGTH, ROUND_SEGMENTS, 1);
  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(sleeveGeometry, robeMaterial);
    sleeve.position.set(((SLEEVE_X + SLEEVE_CUFF_X) / 2) * side, (SLEEVE_TOP_Y + SLEEVE_CUFF_Y) / 2, 0);
    sleeve.rotation.z = SLEEVE_TILT * side;
    group.add(sleeve);
  }

  // State. The route is a list of world-space waypoints, built once and then walked in order.
  const path = [];            // rewritten by walkTo; its array is reused, never replaced
  let waypoint = 0;           // the waypoint it is heading for right now
  let walking = false;        // true while waypoints remain
  let routeTo = -1;           // the island.tiles index this walk ends on, -1 when idle
  let lastGroundY = 0;        // the last Y the island gave us, held when it gives null
  let interactables = [];     // the caller's list of { id, label, position }; re-set when it moves
  let lastIslandAngle = island.angle;   // the island's yaw as this file last saw it, for rideIsland

  // A tile's centre in world space, for the island's yaw as it is at this moment.
  function tileCentre(tile) {
    return new THREE.Vector3(tile.x, 0, tile.z).applyAxisAngle(Y_AXIS, island.angle);
  }

  // Two tiles stand next to each other in the row; the height step decides whether it is walkable.
  function canStep(a, b) {
    return Math.abs(a.level - b.level) <= STEP_MAX_RISE;
  }

  // Where a tile record sits in the row, or -1 when it is not one of island.tiles.
  function rowIndex(tile) {
    for (let i = 0; i < island.tiles.length; i++) {
      if (island.tiles[i] === tile) return i;
    }
    return -1;
  }

  // The whole pathfinding rule: every neighbouring step along the row must be climbable.
  function isRouteOpen(from, to) {
    const step = from <= to ? 1 : -1;
    for (let i = from; i !== to; i += step) {
      if (!canStep(island.tiles[i], island.tiles[i + step])) return false;
    }
    return true;
  }

  // A route can be cut from under a walk: a tile it still has to cross may rise out of reach.
  // Measured from the tile it is standing on right now, so a turning island is read where the
  // Caretaker actually is rather than from the frozen waypoints behind it.
  function isRouteStillOpen() {
    if (routeTo < 0) return true;
    const here = island.tileAt(group.position.x, group.position.z);
    if (!here) return true;
    const from = rowIndex(here);
    if (from < 0) return true;
    return isRouteOpen(from, routeTo);
  }

  // End the walk: drop the route and tell the caller the Caretaker has landed. The only exit
  // from a walk, so a cut route stops cleanly instead of leaving the walk running for ever.
  function finishWalk() {
    path.length = 0;
    waypoint = 0;
    walking = false;
    routeTo = -1;
    if (typeof caretaker.onArrive === 'function') caretaker.onArrive();
  }

  // Is this world point out on the pier rather than on the grass? The walk surface answers, and it
  // answers `false` for every caller that does not know what a pier is, so this file stays a walker
  // on whatever ground it is handed.
  function offTheIsland(worldX, worldZ) {
    return typeof island.onPier === 'function' && island.onPier(worldX, worldZ);
  }

  // The Caretaker stands ON the island, so when the island turns it turns with it. Without this
  // the island spins out from underneath a standing Caretaker: the ground slides away, and a snap
  // of the island would fling it clean off the edge. Everything in this file is world space and
  // the island is not, so the whole of it has to come round together - where it stands, where it
  // is still going, and which way it is facing.
  //
  // The one exception is the pier. It is bolted to the railway and never turns, so a Caretaker
  // standing out on the planks must not be carried round with the island: the island's own slow
  // drift, or a snap as the platform comes round, would slide it sideways off the deck and out over
  // the sky, which is what the makers saw. Its pending waypoints get the same answer - a stop on the
  // pier has not moved either, and turning it would walk the route out over the edge.
  function rideIsland() {
    const delta = island.angle - lastIslandAngle;
    if (!Number.isFinite(delta) || delta === 0) return;
    lastIslandAngle = island.angle;

    if (!offTheIsland(group.position.x, group.position.z)) {
      rotateAboutY(group.position, delta);
      group.rotation.y += delta;
    }

    // The waypoints still ahead of it were built in world space for the old angle, so they come
    // round too. The ones already behind it are spent and are left where they are.
    for (let i = waypoint; i < path.length; i++) {
      const stop = path[i];
      if (offTheIsland(stop.x, stop.z)) continue;
      rotateAboutY(stop, delta);
    }
  }

  // Y comes from the island every frame, so the Caretaker rides a tile as it slides, and climbs
  // and descends as the heights change. A null means it is off the island: hold the last good Y.
  function applyGround() {
    const surface = island.getSurfaceY(group.position.x, group.position.z);
    if (Number.isFinite(surface)) lastGroundY = surface;
    group.position.y = lastGroundY;
  }

  // Step toward the waypoint it is on, and swing round to face the way it is going.
  function advance(dt, alpha) {
    const target = path[waypoint];
    const dx = target.x - group.position.x;
    const dz = target.z - group.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance <= CARETAKER_ARRIVE) {
      waypoint += 1;
      if (waypoint >= path.length) finishWalk();   // the last one was this one: the walk is done
      return;
    }

    const travel = Math.min(distance, CARETAKER_SPEED * dt);
    group.position.x += (dx / distance) * travel;
    group.position.z += (dz / distance) * travel;

    // Behind is 0 on this convention, so the heading in x/z is atan2(dx, dz); the gap is wrapped
    // so it always turns the short way round rather than the long way.
    const gap = wrapAngle(Math.atan2(dx, dz) - group.rotation.y);
    group.rotation.y += gap * alpha;
  }

  // No allocation in here: numbers, reads of the route, and writes into the group's own transform.
  function update(dt) {
    const alpha = 1 - Math.pow(1 - TURN_SMOOTHING, dt * 60);

    // First, before anything reads a position: bring the Caretaker round with the island. The
    // route check and the step below both work in world space, so they need it already moved.
    rideIsland();

    if (walking) {
      if (isRouteStillOpen()) advance(dt, alpha);
      else finishWalk();                            // the route closed under it: stop cleanly
    }

    applyGround();
  }

  // Set off toward a world point. True when a route exists and the walk started; false when it
  // does not — the point is off the island, or a step along the way is too tall to climb — and on
  // false the Caretaker is left exactly as it was, whether that is standing still or mid-walk.
  function walkTo(worldX, worldZ) {
    const from = island.tileAt(group.position.x, group.position.z);
    const to = island.tileAt(worldX, worldZ);
    if (!from || !to) return false;

    const fromIndex = rowIndex(from);
    const toIndex = rowIndex(to);
    if (fromIndex < 0 || toIndex < 0) return false;
    if (fromIndex !== toIndex && !isRouteOpen(fromIndex, toIndex)) return false;

    // Commit: the route is built now, in world space — the centre of each tile on the way, then
    // the point the player asked for. Same tile means the loop adds nothing and it walks straight
    // there. If the island turns mid-walk, the walk keeps this route.
    path.length = 0;
    // Leaving the pier for the grass, the first leg is along the deck to the tile it joins, before
    // any of the island's own row. The pier reports that tile as the ground underfoot, so a walk to
    // an end tile would otherwise set off straight for it from the far end of the planks - a line
    // that leaves the deck and crosses open sky, which is the other half of what the makers saw.
    // Coming in along the deck first costs one waypoint and keeps every leg on something.
    if (offTheIsland(group.position.x, group.position.z) && !offTheIsland(worldX, worldZ)) {
      path.push(tileCentre(from));
    }
    const step = fromIndex <= toIndex ? 1 : -1;
    for (let i = fromIndex + step; i !== toIndex + step; i += step) {
      path.push(tileCentre(island.tiles[i]));
    }
    path.push(new THREE.Vector3(worldX, 0, worldZ));

    waypoint = 0;
    routeTo = toIndex;
    walking = true;
    return true;
  }

  // The Caretaker's world position, live: it is the group's own transform, so the caller can
  // hold on to it and it is never stale.
  function getPosition() {
    return group.position;
  }

  function isWalking() {
    return walking;
  }

  function setInteractables(list) {
    interactables = Array.isArray(list) ? list : [];
  }

  // The nearest usable thing within INTERACT_RANGE of the Caretaker, or null. Distance is
  // measured across the ground only: the pool and the pad stand at different heights
  // on the same tile top, and reaching them is a matter of standing beside them.
  function getNearby() {
    let nearest = null;
    let best = 0;
    for (let i = 0; i < interactables.length; i++) {
      const entry = interactables[i];
      if (!entry || !entry.position) continue;
      const dx = entry.position.x - group.position.x;
      const dz = entry.position.z - group.position.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared > INTERACT_RANGE_SQUARED) continue;
      if (nearest === null || distanceSquared < best) {
        best = distanceSquared;
        nearest = entry;
      }
    }
    return nearest;
  }

  // One short line for the HUD, straight off the nearby entry's label. Empty when nothing is near.
  function getPrompt() {
    const entry = getNearby();
    return entry && entry.label != null ? PROMPT_PREFIX + entry.label : '';
  }

  // Stop walking and stand on the tile it starts on. The island may not be at its starting yaw,
  // so the tile's centre is converted to world space the same way a route is.
  function reset() {
    path.length = 0;
    waypoint = 0;
    walking = false;
    routeTo = -1;
    group.rotation.y = 0;                       // facing its own forward again
    const tile = island.tiles[CARETAKER_START_TILE];
    if (tile) {
      const centre = tileCentre(tile);
      group.position.x = centre.x;
      group.position.z = centre.z;
    }
    // It has just been placed for the island's yaw as it is right now, so that yaw is the new
    // baseline: rideIsland measures from here, and it must not turn the Caretaker a second time.
    lastIslandAngle = island.angle;
    applyGround();
  }

  const caretaker = {
    group,
    update,
    walkTo,
    getPosition,
    isWalking,
    setInteractables,
    getNearby,
    getPrompt,
    // The caller assigns this, like ui.onStart. It starts null and is always guarded before use.
    onArrive: null,
    reset,
  };

  reset();   // standing on the start tile from the very first frame

  return caretaker;
}
