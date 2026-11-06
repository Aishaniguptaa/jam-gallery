// ui.js — the plain-DOM overlay: kills, floor, health bar, and the game over / restart panel.
import {
  enemyHealthBarWidth, enemyHealthBarHeight, enemyHealthBarYOffset,
  enemyHealthBarColor, enemyHealthBarBg,
  spawnIndicatorSize, spawnIndicatorColor,
} from './tuning.js';

const GREY = { dark: '#595959', mid: '#7f7f7f', light: '#a5a5a5', pale: '#cccccc', white: '#f2f2f2' };

let els = null;            // built by createUI
let onRestart = null;      // set by main.js
let shown = { score: null, floor: null };   // skip redrawing unchanged readouts
const enemyBars = [];      // active enemy health-bar containers

export function createUI() {
  const root = document.getElementById('ui') || document.createElement('div');
  root.id = 'ui';
  Object.assign(root.style, {
    position: 'fixed', inset: '0', zIndex: '10', pointerEvents: 'none',
    font: '15px/1.5 system-ui, sans-serif', color: GREY.white, userSelect: 'none',
  });

  // Top-left readout.
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'absolute', left: '16px', top: '16px', padding: '10px 14px', minWidth: '170px',
    background: 'rgba(0,0,0,0.45)', border: `1px solid ${GREY.mid}`, borderRadius: '6px',
  });
  const score = document.createElement('div');
  const floor = document.createElement('div');
  const hp = document.createElement('div');
  Object.assign(hp.style, { marginTop: '8px', fontSize: '13px', color: GREY.pale });
  const barOuter = document.createElement('div');
  Object.assign(barOuter.style, {
    marginTop: '4px', height: '10px', background: GREY.dark, border: `1px solid ${GREY.mid}`,
  });
  const bar = document.createElement('div');
  Object.assign(bar.style, { height: '100%', width: '100%', background: GREY.pale });
  barOuter.appendChild(bar);
  panel.append(score, floor, hp, barOuter);

  // Game over: a centred panel with one Restart button. The button is the only clickable thing.
  const over = document.createElement('div');
  Object.assign(over.style, {
    position: 'absolute', inset: '0', display: 'none', placeItems: 'center',
    background: 'rgba(0,0,0,0.6)',
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    padding: '24px 32px', textAlign: 'center', background: 'rgba(0,0,0,0.75)',
    border: `1px solid ${GREY.light}`, borderRadius: '8px',
  });
  const title = document.createElement('div');
  title.textContent = 'The golem is destroyed';
  Object.assign(title.style, { fontSize: '20px', marginBottom: '10px' });
  const overStats = document.createElement('div');
  Object.assign(overStats.style, { color: GREY.pale, marginBottom: '16px' });
  const hint = document.createElement('div');
  hint.textContent = 'press R or click Restart';
  Object.assign(hint.style, { color: GREY.light, fontSize: '13px', marginTop: '10px' });
  const button = document.createElement('button');
  button.textContent = 'Restart';
  Object.assign(button.style, {
    pointerEvents: 'auto', cursor: 'pointer', font: 'inherit', padding: '8px 20px',
    color: GREY.white, background: GREY.dark, border: `1px solid ${GREY.light}`, borderRadius: '6px',
  });
  button.addEventListener('click', () => { if (onRestart) onRestart(); });
  button.addEventListener('mousedown', (event) => event.stopPropagation());  // don't read as a shot
  box.append(title, overStats, button, hint);
  over.appendChild(box);

  root.append(panel, over);
  if (!root.isConnected) document.body.appendChild(root);

  const wave = document.createElement('div');
  Object.assign(wave.style, { marginTop: '4px', fontSize: '13px', color: GREY.pale });
  panel.append(wave);

  els = { score, floor, wave, hp, bar, over, overStats };
  setScore(0);
  setFloor(1);
  setWave(1, 1);
  setHealth(1, 1);
  return { setRestartHandler(fn) { onRestart = fn; } };
}

export function setScore(n) {
  if (!els || shown.score === n) return;
  shown.score = n;
  els.score.textContent = `Kills: ${n}`;
}

export function setFloor(n) {
  if (!els || shown.floor === n) return;
  shown.floor = n;
  els.floor.textContent = `Floor: ${n}`;
}

export function setWave(current, total) {
  if (!els) return;
  els.wave.textContent = `Wave: ${current} / ${total}`;
}

export function setHealth(hp, maxHp) {
  if (!els) return;
  const shown = Math.max(0, Math.ceil(hp));
  els.hp.textContent = `HP: ${shown} / ${maxHp}`;
  els.bar.style.width = `${Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0)) * 100}%`;
}

export function showGameOver(score, floor) {
  if (!els) return;
  els.overStats.textContent = `Kills: ${score}    Floor: ${floor}`;
  els.over.style.display = 'grid';
}

export function hideGameOver() { if (els) els.over.style.display = 'none'; }

// --- Enemy health bars -------------------------------------------------------
export function createEnemyHealthBar() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'absolute', pointerEvents: 'none',
    width: `${enemyHealthBarWidth}px`, height: `${enemyHealthBarHeight}px`,
  });

  const bg = document.createElement('div');
  Object.assign(bg.style, {
    width: '100%', height: '100%', background: enemyHealthBarBg,
    border: `1px solid ${GREY.dark}`, borderRadius: '1px', overflow: 'hidden',
  });

  const fg = document.createElement('div');
  Object.assign(fg.style, {
    width: '100%', height: '100%', background: enemyHealthBarColor,
  });

  bg.appendChild(fg);
  container.appendChild(bg);
  document.body.appendChild(container);
  enemyBars.push(container);

  return {
    element: container,
    setHp(hp, maxHp) {
      const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
      fg.style.width = `${ratio * 100}%`;
    },
    remove() {
      const i = enemyBars.indexOf(container);
      if (i >= 0) enemyBars.splice(i, 1);
      if (container.parentNode) container.parentNode.removeChild(container);
    },
  };
}

export function positionEnemyHealthBar(barElement, worldPosition, camera, renderer) {
  const ndc = worldPosition.clone().project(camera);
  const canvas = renderer.domElement;

  if (ndc.z > 1 || ndc.z < -1) {
    barElement.style.display = 'none';
    return;
  }

  const screenX = (ndc.x * 0.5 + 0.5) * canvas.clientWidth;
  const screenY = (1 - (ndc.y * 0.5 + 0.5)) * canvas.clientHeight;

  barElement.style.display = 'block';
  barElement.style.left = `${screenX - enemyHealthBarWidth / 2}px`;
  barElement.style.top = `${screenY - enemyHealthBarHeight - enemyHealthBarYOffset}px`;
}

export function clearEnemyHealthBars() {
  for (const bar of enemyBars) {
    if (bar.parentNode) bar.parentNode.removeChild(bar);
  }
  enemyBars.length = 0;
}

// --- Spawn indicators --------------------------------------------------------
export function createSpawnIndicator() {
  const element = document.createElement('div');
  const half = spawnIndicatorSize / 2;
  Object.assign(element.style, {
    position: 'absolute',
    pointerEvents: 'none',
    width: '0',
    height: '0',
    borderTop: `${half}px solid transparent`,
    borderBottom: `${half}px solid transparent`,
    borderLeft: `${spawnIndicatorSize}px solid ${spawnIndicatorColor}`,
  });
  document.body.appendChild(element);

  return {
    element,
    remove() {
      if (element.parentNode) element.parentNode.removeChild(element);
    },
  };
}

export function positionSpawnIndicator(element, worldPos, camera, renderer) {
  const ndc = worldPos.clone().project(camera);
  const canvas = renderer.domElement;

  // If the point is behind the camera, mirror it so the indicator lands on the opposite edge.
  const behind = ndc.z > 1;
  const rawX = behind ? -ndc.x : ndc.x;
  const rawY = behind ? -ndc.y : ndc.y;

  // On-screen spawns don't need an arrow.
  if (!behind && Math.abs(rawX) < 1 && Math.abs(rawY) < 1) {
    element.style.display = 'none';
    return;
  }

  const clampedX = Math.max(-0.95, Math.min(0.95, rawX));
  const clampedY = Math.max(-0.95, Math.min(0.95, rawY));

  const screenX = (clampedX * 0.5 + 0.5) * canvas.clientWidth;
  const screenY = (1 - (clampedY * 0.5 + 0.5)) * canvas.clientHeight;

  const rawScreenX = (rawX * 0.5 + 0.5) * canvas.clientWidth;
  const rawScreenY = (1 - (rawY * 0.5 + 0.5)) * canvas.clientHeight;
  const angle = Math.atan2(rawScreenY - screenY, rawScreenX - screenX) * (180 / Math.PI);

  element.style.display = 'block';
  element.style.left = `${screenX}px`;
  element.style.top = `${screenY}px`;
  element.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}
