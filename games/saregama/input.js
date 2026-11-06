// input.js — the key map ('s'..'n' to a lane, SPACE to restart), the one keyboard listener, and touch lane buttons.
import { KEYS, SWARAS, RESTART_KEY } from './tuning.js';

// --- KEY MAP: 's'..'n' -> lane 0..6, anything else -> -1
export function laneFromKey(key) {
  return KEYS.indexOf(String(key).toLowerCase());
}

// --- THE TOUCH STRIP: a row of lane buttons for a phone or tablet. Only input.js and index.html may change,
// so these numbers live here, named, rather than in tuning.js.
const BUTTON_MIN_HEIGHT_PX = 44; // the smallest a thumb target ever shrinks to
const BUTTON_HEIGHT_PX = 58;
const BUTTON_GAP_PX = 6;
const BAR_PADDING_PX = 8;
const KEY_FONT_PX = 20;         // the key letter on a button
const SWARA_FONT_PX = 10;       // the swara name under it
const BUTTON_RADIUS_PX = 10;
// The colours are the same gold-on-indigo the rest of the screen uses, so the strip reads as part of the
// game rather than a browser control laid over it: the key letters carry the heading gold, the swara names
// the warmer parchment, and the pressed fill is the gold flare.
const BUTTON_BG = 'rgba(26, 18, 42, 0.42)';        // semi-transparent indigo: the game shows through
const BUTTON_BG_PRESSED = 'rgba(255, 217, 160, 0.42)';
const BUTTON_BORDER = '1px solid rgba(242, 198, 109, 0.30)';
const BUTTON_COLOR = '#f2c66d';
const SWARA_COLOR = 'rgba(236, 217, 180, 0.70)';

// Is the player on a finger, or on a mouse? Only a coarse POINTER counts, not merely the presence of a
// touch screen: a Windows laptop with a touchscreen reports touch points but the player is using a
// trackpad, and the lane strip would then sit over the game for no reason. A phone or tablet is coarse.
// Guarded, so a missing DOM never throws.
function hasTouchScreen() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

// --- THE TOUCH CONTROLS: seven buttons, one per lane, along the bottom. A tap does exactly what that lane's
// key does and also starts or restarts a run, in the same order the keydown handler uses: restart first
// (which unlocks the sound), then the lane tap. Built always, shown only where a touch screen can use them.
function createTouchControls({ onLane, onRestartKey }) {
  if (typeof document === 'undefined' || !document.body) return;

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '2',
    display: 'none',                 // revealed only on a touch device
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: `${BUTTON_GAP_PX}px`,
    padding: `${BAR_PADDING_PX}px`,
    paddingBottom: `calc(${BAR_PADDING_PX}px + env(safe-area-inset-bottom))`,
    boxSizing: 'border-box',
    pointerEvents: 'none',           // the strip never blocks the view; only the buttons take taps
  });

  KEYS.forEach((key, lane) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `${SWARAS[lane]} (${key.toUpperCase()})`);
    Object.assign(button.style, {
      flex: '1 1 0',
      minWidth: '0',
      minHeight: `${BUTTON_MIN_HEIGHT_PX}px`,
      height: `${BUTTON_HEIGHT_PX}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '2px',
      margin: '0',
      padding: '0',
      background: BUTTON_BG,
      border: BUTTON_BORDER,
      borderRadius: `${BUTTON_RADIUS_PX}px`,
      color: BUTTON_COLOR,
      pointerEvents: 'auto',         // the overlay is pointer-events:none, so taps need this to land
      touchAction: 'none',           // a tap must not scroll or zoom the page
      userSelect: 'none',            // a long press must not select text
      WebkitUserSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      cursor: 'pointer',
    });

    const keyLine = document.createElement('span');
    keyLine.textContent = key.toUpperCase();
    Object.assign(keyLine.style, { fontSize: `${KEY_FONT_PX}px`, fontWeight: '700', lineHeight: '1' });

    const swaraLine = document.createElement('span');
    swaraLine.textContent = SWARAS[lane];
    Object.assign(swaraLine.style, { fontSize: `${SWARA_FONT_PX}px`, lineHeight: '1', color: SWARA_COLOR });

    button.append(keyLine, swaraLine);

    const release = () => { button.style.background = BUTTON_BG; };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.style.background = BUTTON_BG_PRESSED;
      onRestartKey();   // unlock the sound, and start or restart when the title or game-over screen is up
      onLane(lane);     // the exact tap that lane's key would make
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);

    bar.append(button);
  });

  document.body.append(bar);

  // Shown only where the pointer is a finger. A stray touch on a laptop must not summon the strip.
  if (hasTouchScreen()) bar.style.display = 'flex';
}

// --- KEYBOARD
// Held keys do not repeat-fire; main.js decides what a lane tap or the restart key means.
export function createKeyboard({ onLane, onRestartKey }) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return; // holding a key must not fire taps
    if (event.ctrlKey || event.metaKey || event.altKey) return; // leave browser shortcuts alone

    if (event.code === RESTART_KEY) {
      event.preventDefault();
      onRestartKey();
      return;
    }

    const laneIndex = laneFromKey(event.key);
    if (laneIndex >= 0) {
      event.preventDefault();
      onLane(laneIndex);
    }
  });

  createTouchControls({ onLane, onRestartKey });
}
