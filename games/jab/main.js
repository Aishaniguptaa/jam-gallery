// main.js — scene, camera, render loop, collision, game state and wiring for the moon-dungeon golem.
import * as THREE from 'three';
import {
  arenaSize, playerHP, playerRadius, projectileRadius, projectileDamage,
  enemyHP, enemyRadius,
  contactDamage, contactCooldown, contactPushDistance, contactPushEnemy,
  spawnInterval, waveSize, waveGrowth, wavesPerFloor,
  cameraHeight, cameraDistance, cameraFollowSpeed, cameraAngle, elementFieldCount,
  screenShakeAmount, screenShakeDecay, elementColors,
  spawnMargin, minSpawnDistance, spawnIndicatorDuration,
  columnCount, columnRadius, columnMinDistanceFromPlayer,
  wallHeight, wallThickness,
  internalWallCount, internalWallLength, internalWallThickness,
  enemyElementDropChance,
  archerProjectileRadius, archerProjectileDamage,
} from './tuning.js';
import { createPlayer, updatePlayer, updateProjectiles, getProjectiles, setElement, getElement } from './player.js?v=2';
import { spawnHitBurst, updateFX, clearFX } from './fx.js?v=2';
import {
  spawnEnemyAt, updateEnemies, getEnemies, clearEnemies,
  updateEnemyProjectiles, getEnemyProjectiles, clearEnemyProjectiles,
} from './enemies.js?v=2';
import { spawnElementFields, spawnElementFieldAt, updateElementFields, getElementFields, clearElementFields } from './elements.js?v=2';
import { playHit, playDeath, playAbsorb, resumeAudio } from './audio.js?v=2';
import {
  createUI, setScore, setFloor, setWave, setHealth, showGameOver, hideGameOver,
  createEnemyHealthBar, positionEnemyHealthBar, clearEnemyHealthBars,
  createSpawnIndicator, positionSpawnIndicator,
} from './ui.js?v=2';

// --- Overlay -----------------------------------------------------------------
const ui = createUI();

// --- Scene, camera, renderer -------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#595959');

// Isometric-ish top-down: 45 degrees around the golem, zoomed in, aimed at the golem.
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
camera.position.set(
  cameraDistance * Math.sin(cameraAngle),
  cameraHeight,
  cameraDistance * Math.cos(cameraAngle)
);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#f2f2f2', '#595959', 1.6));
const sun = new THREE.DirectionalLight('#f2f2f2', 1.8);
sun.position.set(8, 16, 6);
scene.add(sun);

// --- Mosaic floor texture ----------------------------------------------------
function createMosaicTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d');
  const greys = ['#595959', '#6e6e6e', '#7f7f7f', '#8f8f8f', '#a5a5a5'];

  // Base fill.
  ctx2d.fillStyle = '#555555';
  ctx2d.fillRect(0, 0, size, size);

  // Random-sized mosaic tiles.
  const tile = 32;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shade = greys[Math.floor(Math.random() * greys.length)];
      ctx2d.fillStyle = shade;
      ctx2d.fillRect(x + 1, y + 1, tile - 2, tile - 2);

      // Occasional smaller inset tile.
      if (Math.random() < 0.25) {
        ctx2d.fillStyle = greys[Math.floor(Math.random() * greys.length)];
        const inset = tile * 0.25;
        ctx2d.fillRect(x + inset, y + inset, tile - inset * 2, tile - inset * 2);
      }

      // Dark grout / cracks.
      ctx2d.strokeStyle = '#3a3a3a';
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(x, y, tile, tile);

      // Random crack line.
      if (Math.random() < 0.08) {
        ctx2d.beginPath();
        ctx2d.moveTo(x + Math.random() * tile, y + Math.random() * tile);
        ctx2d.lineTo(x + Math.random() * tile, y + Math.random() * tile);
        ctx2d.strokeStyle = '#2a2a2a';
        ctx2d.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(arenaSize * 2, arenaSize * 2),
  new THREE.MeshStandardMaterial({ map: createMosaicTexture(), roughness: 0.9 })
);
floorMesh.rotation.x = -Math.PI / 2;
scene.add(floorMesh);

const grid = new THREE.GridHelper(arenaSize * 2, arenaSize, '#f2f2f2', '#a5a5a5');
grid.position.y = 0.02;
scene.add(grid);

// --- Walls (perimeter + internal) -------------------------------------------
const wallMaterial = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.9 });
const walls = [];
function addWall(x, z, w, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight, d), wallMaterial);
  mesh.position.set(x, wallHeight / 2, z);
  scene.add(mesh);
  walls.push({ x, z, halfW: w / 2, halfD: d / 2 });
}
function createWalls(scene) {
  const half = arenaSize + wallThickness / 2;
  const long = arenaSize * 2 + wallThickness * 2;
  addWall(0, -half, long, wallThickness);
  addWall(0, half, long, wallThickness);
  addWall(-half, 0, wallThickness, long);
  addWall(half, 0, wallThickness, long);

  // Internal walls to break up the arena.
  for (let i = 0; i < internalWallCount; i++) {
    const horizontal = Math.random() < 0.5;
    const wx = (Math.random() * 2 - 1) * (arenaSize - internalWallLength - 4);
    const wz = (Math.random() * 2 - 1) * (arenaSize - internalWallThickness - 4);
    if (horizontal) {
      addWall(wx, wz, internalWallLength, internalWallThickness);
    } else {
      addWall(wx, wz, internalWallThickness, internalWallLength);
    }
  }
}
createWalls(scene);

// --- Input -------------------------------------------------------------------
// Keys are held under several spellings ('Space'/'space'/' ', 'KeyW'/'keyw'/'w')
// so player.js can look up whichever it checks for.
const keys = new Set();
const mouseNDC = { x: 0, y: 0 };
const ctx = { keys, mouseNDC, camera, arenaSize, mouseDown: false };

const spellings = (event) => [event.code, event.key, event.key.toLowerCase(), event.code.toLowerCase()];

// The left button is reported to player.js both as ctx.mouseDown and as a key token.
const MOUSE_TOKENS = ['mouse', 'Mouse0', 'mouse0', 'MouseLeft', 'mouseleft', 'Primary', 'primary', 'Fire'];

function setMouseDown(down) {
  ctx.mouseDown = down;
  for (const token of MOUSE_TOKENS) {
    if (down) keys.add(token); else keys.delete(token);
  }
}

addEventListener('keydown', (event) => {
  if (event.code === 'Space') event.preventDefault();
  for (const token of spellings(event)) keys.add(token);
  if (state === 'gameover' && event.key.toLowerCase() === 'r') restart();
});
addEventListener('keyup', (event) => { for (const token of spellings(event)) keys.delete(token); });

addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    setMouseDown(true);
    resumeAudio();
  }
});
addEventListener('mouseup', (event) => { if (event.button === 0) setMouseDown(false); });
addEventListener('blur', () => setMouseDown(false));

addEventListener('pointermove', (event) => {
  mouseNDC.x = (event.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(event.clientY / innerHeight) * 2 + 1;
});

// Touch support: tap/ drag anywhere to aim and fire.
addEventListener('touchstart', (event) => {
  if (event.target.tagName === 'BUTTON') return;
  const t = event.touches[0];
  mouseNDC.x = (t.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(t.clientY / innerHeight) * 2 + 1;
  setMouseDown(true);
}, { passive: false });
addEventListener('touchmove', (event) => {
  event.preventDefault();
  const t = event.touches[0];
  mouseNDC.x = (t.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(t.clientY / innerHeight) * 2 + 1;
}, { passive: false });
addEventListener('touchend', () => setMouseDown(false));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Optional FPS panel ------------------------------------------------------
const urlParams = new URLSearchParams(location.search);
const showFps = urlParams.has('fps');
let fpsPanel = null;
if (showFps) {
  fpsPanel = document.createElement('div');
  Object.assign(fpsPanel.style, {
    position: 'fixed', right: '12px', top: '12px', zIndex: '20',
    padding: '8px 12px', background: 'rgba(0,0,0,0.6)', color: '#f2f2f2',
    font: '13px/1.4 monospace', pointerEvents: 'none',
  });
  fpsPanel.textContent = 'FPS: --';
  document.body.appendChild(fpsPanel);
}

// --- Game state --------------------------------------------------------------
const player = createPlayer(scene);
const maxHp = () => player.maxHp ?? playerHP;
const columnMeshes = [];

let state = 'playing';       // 'playing' | 'gameover'
let score = 0;               // enemies killed
let floor = 1;               // the descent itself arrives in M2
let waveInFloor = 1;         // current wave out of wavesPerFloor
let contactTimer = 0;
let waveTimer = 0;
let shownHp = null;
let screenShake = 0;
const activeSpawnIndicators = [];

const alive = (thing) => thing.alive !== false;   // treat a missing flag as alive
const liveEnemies = () => getEnemies().filter(alive).length;
const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function attachHealthBars() {
  for (const enemy of getEnemies()) {
    if (!enemy.healthBar) {
      enemy.healthBar = createEnemyHealthBar();
      enemy.healthBar.setHp(enemy.hp, enemyHP);
    }
  }
}

function clearSpawnIndicators() {
  for (const ind of activeSpawnIndicators) ind.remove();
  activeSpawnIndicators.length = 0;
}

function addSpawnIndicator(spawnPos) {
  const ind = createSpawnIndicator();
  positionSpawnIndicator(ind.element, spawnPos, camera, renderer);
  activeSpawnIndicators.push(ind);
  setTimeout(() => {
    ind.remove();
    const i = activeSpawnIndicators.indexOf(ind);
    if (i >= 0) activeSpawnIndicators.splice(i, 1);
  }, spawnIndicatorDuration * 1000);
}

function spawnWaveCustom(scene, count) {
  const playerPos = player.group.position;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  camDir.y = 0;
  if (camDir.lengthSq() > 0) camDir.normalize();
  const behind = camDir.clone().negate();
  const perp = new THREE.Vector3(-camDir.z, 0, camDir.x);

  const spawnDistance = minSpawnDistance + spawnMargin;
  const spread = minSpawnDistance * 0.6;

  for (let i = 0; i < count; i++) {
    const lateral = (Math.random() * 2 - 1) * spread;
    const spawnPos = new THREE.Vector3()
      .copy(playerPos)
      .addScaledVector(behind, spawnDistance)
      .addScaledVector(perp, lateral);
    spawnPos.x = Math.max(-arenaSize, Math.min(arenaSize, spawnPos.x));
    spawnPos.z = Math.max(-arenaSize, Math.min(arenaSize, spawnPos.z));
    spawnPos.y = 0;

    spawnEnemyAt(scene, spawnPos);
    addSpawnIndicator(spawnPos);
  }
}

function clearColumns() {
  for (const mesh of columnMeshes) {
    if (mesh.parent) mesh.parent.remove(mesh);
  }
  columnMeshes.length = 0;
}

function createColumns(scene, count) {
  clearColumns();
  const geometry = new THREE.CylinderGeometry(columnRadius, columnRadius, 4, 16);
  const material = new THREE.MeshStandardMaterial({ color: '#4a4a4a' });
  const positions = [];
  const playerStart = new THREE.Vector3(0, 0, 0);

  for (let i = 0; i < count; i++) {
    let pos = null;
    let attempts = 0;
    while (attempts < 30) {
      const x = (Math.random() * 2 - 1) * (arenaSize - columnRadius - 2);
      const z = (Math.random() * 2 - 1) * (arenaSize - columnRadius - 2);
      const candidate = new THREE.Vector3(x, 2, z);
      if (distanceXZ(candidate, playerStart) < columnMinDistanceFromPlayer) {
        attempts++;
        continue;
      }
      let tooClose = false;
      for (const other of positions) {
        if (distanceXZ(candidate, other) < columnRadius * 4) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        pos = candidate;
        break;
      }
      attempts++;
    }
    if (!pos) continue;
    positions.push(pos);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    columnMeshes.push(mesh);
  }
}

function resolveColumnCollisions(position, radius) {
  for (const mesh of columnMeshes) {
    const dx = position.x - mesh.position.x;
    const dz = position.z - mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = radius + columnRadius;
    if (dist < minDist && dist > 0.001) {
      const push = (minDist - dist) / dist;
      position.x += dx * push;
      position.z += dz * push;
    }
  }
}

function resolveWallCollisions(position, radius) {
  for (const wall of walls) {
    // Closest point on the axis-aligned wall box to the circle center.
    const closestX = Math.max(wall.x - wall.halfW, Math.min(position.x, wall.x + wall.halfW));
    const closestZ = Math.max(wall.z - wall.halfD, Math.min(position.z, wall.z + wall.halfD));
    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > 0 && distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      position.x += dx * push;
      position.z += dz * push;
    }
  }
  position.x = Math.max(-arenaSize, Math.min(arenaSize, position.x));
  position.z = Math.max(-arenaSize, Math.min(arenaSize, position.z));
}

function separateEnemies() {
  const enemies = getEnemies();
  // Run a couple of iterations so large clumps unpack in a single frame.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!alive(a)) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (!alive(b)) continue;
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        // Keep enemies slightly farther apart than their physical radii so they fan out.
        const minDist = ((a.radius ?? enemyRadius) + (b.radius ?? enemyRadius)) * 1.3;
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) / dist * 0.55;
          a.mesh.position.x -= dx * push;
          a.mesh.position.z -= dz * push;
          b.mesh.position.x += dx * push;
          b.mesh.position.z += dz * push;
        }
      }
    }
  }
}

function restart() {
  clearSpawnIndicators();
  clearEnemyHealthBars();
  for (const enemy of getEnemies()) if (enemy.mesh) scene.remove(enemy.mesh);   // don't trust clearEnemies to un-draw them
  clearEnemies();
  for (const shot of getProjectiles()) {
    shot.alive = false;
    if (shot.mesh) scene.remove(shot.mesh);
  }
  clearElementFields();
  clearColumns();
  clearEnemyProjectiles();
  clearFX();
  screenShake = 0;
  player.hp = maxHp();
  player.dead = false;
  player.group.position.set(0, player.group.position.y, 0);
  setElement(player, 'fire');
  score = 0;
  floor = 1;
  waveInFloor = 1;
  contactTimer = 0;
  waveTimer = spawnInterval;
  shownHp = player.hp;
  setMouseDown(false);
  createColumns(scene, columnCount);
  spawnWaveCustom(scene, waveSize);
  attachHealthBars();
  spawnElementFields(scene, elementFieldCount);
  setScore(score);
  setFloor(floor);
  setWave(waveInFloor, wavesPerFloor);
  setHealth(player.hp, maxHp());
  hideGameOver();
  state = 'playing';
}

ui.setRestartHandler(restart);

// --- Element field absorption ------------------------------------------------
function absorbFields() {
  const playerPos = player.group.position;
  for (const field of getElementFields()) {
    if (!alive(field)) continue;
    if (distanceXZ(playerPos, field.mesh.position) < field.radius + playerRadius) {
      if (field.type === player.element) {
        // Matching element: heal instead of swapping.
        player.hp = Math.min(maxHp(), player.hp + 10);
      } else {
        setElement(player, field.type);
      }
      playAbsorb(field.type);
      field.alive = false;
      if (field.mesh.parent) field.mesh.parent.remove(field.mesh);
    }
  }
}

// --- Collision (ours, not the other builder's) --------------------------------
function hitEnemies() {
  const enemies = getEnemies();
  for (const shot of getProjectiles()) {
    if (!alive(shot)) continue;
    for (const enemy of enemies) {
      if (!alive(enemy)) continue;
      const reach = projectileRadius + (enemy.radius ?? enemyRadius);
      if (distanceXZ(shot.mesh.position, enemy.mesh.position) < reach) {
        enemy.hp -= shot.damage ?? projectileDamage;
        if (enemy.healthBar) enemy.healthBar.setHp(enemy.hp, enemyHP);
        if (shot.pierce !== undefined) {
          shot.pierce -= 1;
          if (shot.pierce <= 0) {
            shot.alive = false;
            if (shot.mesh) scene.remove(shot.mesh);
          }
        } else {
          shot.alive = false;
          if (shot.mesh) scene.remove(shot.mesh);
        }
        if (enemy.hp <= 0) {
          const deathPos = enemy.mesh.position.clone();
          enemy.alive = false;
          if (enemy.mesh) scene.remove(enemy.mesh);
          if (enemy.healthBar) { enemy.healthBar.remove(); enemy.healthBar = null; }
          spawnHitBurst(scene, deathPos, elementColors[player.element]);
          screenShake += screenShakeAmount;
          score += 1;
          playHit(player.element);
          if (Math.random() < enemyElementDropChance) {
            spawnElementFieldAt(scene, deathPos);
          }
        }
        break;   // this shot hit one enemy this frame
      }
    }
  }
}

function hitPlayer() {
  const playerPos = player.group.position;
  for (const shot of getEnemyProjectiles()) {
    if (!alive(shot)) continue;
    if (distanceXZ(shot.mesh.position, playerPos) < archerProjectileRadius + playerRadius) {
      player.hp -= shot.damage ?? archerProjectileDamage;
      shot.alive = false;
      if (shot.mesh.parent) shot.mesh.parent.remove(shot.mesh);
      screenShake += screenShakeAmount * 0.5;
      break;
    }
  }
}

function touchDamage(dt) {
  contactTimer -= dt;
  for (const enemy of getEnemies()) {
    if (!alive(enemy)) continue;
    const reach = (enemy.radius ?? enemyRadius) + playerRadius;
    const dx = player.group.position.x - enemy.mesh.position.x;
    const dz = player.group.position.z - enemy.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < reach) {
      // Resolve overlap so enemies don't sit inside the golem.
      const overlap = reach - dist;
      const nx = dist > 0.001 ? dx / dist : 1;
      const nz = dist > 0.001 ? dz / dist : 0;
      player.group.position.x = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.x + nx * overlap));
      player.group.position.z = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.z + nz * overlap));
      enemy.mesh.position.x -= nx * overlap;
      enemy.mesh.position.z -= nz * overlap;

      if (contactTimer <= 0) {
        player.hp -= contactDamage;
        contactTimer = contactCooldown;
        // Knock back both the golem and the enemy on contact.
        player.group.position.x = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.x + nx * contactPushDistance));
        player.group.position.z = Math.max(-arenaSize, Math.min(arenaSize, player.group.position.z + nz * contactPushDistance));
        enemy.mesh.position.x -= nx * contactPushEnemy;
        enemy.mesh.position.z -= nz * contactPushEnemy;
      }
      break;
    }
  }
}

// --- Camera follow -----------------------------------------------------------
const targetCameraPos = new THREE.Vector3();
const currentCameraPos = camera.position.clone();

function updateCamera(dt) {
  const p = player.group.position;
  targetCameraPos.set(
    p.x + cameraDistance * Math.sin(cameraAngle),
    p.y + cameraHeight,
    p.z + cameraDistance * Math.cos(cameraAngle)
  );
  const t = Math.min(1, cameraFollowSpeed * dt);
  currentCameraPos.lerp(targetCameraPos, t);

  if (screenShake > 0) {
    const shake = new THREE.Vector3(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
    currentCameraPos.add(shake);
    screenShake = Math.max(0, screenShake - screenShakeDecay * dt);
  }

  camera.position.copy(currentCameraPos);
  camera.lookAt(p.x, p.y, p.z);
}

// --- Frame -------------------------------------------------------------------
function update(dt) {
  updatePlayer(player, dt, ctx);
  resolveColumnCollisions(player.group.position, playerRadius);
  resolveWallCollisions(player.group.position, playerRadius);
  updateProjectiles(dt);
  updateEnemies(dt, player.group.position);
  updateEnemyProjectiles(dt);
  separateEnemies();
  hitPlayer(dt);

  for (const enemy of getEnemies()) {
    if (alive(enemy)) {
      resolveColumnCollisions(enemy.mesh.position, enemy.radius ?? enemyRadius);
      resolveWallCollisions(enemy.mesh.position, enemy.radius ?? enemyRadius);
      if (enemy.healthBar) {
        positionEnemyHealthBar(enemy.healthBar.element, enemy.mesh.position, camera, renderer);
      }
    }
  }

  absorbFields();
  hitEnemies();
  touchDamage(dt);
  updateElementFields(dt);

  if (player.hp <= 0 && !player.dead) {
    player.dead = true;
    state = 'gameover';
    screenShake += screenShakeAmount * 3;
    playDeath();
    setMouseDown(false);
    showGameOver(score, floor);
  }

  // Floor escalation: quiet beat once the wave is clear, then the next wave or a new floor.
  if (liveEnemies() === 0) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      if (waveInFloor < wavesPerFloor) {
        waveInFloor += 1;
        spawnWaveCustom(scene, waveSize + (floor - 1) * waveGrowth);
        attachHealthBars();
      } else {
        floor += 1;
        waveInFloor = 1;
        spawnWaveCustom(scene, waveSize + (floor - 1) * waveGrowth);
        attachHealthBars();
        clearElementFields();
        spawnElementFields(scene, elementFieldCount + Math.floor(floor / 2));
      }
      waveTimer = spawnInterval;
      setWave(waveInFloor, wavesPerFloor);
    }
  }

  setScore(score);
  setFloor(floor);

  if (player.hp !== shownHp) {
    shownHp = player.hp;
    setHealth(player.hp, maxHp());
  }
}

const clock = new THREE.Clock();
let fpsAccumulator = 0;
let fpsFrames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);   // a tab switch must not teleport the world
  if (state === 'playing') update(dt);
  updateFX(dt);
  updateCamera(dt);
  renderer.render(scene, camera);

  if (fpsPanel) {
    fpsAccumulator += dt;
    fpsFrames += 1;
    if (fpsAccumulator >= 0.5) {
      const fps = Math.round(fpsFrames / fpsAccumulator);
      const tris = renderer.info.render.triangles;
      const calls = renderer.info.render.calls;
      fpsPanel.textContent = `FPS: ${fps}  calls: ${calls}  tris: ${tris}`;
      fpsAccumulator = 0;
      fpsFrames = 0;
    }
  }
});

createColumns(scene, columnCount);
spawnWaveCustom(scene, waveSize);
attachHealthBars();
waveTimer = spawnInterval;
spawnElementFields(scene, elementFieldCount);
setScore(score);
setFloor(floor);
setWave(waveInFloor, wavesPerFloor);
setHealth(player.hp, maxHp());
