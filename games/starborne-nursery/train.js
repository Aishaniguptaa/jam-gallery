// The Sky Train: a railway fixed in the world beside the island, and a train that runs in from behind, docks, then carries on out the far side. The track never moves; the island turns to meet it.
import * as THREE from 'three';
import {
  TRAIN_INTERVAL,
  TRAIN_FIRST_DELAY,
  TRAIN_WAIT_TIME,
  WINDOW_TIGHTEN,
  ALIGN_TOLERANCE,
  TILE_SIZE,
  TRAIN_HOLD_MAX,
  TRAIN_SETBACK,
  TRAIN_RAIL_ANGLE_DEG,
  TRAIN_RAIL_GROUND_Y,
  TRAIN_RAIL_RISE,
  TRAIN_ALIGN_OFFSET,
  PLATFORM_LENGTH,
  TRAIN_RAIL_COLOR,
  TRAIN_RAIL_TOP_COLOR,
  TRAIN_CAR_COLORS,
  TRAIN_CAR_ROOF_COLOR,
  TRAIN_CAR_TRIM_COLOR,
  TRAIN_SEAM_COLOR,
  // The car's own size comes from tuning.js, like every other number the makers tune: the local
  // names below are the ones the rest of this file reads.
  TRAIN_CAR_LENGTH as CAR_LENGTH,
  TRAIN_CAR_WIDTH as CAR_WIDTH,
  TRAIN_CAR_HEIGHT as CAR_HEIGHT,
  TRAIN_CAR_SPACING as CAR_SPACING,
  TRAIN_CAR_ROOF_OVERHANG as ROOF_OVERHANG,
} from './tuning.js';

// --- The rail and its railhead ---
// RAIL_Y is not a world height. The whole group is parked on the deck's own plane - local y = 0,
// which the group is placed at TRAIN_RAIL_GROUND_Y to make true - so RAIL_Y measures the rail up
// from that plane: one platform's step above the deck. There is nothing to clear, because the track
// runs past the island's front edge instead of across its middle, so the pool, the pad, the props
// and the Caretaker are all beside it, not under it. tuning.js's TRAIN_RAIL_RISE carries the number.
const RAIL_Y = TRAIN_RAIL_RISE;            // the rail's height above the deck's own plane
const RAIL_WIDTH = TILE_SIZE * 0.25;
const RAIL_HEIGHT = 0.25;
// Long enough that the train can park clear off both ends of it: the cars appear and vanish out
// beyond the rail you can see, not in the middle of the track. The makers asked for the track to
// run further, because at 12 tiles its two ends were close enough to the camera to read as a track
// that simply stopped in mid-air. At 30 (75 world units) each end is far enough out to sit at the
// sky's own vanishing point and read as a line running on out of sight, and the train gets a long
// straight run in with it.
const RAIL_LENGTH = TILE_SIZE * 30;
const FACE_LIFT = 0.01;                    // a hair of clearance wherever two faces would tie and z-fight
const RAILHEAD_WIDTH = RAIL_WIDTH * 0.5;   // the running strip, slimmer than the rail under it
const RAILHEAD_HEIGHT = 0.08;
const RAIL_TOP_Y = RAIL_Y + RAIL_HEIGHT / 2;                      // the rail's own top face
const RAILHEAD_TOP_Y = RAIL_TOP_Y + FACE_LIFT + RAILHEAD_HEIGHT;  // where a wheel would run

// --- One car: a body with a roof and a window band, built as one group ---
// The makers asked twice for a bigger train, so the five numbers that size it - and the roof
// overhang below - live in tuning.js and are made bigger there. A car is now 2.35 long, 1.30 across
// and, with its roof, 0.81 tall: taller than the Caretaker's own 0.9 is not, but close enough that a
// car at the dock comes up past their shoulder, which is what makes the train read as the larger
// thing it is. Every one of them is still a fraction of TILE_SIZE, so the proportions between the
// cars and the island's tiles are the ones the three-car berth was worked out with.
const CAR_COUNT = TRAIN_CAR_COLORS.length;
// Where the train's nose can be along the rail, in rail-local z from the rail group's own origin.
// The nose is car 0, the lead car, and car i sits CAR_SPACING behind it, so the tail car is
// CAR_SPACING * (CAR_COUNT - 1) back down the train.
//
// The platform reaches in from the rail along local -X and is centred on rail-local z = 0. So z = 0
// is the point the train has to stop at: put the nose half a train back from zero and the whole
// train is CENTRED on the platform, the middle car lies exactly alongside the boarding spot, and
// there is a car by your shoulder whichever way you look.
//
// This was measured from the island's front edge until the track moved. That edge is 90 degrees off
// from the rail now, so those numbers parked the train a couple of units down the line and the
// platform met an empty track. The berth is the platform, and the platform is the rail's own zero.
const BERTH_NOSE = CAR_SPACING * (CAR_COUNT - 1) / 2;   // where car 0, the nose, comes to rest
const PARK_BEHIND = -(RAIL_LENGTH / 2 + CAR_LENGTH);            // whole train off the -Z end: it enters from here
const PARK_AHEAD = RAIL_LENGTH / 2 + CAR_SPACING * (CAR_COUNT - 1) + CAR_LENGTH; // and off the +Z end, where it exits
// A roof may lip over by at most half the gap between two cars, which is (CAR_SPACING - CAR_LENGTH)
// / 2 = 0.11 here. Past that the neighbouring roofs would touch and the train would read as one block.
// The roof is the widest thing on a car - it lips over the window band as well as the body - and
// dock.js works its TRAIN_FLANK out of the same two numbers: CAR_WIDTH / 2 + ROOF_OVERHANG, so the
// platform's railing always stops short of the flank, at any size the makers set the cars to.
const ROOF_HEIGHT = 0.17;
const TRIM_PROUD = 0.03;                   // the band stands this far proud of the body on every side
const TRIM_HEIGHT = 0.17;
const TRIM_Y = 0;                          // the band sits at the body's middle, where windows would be
const CAR_BASE_Y = RAILHEAD_TOP_Y + FACE_LIFT;  // cars ride the railhead, never tied to its top face

// --- The seam, sitting on the line where the two decks meet ---
// The platform runs in from the rail along local -X and its far end is at -PLATFORM_LENGTH. That is
// exactly the island's own front edge and not a coincidence: PLATFORM_LENGTH is defined in tuning.js
// as the gap between the island's edge and the rail, so the island's edge and the platform's end are
// the same point by construction, at every height the middle tile takes. The glow sits on that line,
// so what brightens is the spot you walk out to.
//
// The strip runs ACROSS the platform - long in local z, thin in local x - because what it marks is a
// line the island has to come level with. It was the other way round until the track moved, from the
// days when the track crossed the island and the seam ran along the walkway instead of across it. It
// also sits down at local y = 0 now rather than up at rail height, because both decks are at grass
// height and the join is at grass height: there is no step to look at any more.
const SEAM_X = -PLATFORM_LENGTH;
const SEAM_WIDTH = TILE_SIZE * 0.08;       // thin, measured along the platform's own length
const SEAM_HEIGHT = 0.04;
const SEAM_DEPTH = TILE_SIZE * 0.6;        // as wide as the platform whose end it marks
const SEAM_MIN_OPACITY = 0.1;              // the seam never goes fully dark
const SEAM_FADE_DEGREES = 45;              // gap at which the seam is at its dimmest

// Both travel times are clocks in seconds, not steps, so the run in and the run out look the same
// at any frame rate.
// Both clocks are longer than they were because the track is: the run in is now about 42 units
// against the 19 it was, and these are what keep the train's own pace the same over the longer
// distance instead of it flying in. The ease does the rest of the work - it settles onto the dock
// gently and pulls away from it slowly, whatever the distance behind the two ends is.
const APPROACH_TIME = 5.0;                 // seconds for the nose to run in from PARK_BEHIND to the dock
const LEAVE_TIME = 3.6;                    // and out from the dock to PARK_AHEAD
const WINDOW_FLOOR = 0.5;                  // the wait window never tightens past this scale
const DEG = Math.PI / 180;

// The railway's one heading, in radians, converted once from the makers' number in tuning.js. The
// rail's Y rotation and both of its XZ coordinates come off it, so this single constant is what
// decides which way round the island, the track and the platform all face.
const RAIL_ANGLE = TRAIN_RAIL_ANGLE_DEG * DEG;

// Which tile of the island the platform meets. The makers moved it off the middle tile and onto the
// outer one, at the +X end of the island's row.
//
// The track is a long straight line, so sliding the whole group ALONG it changes nothing anyone can
// see: the rail, the platform and the train together simply sit two units further down the same
// line. What does change is which tile they sit beside - and since the island's aligned yaw is the
// rail's own heading turned a quarter turn, the island's +X axis is the rail's -Z, so sliding the
// group that way by one TILE_SIZE brings its centreline over the island's +X end tile. main.js and
// caretaker.js both retarget with it: the boarding spot, the tile the pier reports as ground, and
// the tile whose height has to meet the deck are all the island's +X end now.
const DOCK_SHIFT_ALONG_RAIL = -TILE_SIZE;   // rail-local +Z is the island's +X: negative to reach it

// Feel: a gentle magnet, NOT an autopilot. Once the player has turned the island within
// MAGNET_RANGE of the rail, the last few degrees ease in on their own — the doc's
// "satisfying click into place" moment. It only bites inside that range, so finding the
// angle is still the player's job.
const MAGNET_RANGE = 15 * DEG;
const MAGNET_PULL = 8;

// Wrap any angle into -PI..PI so a gap can be measured the short way round.
function wrapAngle(radians) {
  const a = (radians + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
}

export function createTrain(scene, island) {
  const group = new THREE.Group();
  group.visible = true;                    // the rail is part of the sky now: it is up from the first frame
  scene.add(group);

  // The rail: one long thin box centred on the group's own origin, so it runs off the -Z end and
  // the +Z end by the same amount. The train comes in over one end and leaves over the other,
  // which is what makes it a railway crossing the scene rather than a stub off the island's edge.
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, RAIL_LENGTH),
    new THREE.MeshStandardMaterial({ color: TRAIN_RAIL_COLOR, roughness: 1 })
  );
  rail.position.set(0, RAIL_Y, 0);
  group.add(rail);

  // The railhead: a slimmer, lighter strip along the rail's top, lifted a hair so the two faces
  // never tie. It is what makes the track read as a track and not one grey slab.
  const railhead = new THREE.Mesh(
    new THREE.BoxGeometry(RAILHEAD_WIDTH, RAILHEAD_HEIGHT, RAIL_LENGTH),
    new THREE.MeshStandardMaterial({ color: TRAIN_RAIL_TOP_COLOR, roughness: 1 })
  );
  railhead.position.set(0, RAIL_TOP_Y + FACE_LIFT + RAILHEAD_HEIGHT / 2, 0);
  group.add(railhead);

  // The glowing seam at the far end of the pier, level with the rail, where the two would meet.
  const seamMat = new THREE.MeshBasicMaterial({
    color: TRAIN_SEAM_COLOR,
    transparent: true,
    opacity: SEAM_MIN_OPACITY,
  });
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(SEAM_WIDTH, SEAM_HEIGHT, SEAM_DEPTH),
    seamMat
  );
  seam.position.set(SEAM_X, 0, 0);
  group.add(seam);

  // --- Where the track sits: nowhere new, ever ---
  // The makers asked for the railway to be scenery. It has one heading and one height, both
  // constants, and it keeps them: raising the middle tile no longer lifts the track, and a train
  // arriving no longer swings it round to a fresh angle. So this is done once, here, and nothing in
  // update() ever writes the group again. The island is the thing that moves.
  //
  // The group's origin is held TRAIN_SETBACK out along the heading's own local +X - the
  // perpendicular the rail treats as "outward" - and its y is TRAIN_RAIL_GROUND_Y, which is the
  // deck's own plane, so dock.js can build everything at local y = 0 and be level with the grass.
  //
  // Worked example at rot = 0: a Y rotation of zero leaves the group's local +X on world (1, 0, 0),
  // so cos(0) = 1 and -sin(0) = 0 put the origin at (TRAIN_SETBACK, 0, 0) = 3.8 straight out along
  // world +X. The island counts as aligned at RAIL_ANGLE + TRAIN_ALIGN_OFFSET = 0 + PI/2 = 90
  // degrees, and at that yaw the island's own local +Z maps to world (sin 90, 0, cos 90) = (1, 0, 0)
  // - the same direction - so the rail sits 3.8 out in FRONT of the island, off the very edge the
  // platform reaches from. Its local +X maps to world (0, 0, -1), which is the rail's own local -Z,
  // so the island's long axis lies ALONG the track rather than across it. The makers' own heading in
  // tuning.js turns that whole arrangement to face the camera.
  group.rotation.y = RAIL_ANGLE;
  // Out along the heading to TRAIN_SETBACK, and then along the track itself by
  // DOCK_SHIFT_ALONG_RAIL, which is what decides which tile of the island the platform meets. The
  // rail's own length is its local +Z, so that is the axis the second term moves along.
  group.position.set(
    Math.cos(RAIL_ANGLE) * TRAIN_SETBACK + Math.sin(RAIL_ANGLE) * DOCK_SHIFT_ALONG_RAIL,
    TRAIN_RAIL_GROUND_Y,
    -Math.sin(RAIL_ANGLE) * TRAIN_SETBACK + Math.cos(RAIL_ANGLE) * DOCK_SHIFT_ALONG_RAIL
  );

  // Three cars riding the rail top. Each is one Group, so the body, roof and window band slide
  // as a unit. The three bodies share a geometry and only their colour differs; the roof and the
  // trim share both geometry and material, so the whole train builds three materials, not nine.
  const bodyGeo = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH);
  const roofGeo = new THREE.BoxGeometry(
    CAR_WIDTH + ROOF_OVERHANG * 2,
    ROOF_HEIGHT,
    CAR_LENGTH + ROOF_OVERHANG * 2
  );
  const trimGeo = new THREE.BoxGeometry(
    CAR_WIDTH + TRIM_PROUD * 2,
    TRIM_HEIGHT,
    CAR_LENGTH + TRIM_PROUD * 2
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: TRAIN_CAR_ROOF_COLOR, roughness: 1 });
  const trimMat = new THREE.MeshStandardMaterial({ color: TRAIN_CAR_TRIM_COLOR, roughness: 1 });

  const cars = TRAIN_CAR_COLORS.map((color, i) => {
    const car = new THREE.Group();

    const body = new THREE.Mesh(
      bodyGeo,
      new THREE.MeshStandardMaterial({ color, roughness: 1 })
    );
    car.add(body);

    // The roof lips over the body on every side, which is the whole chunky diorama silhouette.
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = CAR_HEIGHT / 2 + ROOF_HEIGHT / 2;
    car.add(roof);

    // The band stands proud of the body at its middle, so a car reads as a car with windows.
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = TRIM_Y;
    car.add(trim);

    // Parked off the +Z end to begin with: the cars stay hidden until a train comes in.
    car.position.set(0, CAR_BASE_Y + CAR_HEIGHT / 2, PARK_AHEAD - CAR_SPACING * i);
    car.visible = false;
    group.add(car);
    return car;
  });

  // State.
  let phase = 'waiting';                   // 'waiting' -> 'arriving' -> 'atDock' -> 'leaving' -> 'waiting'
  let countdown = TRAIN_INTERVAL;          // seconds until the next arrival
  let waitLeft = 0;                        // seconds the train has left at the dock
  let waitWindow = TRAIN_WAIT_TIME;        // this visit's window, TRAIN_WAIT_TIME * windowScale
  let windowScale = 1;                     // tightens by WINDOW_TIGHTEN per visit
  let nose = PARK_AHEAD;                   // where car 0 sits along the rail, in rail-local z
  let approachLeft = 0;                    // seconds left of the run in
  let leaveLeft = 0;                       // seconds left of the run out
  let held = false;                        // true while the Caretaker is standing at the dock
  let dockElapsed = 0;                     // seconds this visit has been at the dock, hold or not
  // The first train is a special case the makers asked for: it comes almost at once and then simply
  // stands at the berth with its clock stopped until the player actually trades with it. The game
  // starts with an empty pool - the first egg is bought - so a player who has to wait out a full
  // TRAIN_INTERVAL before they can do anything has been given nothing to do. Once they have used
  // the train, this clears for good and every visit after it runs the ordinary window.
  let firstVisit = true;                   // true until the player has interacted with the first train
  // How far the island still has to turn, the short way round: the gap between where the island is
  // and the angle that lines it up with the track. The island must turn a quarter turn off the
  // rail's own heading to face it, which is what TRAIN_ALIGN_OFFSET is for, and every check below
  // measures this same number so they can never disagree about what "lined up" means.
  //
  // RAIL_ANGLE is a constant, so this gap is a plain measure of where the ISLAND is: the track is
  // the fixed thing, and turning the island is the whole of the alignment. Since the island drifts
  // slowly on its own (ISLAND_DRIFT_DEG), this is never settled for good.
  function alignmentGap() {
    return wrapAngle(RAIL_ANGLE + TRAIN_ALIGN_OFFSET - island.angle);
  }

  // Pure check of the angles right now: the island's yaw against that alignment angle, short way.
  function isAligned() {
    return Math.abs(alignmentGap()) <= ALIGN_TOLERANCE * DEG;
  }

  // The angle the island has to BE at for the track to line up: the rail's own fixed heading plus
  // the quarter turn of TRAIN_ALIGN_OFFSET. It never changes, and main.js hands it straight to
  // island.snapToView, which is what makes the walk out to the platform a magnet rather than a
  // guess. The rail's own heading would ease the island round to the wrong way - it is the island's
  // angle that is wanted here, a quarter turn off the rail.
  function getRailAngle() {
    return RAIL_ANGLE + TRAIN_ALIGN_OFFSET;
  }

  // Send the train in. It is parked off the -Z end, so it only ever has to run forwards from here:
  // in to the dock, then out over the +Z end. Nothing reverses. There is nothing to re-aim: the
  // track is where it has always been, and it is the island that has to come round to meet it.
  function arrive() {
    nose = PARK_BEHIND;
    approachLeft = APPROACH_TIME;
    phase = 'arriving';
    cars.forEach((car) => {
      car.visible = true;
    });
  }

  function startLeaving() {
    phase = 'leaving';
    leaveLeft = LEAVE_TIME;
  }

  function update(dt) {
    let event = null;

    if (phase === 'waiting') {
      countdown = Math.max(0, countdown - dt);
      if (countdown <= 0) arrive();
    }

    if (phase === 'arriving') {
      // One direction and one clock: the nose eases from the far -Z end up to the dock on an
      // ease-out, so the train is brisk out in the distance and settling as it comes alongside.
      approachLeft = Math.max(0, approachLeft - dt);
      const t = 1 - approachLeft / APPROACH_TIME;   // 0 at PARK_BEHIND, 1 at the dock
      nose = PARK_BEHIND + (BERTH_NOSE - PARK_BEHIND) * (1 - Math.pow(1 - t, 3));
      if (approachLeft <= 0) {
        nose = BERTH_NOSE;
        waitWindow = TRAIN_WAIT_TIME * windowScale;
        waitLeft = waitWindow;
        dockElapsed = 0;                   // the new visit's clock starts now
        phase = 'atDock';
      }
    }

    if (phase === 'atDock') {
      // The magnet: it only pulls once the player is already close. A hold never touches it, so
      // the island can still be turned and lined up while the train is being held.
      const gapToRail = alignmentGap();
      if (Math.abs(gapToRail) < MAGNET_RANGE) {
        island.rotateBy(gapToRail * Math.min(1, MAGNET_PULL * dt));
      }
      // The visit's clock runs whatever the player does; the wait does not. A hold stops the
      // countdown while the Caretaker stands there, and TRAIN_HOLD_MAX stops the hold from
      // ever stranding the train: past the cap the countdown runs down as if nothing were held.
      dockElapsed += dt;
      // The first visit has no clock at all: it stands here until the player uses it, past even the
      // hold cap, because standing there is the whole point of it.
      if (!firstVisit && (!held || dockElapsed >= TRAIN_HOLD_MAX)) {
        waitLeft = Math.max(0, waitLeft - dt);
      }
      // A berth is a STOP, not a moment. Lining the island up used to end the visit on the spot -
      // the seam closed, the train pulled out, and a player who watched it arrive could never
      // reach it: the whole stop went by while it was already moving. The makers cut that, so the
      // train now stands here for the rest of its window and the only thing that ends the visit is
      // the window running out. Lining up still matters - the deck only meets the island's edge
      // when the two are in line, so it is still what lets the Caretaker walk out to the trade -
      // it just no longer takes the train away the second it happens.
      if (waitLeft <= 0) {
        event = 'departed';
        // Each visit leaves the next one a little shorter: WINDOW_TIGHTEN of the window gone, down
        // to WINDOW_FLOOR. It used to be counted per successful dock, and a berth is the thing to
        // count now, because a berth is what a visit is.
        windowScale = Math.max(WINDOW_FLOOR, windowScale * WINDOW_TIGHTEN);
        startLeaving();
      }
    }

    if (phase === 'leaving') {
      // And out over the far side: the nose runs from the dock to the far +Z end, picking up speed
      // from a standstill, so the train pulls away rather than snapping back the way it came.
      leaveLeft = Math.max(0, leaveLeft - dt);
      const t = 1 - leaveLeft / LEAVE_TIME;   // 0 at the dock, 1 at PARK_AHEAD
      nose = BERTH_NOSE + (PARK_AHEAD - BERTH_NOSE) * (t * t * t);
      if (leaveLeft <= 0) {
        nose = PARK_AHEAD;
        cars.forEach((car) => {
          car.visible = false;
        });
        phase = 'waiting';
        countdown = TRAIN_INTERVAL;
      }
    }

    // The rail is not moved here, and that is the point of this whole module now. Its heading and
    // its position were written once at creation and nothing has touched them since; the island
    // drifting and being turned is what makes the two come together.

    // Cars ride the rail: car 0 at the nose, each one behind it a CAR_SPACING further back. The
    // nose only ever moves one way, so the train drives through instead of reversing out.
    cars.forEach((car, i) => {
      car.position.z = nose - CAR_SPACING * i;
    });

    // The seam brightens as the island closes on the rail: 1 - clamp(gap / 45 degrees, 0, 1).
    const gap = Math.abs(alignmentGap());
    const closeness = 1 - Math.min(1, gap / (SEAM_FADE_DEGREES * DEG));
    seamMat.opacity = SEAM_MIN_OPACITY + (1 - SEAM_MIN_OPACITY) * closeness;

    return event;
  }

  function reset() {
    phase = 'waiting';
    // The first train of a run is due almost immediately, and it is the one that waits for the
    // player; see firstVisit above.
    countdown = firstVisit ? TRAIN_FIRST_DELAY : TRAIN_INTERVAL;
    waitWindow = TRAIN_WAIT_TIME;
    waitLeft = 0;
    windowScale = 1;
    nose = PARK_AHEAD;
    approachLeft = 0;
    leaveLeft = 0;
    held = false;
    dockElapsed = 0;
    // The rail is left exactly where it is, and so is the island: a restart puts the train back in
    // its shed and the countdown back to full, and nothing else about the world changes. Where the
    // island is pointing and where the track is are one continuous thing across a restart.
    seamMat.opacity = SEAM_MIN_OPACITY;
    cars.forEach((car) => {
      car.visible = false;
    });
  }

  function isAtDock() {
    return phase === 'atDock';
  }

  // The player has used the first train - opened its shop and seen the trade. From here it is an
  // ordinary visit with a full window ahead of it, and the cycle resumes without another first.
  function noteInteraction() {
    if (!firstVisit) return;
    firstVisit = false;
    waitLeft = TRAIN_WAIT_TIME * windowScale;
    dockElapsed = 0;
  }

  // True only while the first train is standing at the berth and waiting to be used: the sign says
  // so in those words rather than showing a countdown that is not running.
  function isFirstVisit() {
    return firstVisit && phase === 'atDock';
  }

  function getCountdown() {
    return phase === 'waiting' ? countdown : 0;
  }

  function getWaitLeft() {
    return phase === 'atDock' ? waitLeft : 0;
  }

  // The hold flag, set by whoever knows where the Caretaker is standing. It only stores a plain
  // boolean, so calling it every frame with the same value costs nothing and changes nothing.
  function setHeld(value) {
    held = !!value;
  }

  function isHeld() {
    return held;
  }

  return {
    group,
    update,
    reset,
    isAligned,
    getRailAngle,
    isAtDock,
    getCountdown,
    getWaitLeft,
    setHeld,
    isHeld,
    noteInteraction,
    isFirstVisit,
  };
}
