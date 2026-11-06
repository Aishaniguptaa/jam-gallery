// labels.js — the key letter that flashes on a lit pillar: one canvas, texture and material per lane, shared.
import * as THREE from 'three';
import {
  LANE_COUNT, KEYS,
  LABEL_FONT, LABEL_CANVAS_PX, LABEL_GLYPH_SHARE, LABEL_KEY_COLOR, LABEL_OUTLINE_COLOR, LABEL_OUTLINE_PX,
  PILLAR_LABEL_WIDTH,
} from './tuning.js';

// --- THE GLOW: a warm halo painted into the same canvas as the letter, so a lit key reads as luminous
// rather than printed. Because it lives in the texture it costs nothing per frame and it rises and falls
// with the label's own opacity, exactly in step with the pillar's light.
const GLOW_INNER = 'rgba(255, 240, 198, 0.95)'; // the hot core, right behind the glyph
const GLOW_MID = 'rgba(255, 198, 104, 0.5)';    // the warm body of the halo
const GLOW_OUTER = 'rgba(255, 150, 40, 0)';     // its soft edge, fading to nothing so the square never shows
const GLOW_RADIUS = 0.5;                        // the halo's radius as a share of the canvas
const GLOW_CORE_STOP = 0.4;                     // how far out the bright core holds before it starts to fall

// --- ONE LABEL: the key letter alone, drawn as large as the canvas will hold, and stroked dark before it is
// filled so it reads both on dim stone and on the pillar's own glow. The swara is not here: it belongs to
// the title screen's legend. The glyph is measured and scaled to LABEL_GLYPH_SHARE of the canvas, so every
// letter of the seven comes out the same size on the pillar whatever its own shape.
function drawKey(key) {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_PX;
  canvas.height = LABEL_CANVAS_PX;
  const ctx = canvas.getContext('2d');
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // the halo, painted first and in canvas space so it sits behind the glyph and reaches the plate's edge
  const centre = LABEL_CANVAS_PX / 2;
  const glow = ctx.createRadialGradient(centre, centre, 0, centre, centre, LABEL_CANVAS_PX * GLOW_RADIUS);
  glow.addColorStop(0, GLOW_INNER);
  glow.addColorStop(GLOW_CORE_STOP, GLOW_MID);
  glow.addColorStop(1, GLOW_OUTER);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, LABEL_CANVAS_PX, LABEL_CANVAS_PX);

  const metrics = ctx.measureText(key);
  const wide = Math.max(1, metrics.width);
  const tall = Math.max(1, (metrics.actualBoundingBoxAscent || LABEL_CANVAS_PX * 0.36)
    + (metrics.actualBoundingBoxDescent || 0));
  const scale = (LABEL_CANVAS_PX * LABEL_GLYPH_SHARE) / Math.max(wide, tall);

  ctx.translate(LABEL_CANVAS_PX / 2, LABEL_CANVAS_PX / 2);
  ctx.scale(scale, scale); // the glyph is drawn at its own size, then scaled to fill the canvas
  ctx.lineJoin = 'round';
  ctx.lineWidth = LABEL_OUTLINE_PX / scale; // so the outline stays a constant weight once scaled
  ctx.strokeStyle = LABEL_OUTLINE_COLOR;
  ctx.strokeText(key, 0, 0);
  ctx.fillStyle = LABEL_KEY_COLOR;
  ctx.fillText(key, 0, 0);
  return canvas;
}

// --- THE SEVEN LABELS, BUILT ONCE
// One canvas, texture and material per note, made on the first request and shared from then on: every run
// of the game draws from these seven, so the texture count cannot grow and no frame allocates a texture.
// The material starts fully transparent: a label only ever becomes visible because the light turned on.
let shared = null;

function labelKit() {
  if (shared) return shared;
  shared = {
    geometry: new THREE.PlaneGeometry(PILLAR_LABEL_WIDTH, PILLAR_LABEL_WIDTH), // a square letter on a square face
    materials: Array.from({ length: LANE_COUNT }, (_, lane) => {
      const texture = new THREE.CanvasTexture(drawKey((KEYS[lane] ?? '').toUpperCase()));
      texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true, // the canvas is only the letter; no plate behind it
        depthWrite: false, // and it never hides what is in front of it
        opacity: 0,
        fog: false,        // the letter stays crisp when its pillar is deep in the corridor's fog
      });
    }),
  };
  return shared;
}

// --- A PILLAR'S OWN LABEL: a plane carrying its note's key. pillars.js adds it to the pillar, so it sits
// on the face wherever the pillar stands and goes away with the pillar.
export function createPillarLabel(laneIndex) {
  const kit = labelKit();
  const label = new THREE.Mesh(kit.geometry, kit.materials[((laneIndex % kit.materials.length) + kit.materials.length) % kit.materials.length]);
  label.visible = false; // hidden until its pillar is the one glowing
  return label;
}

// --- A PILLAR THAT COMES ROUND AGAIN CARRIES A DIFFERENT NOTE, so its letter has to change with it: the
// label is one of the seven shared planes, so re-labelling is one lookup and no new texture.
export function setLabelLane(label, laneIndex) {
  const kit = labelKit();
  const count = kit.materials.length;
  label.material = kit.materials[((laneIndex % count) + count) % count];
}
