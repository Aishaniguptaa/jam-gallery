// The two enemies as data — the intro boss and the lord — plus one Enemy that telegraphs, swings a
// katana through, and lands it.
import * as THREE from 'three';
import {
  windupTime, attackIntervalMin, attackIntervalMax, enemyGaugeMax,
  introBossHealth, finalBossHealth,
  introBossHeavyChance, finalBossHeavyChance,
  introBossAllowConsecutiveHeavies, finalBossAllowConsecutiveHeavies,
  finalBossCadenceScale, finalBossWindupScale, finalBossSwingScale, finalBossSizeScale,
  swingTime, perfectParryOpensAt, enemyRecoverTime, enemyLunge, enemyLeanBack, telegraphRampTime,
  enemyGlow, enemyWidth, enemyHeight, enemyDepth,
  enemyColor, enemyWarningColor, enemyStrikeColor, enemyStunColor, enemyStunSlump, enemyStunBladeDrop,
  enemyHeavyColor, enemyHeavyStrikeColor, heavyWindupScale, enemyHeavyLeanScale,
  enemyBladeLength, enemyBladeArc, enemyBladeRestAngle, enemyBladeBack, enemyBladeThrough,
  enemyBladeForward, enemyBladeThickness,
} from './tuning.js';

export const ENEMIES = [
  {
    id: 'intro',
    name: 'Intro Boss',
    heavyChance: introBossHeavyChance, // low: he is a boss, but the heavies stay a surprise
    allowConsecutiveHeavies: introBossAllowConsecutiveHeavies, // OFF: never a heavy after a heavy
    health: introBossHealth,
    gaugeMax: enemyGaugeMax,
    cadenceMin: attackIntervalMin,
    cadenceMax: attackIntervalMax,
    windupTime,
    // His own swing, and the threshold the perfect parry opens at inside it: window = 0.55 - 0.37 = 0.18s
    swingTime,
    perfectParryOpensAt,
    sprite: 'assets/sprites/intro-boss.png', // the makers' own art, made with an image generator
  },
  {
    id: 'final',
    name: 'Final Boss',
    heavyChance: finalBossHeavyChance,
    allowConsecutiveHeavies: finalBossAllowConsecutiveHeavies, // ON: he may chain them, and does
    health: finalBossHealth,
    gaugeMax: enemyGaugeMax,
    cadenceMin: attackIntervalMin * finalBossCadenceScale,
    cadenceMax: attackIntervalMax * finalBossCadenceScale,
    windupTime: windupTime * finalBossWindupScale,
    // The lord swings faster than anyone: 0.42s, and his threshold scales with it, so his perfect window
    // is 0.42 - 0.28 = 0.137s. Both shrink together, which is what keeps the parry a read and not a guess.
    swingTime: swingTime * finalBossSwingScale,
    perfectParryOpensAt: perfectParryOpensAt * finalBossSwingScale,
    sprite: 'assets/sprites/final-boss.webp', // the makers' own art, made with an image generator
    // He stands a third taller than the intro boss. Only his picture grows: every timing number above is
    // his own already, and none of them change with it.
    size: finalBossSizeScale,
  },
];

// Four beats: idle -> windup (no parry possible) -> swing (the whole parry window) -> recovering.
// Each wind-up rolls light or heavy from the config's heavyChance; whether a heavy may follow a heavy is
// the config's own allowConsecutiveHeavies. A heavy is parried EXACTLY like a light — same windows, same
// outcomes — so its only job is to read as dearer at a glance: it telegraphs in a deeper red, for
// longer, and leans further back.
// 'stunned' cuts across all of them: his guard has broken, so he slumps and does nothing at all until
// the game releases him — the five-second window the player has to cut him down.
export class Enemy {
  constructor(scene, config) {
    this.config = config;
    this.health = config.health; // the game reads and writes these two
    this.gauge = config.gaugeMax;

    this._state = 'idle';
    this._timer = 0;
    this._windupLeft = 0;
    this._windupTotal = config.windupTime; // the length of the wind-up in progress (a heavy rolls longer)
    this._swingElapsed = 0;
    this._heavy = false; // is the wind-up in progress a heavy? decided as each wind-up begins
    this._lastWasHeavy = false; // so the next roll can refuse to chain heavies where the config forbids it
    this._lunged = false;
    this._strikeFrom = new THREE.Vector3();
    this._lungeDir = new THREE.Vector3(0, 0, 1);
    // A sprite is TINTED, not painted, so its base is white: the picture then shows exactly as it was
    // drawn, and the telegraph colours multiply over it. The gray box keeps its own gray.
    this._baseColor = new THREE.Color(config.sprite ? 0xffffff : enemyColor);
    this._warningColor = new THREE.Color(enemyWarningColor);
    this._strikeColor = new THREE.Color(enemyStrikeColor);
    this._stunColor = new THREE.Color(enemyStunColor);
    this._heavyColor = new THREE.Color(enemyHeavyColor);
    this._heavyStrikeColor = new THREE.Color(enemyHeavyStrikeColor);

    // THE SPRITE. Where the config names a picture, that picture IS the enemy: a flat cut-out standing on
    // the very same ground line the box stood on, and leaned, lunged and tinted by exactly the same code
    // below — nothing about the fight changes, only what you are looking at. A picture cannot sweep a
    // sword, so the katana box is hidden for it and the swing is carried by the lean, the lunge and the
    // colour running hot instead. Where no picture is named, this is the gray box, untouched.
    const sprite = config.sprite ? new THREE.TextureLoader().load(config.sprite) : null;
    // SIZE is this enemy's own, so one of them can be a bigger figure than the other without touching
    // anyone else's numbers. Every enemy without a size is the shared height, unchanged.
    const size = enemyHeight * (config.size || 1);
    // Both shapes are shifted up inside their own geometry, so the mesh origin sits at the feet: place it
    // with mesh.position.set(x, 0, z) and the lean pivots on the ground.
    const geometry = sprite
      ? new THREE.PlaneGeometry(size, size) // the art is square, so the plane is too
      : new THREE.BoxGeometry(enemyWidth, size, enemyDepth);
    geometry.translate(0, size / 2, 0);
    const material = sprite
      ? new THREE.MeshStandardMaterial({
          map: sprite,
          color: this._baseColor.clone(), // white, so the picture shows as it was drawn
          transparent: true,
          alphaTest: 0.05, // a cut-out, not a floating rectangle of background
          roughness: 1,
          metalness: 0,
        })
      : new THREE.MeshStandardMaterial({ color: this._baseColor.clone() });
    this._mesh = new THREE.Mesh(geometry, material);
    this._blade = buildBlade();
    this._mesh.add(this._blade);
    if (sprite) this._blade.visible = false; // the sword is painted into the art; a box one would float
    scene.add(this._mesh);

    this.reset();
  }

  get mesh() {
    return this._mesh;
  }

  get state() {
    return this._state;
  }

  get isStunned() {
    return this._state === 'stunned';
  }

  // Is the swing on its way (or winding up) a heavy? The game reads this on the landing frame to know
  // which damage to bill. Always false between attacks, so a stale flag can never price a light swing.
  get isHeavy() {
    return this._heavy;
  }

  // Seconds elapsed since the swing began, counting up from 0, while the enemy is in 'swing'.
  // That is the number the parry is judged on. Null in every other state: no swing, no parry.
  get timeSinceSwing() {
    if (this._state !== 'swing') return null;
    return Math.min(this.config.swingTime, Math.max(0, this._swingElapsed));
  }

  // This enemy's own perfect-parry threshold, in seconds into its own swing. The lord's swing is shorter,
  // so his threshold comes down with it and his window is tighter — the one place a boss is harder to
  // PARRY rather than merely harder to read.
  get parryOpensAt() {
    return this.config.perfectParryOpensAt;
  }

  reset() {
    if (this._lunged) this._mesh.position.copy(this._strikeFrom); // undo a lunge that was in progress
    this._lunged = false;
    this.health = this.config.health;
    this.gauge = this.config.gaugeMax;
    this._state = 'idle';
    this._windupLeft = 0;
    this._windupTotal = this.config.windupTime;
    this._heavy = false; // no swing in the air, and no stale heavy flag to misprice the next one
    this._lastWasHeavy = false; // a fresh fight may open on a heavy
    this._swingElapsed = 0;
    this._timer = this._nextInterval(); // cadence re-armed from here
    this._mesh.material.color.copy(this._baseColor);
    this._mesh.material.emissive.setRGB(0, 0, 0);
    this._poseIdle(); // weapon and lean back to the idle pose
  }

  // The guard has broken: whatever he was doing stops this instant, including a swing already on its way
  // through. He slumps, greys out and stays that way until release() — update() does nothing until then.
  stun() {
    // Not mid-lunge? Then where he stands now is his mark, so release() brings him back here.
    if (!this._lunged) this._strikeFrom.copy(this._mesh.position);
    this._state = 'stunned';
    this._windupLeft = 0;
    this._heavy = false; // whatever was on its way is gone with the swing
    this._swingElapsed = 0;
    this._timer = 0;
    this._mesh.rotation.x = enemyStunSlump;
    this._blade.rotation.z = enemyBladeRestAngle - enemyStunBladeDrop; // the katana drops, point at the floor
    this._blade.rotation.x = enemyBladeBack;
    this._mesh.material.color.copy(this._stunColor);
    this._mesh.material.emissive.setRGB(0, 0, 0); // no glow at all: he is not telegraphing anything
  }

  // The stun is over: back on his feet at his mark, colour and pose normal, cadence re-armed from here.
  release() {
    if (this._state !== 'stunned') return;
    this._mesh.position.copy(this._strikeFrom); // step back to his mark if the stun caught him lunging
    this._lunged = false;
    this._state = 'idle';
    this._timer = this._nextInterval();
    this._mesh.material.color.copy(this._baseColor);
    this._mesh.material.emissive.setRGB(0, 0, 0);
    this._poseIdle();
  }

  update(dt) {
    if (this._state === 'stunned') return false; // out cold: no idle, no wind-up, no swing, nothing

    if (this._state === 'idle') {
      this._timer -= dt;
      if (this._timer <= 0) {
        this._state = 'windup';
        // Roll light-or-heavy here, as the wind-up begins: a heavy telegraphs longer, so its wind-up is
        // scaled up, and the colour/lean read differently for the whole of it. Whether a heavy may follow
        // a heavy is this enemy's own rule (config.allowConsecutiveHeavies): off for the first two, on for
        // the final boss, who may chain them.
        const mayRollHeavy = this.config.allowConsecutiveHeavies || !this._lastWasHeavy;
        this._heavy = mayRollHeavy && Math.random() < (this.config.heavyChance || 0);
        this._lastWasHeavy = this._heavy;
        this._windupTotal = this.config.windupTime * (this._heavy ? heavyWindupScale : 1);
        this._windupLeft = this._windupTotal;
        this._telegraph(0);
      }
    } else if (this._state === 'windup') {
      // The telegraph ramps over telegraphRampTime and then holds. The blade is still up behind
      // him here, so the attack reads well before the parry window opens.
      this._windupLeft -= dt;
      const elapsed = this._windupTotal - Math.max(0, this._windupLeft);
      this._telegraph(Math.min(1, elapsed / telegraphRampTime));
      if (this._windupLeft <= 0) {
        this._windupLeft = 0;
        this._state = 'swing';
        this._swingElapsed = 0; // the parry window opens here and counts up from 0
        this._strikeFrom.copy(this._mesh.position);
        this._lungeDir.copy(this._mesh.getWorldDirection(this._lungeDir));
        this._lungeDir.y = 0;
        if (this._lungeDir.lengthSq() < 1e-6) this._lungeDir.set(0, 0, 1); // no facing? lunge +Z
        this._lungeDir.normalize();
        this._lunged = true;
        this._swing(0);
      }
    } else if (this._state === 'swing') {
      this._swingElapsed += dt;
      const t = Math.min(1, this._swingElapsed / this.config.swingTime);
      this._swing(t);
      this._mesh.position
        .copy(this._strikeFrom)
        .addScaledVector(this._lungeDir, enemyLunge * t);
      if (this._swingElapsed >= this.config.swingTime) {
        this._swingElapsed = this.config.swingTime;
        this._mesh.position.copy(this._strikeFrom).addScaledVector(this._lungeDir, enemyLunge);
        this._state = 'recovering';
        this._timer = enemyRecoverTime;
        return true; // the blade lands on this frame
      }
    } else if (this._state === 'recovering') {
      this._timer -= dt;
      const k = 1 - Math.max(0, this._timer) / enemyRecoverTime; // 0 = just landed, 1 = back to idle
      this._settle(k);
      this._mesh.position
        .copy(this._strikeFrom)
        .addScaledVector(this._lungeDir, enemyLunge * (1 - k));
      if (this._timer <= 0) {
        this._state = 'idle';
        this._lunged = false;
        this._heavy = false; // the swing is spent: nothing in the air to price as heavy
        this._mesh.position.copy(this._strikeFrom);
        this._mesh.material.color.copy(this._baseColor);
        this._mesh.material.emissive.setRGB(0, 0, 0);
        this._poseIdle();
        this._timer = this._nextInterval();
      }
    }

    return false;
  }

  _nextInterval() {
    const spread = Math.max(0, this.config.cadenceMax - this.config.cadenceMin);
    return this.config.cadenceMin + Math.random() * spread;
  }

  // Recolour the placeholder: the body lerps between two colours while the glow follows `strength`.
  _tint(from, to, k, strength) {
    const t = Math.min(1, Math.max(0, k));
    this._mesh.material.color.copy(from).lerp(to, t);
    this._mesh.material.emissive.copy(from).lerp(to, t).multiplyScalar(enemyGlow * Math.max(0, strength));
  }

  // Weapon, lean and colour back to how he stands when he is waiting.
  _poseIdle() {
    this._blade.rotation.z = enemyBladeRestAngle;
    this._blade.rotation.x = enemyBladeBack;
    this._mesh.rotation.x = 0;
  }

  // The whole read of the windup: he leans back and turns warning orange — or, for a heavy, leans further
  // and burns a deeper red. Nothing moves yet.
  _telegraph(t) {
    const k = Math.min(1, Math.max(0, t));
    const lean = this._heavy ? enemyLeanBack * enemyHeavyLeanScale : enemyLeanBack;
    this._tint(this._baseColor, this._heavy ? this._heavyColor : this._warningColor, k, k);
    this._mesh.rotation.x = -lean * k; // negative pitch tips the top away from its facing
  }

  // t runs 0 -> 1 over the swing. The blade sweeps a big arc down across the frame while the body
  // leans through from the windup into the follow-through and the colour heats up.
  _swing(t) {
    const k = Math.min(1, Math.max(0, t));
    const lean = this._heavy ? enemyLeanBack * enemyHeavyLeanScale : enemyLeanBack;
    this._blade.rotation.z = enemyBladeRestAngle + enemyBladeArc * k;
    this._blade.rotation.x = enemyBladeBack + (enemyBladeThrough - enemyBladeBack) * k;
    this._mesh.rotation.x = -lean + 2 * lean * k;
    this._tint(this._heavy ? this._heavyColor : this._warningColor,
               this._heavy ? this._heavyStrikeColor : this._strikeColor, k, 1);
  }

  // k runs 0 -> 1 as he comes back out of the follow-through into the idle pose.
  _settle(k) {
    const j = 1 - Math.min(1, Math.max(0, k));
    this._blade.rotation.z = enemyBladeRestAngle + enemyBladeArc * j;
    this._blade.rotation.x = enemyBladeBack + (enemyBladeThrough - enemyBladeBack) * j;
    this._mesh.rotation.x = (this._heavy ? enemyLeanBack * enemyHeavyLeanScale : enemyLeanBack) * j;
    this._tint(this._heavy ? this._heavyStrikeColor : this._strikeColor, this._baseColor, k, j);
  }
}

// The enemy's katana: one plain steel box on a pivot at the shoulder, swung by rotation.z. It hangs
// slightly in front of his chest so the sweep is never hidden inside his own body, and the steel is
// nearly non-metallic because nothing in this arena has an environment map to reflect.
function buildBlade() {
  const blade = new THREE.Group();
  // At the shoulder, hilt in his hand, a little forward of his chest.
  blade.position.set(enemyWidth * 0.55, enemyHeight * 0.72, enemyBladeForward);

  const steel = new THREE.MeshStandardMaterial({ color: '#d7dee8', metalness: 0.15, roughness: 0.55 });
  const grip = new THREE.MeshStandardMaterial({ color: '#3a2f30', roughness: 0.9 });

  const edge = new THREE.BoxGeometry(0.09, enemyBladeLength, enemyBladeThickness);
  edge.translate(0, enemyBladeLength / 2, 0); // the hilt sits on the pivot, the blade points up it
  blade.add(new THREE.Mesh(edge, steel));
  blade.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.07), grip));
  return blade;
}
