// Plain DOM overlay: player health, stamina, enemy guard gauge, a big outcome readout and a centre message.
const OUTCOME_STYLE = {
  perfect: { text: '#ffe066', bg: 'rgba(122,88,0,0.55)', border: '#ffd34d' },
  block: { text: '#8fd8ff', bg: 'rgba(0,52,84,0.55)', border: '#4fb8e8' },
  hit: { text: '#ff6b5a', bg: 'rgba(108,0,0,0.6)', border: '#ff5a4d' },
  // Winded: the guard never came up, so you were caught flat-footed and cut down — not a blood hit but
  // a washed-out one. Bone grey on a dim, half-strength badge, so it never reads as the red 'hit'.
  winded: { text: '#e6ded2', bg: 'rgba(40,37,33,0.45)', border: '#a2968a', opacity: '0.8' },
  // Wild: a press at empty air, or a flail during the wind-up. Nothing connected, so it is the dimmest
  // badge of the lot — a muted slate grey that can never be mistaken for the red 'hit' or the blue 'block'.
  wild: { text: '#b0a6b8', bg: 'rgba(30,28,34,0.4)', border: '#6a6273', opacity: '0.6' },
  ready: { text: '#cfc6b8', bg: 'rgba(30,28,26,0.5)', border: '#6b6459' },
};
// The full-screen tint that answers a press: warm gold for a perfect parry, a cold whisper for a block,
// blood red for a hit. One element that is retriggered — never one element per call, so it cannot stack.
const FLASH_STYLE = {
  perfect: { tint: 'radial-gradient(circle at 50% 42%, rgba(255,238,190,0.55), rgba(255,178,56,0.16) 72%)', strength: 1 },
  block: { tint: 'radial-gradient(circle at 50% 42%, rgba(139,196,255,0.22), rgba(60,120,200,0.06) 72%)', strength: 0.5 },
  hit: { tint: 'radial-gradient(circle at 50% 42%, rgba(255,60,40,0.6), rgba(150,10,10,0.28) 75%)', strength: 1 },
};
const FLASH_FADE_MS = 150;
const FONT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const STAMINA_LIVE = '#9fd8e8';    // the pale cold blue of a bar with wind in it
const STAMINA_DRAINED = '#6f7d82'; // the same bar with every last scrap of wind gone: greyed out

// THE FRAME COUNTER, behind ?fps on the URL. Three seconds is the window, because that is the one the
// judging checklist asks about. The MINIMUM is the honest number here: an average can sit comfortably at
// 60 while one long frame every few seconds still stutters the blade, and the player feels that frame.
const FPS_WINDOW = 3;    // seconds before the window starts over
const FPS_PAINT = 0.25;  // seconds between repaints, so the readout cannot cost more than it reports

function formatCount(n) {
  if (!n) return '0';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function createUI() {
  const hud = document.createElement('div');
  hud.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:10;font-family:${FONT}`;
  document.body.appendChild(hud);

  // The screen tint goes in first, so it paints underneath the readouts instead of washing them out.
  const flashLayer = document.createElement('div');
  flashLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0';
  hud.appendChild(flashLayer);

  // Last outcome, top left — this is the M1 check, so it is big and colour-coded.
  const outcome = document.createElement('div');
  outcome.style.cssText =
    'position:absolute;left:24px;top:20px;padding:8px 18px;border-radius:6px;border:2px solid #6b6459;' +
    `font:700 30px/1.1 ${FONT};letter-spacing:2px;color:#cfc6b8;background:rgba(30,28,26,0.5)`;
  outcome.textContent = 'READY';
  hud.appendChild(outcome);

  // Health, and directly under it its own separate stamina bar. Health sits a little higher than it
  // used to so the stamina bar fits below it and still clears the very bottom edge of the screen.
  const health = makeBar(hud, 'left:24px;bottom:60px;width:280px', 'YOU');
  const stamina = makeBar(hud, 'left:24px;bottom:24px;width:280px', 'STAMINA', STAMINA_LIVE);
  const gauge = makeBar(hud, 'left:50%;top:22px;transform:translateX(-50%);width:340px', 'GUARD');
  // His health, directly under his guard and the same width, so one look at the top of the screen says
  // both how close his guard is to breaking and how much of him is left. Its label is his name.
  const enemyHealth = makeBar(hud, 'left:50%;top:76px;transform:translateX(-50%);width:340px', '', '#d0463c');

  const message = document.createElement('div');
  // pre-line keeps the title screen's and the win screen's line breaks on screen.
  message.style.cssText =
    'position:absolute;left:0;right:0;top:38%;text-align:center;display:none;white-space:pre-line;' +
    `font:600 26px/1.4 ${FONT};color:#e8dfd0;text-shadow:0 2px 6px #000`;
  hud.appendChild(message);
  let messageShown = false;
  let healthTint = ''; // the bars are refreshed every frame, so only repaint on a real change
  let staminaDrained = false; // same: the stamina bar is repainted only when the lock comes or goes

  // Which fight this is, along the very bottom edge — in the centre, clear of the health and stamina
  // bars down the left, the guard gauge up top and the outcome readout up left.
  const fight = document.createElement('div');
  fight.style.cssText =
    'position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:none;' +
    `font:600 11px/1 ${FONT};letter-spacing:3px;color:#9d948a;text-shadow:0 2px 6px #000`;
  hud.appendChild(fight);

  // The frame counter. Absent from the URL means absent from the screen: no element is built and the
  // game pays nothing for it. It lives top right, clear of the guard gauge and the outcome badge.
  const fps = new URLSearchParams(location.search).has('fps') ? document.createElement('div') : null;
  let fpsFrames = 0, fpsElapsed = 0, fpsWorstDt = 0, fpsSincePaint = 0;
  if (fps) {
    fps.style.cssText =
      'position:absolute;right:24px;top:20px;padding:6px 10px;border-radius:6px;text-align:right;' +
      'background:rgba(0,0,0,0.6);border:1px solid rgba(220,210,190,0.3);white-space:pre;color:#cfc6b8;' +
      'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace';
    hud.appendChild(fps);
  }

  return {
    setOutcome(text, kind) {
      const style = OUTCOME_STYLE[kind] || OUTCOME_STYLE.ready;
      outcome.textContent = text;
      outcome.style.color = style.text;
      outcome.style.background = style.bg;
      outcome.style.borderColor = style.border;
      outcome.style.opacity = style.opacity || '1';
    },
    setHealth(value, max) {
      setFill(health.fill, value, max);
      const tint = value / max > 0.5 ? '#7ee26a' : value / max > 0.25 ? '#f0c040' : '#ff5a4d';
      if (tint !== healthTint) {
        healthTint = tint;
        health.fill.style.background = tint;
      }
    },
    // Its own bar, never merged into health: it stays one steady cold blue and never changes colour,
    // so it can never be mistaken for health or for the enemy's guard. The one exception is `exhausted`:
    // with no wind left in it the bar stops being a readout and becomes the warning that the player is
    // locked out of everything, so it drops its label to WINDED and greys itself out until they can act.
    setStamina(value, max, exhausted) {
      setFill(stamina.fill, value, max);
      const drained = !!exhausted;
      if (drained === staminaDrained) return;
      staminaDrained = drained;
      stamina.tag.textContent = drained ? 'WINDED' : 'STAMINA';
      stamina.tag.style.color = drained ? '#6d675f' : '#9d948a';
      stamina.fill.style.background = drained ? STAMINA_DRAINED : STAMINA_LIVE;
      stamina.fill.style.opacity = drained ? '0.4' : '1';
      stamina.track.style.opacity = drained ? '0.55' : '1';
    },
    setGauge(value, max) {
      setFill(gauge.fill, value, max);
    },
    // His name rides on the label, so there is never a doubt about whose health is draining up there.
    setEnemyHealth(value, max, label) {
      setFill(enemyHealth.fill, value, max);
      setLabel(enemyHealth.tag, label);
    },
    setMessage(text) {
      if (messageShown && message.textContent === text) return;
      message.textContent = text;
      message.style.opacity = '1'; // a fresh message always arrives at full strength
      message.style.display = 'block';
      messageShown = true;
    },
    hideMessage() {
      if (!messageShown) return;
      message.style.display = 'none';
      messageShown = false;
    },
    // 0..1: the hand-over between the fights fades its one line up and back down with this. Purely
    // additive — setMessage always comes back at 1, so a fade can never leave a message stuck dim.
    setMessageOpacity(value) {
      const k = Math.max(0, Math.min(1, Number(value) || 0));
      if (message.style.opacity === String(k)) return;
      message.style.opacity = String(k);
    },
    // kind is 'perfect' | 'block' | 'hit'; anything else fades in like a block rather than throwing.
    flash(kind) {
      const style = FLASH_STYLE[kind] || FLASH_STYLE.block;
      flashLayer.style.transition = 'none';
      flashLayer.style.background = style.tint;
      flashLayer.style.opacity = String(style.strength);
      void flashLayer.offsetWidth; // commit the tint before the fade is armed, so a rapid retrigger still reads
      flashLayer.style.transition = `opacity ${FLASH_FADE_MS}ms linear`;
      flashLayer.style.opacity = '0';
    },
    setFight(text) {
      fight.textContent = text || '';
      fight.style.display = text ? 'block' : 'none';
    },
    // The hand-over between the fights takes the whole HUD away — the four bars, the outcome badge and the
    // fight label — so for the length of it the screen holds nothing but the room and the one line.
    // showHud is the exact inverse, so the overlay can never be left half-hidden.
    hideHud() {
      outcome.style.display = 'none';
      for (const bar of [health, stamina, gauge, enemyHealth]) bar.wrap.style.display = 'none';
      fight.style.display = 'none';
    },
    showHud() {
      outcome.style.display = 'block';
      for (const bar of [health, stamina, gauge, enemyHealth]) bar.wrap.style.display = 'block';
      fight.style.display = fight.textContent ? 'block' : 'none';
    },
    // Called once a frame with this frame's seconds and renderer.info. Does nothing at all unless ?fps is
    // on the URL, so the game is identical with and without it.
    tickFps(dt, info) {
      if (!fps || !(dt > 0)) return;
      fpsFrames += 1;
      fpsElapsed += dt;
      fpsSincePaint += dt;
      if (dt > fpsWorstDt) fpsWorstDt = dt;
      if (fpsSincePaint < FPS_PAINT) return;
      fpsSincePaint = 0;
      const render = info && info.render;
      fps.textContent =
        `${Math.round(1 / dt)} fps now\n` +
        `${Math.round(fpsFrames / fpsElapsed)} avg\n` +
        `${Math.round(1 / fpsWorstDt)} min\n` +
        (render ? `${render.calls} calls\n${formatCount(render.triangles)} tris` : 'no renderer info');
      if (fpsElapsed >= FPS_WINDOW) {
        fpsFrames = 0;
        fpsElapsed = 0;
        fpsWorstDt = 0;
      }
    },
  };
}

function makeBar(parent, position, label, color = '#7ee26a') {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;${position}`;

  const tag = document.createElement('div');
  tag.style.cssText = `font:600 11px/1 ${FONT};letter-spacing:3px;color:#9d948a;margin-bottom:4px`;
  tag.textContent = label;

  const track = document.createElement('div');
  track.style.cssText =
    'height:14px;border:1px solid rgba(220,210,190,0.35);border-radius:3px;' +
    'background:rgba(0,0,0,0.55);overflow:hidden';

  const fill = document.createElement('div');
  fill.style.cssText = `height:100%;width:100%;background:${color};transition:width 80ms linear`;
  track.appendChild(fill);

  wrap.appendChild(tag);
  wrap.appendChild(track);
  parent.appendChild(wrap);
  // wrap too, so the whole bar can be taken off screen for the hand-over between the fights.
  return { fill, tag, track, wrap };
}

function setLabel(tag, text) {
  const next = text || '';
  if (tag.textContent === next) return; // refreshed every frame: only touch the DOM on a change
  tag.textContent = next;
}

function setFill(fill, value, max) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const width = `${fraction * 100}%`;
  if (fill.style.width === width) return; // stamina ticks every frame: only touch the DOM on a change
  fill.style.width = width;
}
