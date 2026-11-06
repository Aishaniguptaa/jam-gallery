// The WeatherManager: spells of clear, rain, wind or storm that pick themselves, the plain shapes that show them, and the two signals the rest of the game reads from them.
import * as THREE from 'three';
import {
  WEATHER_MIN_MINUTES,
  WEATHER_MAX_MINUTES,
  WEATHER_TABLE,
  WEATHER_TINT_MAX,
  WEATHER_TINT_RAIN,
  WEATHER_TINT_WIND,
  WEATHER_TINT_STORM,
  RAIN_COUNT,
  RAIN_COLOR,
  RAIN_FALL_SPEED,
  RAIN_AREA,
  RAIN_TOP,
  RAIN_BOTTOM,
  WIND_STRENGTH,
  WIND_GUST_RATE,
  STORM_FLASH_MIN,
  STORM_FLASH_MAX,
  STORM_FLASH_DECAY,
  STORM_FLASH_LIGHT,
} from './tuning.js';

// --- The four spells ---
const CLEAR = 'clear';
const RAIN = 'rain';
const WIND = 'wind';
const STORM = 'storm';
const KINDS = [CLEAR, RAIN, WIND, STORM];
const SECONDS_PER_MINUTE = 60;
const CLEAR_TINT = '#ffffff';           // clear reports an amount of 0, so this colour is never applied

// How far each spell may pull the sky, as shares of the one ceiling in tuning.js.
const TINT_RAIN_SHARE = 0.8;
const TINT_WIND_SHARE = 0.5;
const TINT_STORM_SHARE = 1;             // a storm takes the whole allowance
const TINT_AMOUNT_RAIN = WEATHER_TINT_MAX * TINT_RAIN_SHARE;
const TINT_AMOUNT_WIND = WEATHER_TINT_MAX * TINT_WIND_SHARE;
const TINT_AMOUNT_STORM = WEATHER_TINT_MAX * TINT_STORM_SHARE;

// --- The rain ---
// One box, RAIN_AREA wide and centred on the island's origin, from RAIN_TOP down to RAIN_BOTTOM.
const RAIN_HALF = RAIN_AREA / 2;
const RAIN_POINT_SIZE = 0.14;
const RAIN_LEAN_SHARE = 0.5;            // of WIND_STRENGTH: how hard a storm's rain is pushed sideways
const RAIN_LEAN_SMOOTHING = 0.06;       // easing speed of that lean, so it never jerks in or out

// --- The wind motes ---
const WIND_COUNT = 160;                 // a smaller cloud than the rain
const WIND_HALF = RAIN_AREA * 0.25;     // the motes stay in the middle half of the rain's box width
const WIND_TOP = 9;                     // and low in it, around the island rather than above it
const WIND_BOTTOM = 0;
const WIND_POINT_SIZE = 0.22;
const WIND_COLOR = '#e2eef8';           // tuning.js names no wind colour, so the motes get their own
const WIND_GUST_MIN = 0.35;             // the lull between gusts, as a share of WIND_STRENGTH

// --- Lightning ---
// A strike lands at STORM_FLASH_LIGHT, which sits above 1, so the flash holds at full for a beat
// before it falls away. Anything read out of this module is clamped back to 0..1, and the sky and
// the lights belong to daynight.js: this file only reports the brightness, it never lights anything.
const FLASH_FULL = 1;

// One cloud of points. Its positions array is built here and mutated in place every frame, so
// nothing is ever rebuilt. frustumCulled is off because the box is far wider than the bounding
// sphere three measures once: a shower that blinked out at the screen edge would be far worse
// than one drawn a little too often.
function createCloud(count, color, size) {
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      depthWrite: false,
    })
  );
  points.frustumCulled = false;
  points.visible = false;               // nothing shows until a spell asks for it
  return { points, positions, geometry };
}

// Drop one point somewhere inside its box.
function seedPosition(positions, index, half, bottom, top) {
  const i = index * 3;
  positions[i] = (Math.random() - 0.5) * half * 2;
  positions[i + 1] = bottom + Math.random() * (top - bottom);
  positions[i + 2] = (Math.random() - 0.5) * half * 2;
}

export function createWeather(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const rain = createCloud(RAIN_COUNT, RAIN_COLOR, RAIN_POINT_SIZE);
  const wind = createCloud(WIND_COUNT, WIND_COLOR, WIND_POINT_SIZE);
  group.add(rain.points);
  group.add(wind.points);

  // State.
  let kind = CLEAR;                     // the spell running now
  let spellLeft = randomSpellSeconds();  // seconds until the next spell begins
  let time = 0;                         // seconds since the last reset, driving the gust swell
  let rainLean = 0;                     // sideways push on the rain, eased in and out of a storm
  let tintColor = CLEAR_TINT;           // the colour the sky is pulled toward
  let tintAmount = 0;                   // and how far, 0..1
  let flashBrightness = 0;              // lightning, in "brightness a flash adds" units
  let flashLeft = 0;                    // seconds until the next strike

  for (let i = 0; i < RAIN_COUNT; i++) {
    seedPosition(rain.positions, i, RAIN_HALF, RAIN_BOTTOM, RAIN_TOP);   // the whole column
  }
  for (let i = 0; i < WIND_COUNT; i++) {
    seedPosition(wind.positions, i, WIND_HALF, WIND_BOTTOM, WIND_TOP);   // its own slab
  }

  // The object handed back at the end. It is built here, before the function declarations below,
  // so beginSpell can reach onChange through it. The caller assigns onChange, exactly as ui.js's
  // caller assigns onStart; it starts null and every call is guarded.
  const weather = {
    group,
    update,
    getKind,
    getTint,
    getTintAmount,
    getFlash,
    isWatering,
    isRare,
    setKind,
    onChange: null,
    reset,
  };

  // Every spell lasts somewhere between the two tuned lengths, given in minutes.
  function randomSpellSeconds() {
    const minutes =
      WEATHER_MIN_MINUTES + Math.random() * (WEATHER_MAX_MINUTES - WEATHER_MIN_MINUTES);
    return minutes * SECONDS_PER_MINUTE;
  }

  // Seconds until the next flash in a storm.
  function randomFlashDelay() {
    return STORM_FLASH_MIN + Math.random() * (STORM_FLASH_MAX - STORM_FLASH_MIN);
  }

  // One pick straight from the weighted table: a kind repeated three times is three times as
  // likely. A table entry that is not one of the four kinds falls back to clear rather than
  // putting the game in a spell nothing else knows about.
  function pickKind() {
    const index = Math.floor(Math.random() * WEATHER_TABLE.length);
    const picked = WEATHER_TABLE[index];
    return KINDS.indexOf(picked) === -1 ? CLEAR : picked;
  }

  function tintFor(nextKind) {
    if (nextKind === RAIN) return WEATHER_TINT_RAIN;
    if (nextKind === WIND) return WEATHER_TINT_WIND;
    if (nextKind === STORM) return WEATHER_TINT_STORM;
    return CLEAR_TINT;
  }

  function tintAmountFor(nextKind) {
    if (nextKind === RAIN) return TINT_AMOUNT_RAIN;
    if (nextKind === WIND) return TINT_AMOUNT_WIND;
    if (nextKind === STORM) return TINT_AMOUNT_STORM;
    return 0;
  }

  // Begin a spell: show what it shows, arm both clocks, and tell the caller. A repeat of the
  // kind already running is a new spell like any other, and it fires like any other.
  function beginSpell(nextKind) {
    kind = nextKind;
    spellLeft = randomSpellSeconds();
    rain.points.visible = kind === RAIN || kind === STORM;
    wind.points.visible = kind === WIND || kind === STORM;
    tintColor = tintFor(kind);
    tintAmount = tintAmountFor(kind);
    flashBrightness = 0;                              // the lightning stops the moment a storm does
    flashLeft = kind === STORM ? randomFlashDelay() : 0;
    if (typeof weather.onChange === 'function') weather.onChange(kind);
  }

  // Force a spell right now, for debugging. Anything not one of the four kinds is ignored.
  function setKind(nextKind) {
    if (KINDS.indexOf(nextKind) === -1) return;
    beginSpell(nextKind);
  }

  // A drop that reaches the floor comes back at the top with fresh x and z, so the shower never
  // thins out into the same few columns.
  function recycleDrop(index) {
    const i = index * 3;
    rain.positions[i] = (Math.random() - 0.5) * RAIN_AREA;
    rain.positions[i + 1] = RAIN_TOP;
    rain.positions[i + 2] = (Math.random() - 0.5) * RAIN_AREA;
  }

  // Every drop falls at RAIN_FALL_SPEED, drifts by the storm's lean, and wraps round the box.
  function moveRain(dt) {
    const fall = RAIN_FALL_SPEED * dt;
    const drift = rainLean * dt;

    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = i * 3;
      const y = x + 1;
      rain.positions[y] -= fall;
      if (rain.positions[y] < RAIN_BOTTOM) {
        recycleDrop(i);
      } else if (drift !== 0) {
        rain.positions[x] += drift;
        if (rain.positions[x] > RAIN_HALF) rain.positions[x] -= RAIN_AREA;
      }
    }
  }

  // The motes blow sideways at the gust's speed and wrap round their own box, so the cloud never
  // empties out on the downwind side.
  function moveWind(dt, windSpeed) {
    const step = windSpeed * dt;

    for (let i = 0; i < WIND_COUNT; i++) {
      const x = i * 3;
      wind.positions[x] += step;
      if (wind.positions[x] > WIND_HALF) wind.positions[x] -= WIND_HALF * 2;
    }
  }

  // Nothing in here allocates: the two clouds are moved in place and the geometry is never rebuilt.
  function update(dt) {
    time += dt;

    // The spell timer: when it runs out the next spell begins, repeat or not.
    spellLeft -= dt;
    if (spellLeft <= 0) beginSpell(pickKind());

    // One slow gust swell, shared by the motes and by a storm's rain lean.
    const swell = 0.5 + 0.5 * Math.sin(time * WIND_GUST_RATE);
    const gust = WIND_GUST_MIN + (1 - WIND_GUST_MIN) * swell;
    const windSpeed = WIND_STRENGTH * gust;

    // Lightning: a storm flashes on its own clock, and every flash decays at one rate.
    if (kind === STORM) {
      flashLeft -= dt;
      if (flashLeft <= 0) {
        flashBrightness = STORM_FLASH_LIGHT;
        flashLeft = randomFlashDelay();
      }
    }
    if (flashBrightness > 0) {
      flashBrightness = Math.max(0, flashBrightness - STORM_FLASH_DECAY * dt);
    }

    // The lean eases toward what this spell wants, so the shower slides into a storm and out again.
    const alpha = 1 - Math.pow(1 - RAIN_LEAN_SMOOTHING, dt * 60);
    const leanTarget = kind === STORM ? windSpeed * RAIN_LEAN_SHARE : 0;
    rainLean += (leanTarget - rainLean) * alpha;

    if (rain.points.visible) {
      moveRain(dt);
      rain.geometry.attributes.position.needsUpdate = true;
    }
    if (wind.points.visible) {
      moveWind(dt, windSpeed);
      wind.geometry.attributes.position.needsUpdate = true;
    }
  }

  function getKind() {
    return kind;
  }

  function getTint() {
    return tintColor;
  }

  function getTintAmount() {
    return tintAmount;
  }

  function getFlash() {
    return Math.min(FLASH_FULL, flashBrightness);
  }

  // The signal the doc's crops read: the rain is falling on them, in a shower or in a storm.
  function isWatering() {
    return kind === RAIN || kind === STORM;
  }

  // The signal the doc's rare events read: a storm is running.
  function isRare() {
    return kind === STORM;
  }

  // Back to clear and a fresh timer, with the lean and the flash cleared off. It begins that
  // clear spell properly, so the caller hears about it the same way it hears about any other.
  function reset() {
    time = 0;
    rainLean = 0;
    beginSpell(CLEAR);
  }

  return weather;
}
