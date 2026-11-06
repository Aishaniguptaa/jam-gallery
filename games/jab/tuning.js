// tuning.js — every tunable number in the game, named, so it can be changed without touching other files.

// Movement and the golem
export const moveSpeed = 14;         // metres per second (bigger arena needs faster movement)
export const playerHP = 100;
export const playerRadius = 0.6;

// Firing
export const fireRate = 4;           // shots per second
export const projectileSpeed = 40;   // metres per second
export const projectileDamage = 25;
export const projectileRange = 70;   // metres before the shot expires
export const projectileRadius = 0.35;

// Enemies
export const enemySpeed = 4.0;       // faster across the bigger floor
export const enemyHP = 50;
export const enemyRadius = 0.7;
export const contactDamage = 10;
export const contactCooldown = 0.8;  // seconds between contact hits on the golem
export const contactPushDistance = 1.2;   // how far the player is knocked back on contact
export const contactPushEnemy = 0.6;      // how far the enemy is knocked back on contact

// Enemy roles
export const enemyRoleWeights = { brawler: 0.7, archer: 0.3 };
export const archerSpeed = 2.8;
export const archerPreferredRange = 18;   // tries to stay this far from the golem
export const archerRangeTolerance = 4;    // within this band it stops backing up
export const archerFireRate = 1.2;        // shots per second
export const archerProjectileSpeed = 22;
export const archerProjectileDamage = 8;
export const archerProjectileRadius = 0.3;
export const archerProjectileRange = 35;

// Waves
export const spawnInterval = 2.5;    // seconds of quiet before the next wave
export const waveSize = 8;           // enemies in wave 1
export const waveGrowth = 4;         // extra enemies per floor (used from M2)
export const wavesPerFloor = 3;      // how many waves before descending to the next floor

// Spawning
export const spawnMargin = 5;          // extra distance outside the camera view to spawn
export const minSpawnDistance = 28;    // minimum distance from player to spawn
export const spawnIndicatorSize = 16;  // px
export const spawnIndicatorDuration = 1.5; // seconds the arrow stays on screen
export const spawnIndicatorColor = '#f2f2f2';

// Floor — 4x larger area: half-extent doubled from 20 to 40
export const arenaSize = 40;
export const columnCount = 14;
export const columnRadius = 1.5;
export const columnMinDistanceFromPlayer = 12;
export const wallHeight = 4;
export const wallThickness = 1.5;
export const internalWallCount = 4;
export const internalWallLength = 18;
export const internalWallThickness = 1.8;

// Elements
export const elementTypes = ['fire', 'water', 'earth'];
export const elementColors = {
  fire: '#e74c3c',   // warm red-orange
  water: '#3498db',  // cool blue
  earth: '#8e44ad',  // stone purple / brownish
};

// Per-element projectile behaviour
export const fireProjectileSpeed = 35;   // fast bolt
export const waterProjectileSpeed = 28;  // piercing beam
export const earthProjectileSpeed = 18;  // heavy slow blast
export const earthProjectileScale = 2.0; // bigger projectile
export const waterPierceCount = 3;       // how many enemies a water shot passes through

// Element fields
export const elementFieldCount = 2;      // fields spawned per floor
export const elementFieldRadius = 1.8;
export const enemyElementDropChance = 0.25; // chance an enemy drops a field on death

// Per-element tempo modifiers (multipliers)
export const elementMoveSpeedMul = {
  fire: 1.0,
  water: 1.25,   // water feels flowing and mobile
  earth: 0.75,   // earth feels heavy
};

export const elementFireRateMul = {
  fire: 1.0,     // fast
  water: 0.8,    // steady
  earth: 0.55,   // slow, heavy shots
};

export const elementRotationSpeedMul = {
  fire: 1.2,     // snappy
  water: 1.0,    // normal
  earth: 0.6,    // heavy and slow to turn
};

// FX timing
export const muzzleFlashDuration = 0.06;
export const trailSpawnInterval = 0.04;  // seconds between trail dots
export const burstParticleCount = 12;
export const burstLifetime = 0.35;
export const screenShakeAmount = 0.25;
export const screenShakeDecay = 5;

// Camera
export const cameraHeight = 14;          // zoomed in half
export const cameraDistance = 11;        // zoomed in half
export const cameraFollowSpeed = 8;      // lerp speed
export const cameraAngle = Math.PI / 4;  // 45 degrees around the golem

// Enemy health bar
export const enemyHealthBarWidth = 40;   // pixels
export const enemyHealthBarHeight = 5;   // pixels
export const enemyHealthBarYOffset = 28; // pixels above enemy centre on screen
export const enemyHealthBarColor = '#e74c3c';
export const enemyHealthBarBg = '#333333';
