// tuning.js — every number the game is built from: the corridor, the pillar line, the light cue, the models and the look.

// --- THE NOTES: seven lanes, the key that plays each one, and the swara it sings
export const LANE_COUNT = 7;
export const SWARAS = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];
export const KEYS = ['s', 'r', 'g', 'm', 'p', 'd', 'n'];

// --- THE CORRIDOR: the player stands still at the press point and the temple travels past
export const PRESS_Z = 0;                 // the press point: level with the player, down the corridor
export const PILLAR_COLUMN_SPLIT = 0.79;  // where the pillar line sits across the screen: the right-hand side
export const VIEW_HEIGHT = 3.6;           // world units of corridor visible at the press point
export const CAMERA_Y = 1.2;              // the eye height: a little above the pillars' shoulders
export const CAMERA_FOV = 45;
export const CAMERA_NEAR = 0.2;
export const CAMERA_FAR = 120;
export const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);
export const CAMERA_DISTANCE = (VIEW_HEIGHT / 2) / TAN_HALF_FOV; // how far back the camera stands

// --- THE PILLAR LINE: one pillar arriving on every beat, each one a different carving
export const PLAY_PILLAR_COUNT = 6;      // how many pillars the line holds
export const PILLAR_SPACING = 7.8;       // world units between them: the beat, measured in the world
// The slot is cut to the makers' own carvings, which are columns: 0.164 wide by 0.746 tall by 0.164 deep,
// an aspect of about one to four and a half. The slot keeps that aspect, so a carving fills it edge to
// edge, all seven read the same size, and the plain box stand-in is the same shape the carving will be.
export const PILLAR_WIDTH = 0.42;
export const PILLAR_HEIGHT = 1.9;
export const PILLAR_DEPTH = 0.42;
export const PILLAR_BASE_Y = 0;          // they stand on the floor
export const PILLAR_RECYCLE_CLEARANCE = 0.5; // a pillar goes back to the far end this far in front of the camera
export const PILLAR_RECYCLE_Z = CAMERA_DISTANCE - PILLAR_RECYCLE_CLEARANCE;

// --- TEMPO. The travel and the beat are the same number: a pillar crosses PILLAR_SPACING in one gap, so the
// interval between two arrivals is exactly the gap. They cannot drift apart, because one is the other.
export const START_BEAT_GAP = 1.95;      // the slow opening beat
export const FASTEST_BEAT_GAP = 1.1;     // the floor the beat ramps down to: kept steady, never frantic
export const PILLARS_TO_FULL_SPEED = 60; // hits it takes to travel from one to the other: a gentler ramp
export function beatGap(hits) {
  const ramp = Math.min(1, Math.max(0, (Number.isFinite(hits) ? hits : 0) / PILLARS_TO_FULL_SPEED));
  return START_BEAT_GAP + (FASTEST_BEAT_GAP - START_BEAT_GAP) * ramp;
}
export function travelSpeed(gap) {
  return PILLAR_SPACING / Math.max(0.05, gap);
}

// --- THE LIGHT: the pillar lights up before its beat and stays lit through it, so a little early or a
// little late still scores. It is the cue, and it is long on purpose.
export const GLOW_BEFORE_SECONDS = 0.7;  // how long before its beat a pillar lights up
export const GLOW_AFTER_SECONDS = 0.3;   // and how long it stays lit after
export const MIN_DARK_SECONDS = 0.12;    // dark kept between one light going out and the next coming on
export function glowBefore(gap) {
  return Math.min(GLOW_BEFORE_SECONDS, Math.max(0, gap - GLOW_AFTER_SECONDS - MIN_DARK_SECONDS));
}
export const PERFECT_SECONDS = 0.12;     // this close to the beat either side is dead on: full points
export const GLOW_LEVEL = 1.0;           // how bright a lit pillar's own material is
export const HIT_SECONDS = 0.25;         // the cool pop that answers a landed key
export const HIT_LEVEL = 1.15;
export const PILLAR_LIGHT_COLOR = 0xffd9a0; // the warm glow that says "press me"
export const PILLAR_HIT_COLOR = 0xd6ecff;   // the cool pop that answers a landed key
export const PILLAR_LIGHT_INTENSITY = 1.0;
export const PILLAR_GLOW_SCALE = 1.16;   // the additive halo around a lit pillar
export const PILLAR_GLOW_OPACITY = 0.45;

// --- RULES. Only a wrong key on a glowing pillar costs a life; nothing else does.
// Pressing the right key on a glowing pillar always scores: dead on the beat is worth more than in the glow.
export const LIVES = 5;
export const POINTS_PERFECT = 25;   // dead on the beat
export const POINTS_HIT = 10;       // in the glow, off the beat
export const COMBO_MULTIPLIER = 0.1; // extra score per combo step
export const RESTART_KEY = 'Space';  // event.code, starts and restarts a run
export const HINT_HIDE_AFTER_HITS = 8;

// --- THE MAKERS' CARVINGS: seven files, loaded once each and cycled across the arriving pillars. Whichever
// of them exist are used, in this order; one that is missing or unreadable is quietly a plain box, and if
// none of the seven load, the single fallback carving is tried instead.
export const PILLAR_MODEL_URLS = [
  './assets/models/pillar1.glb',
  './assets/models/pillar2.glb',
  './assets/models/pillar3.glb',
  './assets/models/pillar4.glb',
  './assets/models/pillar5.glb',
  './assets/models/pillar6.glb',
  './assets/models/pillar7.glb',
];
// The last-resort carving, asked for only if none of the seven above can be read. It has to be a real
// pillar: a missing file here would be one more request than the page needs.
export const PILLAR_FALLBACK_MODEL_URL = './assets/models/pillar1.glb';
export const PILLAR_MODEL_METALNESS = 0; // stone, and there is no environment map for a metal to reflect

// --- THE HALL THE PLAYER TRAVELS THROUGH: two rows of pillars and a paved floor, gliding past at the same
// speed as the pillar line, so the whole temple moves as one thing.
export const HALL_ROW_X = 7.0;         // how far out the two rows stand, clear of the pillar line
export const HALL_PILLARS_PER_ROW = 8;
export const HALL_PILLAR_SPACING = 9;  // world units between them down the row
export const HALL_PILLAR_WIDTH = 1.0;
export const HALL_PILLAR_HEIGHT = 6.0;
export const HALL_PILLAR_DEPTH = 1.0;
// The stones and the paving wrap past the camera itself, so a piece of hall only ever leaves the frame by
// sliding off the bottom of the screen or off its side: nothing is ever seen to disappear mid-frame.
export const HALL_WRAP_MARGIN = 1.0;
export const HALL_WRAP_Z = CAMERA_DISTANCE + HALL_WRAP_MARGIN;
export const FLOOR_BAND_COUNT = 24;    // the paving bands rushing underfoot: the floor's own motion
export const FLOOR_BAND_SPACING = 3.2;
export const FLOOR_BAND_WIDTH = 44;    // wide enough to cross the whole hall
export const FLOOR_BAND_DEPTH = 0.24;
export const FLOOR_BAND_HEIGHT = 0.06;
export const FLOOR_DEPTH = 220;        // how far the floor plane runs into the distance
export const FOG_NEAR = 16;            // the corridor fades out into the dark, so a recycled pillar never pops
export const FOG_FAR = 38;

// --- LIGHTING: strong enough to show the carving, dim enough that a glowing pillar still carries
export const AMBIENT_INTENSITY = 0.9;
export const KEY_LIGHT_COLOR = 0xfff3e2;   // warm, from the front left: the carving and its normal map
export const KEY_LIGHT_INTENSITY = 2.0;
export const FILL_LIGHT_COLOR = 0x9db8ff;  // cool, from the front right: stops the stone going flat
export const FILL_LIGHT_INTENSITY = 0.8;

// --- THE DANCER: she stands where the plain box stood, on the left, until her carving arrives.
// She carries a 65-bone Mixamo skeleton (Hips, Spine/Spine1/Spine2, Neck, Head, mixamorig:LeftShoulder/
// Arm/ForeArm/Hand and five fingers, LeftUpLeg/Leg/Foot/ToeBase, the same on the right) with no animation
// clip in the file at all. This pass stands her, turned, as one piece; the dance comes later, and the
// bones named above are what an AnimationMixer or a posed clip will drive.
export const DANCER_MODEL_URL = './assets/models/Dancer_Rig.glb';
export const DANCER_WIDTH = 0.7;   // her slot: the carving is fitted inside it...
export const DANCER_HEIGHT = 1.7;  // ...and stands this tall, feet on the floor
export const DANCER_X = -1.8;
export const DANCER_Z = -2.0;
export const DANCER_YAW = 0;       // her own front, down the corridor, watching the pillars arrive
export const DANCER_COLOR = 0xcccccc; // the box stand-in, and what she is if the carving cannot load

// --- INSTRUMENTS: the makers' order. One section per instrument; a portal moves on one step.
export const INSTRUMENTS = ['Tabla', 'Sitar', 'Flute', 'Dhol', 'Santoor'];
// One placeholder voice per instrument: waveform, octave, envelope, and a pitch drop or a second
// detuned string for the struck ones. M4 swaps these for samples behind setInstrument() in audio.js.
export const INSTRUMENT_VOICES = [
  { type: 'sine', octave: 1, duration: 0.22, gain: 0.24, attack: 0.002, pitchStart: 1.8, dropTime: 0.08 }, // Tabla: struck, pitched
  { type: 'sawtooth', octave: 1, duration: 0.75, gain: 0.09, attack: 0.005, detuneCents: 9 },              // Sitar: long buzzing strings
  { type: 'sine', octave: 2, duration: 0.65, gain: 0.18, attack: 0.09 },                                   // Flute: high, soft swell
  { type: 'square', octave: 0.5, duration: 0.3, gain: 0.15, attack: 0.003 },                               // Dhol: low and blunt
  { type: 'triangle', octave: 2, duration: 0.55, gain: 0.12, attack: 0.003, detuneCents: 7 },              // Santoor: bright metal
];

// --- PORTALS: every so many landed notes a portal opens and one more instrument joins the orchestra.
// The whole list is on screen from the first second, dimmed; a portal is what turns a row bright and
// hands that instrument the notes. The makers' knob for how fast the orchestra fills is HITS_PER_PORTAL.
export const HITS_PER_PORTAL = 20;      // landed notes between one portal and the next
export const PORTAL_CUE_SECONDS = 2.8;  // how long the portal's line stays up: it covers the sky's whole crossing

// --- THE DANCER'S BEAT: how sharply she marks a beat. 1 on the beat, fading to nothing over this many
// seconds either side of it, so at the fastest tempo she is still still between beats.
export const ACCENT_FALLOFF_SECONDS = 0.45;

// --- THE ORCHESTRA PANEL, down the left of the screen
export const INSTRUMENT_AREA_LEFT_PERCENT = 3;
export const INSTRUMENT_AREA_TOP_PERCENT = 17;
export const INSTRUMENT_AREA_WIDTH_PERCENT = 23;
export const INSTRUMENT_AREA_TITLE = 'Orchestra';
export const INSTRUMENT_AREA_FONT_PX = 14;
export const INSTRUMENT_AREA_TITLE_FONT_PX = 11;
export const INSTRUMENT_AREA_ROW_GAP_PX = 7;
export const INSTRUMENT_AREA_PADDING_PX = 10;
// The panel is the same gold-on-indigo as the screens: a joined instrument takes the heading gold, one still
// to come is a dim parchment, and the panel itself is a deep indigo wash with a faint gold edge - so the
// orchestra reads as part of the temple's ornament and not a browser list laid over the game.
export const INSTRUMENT_COLOR = '#f2c66d';
export const INSTRUMENT_PENDING_COLOR = 'rgba(236, 217, 180, 0.32)'; // an instrument the orchestra has not reached yet
export const INSTRUMENT_TITLE_COLOR = 'rgba(242, 198, 109, 0.6)';
export const INSTRUMENT_AREA_BACKGROUND = 'rgba(26, 18, 42, 0.34)';
export const INSTRUMENT_AREA_BORDER = '1px solid rgba(242, 198, 109, 0.22)';

// --- THE KEY ON A LIT PILLAR: one big letter, and only while that pillar is glowing.
// The letter fades in with the light, flashes for as long as the light is on, and is gone the moment the
// light is. There is no timer behind it: the flash is read off the glow's own progress through its window,
// so it cannot drift out of step with the light. Set FLASH_KEY_ON_GLOW false to play without any letters.
export const FLASH_KEY_ON_GLOW = true;
export const FLASH_CYCLES_PER_GLOW = 3;  // flashes across one glow: the makers' knob for the flash speed
export const FLASH_LOW = 0.15;           // how dark the trough of a flash gets (0 = right out, 1 = no flash)
export const GLOW_RAMP_SHARE = 0.18;     // the share of the glow spent fading in, and again fading out
export const LABEL_FONT = '700 92px system-ui, sans-serif';
export const LABEL_CANVAS_PX = 128;      // one square canvas per lane, holding one letter
export const LABEL_GLYPH_SHARE = 0.86;   // how much of that canvas the letter itself fills
export const LABEL_KEY_COLOR = '#f4f4f4';
export const LABEL_OUTLINE_COLOR = 'rgba(8, 8, 10, 0.9)'; // so the letter reads on dark stone and on the glow
export const LABEL_OUTLINE_PX = 9;
export const PILLAR_LABEL_WIDTH = PILLAR_WIDTH * 0.92;  // nearly the whole face, so the letter reads as it arrives
export const PILLAR_LABEL_Y = PILLAR_HEIGHT * 0.58;     // just under the player's eye line, up the pillar
export const PILLAR_LABEL_CLEARANCE = 0.02;             // how far the letter floats in front of the body
export const PILLAR_LABEL_Z = PILLAR_DEPTH / 2 + PILLAR_LABEL_CLEARANCE; // for the box stand-in
export const GLOW_RENDER_ORDER = 1;      // the halo draws first of the two...
export const LABEL_RENDER_ORDER = 2;     // ...so the letter is never washed out by a glowing pillar

// --- HUD: score, combo, lives, and the one-line hint that retires after a few pillars
export const HINT_FONT_PX = 13;
export const HINT_BOTTOM_PERCENT = 3;   // of the window height
export const HINT_LEFT_PERCENT = 30;    // the hint keeps to the free middle band, clear of both side areas
export const HINT_RIGHT_PERCENT = 30;
export const HINT_OPACITY = 0.55;

// --- THE SKY (M4 look). The temple travels out of the world one stage at a time: dusk over Hampi, up
// through the air, the airless dark, and out to the galaxies. Every stage is drawn in code on a canvas -
// no picture files - so the whole sky costs nothing to download, and a portal is what moves it on a stage,
// so the orchestra and the sky grow out together.
// There is one stage more than there are instruments on purpose: the orchestra starts at one and every
// portal adds one, so INSTRUMENTS.length - 1 portals happen in a run and every single one of them has a
// stage of its own to move the temple on to. A stage short, and the last portal would open on a sky that
// did not change - the line would come up over nothing.
export const SKY_STAGE_COUNT = 5;      // stages in all; the last one is the furthest out
export const SKY_STAGE_SECONDS = 2.0;  // how long the sky takes to cross from one stage to the next
export const SKY_CANVAS_WIDTH = 1024;
export const SKY_CANVAS_HEIGHT = 512;

// --- THE PAINTED TEMPLE, hanging behind the far end of the corridor: one flat picture of the Vijay
// Vithala temple, drawn in code like the sky. It stands past the farthest the pillars are ever put (they
// reach about -43), and it does not fade with the fog, so the fog closes the corridor and the temple is
// still there at the end of it.
export const BACKDROP_Z = -52;
export const BACKDROP_WIDTH = 170;   // generous: only the middle of it is ever in frame
export const BACKDROP_HEIGHT = 76;

// --- COLOURS (flat stone and light; the temple's own look arrives at M4)
export const BACKGROUND_COLOR = 0x0e0d0c;
export const FLOOR_COLOR = 0x2b2723;
export const FLOOR_BAND_COLOR = 0x6d675e;
export const HALL_PILLAR_COLOR = 0x6a635b;
export const PILLAR_COLOR = 0x6f6a63; // the box stand-in, and what a pillar with no model looks like: plain grey stone

// --- PLACEHOLDER AUDIO (synth tones; real instrument samples replace these at M4)
export const SWARA_FREQUENCIES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88];
export const HIT_FREQUENCY = 1200;
export const HIT_TONE = { type: 'square', octave: 1, duration: 0.07, gain: 0.08, attack: 0.004 };
export const MISS_FREQUENCY = 110;
export const MISS_TONE = { type: 'sawtooth', octave: 1, duration: 0.28, gain: 0.13, attack: 0.006, pitchStart: 1.5, dropTime: 0.14 };
