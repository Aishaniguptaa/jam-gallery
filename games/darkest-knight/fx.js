// Plain-geometry impact bursts and impact lights: the parry crack, the dull block and the blood of a hit.
import * as THREE from 'three';

// Every shard in every burst is this one box: a 1-unit needle along local z, stretched by its own scale.
const SHARD_GEOMETRY = new THREE.BoxGeometry(0.02, 0.02, 1);

// Lights are pooled and built once, and only ever dimmed — never hidden. Three.js counts visible lights
// when it builds a shader, so adding or removing one mid-fight would make it recompile and hitch.
const LIGHT_POOL_SIZE = 2;

// perfect: the biggest burst, warm gold, wide and fast.
// block:   a few cold blue shards, slow and short — barely there, and it lights nothing.
// hit:     heavy red thrown at the camera (the player's side of the screen), with the hardest gravity.
// cut:     your blade getting through HIS guard. The only look that belongs to the enemy's own body
//          rather than to the air between the two of you: dark blood, thrown loose and falling hard.
const LOOKS = {
  perfect: {
    key: 'perfect', count: 20, ttl: 0.42, color: 0xffe9b4,
    speedMin: 3.4, speedMax: 7.2, shardMin: 0.22, shardMax: 0.5, width: 1,
    gravity: 6, towardCamera: 0, opacity: 1, blending: THREE.AdditiveBlending,
    light: { color: 0xffcf7a, intensity: 28, distance: 8 },
  },
  block: {
    key: 'block', count: 5, ttl: 0.26, color: 0x7fb2dd,
    speedMin: 1.1, speedMax: 2.3, shardMin: 0.08, shardMax: 0.18, width: 0.8,
    gravity: 5, towardCamera: 0, opacity: 0.7, blending: THREE.NormalBlending,
    light: null,
  },
  hit: {
    key: 'hit', count: 14, ttl: 0.5, color: 0xd42a1c,
    speedMin: 1.6, speedMax: 3.4, shardMin: 0.3, shardMax: 0.72, width: 2.2,
    gravity: 11, towardCamera: 0.9, opacity: 0.95, blending: THREE.NormalBlending,
    light: { color: 0xff2a18, intensity: 18, distance: 7 },
  },
  cut: {
    key: 'cut', count: 16, ttl: 0.55, color: 0x8e0f14,
    speedMin: 1.1, speedMax: 2.9, shardMin: 0.3, shardMax: 0.8, width: 2.6,
    gravity: 14, towardCamera: 0.25, opacity: 0.95, blending: THREE.NormalBlending,
    light: { color: 0xc0161c, intensity: 9, distance: 5 },
  },
};

const _dir = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _cameraPos = new THREE.Vector3();

// The numbers above are local to this file for now; they get folded into tuning.js once the makers tune them.
export function createFx(scene, camera) {
  const live = [];
  // Finished bursts wait here: their group, shards, and single shared material get reused, so after the
  // first second of a fight nothing is allocated, nothing is orphaned and no shader is rebuilt.
  const spare = { perfect: [], block: [], hit: [], cut: [] };

  const lights = [];
  for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 1, 2);
    light.position.set(0, 0, 0);
    scene.add(light); // stays in the scene for good: intensity 0 is an unlit light
    lights.push(light);
  }
  let nextLight = 0;

  function build(look) {
    const material = new THREE.MeshBasicMaterial({
      color: look.color,
      transparent: true,
      opacity: 0,
      depthWrite: false, // shards fade into each other instead of cutting holes in the world
      fog: false,       // the impact is only metres away: fog would just mute the flash
      blending: look.blending,
    });
    const group = new THREE.Group();
    const shards = [];
    for (let i = 0; i < look.count; i++) {
      const mesh = new THREE.Mesh(SHARD_GEOMETRY, material);
      group.add(mesh);
      shards.push({ mesh, vel: new THREE.Vector3() });
    }
    // hasLight is what this burst is allowed to use; it stays false for a block, so a block never lights the room.
    return { look, group, shards, material, age: 0, light: null, hasLight: !!look.light };
  }

  function takeLight() {
    if (LIGHT_POOL_SIZE === 0) return null;
    for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
      const light = lights[(nextLight + i) % LIGHT_POOL_SIZE];
      if (light.intensity === 0) {
        nextLight = (nextLight + i + 1) % LIGHT_POOL_SIZE;
        return light;
      }
    }
    return null; // every pool light is busy: this burst goes without one rather than stealing a live flash
  }

  function retire(burst) {
    scene.remove(burst.group);
    if (burst.light) {
      burst.light.intensity = 0;
      burst.light = null;
    }
    burst.age = 0;
    spare[burst.look.key].push(burst);
  }

  // kind is 'perfect' | 'block' | 'hit'; anything else gets the block look rather than throwing.
  function parrySpark(kind, position) {
    if (!position) return;
    const look = LOOKS[kind] || LOOKS.block;
    const burst = spare[look.key].pop() || build(look);

    burst.age = 0;
    burst.group.position.copy(position);
    burst.material.opacity = look.opacity;

    // Which way is "the player's side of the screen" from here.
    _cameraPos.copy(position);
    if (camera && camera.getWorldPosition) camera.getWorldPosition(_cameraPos);
    _cameraPos.sub(position).normalize();

    for (const shard of burst.shards) {
      _dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (_dir.lengthSq() < 1e-6) _dir.set(0, 1, 0);
      _dir.normalize();
      // hit leans the spray toward the camera; perfect sprays evenly in every direction.
      if (look.towardCamera > 0) _dir.multiplyScalar(1 - look.towardCamera).addScaledVector(_cameraPos, look.towardCamera).normalize();

      shard.vel.copy(_dir).multiplyScalar(look.speedMin + Math.random() * (look.speedMax - look.speedMin));
      shard.mesh.position.copy(_dir).multiplyScalar(0.05); // start at the meeting point, not inside it
      shard.mesh.scale.set(look.width, look.width, look.shardMin + Math.random() * (look.shardMax - look.shardMin));
      shard.mesh.lookAt(_aim.copy(burst.group.position).add(shard.mesh.position).add(shard.vel));
    }

    scene.add(burst.group);

    if (burst.hasLight) {
      const light = takeLight();
      if (light) {
        burst.light = light;
        light.color.setHex(look.light.color);
        light.distance = look.light.distance;
        light.intensity = look.light.intensity;
        light.position.copy(position);
      }
    }

    live.push(burst);
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const burst = live[i];
      burst.age += dt;
      const k = burst.age / burst.look.ttl;
      if (k >= 1) {
        retire(burst);
        live.splice(i, 1);
        continue;
      }

      burst.material.opacity = burst.look.opacity * (1 - k);
      for (const shard of burst.shards) {
        shard.vel.y -= burst.look.gravity * dt; // sparks arc down as they cool
        shard.mesh.position.addScaledVector(shard.vel, dt);
        shard.mesh.lookAt(_aim.copy(burst.group.position).add(shard.mesh.position).add(shard.vel));
      }
      // The flash is brightest on the frame of the impact and falls off faster than the shards do.
      if (burst.light) burst.light.intensity = burst.look.light.intensity * (1 - k) * (1 - k);
    }
  }

  function reset() {
    for (let i = live.length - 1; i >= 0; i--) retire(live[i]);
    live.length = 0;
    for (const light of lights) light.intensity = 0;
  }

  return { parrySpark, update, reset };
}
