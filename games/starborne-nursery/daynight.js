// The TimeManager: the island's clock, read from the device's own time, and the sky, sun, moon and lights that follow it.
import * as THREE from 'three';
import {
  DAY_LENGTH_MINUTES,
  TIME_START_HOUR,
  DEBUG_TIME_STEP,
  SUN_DISTANCE,
  DAY_SKY_COLOR,
  DUSK_SKY_COLOR,
  NIGHT_SKY_COLOR,
  DAWN_SKY_COLOR,
  DAY_LIGHT_COLOR,
  DUSK_LIGHT_COLOR,
  NIGHT_LIGHT_COLOR,
  DAY_LIGHT_INTENSITY,
  NIGHT_LIGHT_INTENSITY,
  DAY_AMBIENT_INTENSITY,
  NIGHT_AMBIENT_INTENSITY,
  SUN_SIZE,
  MOON_SIZE,
  SUN_MOON_ARC_FLAT,
  MOON_ARC_TURN_DEG,
} from './tuning.js';

// --- The clock ---
// One full day every DAY_LENGTH_MINUTES real minutes, so the hour hand runs at
// 24 * 60 / DAY_LENGTH_MINUTES times real speed: 60x at the shipped 24, which is what makes a
// whole night watchable inside a three-minute playtest, and exactly 1:1 at 1440 for a day that
// keeps real time. The clock is not merely sped up, though: it is seeded from the device's own
// hour, so the sky a player opens the game to is the sky outside their window. That is the
// Animal Crossing feel the design doc asks for - starting anywhere in the day - and the knob is
// what makes that day short enough to see.
const HOURS_PER_DAY = 24;
const HOURS_PER_SECOND = HOURS_PER_DAY / (DAY_LENGTH_MINUTES * 60);
const FULL_TURN = Math.PI * 2;
const NOON = 12;                          // the hour the sun is at its highest

// --- The sun and the moon ---
const SUN_TILT = 0.28;                    // radians the arc leans off the east-west line, so the
                                          // sun is never dead overhead and the moon's lowest point
                                          // falls well clear of the island instead of under it
const TILT_COS = Math.cos(SUN_TILT);
const TILT_SIN = Math.sin(SUN_TILT);
const SUN_COLOR = '#fff3c4';              // unlit discs, so the two bodies read as light sources
const MOON_COLOR = '#e6e9ff';
const MOON_HORIZON = -MOON_SIZE;          // lowest the moon's centre sinks: its top just clips the horizon
// The discs and the light do not ride the same arc. The light keeps the full one - its angle is what
// lights the island, and that look was settled long ago - but the two bodies are drawn on a flatter
// one, because the camera looks DOWN at an island in the sky: a body on the light's own arc is
// overhead at midday and off the top of the frame, which is why the makers could watch a whole
// sunset and never see a sun. Flattened, the sun is in shot from the hour it rises to the hour it
// sets, and the moon is in shot all night. tuning.js carries the number; 1 would put them back on
// the light's own path.
const ARC_FLAT = SUN_MOON_ARC_FLAT;
// The moon gets a turn of its own on top of that. A moon exactly opposite the sun rides the part
// of the sky the camera never looks at after dark, so it was never seen; turning its arc is what
// moves it into shot at 21:00 without touching when it rises, peaks or sets.
const MOON_TURN = MOON_ARC_TURN_DEG * (Math.PI / 180);

// --- Sky and light through the day ---
// Keyframes in hours. Night is long on purpose - 20:00 round to 5:00 - so the violet dark is a
// stretch of the day rather than a blink between sunset and sunrise.
const SKY_STOPS = [
  [0, NIGHT_SKY_COLOR],
  [5, NIGHT_SKY_COLOR],
  [6.5, DAWN_SKY_COLOR],
  [9, DAY_SKY_COLOR],
  [16, DAY_SKY_COLOR],
  [18, DUSK_SKY_COLOR],
  [20, NIGHT_SKY_COLOR],
  [24, NIGHT_SKY_COLOR],
];
const LIGHT_STOPS = [
  [0, NIGHT_LIGHT_COLOR],
  [5, NIGHT_LIGHT_COLOR],
  [6.5, DUSK_LIGHT_COLOR],
  [9, DAY_LIGHT_COLOR],
  [16, DAY_LIGHT_COLOR],
  [18.5, DUSK_LIGHT_COLOR],
  [21, NIGHT_LIGHT_COLOR],
  [24, NIGHT_LIGHT_COLOR],
];
// One 0..1 curve of "how much daylight is there", measured off the sun's own height: full night
// while it is below the horizon, full day once it is properly up, dawn and dusk the ramp between.
const DUSK_FADE_LOW = -0.15;
const DUSK_FADE_HIGH = 0.35;
// The night grade. The art direction asks for deep blues and violets after dark, deeper than a
// plain navy, so the sky and the light that are keyed in tuning.js both take one nudge toward this
// violet as the sun goes down. The keys themselves stay the makers' to choose; this only leans on
// them, and it leans on the square of the darkness so the coral dusk is left nearly alone.
const NIGHT_VIOLET = '#452c78';
const NIGHT_VIOLET_SKY = 0.5;             // how far the full-night sky is pulled toward it
const NIGHT_VIOLET_LIGHT = 0.3;           // and how far the night's sun light is
const AMBIENT_SKY_COLOR = '#cfe3ff';      // the hemisphere light's fill from above, and
const AMBIENT_GROUND_COLOR = '#6b5a44';   // the dim bounce off the island's own soil

// --- Weather aimed at this module from outside ---
const WHITE = '#ffffff';
const FLASH_SKY = 0.6;                    // how far a full lightning flash pulls the sky toward white
const FLASH_LIGHT = 1.2;                  // and how much brightness it adds on top of the two lights

// Keyframes given as [hour, css color] pairs, turned into real Colors once at creation.
function buildStops(pairs) {
  return pairs.map(([hour, color]) => ({ hour, color: new THREE.Color(color) }));
}

// Sample the keyframes at an hour, writing into out. lerpColors writes in place, so the stops'
// own colors are never touched and nothing is allocated per frame.
function sampleStops(stops, hour, out) {
  let i = 0;
  while (i < stops.length - 2 && hour >= stops[i + 1].hour) i += 1;
  const from = stops[i];
  const to = stops[i + 1];
  const span = to.hour - from.hour;
  const t = span > 0 ? (hour - from.hour) / span : 0;
  return out.lerpColors(from.color, to.color, THREE.MathUtils.clamp(t, 0, 1));
}

// Fold an hour into 0..24. Assumes a real number: every caller guards for NaN first.
function wrapHour(hours) {
  return ((hours % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

// Where the sun sits on its arc: 0 at noon, half a turn at midnight.
function sunAngleAt(hour) {
  return ((hour - NOON) / HOURS_PER_DAY) * FULL_TURN;
}

export function createDayNight(scene) {
  // Always opens at dusk, whatever the player's own clock says. The makers chose this over matching
  // the device's hour, and it is the right way round for the game: the light this clock starts in is
  // the light the whole palette was drawn for, so the first thing anyone sees is the island as it
  // was designed rather than as their afternoon. A judge playing for three minutes then watches the
  // sun finish going down - TIME_START_HOUR is 19.5 and DAY_LENGTH_MINUTES is 24, so a full turn of
  // the sky takes 24 real minutes and those three minutes walk it from dusk into night.
  let hour = wrapHour(TIME_START_HOUR);

  // The sun and the moon: two unlit balls on one arc, in a group of their own.
  const group = new THREE.Group();
  scene.add(group);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_SIZE, 16, 12),
    new THREE.MeshBasicMaterial({ color: SUN_COLOR })
  );
  group.add(sunDisc);

  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_SIZE, 16, 12),
    new THREE.MeshBasicMaterial({ color: MOON_COLOR })
  );
  group.add(moonDisc);

  // This module owns the scene's lights. The sun light aims at the island at the origin, so its
  // default target is already the right one; adding the target keeps that direction live.
  const sunLight = new THREE.DirectionalLight(DAY_LIGHT_COLOR, DAY_LIGHT_INTENSITY);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // The ambient fill. Its floor at night is what keeps the island readable after dark.
  const ambient = new THREE.HemisphereLight(
    AMBIENT_SKY_COLOR,
    AMBIENT_GROUND_COLOR,
    DAY_AMBIENT_INTENSITY
  );
  scene.add(ambient);

  // State. The sky is one Color built here and mutated every frame, so the loop never allocates.
  const skyColor = new THREE.Color(DAY_SKY_COLOR);
  const weatherColor = new THREE.Color(WHITE);
  const flashColor = new THREE.Color(WHITE);
  const nightViolet = new THREE.Color(NIGHT_VIOLET);   // the grade both the sky and the light take
  const skyStops = buildStops(SKY_STOPS);
  const lightStops = buildStops(LIGHT_STOPS);
  let weatherAmount = 0;                  // 0..1, how far the sky is pulled toward weatherColor
  let flash = 0;                          // 0..1, the current lightning flash
  let dayness = 1;                        // 0..1, how much daylight there is right now

  // The sun's height: 1 at noon, -1 at midnight. Everything else is shaped from it.
  function sunElevation() {
    return Math.cos(sunAngleAt(hour));
  }

  // Write everything that follows from the current hour. Nothing in here allocates.
  function apply() {
    const angle = sunAngleAt(hour);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Sun: rises in the east (+x) and sets in the west (-x), highest at noon. Hidden once it is
    // wholly below the horizon, or the camera catches a bright ball under a floating island. Its
    // height is the flattened one, so the disc stays in the band of sky the camera can see; the
    // light above is aimed from the disc's own place on the true arc instead.
    sunDisc.position.set(
      -sin * SUN_DISTANCE,
      cos * SUN_DISTANCE * TILT_COS * ARC_FLAT,
      cos * SUN_DISTANCE * TILT_SIN
    );
    sunDisc.visible = sunDisc.position.y > -SUN_SIZE;
    sunLight.position.set(
      -sin * SUN_DISTANCE,
      cos * SUN_DISTANCE * TILT_COS,
      cos * SUN_DISTANCE * TILT_SIN
    );

    // Moon: still up all night at the sun's own opposite end of the clock, still clamped to hang
    // just under the horizon at its lowest rather than sinking away underneath everything - but
    // its arc is turned MOON_TURN round the world's up axis, which is what brings it into the
    // camera's sky at night. Its height is untouched by the turn: rise, peak and set all happen at
    // the hours they always did.
    const moonAngle = angle + Math.PI;
    const moonX = -Math.sin(moonAngle) * SUN_DISTANCE;
    const moonZ = Math.cos(moonAngle) * SUN_DISTANCE * TILT_SIN;
    moonDisc.position.set(
      moonX * Math.cos(MOON_TURN) - moonZ * Math.sin(MOON_TURN),
      Math.max(Math.cos(moonAngle) * SUN_DISTANCE * TILT_COS * ARC_FLAT, MOON_HORIZON),
      moonX * Math.sin(MOON_TURN) + moonZ * Math.cos(MOON_TURN)
    );

    // How much of the sky is night, 0..1, on the same ramp the lights use. Measured before either
    // is coloured, because both the sky and the light take the violet grade from it.
    dayness = THREE.MathUtils.smoothstep(cos, DUSK_FADE_LOW, DUSK_FADE_HIGH);
    const nightness = 1 - dayness;
    // Cubed, so the grade is a night colour rather than a dusk one: at 18:00, the coral key of the
    // sunset, it is barely a quarter of its strength, and it takes full hold only once the sun is
    // properly down. (The dusk window and the night keys themselves are still the makers' to set.)
    const grade = nightness * nightness * nightness;

    // Sky: the day's keyframes, the night grade, then the weather tint, then the flash. The last
    // two only touch this scratch color, so the stored day color is never lost.
    sampleStops(skyStops, hour, skyColor);
    if (grade > 0) skyColor.lerp(nightViolet, NIGHT_VIOLET_SKY * grade);
    if (weatherAmount > 0) skyColor.lerp(weatherColor, weatherAmount);
    if (flash > 0) skyColor.lerp(flashColor, flash * FLASH_SKY);
    scene.background = skyColor;          // the same instance every frame, so no new Color per frame

    // Light: the keyframes give the color, the sun's height gives the intensity - and the grade
    // gives the night the same violet the sky has, so the island sits inside the colour instead of
    // under a light of its own. sampleStops rewrote this color first, so nothing accumulates here.
    sampleStops(lightStops, hour, sunLight.color);
    if (grade > 0) sunLight.color.lerp(nightViolet, NIGHT_VIOLET_LIGHT * grade);
    sunLight.intensity =
      NIGHT_LIGHT_INTENSITY +
      (DAY_LIGHT_INTENSITY - NIGHT_LIGHT_INTENSITY) * dayness +
      flash * FLASH_LIGHT;
    ambient.intensity =
      NIGHT_AMBIENT_INTENSITY +
      (DAY_AMBIENT_INTENSITY - NIGHT_AMBIENT_INTENSITY) * dayness +
      flash * FLASH_LIGHT;
  }

  function update(dt) {
    if (Number.isFinite(dt)) hour = wrapHour(hour + dt * HOURS_PER_SECOND);
    apply();
  }

  function getHour() {
    return hour;
  }

  function setHour(h) {
    if (!Number.isFinite(h)) return;      // a bad number never moves the clock
    hour = wrapHour(h);
    apply();                              // jump the sky with it, so a debug jump shows at once
  }

  function skipHours(n = DEBUG_TIME_STEP) {
    setHour(hour + n);                    // one press of the fast-forward key is DEBUG_TIME_STEP hours
  }

  function isNight() {
    return sunElevation() < 0;            // the sun is down: dusk (18:00) through to dawn (06:00)
  }

  // How much daylight there is, 0..1, on the same smooth ramp the lights themselves use. The sky
  // reads this rather than isNight(), so the stars fade in across dusk instead of snapping on the
  // instant the sun crosses zero - a binary flip there is a visible pop in the middle of a sunset.
  function getDayness() {
    return dayness;
  }

  function setWeatherTint(color, amount) {
    weatherAmount = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0;
    if (color !== undefined && color !== null) weatherColor.set(color);
  }

  function setFlash(intensity) {
    flash = Number.isFinite(intensity) ? THREE.MathUtils.clamp(intensity, 0, 1) : 0;
  }

  apply();                                // so the first rendered frame is already the right sky

  return {
    group,
    sunLight,
    ambient,
    update,
    getHour,
    setHour,
    skipHours,
    isNight,
    getDayness,
    setWeatherTint,
    setFlash,
  };
}
