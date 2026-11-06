// The boarding platform: a planked deck built onto the side of the track, facing in toward the island.
import * as THREE from 'three';
import {
  PLATFORM_LENGTH,
  PLATFORM_WIDTH,
  PLATFORM_DECK_COLOR,
  PLATFORM_BEAM_COLOR,
  PLATFORM_POST_COLOR,
  PLATFORM_POST_DROP,
  PLATFORM_RAILING_COLOR,
  PLATFORM_RAILING_HEIGHT,
  PLATFORM_RAILING_THICK,
  PLATFORM_PLANK_COUNT,
  PLATFORM_BEAM_DROP,
  TILE_SIZE,
  TRAIN_CAR_WIDTH,
  TRAIN_CAR_ROOF_OVERHANG,
} from './tuning.js';

// --- The frame this is built in ---
// The platform hangs off the TRAIN's rail group, not off the island. That is what makes it part of
// the railway rather than part of the island - and the railway does not move. train.js places that
// group at its one heading and its one ground height as it is created and never touches either again,
// so this platform is fixed in the world, and the island is what comes and goes underneath it.
//
// Building in the rail group's own frame comes with two gifts worth naming:
//
//   local y = 0 IS the railway's own ground plane - TRAIN_RAIL_GROUND_Y in tuning.js, which is the
//   middle tile's grass top when that tile sits at its starting level. The deck's top face goes at
//   y = 0, so while the island is lined up AND level the two decks meet with nothing to climb. Lift
//   the middle tile and the grass leaves that plane instead, which is the makers' choice; main.js is
//   the only place that judges it, through BOARD_LEVEL_TOLERANCE. Nothing here has an opinion.
//
//   local -X points at the island, and its front edge sits at x = -PLATFORM_LENGTH (-2.8), which is
//   TRAIN_SETBACK - TILE_SIZE / 2: the gap between the island's edge and the rail's centreline. So
//   the platform's near edge lands on the island's own edge when the island is lined up, and both
//   numbers follow the track rather than being chosen twice.
//
// Nothing here reads island.angle or island.group. Turning the ISLAND is the whole of the alignment,
// and train.isAligned() is where that is asked; this file only ever answers where its own deck is.

// --- Numbers tuning.js does not carry ---
// tuning.js gives the platform its colours, its plank count and how far the framing and the posts
// drop, but not how thick a board is or how wide a beam is. These stay local, and are reported to
// the makers rather than added to a file that is not ours.
const PLANK_THICK = 0.08;         // a board's thickness, so the deck reads as boards, not a sheet
const PLANK_JOINT = 0.025;        // the open joint between two boards: the joins are the whole point
// The grass cap lips 3cm past the tile's own edge - TILE_SIZE * (GRASS_OVERHANG - 1) / 2, in
// island.js - and its top face is exactly the deck's height. So the deck can start neither at the
// island's published edge nor at the tile's: it starts where the grass actually ends. That is what
// keeps the two top faces side by side instead of one lapping over the other, which is a z-fight
// you can see from across the scene. ownsPoint still takes the whole rectangle from the tile's edge.
const GRASS_LIP = 0.03;
const DECK_FIT = 0.006;           // a hair more, so the grass's edge and the deck's can never tie
const FRAME_THICK = 0.09;         // square section of the beams and the railing uprights
const FRAME_INSET = 0.01;         // how far inside the deck's own edge every frame member stops
const FRAME_LIFT = 0.002;         // a couple of mm: the deck hangs clear of the framing beneath it,
                                  // so no board's underside ever sits on a beam's top face
const POST_TUCK = 0.02;           // how far a post reaches up inside the deck, burying its own top
const POST_THICK = PLATFORM_RAILING_THICK;   // one member through the deck: the post under it and
                                             // the railing upright over it share a line and a section
// The widest a car comes in from the rail's centreline: its roof, which lips over the window band
// as well as the body. Worked out from the car's own two numbers in tuning.js rather than written
// down again, so growing the train can never leave the railing standing inside a car's roof.
const TRAIN_FLANK = TRAIN_CAR_WIDTH / 2 + TRAIN_CAR_ROOF_OVERHANG;
const RAIL_CLEAR = 0.015;         // so the railing stops this clear of it, rather than running
                                  // through the flank of a car parked at the dock

// --- The deck's footprint ---
// Two edges, and the whole platform falls out of them. The far one is the rail box's near side
// (RAIL_WIDTH / 2 in train.js), because the deck stops at the track instead of climbing into it.
// The near one is the island's edge with the grass's lip and the fit taken back off it.
const DECK_FAR_X = -TILE_SIZE * 0.125;
const DECK_NEAR_X = -(PLATFORM_LENGTH - GRASS_LIP - DECK_FIT);
const DECK_SPAN_X = DECK_FAR_X - DECK_NEAR_X;
// Boards are laid across the walkway, so each one runs the full PLATFORM_WIDTH along Z and is short
// along X. The joints are taken out first and the boards share what is left, so the first board
// starts flush with the deck's near edge and the last one ends flush with the far edge - no leftover
// sliver at either end, which is what a shared gap on both sides of every board would leave.
const PLANK_X = (DECK_SPAN_X - (PLATFORM_PLANK_COUNT - 1) * PLANK_JOINT) / PLATFORM_PLANK_COUNT;
const PLANK_PITCH = PLANK_X + PLANK_JOINT;
const PLANK_MID_Y = -PLANK_THICK / 2;   // boards hung UNDER the top face, which is the plane at y = 0

// --- The framing under the deck ---
// Two beams down the sides and two rims across the ends, hung PLATFORM_BEAM_DROP below the deck.
// Every member stops FRAME_INSET inside the deck's own edge: flush, a beam's outer face would sit on
// the same plane as a board's side face, and the two would fight along the whole length.
const BEAM_NEAR_X = DECK_NEAR_X + FRAME_INSET;
const BEAM_FAR_X = DECK_FAR_X - FRAME_INSET;
const BEAM_LENGTH_X = BEAM_FAR_X - BEAM_NEAR_X;
const BEAM_MID_X = (BEAM_NEAR_X + BEAM_FAR_X) / 2;
const BEAM_TOP_Y = -PLANK_THICK - FRAME_LIFT;
const BEAM_BOTTOM_Y = BEAM_TOP_Y - PLATFORM_BEAM_DROP;
const BEAM_MID_Y = (BEAM_TOP_Y + BEAM_BOTTOM_Y) / 2;
const BEAM_Z = PLATFORM_WIDTH / 2 - FRAME_INSET - FRAME_THICK / 2;   // the side beams' line
const CROSS_NEAR_X = BEAM_NEAR_X + FRAME_THICK / 2;
const CROSS_FAR_X = BEAM_FAR_X - FRAME_THICK / 2;
// Butted between the two side beams rather than run past them, so the three meet in flat joints.
const CROSS_LENGTH_Z = PLATFORM_WIDTH - 2 * (FRAME_INSET + FRAME_THICK);

// --- The posts ---
// One line per corner, carried on up through the deck by the railing: the upright above and the
// post below are centred on the same point, and the post is the slimmer of the two, so it sits
// inside the beam it passes and no two of their faces are ever on one plane. The top is tucked up
// into the boards, which buries it; the bottom runs on down PLATFORM_POST_DROP into open sky. That
// drop is deliberately longer than the island's own rock keel, so the platform looks like it goes
// on down further than you can see.
const POST_NEAR_X = BEAM_NEAR_X + FRAME_INSET + POST_THICK / 2;
// The far pair stands where the train's flank comes alongside, not at the deck's far edge: the deck
// runs on under the parked cars to the boarding step, and that last hand's width is left unrailed
// on purpose, because it is the way onto the train.
const POST_FAR_X = -(TRAIN_FLANK + RAIL_CLEAR + FRAME_THICK / 2);
const POST_TOP_Y = BEAM_TOP_Y + POST_TUCK;
const POST_MID_Y = POST_TOP_Y - PLATFORM_POST_DROP / 2;

// --- The railing ---
// Along the two long sides only, from the island end to where the train comes alongside: the island
// end is where the Caretaker walks on and the far end is the step onto the train, so both stay open.
const UPRIGHT_TOP_Y = PLATFORM_RAILING_HEIGHT + PLATFORM_RAILING_THICK / 2;
const UPRIGHT_BOTTOM_Y = -POST_TUCK;
const UPRIGHT_HEIGHT = UPRIGHT_TOP_Y - UPRIGHT_BOTTOM_Y;
const UPRIGHT_MID_Y = (UPRIGHT_TOP_Y + UPRIGHT_BOTTOM_Y) / 2;
const RAIL_NEAR_X = POST_NEAR_X + FRAME_THICK / 2;
const RAIL_FAR_X = POST_FAR_X - FRAME_THICK / 2;
const RAIL_LENGTH_X = RAIL_FAR_X - RAIL_NEAR_X;
const RAIL_MID_X = (RAIL_NEAR_X + RAIL_FAR_X) / 2;

// One flat, ropy material per timber colour, built once and shared by every part that wears it:
// four materials for the whole platform, never one per board.
function timber(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1 });
}

// One scratch vector per query, reused because both are asked every frame while the Caretaker is
// near the seam, and neither worldToLocal nor applyMatrix4 returns anything without mutating.
const SCRATCH_LOCAL = new THREE.Vector3();
const SCRATCH_DECK = new THREE.Vector3();

export function createDock(scene, train) {
  // This group's own origin IS the rail group's origin: ownsPoint hands a world point straight to
  // it, and getDeckY reads its translation, so it must carry no offset and no rotation of its own.
  // Everything below is placed in the rail group's frame on purpose, and the two queries depend on it.
  const group = new THREE.Group();

  const deckMat = timber(PLATFORM_DECK_COLOR);
  const beamMat = timber(PLATFORM_BEAM_COLOR);
  const postMat = timber(PLATFORM_POST_COLOR);
  const railMat = timber(PLATFORM_RAILING_COLOR);

  // One geometry per shape rather than per mesh: the eleven boards share one box, and the four
  // uprights share another. Six geometries and four materials carry the whole platform.
  const plankGeo = new THREE.BoxGeometry(PLANK_X, PLANK_THICK, PLATFORM_WIDTH);
  const sideBeamGeo = new THREE.BoxGeometry(BEAM_LENGTH_X, PLATFORM_BEAM_DROP, FRAME_THICK);
  const crossBeamGeo = new THREE.BoxGeometry(FRAME_THICK, PLATFORM_BEAM_DROP, CROSS_LENGTH_Z);
  const postGeo = new THREE.BoxGeometry(POST_THICK, PLATFORM_POST_DROP, POST_THICK);
  const uprightGeo = new THREE.BoxGeometry(FRAME_THICK, UPRIGHT_HEIGHT, FRAME_THICK);
  const railGeo = new THREE.BoxGeometry(RAIL_LENGTH_X, PLATFORM_RAILING_THICK, PLATFORM_RAILING_THICK);

  // --- The deck ---
  // Boards across the walkway, one after another down the platform, all with their top faces on
  // y = 0. That plane is the tile's grass top, so the deck is level with the island by construction
  // rather than by a number copied from somewhere else.
  for (let i = 0; i < PLATFORM_PLANK_COUNT; i++) {
    const plank = new THREE.Mesh(plankGeo, deckMat);
    plank.position.set(DECK_NEAR_X + PLANK_X / 2 + PLANK_PITCH * i, PLANK_MID_Y, 0);
    group.add(plank);
  }

  // --- The framing under the deck ---
  // Beams down both sides for the length of the platform, and a rim across each end. They hang
  // below the boards rather than beside them, so the deck stays the widest part of the platform, and
  // they are what you see through the joints.
  [1, -1].forEach((side) => {
    const beam = new THREE.Mesh(sideBeamGeo, beamMat);
    beam.position.set(BEAM_MID_X, BEAM_MID_Y, side * BEAM_Z);
    group.add(beam);
  });
  [CROSS_NEAR_X, CROSS_FAR_X].forEach((x) => {
    const rim = new THREE.Mesh(crossBeamGeo, beamMat);
    rim.position.set(x, BEAM_MID_Y, 0);
    group.add(rim);
  });

  // --- The posts ---
  // Four, one per corner of the deck's frame, dropping into open sky. There is nothing under the
  // platform to stand on, and that is the point: it reads as something built out over the drop.
  [POST_NEAR_X, POST_FAR_X].forEach((x) => {
    [1, -1].forEach((side) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, POST_MID_Y, side * BEAM_Z);
      group.add(post);
    });
  });

  // --- The railing ---
  // A top rail down each long side, held by an upright at either end of its run. No rail across
  // either end: the near end is the way in from the island, the far end the way onto the train.
  [1, -1].forEach((side) => {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(RAIL_MID_X, PLATFORM_RAILING_HEIGHT, side * BEAM_Z);
    group.add(rail);
  });
  [POST_NEAR_X, POST_FAR_X].forEach((x) => {
    [1, -1].forEach((side) => {
      const upright = new THREE.Mesh(uprightGeo, railMat);
      upright.position.set(x, UPRIGHT_MID_Y, side * BEAM_Z);
      group.add(upright);
    });
  });

  // Hung off the rail group, so the platform is fixed in the world along with the track it belongs
  // to. Everything above is placed in that group's frame, so the moment the group was parked the
  // platform was too. scene is only the fallback: a platform loose in the scene is a far better
  // failure than a module that throws and takes the page down with it.
  const parent = train && train.group ? train.group : scene;
  if (parent) parent.add(group);

  // --- Queries ---
  // Is this world point over the deck? The platform is a plain axis-aligned rectangle in the rail
  // group's own frame, so the point is pushed back through this group's matrix - the road island.js
  // takes for a tile - and tested there. The rectangle is the platform's whole published footprint,
  // from the island's edge out to the rail's near side; the few centimetres at the near end where
  // the deck itself has not started yet are the grass's own lip, at the same height, so the answer
  // stays honest at the seam.
  function ownsPoint(worldX, worldZ) {
    group.updateWorldMatrix(true, false);   // the track's yaw as it is right now, not last frame's
    const local = group.worldToLocal(SCRATCH_LOCAL.set(worldX, 0, worldZ));
    return (
      local.x >= -PLATFORM_LENGTH &&
      local.x <= DECK_FAR_X &&
      local.z >= -PLATFORM_WIDTH / 2 &&
      local.z <= PLATFORM_WIDTH / 2
    );
  }

  // The deck is flat, so one point answers for all of it: this group's origin, which sits on the
  // deck's top plane, pushed through the group's world matrix. The two arguments are ignored on
  // purpose and kept so main.js can call this exactly as it calls island.getSurfaceY.
  function getDeckY(worldX, worldZ) {
    group.updateWorldMatrix(true, false);
    return SCRATCH_DECK.set(0, 0, 0).applyMatrix4(group.matrixWorld).y;
  }

  return { group, ownsPoint, getDeckY };
}
