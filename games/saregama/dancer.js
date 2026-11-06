// dancer.js — the makers' rigged dancer: her dance, written as a small set of sine-driven bone rotations.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as T from './tuning.js'; // read only: the file and the slot the game already names for her

const { DANCER_MODEL_URL, DANCER_WIDTH, DANCER_HEIGHT, DANCER_X, DANCER_Z, DANCER_YAW } = T;

// --- THE NUMBERS. Every one of these is a knob for the makers, and they all move into tuning.js when the
// dance gets its own tuning pass. Angles are radians: a tenth is already a lot on a spine.
// The idle: slow, continuous, and nowhere near the tempo, so she is never quite still.
const SHIFT_SPEED = 0.55;         // rad/s of the weight shift: one swing from leg to leg in about eleven seconds
const BREATH_SPEED = 1.05;        // rad/s of the chest rising and falling: about six seconds a breath
const DRIFT_SPEED = 0.31;         // rad/s of the head's wander: the slowest of the three
const SHIFT_TURN = 0.055;         // rad the hips turn as the weight goes from one leg to the other
const SHIFT_TIP = 0.035;          // rad the hips tip over the weighted leg
const SPINE_TURN = 0.045;         // rad the spine unwinds of that turn, so her shoulders stay square
const SPINE_COUNTER = 0.05;       // rad the spine leans back against that tip, so her head stays level
const CHEST_LIFT = 0.022;         // rad the chest opens on the in-breath and closes on the out-breath
const NECK_COUNTER = 0.018;       // rad the neck keeps her head over her feet
const HEAD_COUNTER = 0.012;       // and the head carries on past level, the way a head does
const HEAD_DRIFT = 0.045;         // rad the head turns slowly, as if it were watching the pillars arrive
const HEAD_TILT = 0.02;           // rad the head tips with that drift
const SHIFT_KNEE = 0.045;         // rad the two knees alternate by as her weight shifts between them
const BASE_FOLD = 0.05;           // rad both knees carry a little bend, so she stands grounded, not locked
// A layer that runs down several joints is worked out whole and then shared: the shares below add up to
// one, so the layer lands complete by the time it reaches her head.
const CHAIN_TOP = 0.45;           // the share the lowest of three joints takes
const CHAIN_MIDDLE = 0.35;        // the middle one
const CHAIN_TAIL = 0.20;          // and the highest
// The base pose: arms raised with the elbows out, a devotee's stance rather than arms at her sides. It is
// applied on every frame, because the file has her in a wide T and nothing else would put her arms down.
const BASE_ARM_DROP = 0.08;       // rad the upper arms come down from that T into the stance
const BASE_ARM_FORWARD = 0.12;    // rad they come forward, so the elbows lead and sit in front of her
const BASE_ELBOW_BEND = 0.7;      // rad the elbows fold, which brings the hands in front of her chest
const BASE_SHOULDER_LIFT = 0.05;  // rad the shoulders sit lifted: what "elbows out" looks like from the front
const ARM_SWAY = 0.03;            // rad the arms swing a little against each other with the weight shift
// The hands: the wrists trail the arms and mark the beat with them. The fingers are left alone.
const HAND_TRAIL = 0.05;          // rad the wrists trail behind the arms' sway, the lag that reads as movement
const HAND_ACCENT = 0.03;         // rad the wrists turn on the beat, a third of what the arms themselves lift
// The beat: everything here is scaled by the accent the caller hands in, so it reads as her marking it.
const DIP_METRES = 0.015;         // how far her hips drop on a beat, in world metres: a centimetre and a half
const ACCENT_ARM_LIFT = 0.09;     // rad the arms rise on the beat
const ACCENT_ELBOW = 0.06;        // rad the elbows open a touch with them
const ACCENT_SHOULDER = 0.03;     // rad the shoulders lift, just ahead of the arms
const ACCENT_MARK = 0.025;        // rad her whole spine tips forward, marking the beat
const ACCENT_NOD = 0.05;          // rad she nods, her head taking most of it
const ACCENT_NECK_SHARE = 0.6;    // the share of that nod the neck takes, her head taking the rest
// The feet: she marks time in place, so the unweighted foot lifts a little and sets down on the beat. The
// lift is a world height, turned into the rig's own units at load, so it stays true to her body's size.
const STEP_METRES = 0.012;        // how far the unweighted foot is to leave the floor, in world metres
const STEP_FIRM = 0.9;            // the share of the step the beat takes back as the foot lands, firming the set-down
// The file has her facing -X: her toes point that way and her body is thin along X. A quarter turn
// anticlockwise puts that front down the corridor, which is where DANCER_YAW then aims her.
const FACING_YAW = -Math.PI / 2;

// --- WHERE EACH BONE TURNS
// Read off the rig's own rest pose, not assumed, because Mixamo's bones are not axis-aligned: the spine
// chain sits with its local X to her left and its local Z forward, the arm bones are mirrored left and
// right so that +x raises both, and each leg's local X is her side axis with its Y pointing down.
//   spine, neck, head   +x bends forward, +y turns her left, +z tips her to her right
//   shoulders and arms  +x raises the arm on both sides; -z swings the LEFT arm forward, +z the right
//   forearms            -z on the left and +z on the right fold that elbow and bring the hand forward
//   legs                +x swings a leg back, so a knee folds back with +x and a hip flexes with -x
//   hands               the wrist keeps the forearm's own axes: +x turns it, and -z on the left and +z on
//                       the right bend it forward, so one sign trails both hands against the arms' sway
// The signs used below are that mapping and nothing else; the sizes are the numbers above.
// The fingers are left where the file has them: five joints a hand would cost frames the hands are too
// small to repay at the distance the game stands her at. The wrist itself moves, and carries the hand.

// --- THE POSE, REBUILT EVERY FRAME
// Each rotation is set absolutely, from the bone's rest rotation, and never added to what is already
// there: a dropped frame, a fast run or a dt hiccup cannot walk the pose off its rest. The temporaries
// below are made once, at load, so a frame of the dance allocates nothing at all.
const scratchEuler = new THREE.Euler();
const scratchQuat = new THREE.Quaternion();
const scratchA = new THREE.Vector3(); // the next two are used once, at load, to measure her leg
const scratchB = new THREE.Vector3();

function turn(bone, rest, x, y, z) {
  if (bone === undefined) return; // a bone this file names and the model does not have: leave it alone
  scratchQuat.setFromEuler(scratchEuler.set(x, y, z));
  bone.quaternion.copy(rest).multiply(scratchQuat);
}

// One leg folded by `fold` radians: the thigh tips forward by half of it and the knee folds back by the
// whole of it, which keeps the ankle under the hip and drops her by just what the fold costs; the ankle
// then gives half of it back, so the sole stays flat. That last part is the approximate one — her ankle's
// own axis sits about forty-five degrees off her side axis — and it is the least of this dance: the sole
// keeps a third of the lean the fold puts on her leg, which tips her toe about a centimetre under the
// floor at the very peak of a beat and nowhere else. At the game's distance that is two pixels of it.
function foldLeg(thigh, thighRest, knee, kneeRest, ankle, ankleRest, fold) {
  turn(thigh, thighRest, -fold * 0.5, 0, 0);
  turn(knee, kneeRest, fold, 0, 0);
  turn(ankle, ankleRest, -fold * 0.5, 0, 0);
}

// --- THE JOINTS THE DANCE DRIVES, BY THE NAMES THE FILE USES
const JOINTS = {
  hips: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2', neck: 'Neck', head: 'Head',
  shoulderL: 'LeftShoulder', armL: 'LeftArm', forearmL: 'LeftForeArm', handL: 'LeftHand',
  shoulderR: 'RightShoulder', armR: 'RightArm', forearmR: 'RightForeArm', handR: 'RightHand',
  upLegL: 'LeftUpLeg', kneeL: 'LeftLeg', footL: 'LeftFoot',
  upLegR: 'RightUpLeg', kneeR: 'RightLeg', footR: 'RightFoot',
};

// The name in the file and the name in the scene are not the same string, and that is not obvious: three.js
// strips the ":" out of "mixamorig:Hips" as it loads, so the bone arrives called "mixamorigHips", while the
// file's own spelling is kept aside on the node's userData. Both are indexed here, under the last part of
// the name, so the lookup lands whichever way the loader spells it - and a re-export that drops the prefix
// altogether still dances, because the last part is the same in all three spellings.
function boneMap(model) {
  const found = new Map();
  model.traverse((node) => {
    if (node.isBone !== true) return;
    for (const name of [node.userData.name, node.name]) {
      if (typeof name === 'string' && name !== '') found.set(name.split(':').pop(), node);
    }
  });
  return found;
}

// Looked up once, here, and kept with the rest rotation each one is measured from: after this the dance
// never looks a bone up again. A bone the model turns out not to have is simply not danced.
function bind(dancer, model) {
  const found = boneMap(model);
  for (const short in JOINTS) {
    const bone = found.get(JOINTS[short]);
    dancer.bones[short] = bone;
    dancer.rest[short] = bone === undefined ? null : bone.quaternion.clone();
  }
}

// --- CREATE: starts the load and returns at once, with a dancer that does nothing yet
export function createDancer(scene) {
  const dancer = {
    object: null, // the group she stands in, once she is here: null until then
    time: 0,      // her own clock in seconds: only the sine waves read it
    ready: false, // true only once her bones are bound and she is standing in the scene
    bones: {},    // every bone the dance drives, by short name
    rest: {},     // and the rest rotation it is measured from
    hipsRestY: 0, // where her hips sit when she is not dancing
    dipUnit: 0,   // the beat's drop of the hips, in the rig's own units...
    dipFold: 0,   // ...and the knee fold that goes with it, so the drop never lifts her feet
    stepFold: 0,  // the knee fold that lifts an unweighted foot by STEP_METRES; the step only ever adds it
  };
  load(scene, dancer);
  return dancer;
}

let loader = null;

// fetch, not GLTFLoader.load: a file that is not there is one quiet null instead of a console error.
function load(scene, dancer) {
  fetch(DANCER_MODEL_URL)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((buffer) => (buffer === null ? null : parse(buffer)))
    .then((gltf) => {
      if (gltf !== null) dress(scene, dancer, gltf);
    })
    .catch(() => {}); // a missing file, a file that will not parse, a dead network: she never arrives
}

function parse(buffer) {
  if (loader === null) loader = new GLTFLoader();
  return new Promise((resolve) => {
    try {
      loader.parse(buffer, '', resolve, () => resolve(null));
    } catch (error) {
      resolve(null); // a file that parses to nothing must not take the game down
    }
  });
}

// --- DRESS: the slot, the fit, and the bones
// Measured, never assumed, so a re-export of the same character still lands on the floor with her crown on
// DANCER_HEIGHT. Her width is measured before she is turned: her arms are straight out in the file, and
// fitting that span into the slot's width would leave her standing there a doll.
function dress(scene, dancer, gltf) {
  const model = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(
    DANCER_WIDTH / Math.max(size.x, 1e-6),
    DANCER_HEIGHT / Math.max(size.y, 1e-6),
  );

  const object = new THREE.Group(); // the slot: exactly where the grey box stood
  object.position.set(DANCER_X, 0, DANCER_Z);
  object.rotation.y = DANCER_YAW;

  const holder = new THREE.Group(); // the fit: her scale, her own front, her feet on the floor
  holder.scale.setScalar(scale);
  holder.rotation.y = FACING_YAW;
  holder.position.y = DANCER_HEIGHT / 2;
  model.position.copy(centre).multiplyScalar(-1); // her middle on the slot's middle
  holder.add(model);
  object.add(holder);

  bind(dancer, model);
  const hips = dancer.bones.hips;
  const foot = dancer.bones.footL;
  if (hips === undefined || foot === undefined) return; // no hips or no feet is no dance

  scene.add(object); // nothing of hers is in the scene at all until she is ready to stand in it
  object.updateMatrixWorld(true);

  // The drop and the fold are the same number seen twice: her knee folds by exactly what it costs her
  // hips to come down, so her feet stay planted however large the makers make this dip.
  const legLength = Math.max(0.05, hips.getWorldPosition(scratchA).y - foot.getWorldPosition(scratchB).y);
  const share = Math.min(0.95, Math.max(0, DIP_METRES / legLength));
  dancer.object = object;
  dancer.hipsRestY = hips.position.y;
  dancer.dipUnit = DIP_METRES / scale;         // world metres into the rig's own units
  dancer.dipFold = 2 * Math.acos(1 - share);   // and the knee fold that same drop costs
  // The step is that same geometry read as a rise: a fold of f lifts a foot by legLength * (1 - cos(f/2)),
  // so the fold whose own lift is STEP_METRES is read off the leg length the dip just measured. It is only
  // ever added to the unweighted leg, and never taken from the weighted one, so a stepped foot is always
  // folded at least as far as a planted one: the step can lift a foot, and can never fold one down.
  const stepShare = Math.min(0.95, Math.max(0, STEP_METRES / legLength));
  dancer.stepFold = 2 * Math.acos(1 - stepShare);
  dancer.ready = true;
}

// --- ONE FRAME OF THE DANCE
// Safe to call before the model arrives, after a load that failed, and after a file that was never there:
// in every one of those cases it does nothing and says nothing.
export function updateDancer(dancer, dt, accent) {
  if (!dancer || !dancer.ready) return;
  const bones = dancer.bones;
  const rest = dancer.rest;

  if (Number.isFinite(dt)) dancer.time += Math.max(0, dt);
  const t = dancer.time;
  const beat = Number.isFinite(accent) ? Math.min(1, Math.max(0, accent)) : 0;

  // --- THE IDLE, read off her own clock
  const shift = Math.sin(t * SHIFT_SPEED);   // +1 with her weight on her left leg, -1 on her right
  const breath = Math.sin(t * BREATH_SPEED); // +1 at the top of a breath
  const drift = Math.sin(t * DRIFT_SPEED);   // her head wandering on its own, slowest of the three

  // --- THE LAYERS, each worked out whole and then spread over the joints it runs through
  const counter = SPINE_COUNTER * shift;   // her spine leaning back against the hips' tip
  const unwind = -SPINE_TURN * shift;      // and turning back against the hips' turn
  const lift = CHEST_LIFT * breath;        // the chest opening and closing
  const mark = ACCENT_MARK * beat;         // the beat, tipping her forward
  const nod = ACCENT_NOD * beat;           // and the beat, nodding her
  const armLift = ACCENT_ARM_LIFT * beat;
  const armSway = ARM_SWAY * shift;
  const shoulder = BASE_SHOULDER_LIFT + ACCENT_SHOULDER * beat;
  const elbow = BASE_ELBOW_BEND + ACCENT_ELBOW * beat;
  const handTrail = HAND_TRAIL * shift;                  // the wrists lagging behind the arms' sway
  const handTurn = HAND_ACCENT * beat;                   // and the wrists turning, just, on the beat
  const step = dancer.stepFold * (1 - STEP_FIRM * beat); // the step's lift, taken back as the beat sets it down
  const freeL = Math.max(0, -shift);                     // how far the left foot may lift: 1 with the weight all right
  const freeR = Math.max(0, shift);                      // and the right: 1 with the weight all left
  const foldL = BASE_FOLD + SHIFT_KNEE * (0.5 - 0.5 * shift) + dancer.dipFold * beat + step * freeL;
  const foldR = BASE_FOLD + SHIFT_KNEE * (0.5 + 0.5 * shift) + dancer.dipFold * beat + step * freeR;

  // --- HER BODY: the hips carry the weight shift, and the beat brings them down onto her knees
  turn(bones.hips, rest.hips, 0, SHIFT_TURN * shift, -SHIFT_TIP * shift);
  if (bones.hips !== undefined) bones.hips.position.y = dancer.hipsRestY - dancer.dipUnit * beat;
  turn(bones.spine, rest.spine, (mark - lift) * CHAIN_TOP, unwind * CHAIN_TOP, counter * CHAIN_TOP);
  turn(bones.spine1, rest.spine1, (mark - lift) * CHAIN_MIDDLE, unwind * CHAIN_MIDDLE, counter * CHAIN_MIDDLE);
  turn(bones.spine2, rest.spine2, (mark - lift) * CHAIN_TAIL, unwind * CHAIN_TAIL, counter * CHAIN_TAIL);
  turn(bones.neck, rest.neck, ACCENT_NECK_SHARE * nod, 0, NECK_COUNTER * shift);
  turn(bones.head, rest.head, (1 - ACCENT_NECK_SHARE) * nod, HEAD_DRIFT * drift, HEAD_TILT * drift + HEAD_COUNTER * shift);

  // --- HER ARMS: held raised with the elbows out, and lifted further on the beat. The two sides are
  // mirror images, so one sign leans the left arm forward and swings the right one back: that is what
  // makes the sway read as one body turning rather than two arms waving.
  turn(bones.shoulderL, rest.shoulderL, shoulder, 0, 0);
  turn(bones.shoulderR, rest.shoulderR, shoulder, 0, 0);
  turn(bones.armL, rest.armL, armLift - BASE_ARM_DROP, 0, -BASE_ARM_FORWARD - armSway);
  turn(bones.armR, rest.armR, armLift - BASE_ARM_DROP, 0, BASE_ARM_FORWARD - armSway);
  turn(bones.forearmL, rest.forearmL, 0, 0, -elbow);
  turn(bones.forearmR, rest.forearmR, 0, 0, elbow);

  // --- HER HANDS: the wrists trail the arms' sway, which is what reads an arm as moving rather than held,
  // and turn a little on the beat. One sign trails both, the same way one sign sways both arms.
  turn(bones.handL, rest.handL, handTurn, 0, handTrail);
  turn(bones.handR, rest.handR, handTurn, 0, handTrail);

  // --- HER LEGS: the weight shifts knee to knee, the beat's fold is the beat's dip, and the unweighted
  // foot takes its step. Every fold here is at least the planted fold and the step only ever adds to it,
  // so a foot may lift but is never folded down further: nothing here can carry a sole through the floor.
  foldLeg(bones.upLegL, rest.upLegL, bones.kneeL, rest.kneeL, bones.footL, rest.footL, foldL);
  foldLeg(bones.upLegR, rest.upLegR, bones.kneeR, rest.kneeR, bones.footR, rest.footR, foldR);
}
