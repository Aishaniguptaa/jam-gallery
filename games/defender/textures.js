// textures.js — the arena floor, drawn on a canvas instead of downloaded as an image file.
import * as THREE from 'three';

const SIZE = 512;       // the canvas is square and maps straight onto the square arena
const GRID_LINES = 8;   // faint deck lines: every 5 units of the 40-unit floor
const STAINS = 6;       // dark oil stains
const GRAINS = 4500;    // specks of grit

// A tiny repeatable RNG, so the floor is drawn the same way on every load.
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Draw the floor and hand back the finished canvas.
function drawGround() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const random = makeRandom(20261106);

  // Warm sand: warmest around the rig in the middle, dustier toward the corners.
  const sand = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.04, SIZE / 2, SIZE / 2, SIZE * 0.7);
  sand.addColorStop(0, '#b28c5c');
  sand.addColorStop(0.45, '#9c7749');
  sand.addColorStop(1, '#5c4229');
  ctx.fillStyle = sand;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Oil stains: overlapping dark blobs, so the deck looks used rather than painted.
  for (let i = 0; i < STAINS; i++) {
    const cx = random() * SIZE;
    const cy = random() * SIZE;
    const spread = 12 + random() * 28;
    for (let j = 0; j < 9; j++) {
      const angle = random() * Math.PI * 2;
      const distance = random() * spread;
      ctx.fillStyle = `rgba(48, 28, 19, ${(0.04 + random() * 0.07).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, spread * (0.2 + random() * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Painted grid lines, faint enough to be texture rather than a map.
  ctx.strokeStyle = 'rgba(48, 30, 20, 0.16)';
  ctx.lineWidth = 2;
  for (let i = 1; i < GRID_LINES; i++) {
    const p = Math.round((i / GRID_LINES) * SIZE) + 0.5; // the half pixel keeps a 2px line crisp
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, SIZE);
    ctx.moveTo(0, p);
    ctx.lineTo(SIZE, p);
    ctx.stroke();
  }

  // Grit: small light and dark specks.
  for (let i = 0; i < GRAINS; i++) {
    ctx.fillStyle = random() < 0.5
      ? `rgba(255, 226, 180, ${(0.05 + random() * 0.08).toFixed(3)})`
      : `rgba(60, 38, 24, ${(0.04 + random() * 0.08).toFixed(3)})`;
    const grain = 1 + random() * 1.6;
    ctx.fillRect(random() * SIZE, random() * SIZE, grain, grain);
  }

  return canvas;
}

export const groundTexture = new THREE.CanvasTexture(drawGround());
groundTexture.colorSpace = THREE.SRGBColorSpace; // the canvas holds sRGB colours
