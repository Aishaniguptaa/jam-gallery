// Enemy roles: brawlers rush and melee, archers keep distance and shoot.
import * as THREE from 'three';
import {
  enemySpeed, enemyHP, enemyRadius, arenaSize,
  enemyRoleWeights, archerSpeed, archerPreferredRange, archerRangeTolerance,
  archerFireRate, archerProjectileSpeed, archerProjectileDamage,
  archerProjectileRadius, archerProjectileRange,
} from './tuning.js';

const BRAWLER_COLOR = '#4a4a4a';
const ARCHER_COLOR = '#6a5a4a';
const enemies = [];
const enemyProjectiles = [];
let shotScene = null;
let brawlerGeometry = null;
let archerGeometry = null;
let enemyProjectileGeometry = null;

function pickRole() {
  const roll = Math.random();
  return roll < enemyRoleWeights.brawler ? 'brawler' : 'archer';
}

function getBrawlerGeometry() {
  if (!brawlerGeometry) {
    brawlerGeometry = new THREE.IcosahedronGeometry(enemyRadius * 0.9, 0);
    brawlerGeometry.scale(1, 1.6, 1);
    brawlerGeometry.translate(0, enemyRadius * 0.9, 0);
  }
  return brawlerGeometry;
}

function getArcherGeometry() {
  if (!archerGeometry) {
    // A narrower, taller shard for archers.
    archerGeometry = new THREE.ConeGeometry(enemyRadius * 0.7, enemyRadius * 2.6, 5);
    archerGeometry.translate(0, enemyRadius * 1.3, 0);
  }
  return archerGeometry;
}

export function spawnEnemyAt(scene, position, role = null) {
  shotScene = scene;
  const chosenRole = role ?? pickRole();
  const isArcher = chosenRole === 'archer';
  const geometry = isArcher ? getArcherGeometry() : getBrawlerGeometry();
  const color = isArcher ? ARCHER_COLOR : BRAWLER_COLOR;
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.2, flatShading: true })
  );
  mesh.position.copy(position);
  mesh.position.y = 0;
  mesh.rotation.y = Math.random() * Math.PI;
  scene.add(mesh);
  enemies.push({
    mesh,
    hp: enemyHP,
    alive: true,
    radius: enemyRadius,
    role: chosenRole,
    fireTimer: Math.random() * (1 / archerFireRate),
  });
  return enemies[enemies.length - 1];
}

export function spawnWave(scene, count) {
  for (let i = 0; i < count; i++) {
    const edge = Math.floor(Math.random() * 4);
    const along = (Math.random() * 2 - 1) * arenaSize;
    const inset = arenaSize * (0.92 + Math.random() * 0.06);
    const position = new THREE.Vector3();
    if (edge === 0) position.set(along, 0, -inset);
    else if (edge === 1) position.set(along, 0, inset);
    else if (edge === 2) position.set(-inset, 0, along);
    else position.set(inset, 0, along);
    spawnEnemyAt(scene, position);
  }
}

function spawnEnemyProjectile(position, direction) {
  if (!enemyProjectileGeometry) {
    enemyProjectileGeometry = new THREE.SphereGeometry(archerProjectileRadius, 8, 6);
  }
  const material = new THREE.MeshBasicMaterial({ color: '#f2a65a' });
  const mesh = new THREE.Mesh(enemyProjectileGeometry, material);
  mesh.position.copy(position);
  mesh.position.y = enemyRadius;
  if (shotScene) shotScene.add(mesh);
  enemyProjectiles.push({
    mesh,
    dir: direction.clone().normalize(),
    alive: true,
    traveled: 0,
    damage: archerProjectileDamage,
  });
}

export function updateEnemyProjectiles(dt) {
  // Clean up dead projectiles.
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    if (enemyProjectiles[i].alive) continue;
    const mesh = enemyProjectiles[i].mesh;
    if (mesh.parent) mesh.parent.remove(mesh);
    enemyProjectiles.splice(i, 1);
  }

  for (const shot of enemyProjectiles) {
    const step = archerProjectileSpeed * dt;
    shot.mesh.position.addScaledVector(shot.dir, step);
    shot.traveled += step;
    if (shot.traveled >= archerProjectileRange) shot.alive = false;
  }
}

export function getEnemyProjectiles() {
  return enemyProjectiles;
}

export function clearEnemyProjectiles() {
  for (const shot of enemyProjectiles) {
    if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
  }
  enemyProjectiles.length = 0;
}

export function updateEnemies(dt, targetPos) {
  // Drop the ones killed last frame first, in place.
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].alive) continue;
    const mesh = enemies[i].mesh;
    if (mesh.parent) mesh.parent.remove(mesh);
    enemies.splice(i, 1);
  }

  for (const enemy of enemies) {
    const position = enemy.mesh.position;
    const dx = targetPos.x - position.x;
    const dz = targetPos.z - position.z;
    const distance = Math.hypot(dx, dz);

    if (enemy.role === 'archer') {
      // Archers try to keep their preferred range.
      const tooClose = distance < archerPreferredRange - archerRangeTolerance;
      const tooFar = distance > archerPreferredRange + archerRangeTolerance;
      let moveDirX = 0;
      let moveDirZ = 0;
      if (tooClose) {
        // Back away from the golem.
        moveDirX = -dx / distance;
        moveDirZ = -dz / distance;
      } else if (tooFar) {
        // Approach to firing range.
        moveDirX = dx / distance;
        moveDirZ = dz / distance;
      } else {
        // Strafe sideways to avoid stacking.
        moveDirX = dz / distance;
        moveDirZ = -dx / distance;
      }
      const step = archerSpeed * dt;
      position.x += moveDirX * step;
      position.z += moveDirZ * step;

      // Fire when roughly in range.
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && distance < archerPreferredRange + archerRangeTolerance * 2 && distance > 1) {
        const dir = new THREE.Vector3(dx / distance, 0, dz / distance);
        spawnEnemyProjectile(position.clone().add(new THREE.Vector3(0, enemyRadius, 0)), dir);
        enemy.fireTimer = 1 / archerFireRate + Math.random() * 0.2;
      }
    } else {
      // Brawler: rush straight at the golem.
      const step = enemySpeed * dt;
      if (distance > 1e-4) {
        const travel = Math.min(step, distance);
        position.x += (dx / distance) * travel;
        position.z += (dz / distance) * travel;
      }
    }

    position.y = 0;
  }
}

export function getEnemies() {
  return enemies;
}

export function clearEnemies() {
  for (const enemy of enemies) {
    if (enemy.mesh.parent) enemy.mesh.parent.remove(enemy.mesh);
  }
  enemies.length = 0;
}
