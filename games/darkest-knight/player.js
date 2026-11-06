// First-person rig locked on the enemy: a visible sword, a lantern, and a walk it keeps behind a flag.
import * as THREE from 'three';
import { arenaRadius, enemySpawnZ, lookHeight, playerCanWalk } from './tuning.js';

// Rig feel. These numbers should move into tuning.js once the makers want to tune them.
const EYE_HEIGHT = 1.6;
const WALK_SPEED = 3.2;
const BOB_AMPLITUDE = 0.05;
const BOB_RATE = 8.5;
const LUNGE_TIME = 0.22;
const LUNGE_REACH = 0.55;
const SWORD_REST = { x: 0.48, y: -0.55, z: -0.7, tilt: -Math.PI / 4, lean: 0.22 };
const _dir = new THREE.Vector3();

// domElement stays in the signature (main.js passes the canvas) though the rig no longer takes
// pointer lock: the camera never looks around, it stays aimed at where the enemy stands.
export function createPlayer(scene, camera, domElement) {
  camera.rotation.order = 'YXZ'; // yaw then pitch, so the horizon stays level
  camera.position.set(0, EYE_HEIGHT, 0);
  scene.add(camera); // the sword and lantern only render while the camera is in the scene

  const sword = buildSword();
  camera.add(sword);

  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#ffcf94' })
  );
  lantern.position.set(-0.45, -0.44, -0.85);
  lantern.add(new THREE.PointLight('#ffb066', 10, 20, 1.8)); // the only warm light in the scene
  camera.add(lantern);

  let bobTime = 0;
  let lunge = 0;
  const held = new Set();

  // Walking is off by default: the makers want the view held on the enemy. The walk path below is
  // intact, so `playerCanWalk = true` in tuning.js turns it back on with no other change.
  if (playerCanWalk) {
    addEventListener('keydown', (e) => held.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
    addEventListener('blur', () => held.clear()); // stop walking if the window loses focus
  }

  // --- sword ---
  function placeSword() {
    const shove = lunge > 0 ? Math.sin((1 - lunge / LUNGE_TIME) * Math.PI) : 0;
    sword.position.set(SWORD_REST.x, SWORD_REST.y + shove * 0.2, SWORD_REST.z - shove * LUNGE_REACH);
    sword.rotation.set(SWORD_REST.tilt - shove * 0.5, 0, SWORD_REST.lean);
  }

  function parryLunge() {
    lunge = LUNGE_TIME;
    placeSword();
  }

  // --- view ---
  // Aimed at the enemy's standing spot, not at his moving mesh, so a lunge does not swing the view.
  function aim() {
    camera.lookAt(0, lookHeight, enemySpawnZ);
  }

  // --- walk (only reachable while playerCanWalk is true) ---
  function walk(dt) {
    const forward =
      (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
    const right =
      (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
    const moving = forward !== 0 || right !== 0;

    // Forward is wherever the locked view points, so W always walks at the enemy.
    camera.getWorldDirection(_dir);
    const yaw = Math.atan2(-_dir.x, -_dir.z);
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    if (moving) {
      const step = (WALK_SPEED * dt) / Math.hypot(forward, right);
      camera.position.x += (right * cos - forward * sin) * step;
      camera.position.z += (-right * sin - forward * cos) * step;

      const away = Math.hypot(camera.position.x, camera.position.z);
      if (away > arenaRadius) {
        // the arena edge is a wall: slide along it instead of leaving
        const k = arenaRadius / away;
        camera.position.x *= k;
        camera.position.z *= k;
      }
      bobTime += dt;
    }

    const bobTarget = EYE_HEIGHT + (moving ? Math.sin(bobTime * BOB_RATE) * BOB_AMPLITUDE : 0);
    camera.position.y += (bobTarget - camera.position.y) * Math.min(1, dt * 10);
  }

  function update(dt) {
    if (lunge > 0) lunge = Math.max(0, lunge - dt);
    placeSword();

    if (!playerCanWalk) {
      camera.position.set(0, EYE_HEIGHT, 0); // no keys, no bobbing: the view sits perfectly still
    } else if (dt > 0) {
      walk(dt); // a first frame can arrive with dt = 0
    }

    aim();
  }

  function reset() {
    bobTime = 0;
    lunge = 0;
    held.clear();
    camera.position.set(0, EYE_HEIGHT, 0);
    aim();
    placeSword();
  }

  reset();

  return {
    camera,
    update,
    parryLunge,
    reset,
    get bobTime() {
      return bobTime;
    },
  };
}

function buildSword() {
  const sword = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#98a0aa', metalness: 0.75, roughness: 0.35 });
  const wrap = new THREE.MeshStandardMaterial({ color: '#241c20', roughness: 0.9 });

  const bladeGeo = new THREE.BoxGeometry(0.04, 1.2, 0.09);
  bladeGeo.translate(0, 0.6, 0); // the hilt sits on the group's origin, the blade points up it
  sword.add(new THREE.Mesh(bladeGeo, steel));

  sword.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.12), wrap));
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.26, 0.07), wrap);
  handle.position.y = -0.15;
  sword.add(handle);
  return sword;
}
