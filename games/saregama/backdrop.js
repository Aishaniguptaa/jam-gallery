// backdrop.js — the temple at the far end of the corridor: one generated facade image (assets/temple-facade.svg) drawn onto a canvas whose background is transparent, so the real five-stage sky shows above the temple and changes at every portal.
import * as THREE from 'three';
import { BACKDROP_Z, BACKDROP_WIDTH, BACKDROP_HEIGHT } from './tuning.js';

// --- THE CANVAS THE FACADE IS DRAWN INTO: the plane's own proportions, and wide enough that the middle
// sliver - the only part ever in frame - still holds the carving crisply.
const PICTURE_WIDTH = 4080;                             // canvas pixels across
const PIXELS_PER_UNIT = PICTURE_WIDTH / BACKDROP_WIDTH; // 24: canvas pixels to one world unit, and back
const PICTURE_HEIGHT = Math.round(PIXELS_PER_UNIT * BACKDROP_HEIGHT); // 1824: the plane's own aspect exactly

// --- THE FACADE IMAGE: a generated drawing of the temple front with nothing in it but the temple. Every
// pixel the temple does not cover is fully transparent, which is what lets the sky - sky.js, one stage per
// portal - show through above it. The canvas holds the picture at the same 24 pixels to the world unit as
// the plane it hangs on, so the temple's drawn size and its size in the corridor are the same number.
const FACADE_URL = './assets/temple-facade.svg';  // the generated facade: the temple, and nothing behind it
const FACADE_CANVAS_HEIGHT = 528;                 // 22 world units tall, at 24 canvas pixels to the world unit
const FACADE_CANVAS_WIDTH = 938;                  // the SVG's own 16:9 held to within a pixel: 39 world units wide
const FACADE_LEFT = 1571;                         // centred across the canvas: (4080 - 938) / 2
const FACADE_TOP = PICTURE_HEIGHT - FACADE_CANVAS_HEIGHT; // 1296: its foot on the canvas' bottom edge, so it stands on the floor

// --- THE ONE THING MAIN.JS NEEDS TO KNOW ABOUT THE PICTURE ON SCREEN
const BACKDROP_RENDER_ORDER = -1;   // drawn first, so it stays behind everything else in the corridor
const MATERIAL_TINT = 0xffffff;     // white leaves the picture's own colours alone

// --- THE BACKDROP ON SCREEN: one unlit, unfogged plane carrying the facade, standing on the floor
export function createBackdrop(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = PICTURE_WIDTH;
  canvas.height = PICTURE_HEIGHT;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  // The canvas is left empty until the image arrives, and empty is the right thing for it to be: a fully
  // transparent picture is simply the sky, and the sky is already behind it and already lit.
  const facade = new Image();
  facade.onload = () => {
    ctx.drawImage(facade, FACADE_LEFT, FACADE_TOP, FACADE_CANVAS_WIDTH, FACADE_CANVAS_HEIGHT);
    texture.needsUpdate = true;
  };
  facade.src = FACADE_URL;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: MATERIAL_TINT,
    fog: false, // the picture stands well past FOG_FAR: fog would erase it, so it is never fogged
    // The facade's own background is transparent, so the material has to be blended for the real sky to show
    // through it. Without this the texture's alpha would be ignored and the open sky above the temple would
    // be painted over the sky it is meant to reveal.
    transparent: true,
  });

  const geometry = new THREE.PlaneGeometry(BACKDROP_WIDTH, BACKDROP_HEIGHT);
  geometry.translate(0, BACKDROP_HEIGHT / 2, 0); // so the plane stands on the floor, growing upward
  const backdrop = new THREE.Mesh(geometry, material);
  backdrop.position.set(0, 0, BACKDROP_Z);
  backdrop.renderOrder = BACKDROP_RENDER_ORDER;
  scene.add(backdrop);
  return backdrop;
}
