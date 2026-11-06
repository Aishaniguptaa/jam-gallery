// ui.js — the DOM overlay: score, combo and lives, the orchestra panel on the left, the one-line play hint, and the title, rules and game-over screens.
import {
  LIVES, INSTRUMENTS, KEYS, SWARAS,
  INSTRUMENT_AREA_LEFT_PERCENT, INSTRUMENT_AREA_TOP_PERCENT, INSTRUMENT_AREA_WIDTH_PERCENT,
  INSTRUMENT_AREA_TITLE, INSTRUMENT_AREA_FONT_PX, INSTRUMENT_AREA_TITLE_FONT_PX,
  INSTRUMENT_AREA_ROW_GAP_PX, INSTRUMENT_AREA_PADDING_PX, INSTRUMENT_COLOR, INSTRUMENT_PENDING_COLOR,
  INSTRUMENT_TITLE_COLOR, INSTRUMENT_AREA_BACKGROUND, INSTRUMENT_AREA_BORDER,
  HINT_FONT_PX, HINT_BOTTOM_PERCENT, HINT_LEFT_PERCENT, HINT_RIGHT_PERCENT, HINT_OPACITY,
} from './tuning.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// --- BUILD: the blocks main.js shows, hides and fills
export function createUI(root) {
  const hud = el('div', 'hud');
  const score = el('div', 'hud-score', 'Score 0');
  const combo = el('div', 'hud-combo');
  const lives = el('div', 'hud-lives');
  hud.append(score, combo, lives);

  // --- THE ORCHESTRA, down the left: every instrument the makers have planned, each one bright once it is
  // playing. setInstruments() is the single way the list changes, so an instrument joining is one call.
  const area = el('div', 'instrument-area');
  Object.assign(area.style, {
    position: 'absolute',
    left: `${INSTRUMENT_AREA_LEFT_PERCENT}%`,
    top: `${INSTRUMENT_AREA_TOP_PERCENT}%`,
    width: `${INSTRUMENT_AREA_WIDTH_PERCENT}%`,
    boxSizing: 'border-box',
    padding: `${INSTRUMENT_AREA_PADDING_PX}px`,
    background: INSTRUMENT_AREA_BACKGROUND,
    border: INSTRUMENT_AREA_BORDER,
  });
  const areaTitle = el('div', 'instrument-title', INSTRUMENT_AREA_TITLE);
  Object.assign(areaTitle.style, {
    fontSize: `${INSTRUMENT_AREA_TITLE_FONT_PX}px`,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: INSTRUMENT_TITLE_COLOR,
    marginBottom: `${INSTRUMENT_AREA_ROW_GAP_PX}px`,
  });
  const list = el('div', 'instrument-list');
  Object.assign(list.style, {
    display: 'grid',
    gap: `${INSTRUMENT_AREA_ROW_GAP_PX}px`,
    fontSize: `${INSTRUMENT_AREA_FONT_PX}px`,
  });
  area.append(areaTitle, list);

  const legend = KEYS.map((key, i) => `${key.toUpperCase()} ${SWARAS[i]}`).join('   ');
  // The gold frame every screen wears: an outer rule, an inner rule and a gold spur at each corner. The
  // temple keeps playing behind the scrim, so these are decor only - hidden from screen readers.
  function screenFrame() {
    const frame = el('div', 'screen-frame');
    frame.setAttribute('aria-hidden', 'true');
    frame.append(
      el('i', 'frame-corner c-tl'), el('i', 'frame-corner c-tr'),
      el('i', 'frame-corner c-bl'), el('i', 'frame-corner c-br'),
    );
    return frame;
  }

  // The small rule under a title: two tapering lines, two studs and a diamond gem at the centre.
  function titleOrnament() {
    const ornament = el('div', 'title-ornament');
    ornament.setAttribute('aria-hidden', 'true');
    ornament.append(
      el('span', 'orn-line orn-line-left'),
      el('span', 'orn-dot'),
      el('span', 'orn-gem'),
      el('span', 'orn-dot'),
      el('span', 'orn-line orn-line-right'),
    );
    return ornament;
  }

  // --- THE TITLE: the makers' own artwork fills the screen and carries the name and the look, and the play
  // rules are written straight onto it, over the middle. SPACE begins the run from here: title -> play.
  const title = el('div', 'screen title-screen');
  title.setAttribute('aria-label', 'SaReGaMa — a rhythm journey through Hampi');
  const titleBody = el('div', 'screen-body title-body');
  titleBody.append(
    titleOrnament(),
    el('p', 'screen-line title-legend', legend),
    el('p', 'screen-line', 'The pillars travel past you on the right. When one lights up, press its key.'),
    el('p', 'screen-line', 'The right key always scores. A wrong key costs a life. Nothing else does.'),
    el('p', 'screen-line', 'Every note you land is played by your orchestra.'),
    el('p', 'screen-prompt', 'Press SPACE to begin'),
  );
  title.append(titleBody);

  // --- THE RULES: the same gold-framed screen as the title, but on near-black, so the play rules are the
  // only thing to read. It sits between the title and the run: title -> SPACE -> rules -> SPACE -> play.
  const rules = el('div', 'screen');
  Object.assign(rules.style, { background: 'rgba(6, 4, 10, 0.96)' }); // opaque enough to be a black screen
  const rulesBody = el('div', 'screen-body');
  rulesBody.append(
    el('h1', 'screen-title', 'How to Play'),
    titleOrnament(),
    el('p', 'screen-line', legend),
    el('p', 'screen-line', 'The pillars travel past you on the right. When one lights up, press its key.'),
    el('p', 'screen-line', 'The right key always scores. A wrong key costs a life. Nothing else does.'),
    el('p', 'screen-line', 'Every note you land is played by your orchestra.'),
    el('p', 'screen-prompt', 'Press SPACE to begin'),
  );
  rules.append(screenFrame(), rulesBody);

  // --- THE GAME OVER SCREEN: the makers' own artwork again, full bleed. The picture already carries GAME
  // OVER, the "SCORE" label and "Press SPACE to Play Again", and it leaves the plaque's stone bare, so the
  // one thing it cannot know - the run's real score - is the only thing the game adds, laid onto the plaque.
  const over = el('div', 'screen over-screen');
  const overBody = el('div', 'screen-body');
  const overScore = el('p', 'over-score-value', '0'); // main.js writes the run's score into this node
  const overPatch = el('div', 'over-patch');
  overPatch.append(overScore);
  overBody.append(overPatch);
  over.append(overBody);

  // The one-line hint for the first beats of a run: low contrast, in the middle band between the orchestra
  // and the pillar line, so on any window shape it sits under neither of them.
  const hint = el('div', 'play-hint', 'Press the key of the pillar that lights up.');
  Object.assign(hint.style, {
    position: 'absolute',
    left: `${HINT_LEFT_PERCENT}%`,
    right: `${HINT_RIGHT_PERCENT}%`,
    bottom: `${HINT_BOTTOM_PERCENT}%`,
    textAlign: 'center',
    fontSize: `${HINT_FONT_PX}px`,
    color: '#ecd9b4', // the warm parchment-cream of the temple's body text, matching #ui
    opacity: String(HINT_OPACITY),
  });

  // --- THE PORTAL: the one line that says the orchestra just grew. It fades in over the middle of the
  // screen - clear of the orchestra panel on the left and the pillar line on the right - and fades out
  // again; main.js owns how long it stays. Opacity, not hidden, so it can fade both ways.
  const portal = el('div', 'portal-line');
  Object.assign(portal.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    top: '40%',
    textAlign: 'center',
    fontSize: '23px',
    letterSpacing: '0.14em',
    color: '#ffe6b8',
    textShadow: '0 0 20px rgba(255, 205, 130, 0.7)',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 320ms ease',
  });

  root.append(hud, area, hint, portal, title, rules, over);

  const ui = { score, combo, lives, area, list, hint, portal, title, rules, over, overScore };
  over.hidden = true; // the game-over screen only appears when a run ends
  rules.hidden = true; // and the rules only between the title and the run
  hint.hidden = true; // and the play hint only while a run is on
  updateHud(ui, { score: 0, lives: LIVES, combo: 0 });
  setInstruments(ui, 1);
  return ui;
}

// --- THE ORCHESTRA PANEL: the makers' list, the instruments that have joined in full colour and the ones
// still to come dimmed. joinedCount is all a portal has to raise by one.
export function setInstruments(ui, joinedCount) {
  const joined = Math.max(0, Math.min(INSTRUMENTS.length, joinedCount));
  ui.list.replaceChildren(...INSTRUMENTS.map((name, index) => {
    const row = el('div', 'instrument-row', name);
    row.style.color = index < joined ? INSTRUMENT_COLOR : INSTRUMENT_PENDING_COLOR;
    return row;
  }));
}

export function showPlayHint(ui, visible) {
  ui.hint.hidden = !visible;
}

// --- THE PORTAL LINE: "A portal opens - Sitar joins the orchestra". shown is whether it should be up;
// the name is only read when it is, so main.js can hold one string and not rebuild it every frame.
export function showPortal(ui, shown, instrumentName) {
  if (shown && instrumentName) ui.portal.textContent = `A portal opens — ${instrumentName} joins the orchestra`;
  ui.portal.style.opacity = shown ? '1' : '0';
}

// --- NUMBERS ON SCREEN, straight from the state main.js owns
export function updateHud(ui, { score, lives, combo }) {
  const full = Math.max(0, lives);
  ui.score.textContent = `Score ${score}`;
  ui.lives.textContent = `Lives ${'♥'.repeat(full)}${'♡'.repeat(Math.max(0, LIVES - full))}`;
  ui.combo.textContent = combo > 1 ? `Combo x${combo}` : '';
}

export function showTitle(ui, visible) {
  ui.title.hidden = !visible;
}

export function showRules(ui, visible) {
  ui.rules.hidden = !visible;
}

export function showGameOver(ui, visible, score) {
  ui.overScore.textContent = String(score);
  ui.over.setAttribute('aria-label', `Game over. Score ${score}. Press SPACE to play again.`);
  ui.over.hidden = !visible;
}
