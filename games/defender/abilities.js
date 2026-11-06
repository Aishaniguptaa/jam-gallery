// abilities.js — after each boss wave the tower takes something from the boss: pick one of two.
// Each ability is a small change to the run's numbers; main.js owns those numbers and applies them.

// Which pair is offered after which boss wave. `id` is what main.js switches on.
export const ABILITY_PICKS = {
  5: [
    { id: 'focus', name: 'Focus Barrel', text: 'Arrows fly in a much tighter cone.' },
    { id: 'plating', name: 'Stone Plating', text: '+50 max HP and a full heal.' },
  ],
  10: [
    { id: 'rapid', name: 'Rapid Fire', text: 'Shoot 40% faster.' },
    { id: 'heavy', name: 'Heavy Arrows', text: 'Every arrow hits twice as hard.' },
  ],
  15: [
    { id: 'volley', name: 'Triple Shot', text: 'Three arrows per shot.' },
    { id: 'mend', name: 'Rebuild', text: '+50 max HP and a full heal.' },
  ],
};

let overlay = null;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;' +
    'gap:24px;background:rgba(12,8,6,0.78);z-index:50;font-family:system-ui,sans-serif;color:#f4ead8;padding:16px';
  document.body.appendChild(overlay);
  return overlay;
}

// Show the pair for this boss wave; calls onPick(id) once, then hides itself.
export function showAbilityPick(bossWave, onPick) {
  const options = ABILITY_PICKS[bossWave];
  if (!options) { onPick(null); return; }

  const el = ensureOverlay();
  el.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Boss down. Take one ability.';
  title.style.cssText = 'font-size:clamp(22px,4vw,40px);font-weight:800;text-align:center';
  el.appendChild(title);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:720px';
  el.appendChild(row);

  for (const option of options) {
    const button = document.createElement('button');
    button.innerHTML = `<div style="font-size:22px;font-weight:800;margin-bottom:8px">${option.name}</div>` +
      `<div style="font-size:16px;opacity:0.85">${option.text}</div>`;
    button.style.cssText =
      'width:260px;padding:20px;border-radius:12px;border:2px solid #c9a46a;background:#2a1d14;' +
      'color:#f4ead8;cursor:pointer;text-align:left;font-family:inherit';
    button.addEventListener('pointerenter', () => { button.style.background = '#43301f'; });
    button.addEventListener('pointerleave', () => { button.style.background = '#2a1d14'; });
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      el.style.display = 'none';
      onPick(option.id);
    }, { once: true });
    row.appendChild(button);
  }

  el.style.display = 'flex';
}

export function hideAbilityPick() {
  if (overlay) overlay.style.display = 'none';
}
