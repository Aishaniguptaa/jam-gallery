// Element fields: glowing patches on the floor that change the golem's element when walked over.
import * as THREE from 'three';
import { elementTypes, elementColors, elementFieldRadius, arenaSize } from './tuning.js';

const fields = [];

function randomPosition() {
  // Keep fields away from the player spawn at (0,0) and inside the arena.
  const minDistFromSpawn = 4;
  let x, z, dist;
  do {
    x = (Math.random() * 2 - 1) * (arenaSize - elementFieldRadius - 1);
    z = (Math.random() * 2 - 1) * (arenaSize - elementFieldRadius - 1);
    dist = Math.hypot(x, z);
  } while (dist < minDistFromSpawn);
  return { x, z };
}

function createFieldMesh(scene, type, x, z) {
  const group = new THREE.Group();
  const color = elementColors[type];

  // Glowing pool on the floor.
  const poolGeo = new THREE.CylinderGeometry(elementFieldRadius, elementFieldRadius, 0.08, 24);
  poolGeo.translate(0, 0.04, 0);
  const pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ color }));
  group.add(pool);

  // Floating rune ring above it.
  const ringGeo = new THREE.TorusGeometry(elementFieldRadius * 0.6, 0.08, 8, 16);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.9;
  group.add(ring);

  group.position.set(x, 0, z);
  scene.add(group);
  return { group, ring };
}

export function spawnElementFields(scene, count) {
  for (let i = 0; i < count; i++) {
    const type = elementTypes[Math.floor(Math.random() * elementTypes.length)];
    const pos = randomPosition();
    const { group, ring } = createFieldMesh(scene, type, pos.x, pos.z);
    fields.push({ mesh: group, ring, type, alive: true, radius: elementFieldRadius });
  }
}

export function spawnElementFieldAt(scene, position, type) {
  const chosenType = type ?? elementTypes[Math.floor(Math.random() * elementTypes.length)];
  const { group, ring } = createFieldMesh(scene, chosenType, position.x, position.z);
  fields.push({ mesh: group, ring, type: chosenType, alive: true, radius: elementFieldRadius });
}

export function updateElementFields(dt) {
  for (const field of fields) {
    if (field.alive !== false && field.ring) {
      field.ring.rotation.z += dt * 1.5;
    }
  }
}

export function getElementFields() { return fields; }

export function clearElementFields() {
  for (const field of fields) {
    if (field.mesh && field.mesh.parent) field.mesh.parent.remove(field.mesh);
  }
  fields.length = 0;
}
