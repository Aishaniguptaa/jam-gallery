// ui.js — the HUD: wave counter, base HP bar, red damage flash, wave announcement, game-over and win overlays.

const el = {}; // cached page elements, filled in by initUI()

// Grab every HUD element once, when the page is ready.
export function initUI() {
  el.wave = document.getElementById('wave-value');
  el.hpBar = document.getElementById('hp-bar');
  el.hpLabel = document.getElementById('hp-label');
  el.gameOver = document.getElementById('game-over');
  el.gameOverWave = document.getElementById('go-wave');
  el.flash = document.getElementById('damage-flash');
  el.waveAnnounce = document.getElementById('wave-announce');
  el.win = document.getElementById('win-screen');
  el.winWave = document.getElementById('win-wave');
  el.winTime = document.getElementById('win-time');
}

// Draw the current run's numbers: the wave reached and how much base health is left.
export function updateUI({ wave, hp, maxHp }) {
  el.wave.textContent = wave;

  const percent = Math.max(0, Math.min(1, hp / maxHp)) * 100;
  el.hpBar.style.width = percent + '%';
  el.hpLabel.textContent = `HP ${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
}

// Big "Wave N" in the middle of the screen, shown during the pause between waves.
export function showWaveAnnounce(wave) {
  el.waveAnnounce.textContent = `Wave ${wave}`;
  el.waveAnnounce.hidden = false;
}

// Clear the announcement when the wave actually starts.
export function hideWaveAnnounce() {
  el.waveAnnounce.hidden = true;
}

// Show the end-of-run overlay with the wave the player reached.
export function showGameOver(wave) {
  el.gameOverWave.textContent = wave;
  el.gameOver.hidden = false;
}

// Hide the overlay again (used by restart).
export function hideGameOver() {
  el.gameOver.hidden = true;
}

// Show the end-of-run overlay for a run that held the rig: the wave reached and how long it took.
export function showWin(wave, seconds) {
  el.winWave.textContent = wave;
  el.winTime.textContent = seconds.toFixed(1) + 's';
  el.win.hidden = false;
}

// Hide the win overlay again (used by restart).
export function hideWin() {
  el.win.hidden = true;
}

// One quick red blink over the whole screen when the base takes damage.
export function flashBaseDamage() {
  el.flash.classList.remove('flash');
  void el.flash.offsetWidth; // reading the layout restarts the CSS animation
  el.flash.classList.add('flash');
}
