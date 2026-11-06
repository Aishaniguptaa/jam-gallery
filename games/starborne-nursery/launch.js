// The Launch pad on the island's right tile, the release (a wide flat ray banks and climbs, trailing a wake of light), and the released animals that drift in the sky afterwards.
import * as THREE from 'three';
import { CREATURE_KINDS } from './creature.js';
import {
  LAUNCH_DURATION,
  LAUNCH_PAD_COLOR,
  LAUNCH_GLOW_COLOR,
  LAUNCH_CIRCLE_RADIUS,
  LAUNCH_RISE_HEIGHT,
  LAUNCH_TURNS,
  LAUNCH_PAD_INSET,
  LAUNCH_PAD_DEPTH,
  STARLIGHT_PER_LAUNCH,
  LAUNCH_RAY_SPAN,
  LAUNCH_RAY_SWEEP,
  LAUNCH_RAY_BODY_COLOR,
  LAUNCH_RAY_GLOW_COLOR,
  LAUNCH_TRAIL_COUNT,
  LAUNCH_TRAIL_LENGTH,
  LAUNCH_TRAIL_SPREAD,
  LAUNCH_TRAIL_RISE,
  TILE_SIZE,
  TILE_HEIGHT,
} from './tuning.js';

// --- The pad, in island-local coordinates (the right-hand tile sits at x = +TILE_SIZE) ---
// island.js builds every tile as one solid box, so the right tile's grass top is one unbroken
// face at y = TILE_HEIGHT, and a pad sunk below that line would simply be swallowed by it. So
// the pad is built the other way up, exactly as creature.js does with its pool rim: it stands
// proud of the grass instead of being cut into it, and reads as set into the tile from above.
const PAD_CLEARANCE = 0.02;                       // lift off the grass top, so the two faces never tie
const PAD_BASE_Y = TILE_HEIGHT + PAD_CLEARANCE;   // the pad's underside, just clear of the grass
const PAD_TOP_Y = PAD_BASE_Y + LAUNCH_PAD_DEPTH;  // and its face, one pad depth higher
const PAD_RADIUS = TILE_SIZE * LAUNCH_PAD_INSET * 0.5;
const PAD_X = TILE_SIZE;                          // the right-hand tile (the pool owns x = 0)

// --- The glow ring: the "something just left" beat ---
const GLOW_RING_SCALE = 0.92;                     // ring just inside the pad's edge
const GLOW_RING_TUBE = 0.1;                       // its thickness, as a fraction of the pad radius
const GLOW_REST_OPACITY = 0.25;                   // the ring never goes fully dark
const GLOW_FLASH_OPACITY = 0.75;                  // and flares to full when a launch starts
const GLOW_FLARE_TIME = 1;                        // seconds the flash takes to ease back down

// --- The released spirit: a wide, flat low-poly ray ---
// It leaves the pad travelling along -z, so "forward" is -z here and the wings sweep back toward
// +z. Every shape is flat-shaded and built from a handful of triangles, so nothing about it reads
// as a smooth ball.
const RAY_HALF_SPAN = LAUNCH_RAY_SPAN * 0.5;      // tip to tip is LAUNCH_RAY_SPAN
const RAY_BODY_WIDTH = LAUNCH_RAY_SPAN * 0.42;    // the diamond, narrower than the wings
const RAY_BODY_LENGTH = LAUNCH_RAY_SPAN * 0.5;    // nose to tail
const RAY_BODY_THICK = LAUNCH_RAY_SPAN * 0.09;    // thin: a diamond from above, a lens from the side
const RAY_CORE_RADIUS = LAUNCH_RAY_SPAN * 0.1;    // the heart, wider than the body is thick so it shows
const RAY_WING_DIHEDRAL = 0.16;                   // radians a wing lifts at its tip
const RAY_BANK = 0.3;                             // radians it rolls into its turn, so it looks alive
const SPIRIT_SPIN_RATE = 1.1;                     // radians per second of slow self-rotation
const SPIRIT_START_Y = PAD_TOP_Y;                 // it leaves from the pad's face
// The pad sits out along +x, and the arc is measured with x = sin(a), z = cos(a), so the arc
// has to begin at a quarter turn or the spirit would appear off the island's edge instead of
// lifting off the pad itself.
const PAD_ANGLE = Math.PI / 2;
const FADE_START = 0.6;                           // progress at which the fade to nothing begins
const FULL_TURN = Math.PI * 2;

// --- The wake of light the ray leaves behind it ---
// Motes are placed by distance behind the ray, not by frame count, so the wake is the same length
// on a slow machine as on a fast one. That means the history buffer has to hold enough frames to
// reach LAUNCH_TRAIL_LENGTH back along the path, and that is far more frames than there are motes.
// The climb is 31.7 world units long, and its slowest stretch covers the wake's 6 units in about
// 108 frames at 144 fps, 180 at 240 and 269 at 360, so 384 frames (about 6 KB of plain numbers)
// holds a full-length wake up to roughly 480 fps. Above that the oldest motes clamp onto the start
// of the path and the wake gets a little shorter, which is a graceful way to run out of history.
const TRAIL_HISTORY = 384;
const TRAIL_AGE_STEP = LAUNCH_TRAIL_LENGTH / Math.max(1, LAUNCH_TRAIL_COUNT - 1);
const TRAIL_MOTE_SIZE = 0.34;                     // world units, attenuated with distance
const TRAIL_BRIGHTNESS = 0.6;                     // the wake is additive, so keep the head from flaring out
const TRAIL_LAG_MIN = 0.4;                        // shallowest lag below the ray, as a fraction of its rise

// --- The floaters: the animals that were released, still out in the sky afterwards ---
// The makers asked for this in their own words: "the animals you release have them float around in
// the background." A release leaves one behind, and it drifts there for the rest of the round.
//
// FLOATERS_MAX is the makers' cap on how many the sky may hold, and it is a cost as well as a look:
// a floater is seven small meshes, so eight of them are at most 56 draw calls on top of the scene -
// cheap beside the sky's own clouds, but not free. It is also what keeps them readable. Past eight
// the animals stop being individuals and start being a flock, and the creature that has just been
// released would be lost in it. So on the ninth release the oldest one leaves.
const FLOATERS_MAX = 8;

// Where a floater may live. The camera is fixed at (8.8, 12, 12.8) looking down at the island, and
// from a seat like that there is only a narrow shell of sky a whole ring around the island can pass
// through. Both ends of the problem are on the near side and the far side of that ring: a floater
// on the near side is between the camera and the island, so a low ring drops it onto the island's
// own face in the picture; a floater on the far side is furthest away, so a high ring climbs out of
// the top of the frame. That leaves one band that works all the way round - a modest ring riding
// well above the island - and it is narrow, which is why the radius and the height move together
// rather than being picked apart: the wider the ring, the higher it has to ride to stay in the sky.
// These numbers are that band, measured against the camera and not guessed at, and the release's
// own arc climbs through them on the way up - so a creature that has just gone up appears in the
// part of the sky it will spend the rest of the round drifting in.
//
// The band is a compromise, and the compromise is visible: the floaters ride the island's own turn,
// so each one passes round to both sides of the ring. Measured over a whole turn of the island, the
// creature nearest the camera sits about a third of the way up the top half of the frame and the
// one furthest away sits at nine tenths, where the top edge can clip the tip of a wing. Pushing the
// band down to save the far side drops the near side onto the treetops, which is worse: the makers
// asked for animals in the background, and a creature in the branches is not in the background. So
// the height is kept where it keeps them clear of the island at every angle. Move these with care.
const FLOATER_RADIUS_MIN = 4.6;                   // world units out from the island's centre...
const FLOATER_RADIUS_MAX = 5.4;                   // ...just past the island's own edge, plus room
const FLOATER_HEIGHT_MIN = 6.8;                   // world units up, on the inside of the ring
const FLOATER_HEIGHT_MAX = 7.2;                   // and on the outside of it
const FLOATER_HEIGHT_JITTER = 0.12;               // so no two of them ride at exactly the same level

// The drift itself. A world speed, not an angle per second, so a floater on the outside of the ring
// turns round no faster than one on the inside: the same reason the sky's own clouds are moved.
const FLOATER_DRIFT = 0.2;                        // world units per second, slower than the clouds
const FLOATER_DRIFT_SPREAD = 0.45;                // either side of that, so no two keep pace
const FLOATER_BOB = 0.28;                         // world units of slow rise and fall
const FLOATER_BOB_RATE = 0.5;                     // radians per second of that sway
const FLOATER_BOB_SPREAD = 0.4;
const FLOATER_TURN = 0.22;                        // radians per second of slow yaw
const FLOATER_TURN_SPREAD = 0.7;
const FLOATER_ROLL = 0.12;                        // radians the sway leans it, so it swims, not slides
const FLOATER_SIZE_MIN = 0.7;                     // the model below is built about 1.75 long, nose
const FLOATER_SIZE_MAX = 1;                       // to tail, so this is 1.2 to 1.75 world units
// Releases are spaced by the golden angle rather than picked at random: each new one lands furthest
// from the last, so a handful of them ring the island instead of clumping into one corner of the sky.
const FLOATER_SPREAD_ANGLE = 2.39996;
const FLOATER_SPREAD_JITTER = 0.35;               // radians of scatter on top of that, so it is not a pattern

// The floater's model, in one unit block: body, snout, two wings, a tail and a bright core. It is
// the ray's own family - long along -z, plate wings swept back, a small core of light - but built
// out of boxes and a four-sided cone, so it reads as blocky rather than as a smooth, grown thing.
// It is a good deal longer than it is wide: a creature seen from this high up is mostly an outline,
// and a wide one reads as a pale lump where a narrow one reads as something with a nose and a tail.
const FLOATER_BODY_W = 0.34;
const FLOATER_BODY_H = 0.34;
const FLOATER_BODY_L = 1.15;
const FLOATER_SNOUT_W = 0.24;
const FLOATER_SNOUT_L = 0.3;
const FLOATER_WING_SPAN = 0.6;                    // one wing, measured out from the body's side
const FLOATER_WING_CHORD = 0.38;                  // its width, front to back
const FLOATER_WING_THICK = 0.08;
const FLOATER_WING_SWEEP = 0.5;                   // radians the wing is swept back
const FLOATER_WING_DIHEDRAL = 0.25;               // and lifted at the tip, so it shows from above
const FLOATER_WING_BACK = 0.1;                    // how far behind the body's middle the wings sit
const FLOATER_TAIL_SPAN = 0.42;
const FLOATER_TAIL_CHORD = 0.3;
// A fin stands up on the creature's back. Seen from a camera looking down, a flat animal is a flat
// plate and nothing else, and this is the one shape that puts an edge on it from above.
const FLOATER_FIN_LENGTH = 0.3;
const FLOATER_FIN_HEIGHT = 0.24;
const FLOATER_FIN_THICK = 0.06;
// The core sits ON the back rather than inside the body: buried in a body this thick it simply
// never showed, and a bright block on the spine is what makes a distant floater a light first.
const FLOATER_CORE = 0.18;                        // the bright block it carries
const FLOATER_CORE_LIFT = 0.2;                    // how high up the back it rides
const FLOATER_CORE_TILT = 0.6;                    // radians it is turned, so it reads as a gem not a cube
// The fins are a deeper blue than the body. One colour for the whole creature came out as a single
// pale lump against the sky - at this size and this distance the shading is far too soft to tell a
// wing from a flank - so the fins take the pool's own blue and the shape reads again. Written here
// rather than imported, because it is part of this creature's look and nothing else reads it.
const FLOATER_FIN_COLOR = '#4a86b8';

// Leaps, then slows: the climb is nearly done well before the spirit fades.
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Holds full until FADE_START, then settles smoothly to nothing by t = 1.
function fadeAt(t) {
  if (t <= FADE_START) return 1;
  const p = Math.min(1, (t - FADE_START) / (1 - FADE_START));
  return 1 - p * p * (3 - 2 * p);
}

// A stable pseudo-random 0..1 from one mote's index: the scatter is drawn from this instead of
// Math.random so the wake does not shimmer, and so the per-frame loop never allocates.
function hash01(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

// The pad: a shallow stone disc set into the right tile, with the glow ring lying on its face.
function createPad(glowMaterial) {
  const pad = new THREE.Group();

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS, LAUNCH_PAD_DEPTH, 24),
    new THREE.MeshStandardMaterial({ color: LAUNCH_PAD_COLOR, roughness: 1 })
  );
  disc.position.set(PAD_X, PAD_BASE_Y + LAUNCH_PAD_DEPTH / 2, 0);
  pad.add(disc);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PAD_RADIUS * GLOW_RING_SCALE, PAD_RADIUS * GLOW_RING_TUBE, 8, 28),
    glowMaterial
  );
  ring.position.set(PAD_X, PAD_TOP_Y, 0);
  ring.rotation.x = -Math.PI / 2;                 // lie the ring flat on the pad's face
  pad.add(ring);

  return pad;
}

// One wing, as a flat four-vertex quad: a leading edge out to the tip, then a trailing edge back
// to the body. Double-sided, so a wing never blinks out as the ray banks and the island turns.
function createWingGeometry(sign) {
  const rootX = sign * RAY_BODY_WIDTH * 0.5;
  const tipX = sign * RAY_HALF_SPAN;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    rootX, 0, -RAY_BODY_LENGTH * 0.30,          // front root, beside the nose
    tipX * 0.86, 0, LAUNCH_RAY_SWEEP * 0.34,    // and its counterpart out near the tip
    tipX, 0, LAUNCH_RAY_SWEEP,                  // the swept-back tip itself
    rootX, 0, RAY_BODY_LENGTH * 0.42,           // back root, beside the tail
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

// The ray: a flat diamond body, two swept wings and a small bright core, hidden until a launch starts.
function createRay(bodyMaterial, glowMaterial) {
  const spirit = new THREE.Group();
  spirit.visible = false;

  // The inner group is the body on its own, so the bank can roll it without fighting the yaw that
  // the arc and the slow spin keep writing to spirit.rotation.y.
  const ray = new THREE.Group();
  spirit.add(ray);

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1), bodyMaterial);
  body.scale.set(RAY_BODY_WIDTH * 0.5, RAY_BODY_THICK * 0.5, RAY_BODY_LENGTH * 0.5);
  ray.add(body);

  [1, -1].forEach((sign) => {
    const wing = new THREE.Mesh(createWingGeometry(sign), bodyMaterial);
    wing.rotation.z = sign * RAY_WING_DIHEDRAL;
    ray.add(wing);
  });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(RAY_CORE_RADIUS), glowMaterial);
  ray.add(core);                                  // drawn after the body, and pokes through it

  spirit.position.set(PAD_X, SPIRIT_START_Y, 0);  // waiting on the pad
  return { spirit, ray };
}

// The wake: one Points object for the whole trail, so the lot costs a single draw call.
function createTrail() {
  const positions = new Float32Array(LAUNCH_TRAIL_COUNT * 3);
  const colors = new Float32Array(LAUNCH_TRAIL_COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: TRAIL_MOTE_SIZE,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,             // additive means an aged, fully dark mote is simply gone
  }));
  // The motes are written in place from history, so the geometry's own bounds mean nothing and
  // culling would happily throw the whole wake away.
  points.frustumCulled = false;
  points.visible = false;

  return { points, geometry, positions, colors };
}

// One released animal, built from two shared geometries and three shared materials: a body box, a
// four-sided cone for the snout, two swept plates for the wings, one for the tail, a fin on its
// back and a bright block on top of that. Nothing is unique to the creature - only where it sits.
// One released animal, drifting out in the sky, built to the shape of the kind that went up. The
// makers asked for this: a duskfin that drifts past should read as a duskfin and not as another
// minnow. Every shape is the same seven meshes in the same places with different multipliers, so a
// whale in the sky costs no more to draw than a minnow does.
//
//   size  the whole animal, on top of the size the spawn already rolls
//   wide/tall/long  the body's three axes
//   wing  the side fins' span and chord    sail  the dorsal fin's height
//   tail  the tail's span                   snout  the nose cone's size
//   blunt  a whale's broad square head instead of a cone
//   cone   a solid cone for a tail instead of a flat blade (the emberfin's own silhouette)
//
// The cloud minnow's row is all ones and no flags, so the makers' first animal is unchanged.
const FLOATER_SHAPES = {
  cloudminnow: { size: 1, wide: 1, tall: 1, long: 1, wing: 1, sail: 1, tail: 1, snout: 1 },
  duskfin: { size: 1.05, wide: 0.85, tall: 1.45, long: 1.05, wing: 0.8, sail: 1.9, tail: 1, snout: 0.9 },
  emberfin: { size: 0.92, wide: 1.1, tall: 1.05, long: 0.85, wing: 1.25, sail: 0.7, tail: 1.3, snout: 1.1, cone: 1 },
  whalekin: { size: 1.6, wide: 1.15, tall: 1.3, long: 1.5, wing: 1.05, sail: 0.8, tail: 1.6, snout: 0, blunt: 1 },
};

function buildFloater(box, cone, bodyMat, finMat, glowMat, shape) {
  const s = shape || FLOATER_SHAPES.cloudminnow;
  const floater = new THREE.Group();

  const bodyL = FLOATER_BODY_L * s.long;
  const bodyH = FLOATER_BODY_H * s.tall;
  const bodyW = FLOATER_BODY_W * s.wide;

  const body = new THREE.Mesh(box, bodyMat);
  body.scale.set(bodyW, bodyH, bodyL);
  floater.add(body);

  if (s.blunt) {
    // The whale's head: broad and square, and no cone at all - the one creature up here that does
    // not wear a snout.
    const head = new THREE.Mesh(box, bodyMat);
    head.scale.set(bodyW * 1.3, bodyH * 0.9, bodyL * 0.3);
    head.position.z = -bodyL * 0.55;
    floater.add(head);
  } else {
    // A cone points up out of the box; the tilt lays it along -z, so the nose leads the drift.
    const snout = new THREE.Mesh(cone, bodyMat);
    snout.scale.set(FLOATER_SNOUT_W * s.snout, FLOATER_SNOUT_L * s.snout, FLOATER_SNOUT_W * s.snout);
    snout.position.z = -bodyL * 0.5;
    snout.rotation.x = -Math.PI / 2;
    floater.add(snout);
  }

  [1, -1].forEach((sign) => {
    const wing = new THREE.Mesh(box, finMat);
    wing.scale.set(FLOATER_WING_SPAN * s.wing, FLOATER_WING_THICK, FLOATER_WING_CHORD * s.wing);
    wing.position.set(sign * FLOATER_WING_SPAN * s.wing * 0.5, 0, FLOATER_WING_BACK);
    wing.rotation.y = sign * FLOATER_WING_SWEEP;
    wing.rotation.z = sign * FLOATER_WING_DIHEDRAL;
    floater.add(wing);
  });

  if (s.cone) {
    // The emberfin's tail: a lump rather than a blade, laid along +z so its point trails.
    const tail = new THREE.Mesh(cone, finMat);
    tail.scale.set(FLOATER_TAIL_SPAN * 0.6, FLOATER_TAIL_CHORD * 2.4, FLOATER_TAIL_SPAN * 0.6);
    tail.position.z = bodyL * 0.5 + FLOATER_TAIL_CHORD * 0.5;
    tail.rotation.x = Math.PI / 2;
    floater.add(tail);
  } else {
    const tail = new THREE.Mesh(box, finMat);
    tail.scale.set(FLOATER_TAIL_SPAN * s.tail, FLOATER_WING_THICK, FLOATER_TAIL_CHORD * s.tail);
    tail.position.z = bodyL * 0.5 + FLOATER_TAIL_CHORD * 0.35;
    floater.add(tail);
  }

  // The fin on the back: thin across, tall, set behind the middle and ahead of the tail.
  const fin = new THREE.Mesh(box, finMat);
  fin.scale.set(FLOATER_FIN_THICK, FLOATER_FIN_HEIGHT * s.sail, FLOATER_FIN_LENGTH);
  fin.position.set(0, bodyH * 0.5 + FLOATER_FIN_HEIGHT * s.sail * 0.5, FLOATER_WING_BACK);
  floater.add(fin);

  // Drawn last, riding the back above the fin's shoulder: a distant floater should read as a light
  // in the sky first and as a creature second, which is the same job the ray's own core does close up.
  const core = new THREE.Mesh(box, glowMat);
  core.scale.set(FLOATER_CORE, FLOATER_CORE, FLOATER_CORE);
  core.position.set(0, FLOATER_CORE_LIFT, -bodyL * 0.22);
  core.rotation.set(FLOATER_CORE_TILT, FLOATER_CORE_TILT, 0);
  floater.add(core);

  return floater;
}

export function createLaunch(scene, island) {
  // scene is part of every factory's signature here, but the pad and the spirit hang off
  // island.group instead, so the island's spin carries them for free. Nothing in this file
  // touches island.angle or island.group.rotation.y: island.js owns both of those.
  const group = new THREE.Group();
  island.group.add(group);

  // The right-hand tile can be raised and lowered now, so the pad has to ride it. Look the tile
  // up by its local x rather than by index, so a reordered island can never move the pad wrongly.
  const padTile = island.tiles ? island.tiles.find((t) => t.x === TILE_SIZE) : null;

  // Flat colours, no textures: the ring and the core are unlit-ish and read as light, the body
  // takes the sun. Both spirit materials are transparent from the start, because the fade at the
  // end of the climb writes straight into their opacity.
  const padGlowMat = new THREE.MeshBasicMaterial({
    color: LAUNCH_GLOW_COLOR,
    transparent: true,
    opacity: GLOW_REST_OPACITY,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: LAUNCH_RAY_BODY_COLOR,
    roughness: 0.55,
    flatShading: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: LAUNCH_RAY_GLOW_COLOR,
    emissive: LAUNCH_RAY_GLOW_COLOR,
    emissiveIntensity: 1.4,
    flatShading: true,
    transparent: true,
    opacity: 1,
  });

  group.add(createPad(padGlowMat));
  const { spirit, ray } = createRay(bodyMat, glowMat);
  group.add(spirit);

  const trail = createTrail();
  group.add(trail.points);
  // Read once here, not per frame: the newest motes take the glow colour, the oldest go dark.
  const glowColor = new THREE.Color(LAUNCH_RAY_GLOW_COLOR);

  // --- The floaters ---
  // One box, one cone, and a pair of materials per kind, for every animal in the sky: a release costs
  // nothing but the few meshes it is built from. The materials are the floater's own, not the ray's,
  // because the ray's two are the ones the fade writes into on every launch - a shared pair would
  // drag the whole sky dark behind it. All of them are self-lit, so a floater stays a pale light in
  // the sky after dark instead of turning into a silhouette.
  const floaterBox = new THREE.BoxGeometry(1, 1, 1);
  const floaterCone = new THREE.ConeGeometry(0.5, 1, 4);

  // One pair of materials per kind, built the first time that kind is released and kept after that:
  // four kinds is eight materials at most, against a fresh pair on every release. The makers asked
  // for the duskfin's model in the sky to be purple like the duskfin, so a floater wears the colours
  // of the creature it came from - the grown stage's, because the one that went up was grown. The
  // launch ray's own two stay the fallback, which is what the minnow has always worn.
  const kindMats = new Map();
  function floaterMaterials(kindId) {
    const made = kindMats.get(kindId);
    if (made) return made;
    const kind = CREATURE_KINDS.find((k) => k.id === kindId);
    const body = kind ? kind.body[kind.body.length - 1] : LAUNCH_RAY_BODY_COLOR;
    const fin = kind ? kind.fins[kind.fins.length - 1] : FLOATER_FIN_COLOR;
    const pair = {
      body: new THREE.MeshStandardMaterial({
        color: body, emissive: body, emissiveIntensity: 0.45,
        roughness: 0.6, flatShading: true,
      }),
      fin: new THREE.MeshStandardMaterial({
        color: fin, emissive: fin, emissiveIntensity: 0.28,
        roughness: 0.7, flatShading: true,
      }),
    };
    kindMats.set(kindId, pair);
    return pair;
  }
  const floaterGlowMat = new THREE.MeshStandardMaterial({
    color: LAUNCH_RAY_GLOW_COLOR,
    emissive: LAUNCH_RAY_GLOW_COLOR,
    emissiveIntensity: 1.6,
    flatShading: true,
  });

  // Oldest first, so the one to retire is always at the front. The slot counter is what spaces
  // them round the ring; it is releases this round, not floaters still in the sky.
  const floaters = [];
  let floaterSlot = 0;

  // --- The rolling history behind the wake ---
  // Plain numbers in fixed typed arrays, written once per frame and refilled in place, so update()
  // allocates nothing. trailDist[] is the arc length the ray has flown at each entry, which is what
  // lets a mote be placed a set distance back instead of a set number of frames back.
  const trailPos = new Float32Array(TRAIL_HISTORY * 3);
  const trailDist = new Float32Array(TRAIL_HISTORY);
  let trailHead = TRAIL_HISTORY - 1;   // newest entry; the first push lands in slot 0
  let trailCount = 0;                  // valid entries, filling up over the first TRAIL_HISTORY frames
  let trailTotal = 0;                  // arc length flown since the launch began

  // State.
  let playing = false;      // true only while a launch is in flight
  let elapsed = 0;          // seconds into the current launch
  let flareLeft = 0;        // seconds of pad flash left
  let starlight = 0;        // releases banked this run
  let releaseKind = 'cloudminnow';   // which kind is on the pad; the floater that is left behind is its own

  // The body and the glow are the only two materials the fade drives, and they fade together.
  function setSpiritOpacity(value) {
    bodyMat.opacity = value;
    glowMat.opacity = value;
  }

  // The flash lands at full on release and eases back to the ring's resting dim.
  function applyPadGlow() {
    const remaining = flareLeft / GLOW_FLARE_TIME;
    padGlowMat.opacity = GLOW_REST_OPACITY + GLOW_FLASH_OPACITY * remaining * remaining;
  }

  // Place the spirit for a 0..1 progress. At t = 0 it is exactly on the pad; from there it
  // widens out to LAUNCH_CIRCLE_RADIUS as it climbs, goes once round the island, and fades last.
  function applyProgress(t) {
    const climb = easeOutCubic(t);
    const angle = PAD_ANGLE + t * LAUNCH_TURNS * FULL_TURN;
    const radius = PAD_X + (LAUNCH_CIRCLE_RADIUS - PAD_X) * climb;
    spirit.position.set(
      Math.sin(angle) * radius,
      SPIRIT_START_Y + climb * LAUNCH_RISE_HEIGHT,
      Math.cos(angle) * radius
    );
    setSpiritOpacity(fadeAt(t));
  }

  function ringPrev(index) {
    return (index + TRAIL_HISTORY - 1) % TRAIL_HISTORY;
  }

  function ringOldest() {
    return (trailHead - trailCount + 1 + TRAIL_HISTORY) % TRAIL_HISTORY;
  }

  // Push this frame's position onto the ring. The segment from the last entry becomes arc length,
  // so trailDist[] measures distance flown and never frames elapsed.
  function pushTrail() {
    // Read the last entry before moving the head: trailHead still points at it, and stepping back
    // from the head would read the slot behind the last write, which is stale on the second frame.
    if (trailCount > 0) {
      const prev = trailHead * 3;
      const dx = spirit.position.x - trailPos[prev];
      const dy = spirit.position.y - trailPos[prev + 1];
      const dz = spirit.position.z - trailPos[prev + 2];
      trailTotal += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    trailHead = (trailHead + 1) % TRAIL_HISTORY;
    const at = trailHead * 3;
    trailPos[at] = spirit.position.x;
    trailPos[at + 1] = spirit.position.y;
    trailPos[at + 2] = spirit.position.z;
    trailDist[trailHead] = trailTotal;
    if (trailCount < TRAIL_HISTORY) trailCount += 1;
  }

  // Refill the one Points geometry from the history: mote i sits i steps of distance back along the
  // path, scattered a little and lagging below, and dims with its age.
  function writeWake() {
    const positions = trail.positions;
    const colors = trail.colors;
    const oldest = ringOldest();
    const oldestDist = trailDist[oldest];
    const newestDist = trailDist[trailHead];

    // The target distance only ever falls as the motes age, so the walk back through the history
    // carries one pointer instead of starting over for each mote: the whole sweep is linear.
    let hi = trailHead;

    for (let i = 0; i < LAUNCH_TRAIL_COUNT; i++) {
      const age = i / Math.max(1, LAUNCH_TRAIL_COUNT - 1);   // 0 newest .. 1 oldest
      const targetDist = newestDist - i * TRAIL_AGE_STEP;
      // The history still has to grow to cover the newest mote's distance behind the ray.
      const clamped = targetDist < oldestDist;

      // Step back to the first entry at or above the target, never past the oldest one.
      while (hi !== oldest && trailDist[ringPrev(hi)] >= targetDist) hi = ringPrev(hi);

      // Nothing below the oldest entry, so the two ends collapse onto it and the mote clamps.
      const lo = (clamped || hi === oldest) ? oldest : ringPrev(hi);
      const seg = trailDist[hi] - trailDist[lo];
      const k = (!clamped && seg > 0) ? (targetDist - trailDist[lo]) / seg : 0;

      const loAt = lo * 3;
      const hiAt = hi * 3;
      const out = i * 3;
      positions[out] = trailPos[loAt] + (trailPos[hiAt] - trailPos[loAt]) * k
        + (hash01(i * 4 + 1) * 2 - 1) * LAUNCH_TRAIL_SPREAD;
      positions[out + 1] = trailPos[loAt + 1] + (trailPos[hiAt + 1] - trailPos[loAt + 1]) * k
        - LAUNCH_TRAIL_RISE * (TRAIL_LAG_MIN + (1 - TRAIL_LAG_MIN) * hash01(i * 4 + 2));
      positions[out + 2] = trailPos[loAt + 2] + (trailPos[hiAt + 2] - trailPos[loAt + 2]) * k
        + (hash01(i * 4 + 3) * 2 - 1) * LAUNCH_TRAIL_SPREAD;

      // Bright at the head, fully dark at the tail. With additive blending a dark mote adds
      // nothing, so the wake thins out to nothing instead of ending in a row of black specks.
      const fade = clamped ? 0 : (1 - age) * (1 - age) * TRAIL_BRIGHTNESS;
      colors[out] = glowColor.r * fade;
      colors[out + 1] = glowColor.g * fade;
      colors[out + 2] = glowColor.b * fade;
    }

    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.attributes.color.needsUpdate = true;
  }

  // Wipe the history so no mote from the last launch can leak into the new one. Cheap and rare.
  function clearTrail() {
    trailHead = TRAIL_HISTORY - 1;
    trailCount = 0;
    trailTotal = 0;
    trailPos.fill(0);
    trail.colors.fill(0);
    trail.positions.fill(0);
    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.attributes.color.needsUpdate = true;
  }

  // Put one floater where its own numbers currently hold it. Shared by the spawn and by the
  // per-frame update, so the two can never disagree about where it is - the same trick the sky's
  // drifting motes use. The tile lift is given back here: the pad has to ride a tile that can be
  // raised and lowered, but the sky does not, and without this the whole flock would rise with the
  // right-hand tile. The creatures belong to island.group, so the island's turn still carries them.
  function placeFloater(f) {
    const lift = Math.sin(f.bob) * FLOATER_BOB;
    f.root.position.set(
      Math.sin(f.angle) * f.radius,
      f.height + lift - group.position.y,
      Math.cos(f.angle) * f.radius
    );
    f.root.rotation.y = f.spin;
    f.root.rotation.z = Math.cos(f.bob) * FLOATER_ROLL;
  }

  // A release just finished: the creature that got away stays in the sky. Everything here is drawn
  // once per release at most, so the Math.random scatter costs nothing.
  function spawnFloater() {
    const radius = THREE.MathUtils.lerp(FLOATER_RADIUS_MIN, FLOATER_RADIUS_MAX, Math.random());
    const along = (radius - FLOATER_RADIUS_MIN) / (FLOATER_RADIUS_MAX - FLOATER_RADIUS_MIN);
    const shape = FLOATER_SHAPES[releaseKind] || FLOATER_SHAPES.cloudminnow;
    const mats = floaterMaterials(releaseKind);
    const root = buildFloater(
      floaterBox, floaterCone, mats.body, mats.fin, floaterGlowMat, shape
    );
    root.scale.setScalar(
      THREE.MathUtils.lerp(FLOATER_SIZE_MIN, FLOATER_SIZE_MAX, Math.random()) * shape.size
    );

    const f = {
      root,
      radius,
      // Tied to the radius, plus a jitter: see FLOATER_RADIUS_MAX for why the two move together.
      height: THREE.MathUtils.lerp(FLOATER_HEIGHT_MIN, FLOATER_HEIGHT_MAX, along)
        + (Math.random() * 2 - 1) * FLOATER_HEIGHT_JITTER,
      angle: floaterSlot * FLOATER_SPREAD_ANGLE
        + (Math.random() * 2 - 1) * FLOATER_SPREAD_JITTER,
      spin: Math.random() * FULL_TURN,
      bob: Math.random() * FULL_TURN,     // this one's own phase in the slow rise and fall
      drift: FLOATER_DRIFT
        * THREE.MathUtils.lerp(1 - FLOATER_DRIFT_SPREAD, 1 + FLOATER_DRIFT_SPREAD, Math.random()),
      bobRate: FLOATER_BOB_RATE
        * THREE.MathUtils.lerp(1 - FLOATER_BOB_SPREAD, 1 + FLOATER_BOB_SPREAD, Math.random()),
      turn: FLOATER_TURN
        * THREE.MathUtils.lerp(1 - FLOATER_TURN_SPREAD, 1 + FLOATER_TURN_SPREAD, Math.random()),
    };

    floaterSlot += 1;
    placeFloater(f);
    floaters.push(f);
    group.add(root);

    // The sky holds FLOATERS_MAX and no more. The oldest one goes the moment the ninth arrives -
    // out right away rather than faded out, because the cap is what keeps the sky readable and a
    // release is the one moment nobody is watching an animal that has been up there for minutes.
    if (floaters.length > FLOATERS_MAX) {
      const oldest = floaters.shift();
      group.remove(oldest.root);
    }
  }

  function clearFloaters() {
    while (floaters.length > 0) group.remove(floaters.pop().root);
    floaterSlot = 0;
  }

  function start(kind) {
    if (playing) return false;
    // The makers' note: only the egg was different for the duskfin. Whatever kind goes up is the kind
    // that is left in the sky, so the animal that drifts past is the animal the Caretaker raised.
    if (kind) releaseKind = kind;
    playing = true;
    elapsed = 0;
    starlight += STARLIGHT_PER_LAUNCH;
    flareLeft = GLOW_FLARE_TIME;
    spirit.visible = true;
    spirit.rotation.y = 0;
    ray.rotation.z = 0;
    clearTrail();
    trail.points.visible = true;
    applyProgress(0);       // on the arc and fully lit from the very first frame
    applyPadGlow();         // and the ring flashes the moment the release is asked for
    return true;
  }

  function update(dt) {
    let event = null;

    // Ride the tile, so the pad and the spirit both leave from wherever the tile currently sits.
    if (padTile) group.position.y = padTile.group.position.y;

    // A step that is not a usable length of time is dropped rather than written into the sky: one
    // NaN would poison a floater's position for the rest of the round, and a negative step would
    // walk its drift backwards.
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;

    // The animals that have been released, drifting round the island. This runs in every state,
    // not only mid-launch: they keep floating while the pool raises the next egg. Nothing here
    // allocates - each floater's motion is written straight onto the mesh it already has.
    for (let i = 0; i < floaters.length; i++) {
      const f = floaters[i];
      f.angle += (f.drift / f.radius) * step;
      // One full turn, then start again. Modulo, not subtraction: a stalled tab can hand us a step
      // big enough to clear the full turn several times over.
      if (f.angle >= FULL_TURN) f.angle %= FULL_TURN;
      f.bob += f.bobRate * step;
      if (f.bob >= FULL_TURN) f.bob %= FULL_TURN;
      f.spin += f.turn * step;
      placeFloater(f);
    }

    if (flareLeft > 0) {
      flareLeft = Math.max(0, flareLeft - dt);
      applyPadGlow();
    }

    // Slow turn, so it never looks frozen, plus a gentle roll tied to it: the ray banks into the
    // direction it is turning, which is most of what makes it read as flying rather than sliding.
    spirit.rotation.y += SPIRIT_SPIN_RATE * dt;
    ray.rotation.z = Math.sin(spirit.rotation.y) * RAY_BANK;

    if (!playing) return null;

    elapsed += dt;
    const t = Math.min(1, elapsed / LAUNCH_DURATION);
    applyProgress(t);
    pushTrail();
    writeWake();

    if (t >= 1) {
      // Clear the flag on the same frame it finishes, so 'launched' fires once and never again.
      playing = false;
      spirit.visible = false;
      trail.points.visible = false;
      // The creature is away: it leaves one of its own kind in the sky behind it.
      spawnFloater();
      event = 'launched';
    }

    return event;
  }

  function isBusy() {
    return playing;
  }

  function getStarlight() {
    return starlight;
  }

  // Spend banked starlight. Anything that is not a real, non-negative amount is refused, and so is
  // a spend larger than the balance: nothing is subtracted unless the whole of it is covered, so
  // the balance can never be driven below zero.
  function spendStarlight(n) {
    if (!Number.isFinite(n) || n < 0) return false;   // NaN, Infinity and negatives: no change
    if (starlight < n) return false;
    starlight -= n;
    return true;
  }

  function reset() {
    playing = false;        // safe mid-flight: the next start() runs a fresh launch
    elapsed = 0;
    flareLeft = 0;
    starlight = 0;
    spirit.visible = false;
    spirit.rotation.y = 0;
    ray.rotation.z = 0;
    spirit.position.set(PAD_X, SPIRIT_START_Y, 0);   // parked on the pad, where it lifts off
    setSpiritOpacity(1);
    trail.points.visible = false;
    clearTrail();
    applyPadGlow();         // ring back to its resting dim
    clearFloaters();        // and every animal the last round left up there goes with it
  }

  return {
    group,
    start,
    update,
    isBusy,
    getStarlight,
    spendStarlight,
    reset,
  };
}
