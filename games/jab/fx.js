// fx.js — lightweight particle effects: muzzle flash, hit burst, projectile trails.
import * as THREE from 'three';
import {
  muzzleFlashDuration,
  burstParticleCount,
  burstLifetime,
  trailSpawnInterval,
} from './tuning.js';

const flashes = [];
const burstParticles = [];
const trailDots = [];

const burstGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const trailGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const flashGeometry = new THREE.SphereGeometry(0.3, 8, 6);

export function spawnMuzzleFlash(scene, position, color) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(flashGeometry, material);
  mesh.position.copy(position);
  mesh.scale.setScalar(0.5);
  scene.add(mesh);
  flashes.push({ mesh, life: muzzleFlashDuration, maxLife: muzzleFlashDuration });
}

export function spawnHitBurst(scene, position, color) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  for (let i = 0; i < burstParticleCount; i++) {
    const mesh = new THREE.Mesh(burstGeometry, material.clone());
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * 0.4;
    mesh.position.y += (Math.random() - 0.5) * 0.4;
    mesh.position.z += (Math.random() - 0.5) * 0.4;
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 2 + Math.random() * 4;
    const velocity = new THREE.Vector3(
      speed * Math.sin(phi) * Math.cos(theta),
      speed * Math.cos(phi),
      speed * Math.sin(phi) * Math.sin(theta)
    );
    scene.add(mesh);
    burstParticles.push({ mesh, life: burstLifetime, maxLife: burstLifetime, velocity });
  }
}

export function spawnProjectileTrailDot(scene, position, color) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 });
  const mesh = new THREE.Mesh(trailGeometry, material);
  mesh.position.copy(position);
  mesh.position.y = Math.max(mesh.position.y, 0.06);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(mesh);
  trailDots.push({ mesh, life: trailSpawnInterval * 2.5, maxLife: trailSpawnInterval * 2.5 });
}

function updateList(dt, list, updateFn) {
  for (let i = list.length - 1; i >= 0; i--) {
    const fx = list[i];
    fx.life -= dt;
    if (fx.life <= 0) {
      fx.mesh.parent.remove(fx.mesh);
      list.splice(i, 1);
      continue;
    }
    updateFn(fx);
  }
}

export function updateFX(dt) {
  updateList(dt, flashes, (fx) => {
    const t = fx.life / fx.maxLife;
    fx.mesh.scale.setScalar(0.5 + (1 - t) * 1.2);
    fx.mesh.material.opacity = t;
  });

  updateList(dt, burstParticles, (fx) => {
    const t = fx.life / fx.maxLife;
    fx.mesh.position.addScaledVector(fx.velocity, dt);
    fx.mesh.rotation.x += dt * 3;
    fx.mesh.rotation.y += dt * 4;
    fx.mesh.material.opacity = t;
    fx.mesh.scale.setScalar(t);
  });

  updateList(dt, trailDots, (fx) => {
    const t = fx.life / fx.maxLife;
    fx.mesh.material.opacity = t * 0.45;
    fx.mesh.scale.setScalar(t);
  });
}

export function clearFX() {
  for (const fx of flashes) if (fx.mesh.parent) fx.mesh.parent.remove(fx.mesh);
  for (const fx of burstParticles) if (fx.mesh.parent) fx.mesh.parent.remove(fx.mesh);
  for (const fx of trailDots) if (fx.mesh.parent) fx.mesh.parent.remove(fx.mesh);
  flashes.length = 0;
  burstParticles.length = 0;
  trailDots.length = 0;
}
