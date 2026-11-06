// ui.js — all of Starborne Nursery's on-screen text and screens: the dock sign (countdown, hunger, stage, feed, status), the title screen and the sky train's shop.
// It imports nothing and knows no prices: the shop's whole catalogue, tabs and all, arrives from the caller on every open.


const CSS = `
  /* The makers asked for a pixel face. Silkscreen is one, and it is the only file this game loads
     that it did not draw or write itself: a 32 KB TrueType face under the SIL Open Font License 1.1,
     credited in meta.json with its source and kept beside this file in fonts/, so it needs no
     network at run time and nothing to license at judging time. The path is relative to index.html,
     which is where this style block ends up living. */
  @font-face {
    font-family: "Silkscreen";
    src: url("./fonts/Silkscreen-Regular.ttf") format("truetype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  /* The makers' palette: the panels are the night sky the creatures are launched into, not a white
     card held in front of it. Deep navy, cream text, and a four-pointed star through the panels as
     a motif. Every surface below reads from these, so one change here moves the whole interface. */
  :root {
    --ui-navy: rgba(16, 29, 56, 0.88);
    --ui-navy-solid: rgba(13, 23, 46, 0.97);
    --ui-cream: #f3e7cd;
    --ui-cream-dim: rgba(243, 231, 205, 0.74);
    --ui-edge: rgba(243, 231, 205, 0.2);
    --ui-shadow: 0 10px 26px rgba(6, 12, 24, 0.45);
    --ui-gold: #f2c94c;
    --ui-coins: #e8b87a;
    --ui-mint: #bfe3a8;
    /* One four-pointed star, drawn as a data URI so it needs no file and no request: the faint one
       tiles across a panel as a starfield, the bright one is the motif's single accent. The faint
       star sits small inside its own box (the viewBox is padded around it), so tiling it leaves a
       sky with a few stars in it rather than a pattern of blobs. */
    --ui-star: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-14 -14 52 52'%3E%3Cpath d='M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z' fill='%23f2c94c' fill-opacity='0.11'/%3E%3C/svg%3E");
    --ui-star-bright: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z' fill='%23f2c94c' fill-opacity='0.85'/%3E%3C/svg%3E");
  }

  /* Silkscreen for every word on the screen, headings down to the smallest note. A pixel face wants
     one size or two rather than a range, so the fine print sits at 12px and stays legible there;
     below that the pixels mush together and a price stops being readable, which is a bug and not a
     style. The old fantasy stack stays behind it as a fallback if the file ever fails to load. */
  .ui-root {
    position: fixed; inset: 0; pointer-events: none; z-index: 10;
    font-family: "Silkscreen", "Luminari", "Papyrus", "Gabriola", fantasy,
      system-ui, sans-serif;
    color: var(--ui-cream); -webkit-user-select: none; user-select: none;
  }

  .ui-panel {
    position: absolute; padding: 10px 14px;
    background-color: var(--ui-navy);
    background-image: var(--ui-star);
    background-repeat: repeat; background-size: 88px 88px;
    border: 1px solid var(--ui-edge);
    border-radius: 14px;
    box-shadow: var(--ui-shadow);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }

  /* Bottom-centre: the dock sign, the player's main readout. */
  .ui-sign {
    position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%);
    min-width: 200px; padding: 10px 24px; text-align: center;
    background-color: var(--ui-navy);
    background-image: var(--ui-star);
    background-repeat: repeat; background-size: 88px 88px;
    border: 1px solid var(--ui-edge);
    border-radius: 16px;
    box-shadow: var(--ui-shadow);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .ui-countdown {
    font-size: 24px; font-weight: 700; line-height: 1.15;
    color: var(--ui-cream-dim); font-variant-numeric: tabular-nums;
  }
  .ui-status {
    margin-top: 2px; min-height: 20px; font-size: 15px; font-weight: 700;
    letter-spacing: 0.04em; color: var(--ui-mint);
    opacity: 0; transition: opacity 0.2s ease;
  }
  .ui-status.is-on { opacity: 1; }

  /* The top hint line: quiet, and gone completely when there is nothing to say. */
  .ui-note {
    display: none; margin-bottom: 3px; font-size: 13px; line-height: 1.25;
    letter-spacing: 0.03em; color: var(--ui-cream-dim); opacity: 0.85;
  }
  .ui-note.is-on { display: block; }

  /* One compact row: the hunger meter, then the creature's stage name beside it. */
  .ui-readout {
    display: flex; align-items: center; justify-content: center; gap: 9px;
    margin-top: 7px;
  }
  .ui-meter {
    width: 140px; height: 10px; border-radius: 999px; overflow: hidden;
    background: rgba(243, 231, 205, 0.18);
  }
  .ui-meter-fill {
    width: 0%; height: 100%; border-radius: 999px;
    background: #6a8f4e; transition: width 0.3s ease, background 0.3s ease;
  }
  .ui-stage {
    font-size: 12px; font-weight: 700; line-height: 1; letter-spacing: 0.06em;
    color: var(--ui-cream-dim); white-space: nowrap;
  }
  /* The four stocks the player is carrying, out of the sign and up into the top-right corner: the
     sign is what this moment is saying, and these are what the player has. Stacked in a column and
     right-aligned, so the four numbers line up on their last digit and read as one list. */
  .ui-stats {
    position: absolute; top: 18px; right: 18px;
    display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
    padding: 9px 14px; min-height: 17px;
    background-color: var(--ui-navy);
    background-image: var(--ui-star);
    background-repeat: repeat; background-size: 88px 88px;
    border: 1px solid var(--ui-edge);
    border-radius: 14px;
    box-shadow: var(--ui-shadow);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
    color: var(--ui-cream-dim); opacity: 0.85; font-variant-numeric: tabular-nums;
  }
  /* Starlight is the one number the doc lets grow, and it is earned only by launching. */
  .ui-starlight { color: var(--ui-gold); }
  /* Coins are the train's money, so they read as struck metal next to the starlight's gold. */
  .ui-coins { color: var(--ui-coins); }
  /* A stat the player has none of yet fades back, so a fresh run's sign is not a row of zeros. It
     comes back the moment there is something of it to read. */
  .ui-coins.is-empty, .ui-seeds.is-empty { opacity: 0.35; }

  /* The title screen: it fades in and is the only clickable thing. */
  .ui-screen {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    padding: 24px; text-align: center;
    background: rgba(16, 29, 56, 0.4);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(8px);
    transition: opacity 0.45s ease, transform 0.45s ease, visibility 0.45s;
  }
  .ui-screen.is-on { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0); }

  .ui-card {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    max-width: min(560px, 88vw); padding: clamp(22px, 4vw, 36px) clamp(26px, 6vw, 54px);
    background-color: var(--ui-navy-solid);
    background-image: var(--ui-star);
    background-repeat: repeat; background-size: 118px 118px;
    border: 1px solid var(--ui-edge);
    border-radius: 24px;
    box-shadow: var(--ui-shadow);
  }
  .ui-card h1 {
    margin: 0; font-size: clamp(32px, 6.5vw, 60px); font-weight: 700;
    line-height: 1.1; color: var(--ui-cream);
  }
  /* The rule under the title is the motif's one bright accent: a four-pointed star rather than a bar. */
  .ui-rule {
    width: 34px; height: 34px;
    background-image: var(--ui-star-bright);
    background-repeat: no-repeat; background-position: center; background-size: contain;
  }
  .ui-sub { margin: 0; font-size: clamp(15px, 2.2vw, 19px); line-height: 1.4; color: var(--ui-cream); opacity: 0.88; }
  /* First launch: the player names the Caretaker. Optional — it falls back to "Caretaker". */
  .ui-name {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    margin: 4px 0 0;
  }
  .ui-name span {
    font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ui-cream-dim); opacity: 0.8;
  }
  .ui-name-input {
    width: 200px; padding: 8px 12px; text-align: center;
    font: inherit; font-size: 16px; color: var(--ui-cream);
    background: rgba(243, 231, 205, 0.1);
    border: 1px solid var(--ui-edge); border-radius: 10px;
    outline: none; -webkit-user-select: text; user-select: text;
  }
  .ui-name-input:focus {
    border-color: #f2c94c; box-shadow: 0 0 0 3px rgba(242, 201, 76, 0.25);
  }

  .ui-hint {
    margin: 8px 0 0; font-size: 14px; letter-spacing: 0.06em; color: var(--ui-cream);
    animation: ui-breathe 2.6s ease-in-out infinite;
  }
  @keyframes ui-breathe {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  /* The sky train's shop. It borrows the title screen's show/hide and its fade, but none of its
     paint: the makers still want to watch the island and the train while they trade, so the scrim
     is clear and the card sits low and small instead of filling the screen. The clear scrim still
     takes the clicks, which is what keeps a stray one off the canvas behind the panel. */
  .ui-screen.ui-shop {
    align-items: flex-end; justify-content: center; padding: 0 24px 24px;
    background: transparent;
    backdrop-filter: none; -webkit-backdrop-filter: none;
  }
  /* Smaller than the title card and low on the screen, so everything above it stays in view. */
  .ui-shop-card {
    display: flex; flex-direction: column; gap: 8px;
    width: min(420px, 92vw); padding: 16px 20px 14px;
    /* Nearly opaque, not translucent: the dock sign sits behind this card and its own lines were
       showing through the price rows while the player was reading them. */
    background-color: var(--ui-navy-solid);
    background-image: var(--ui-star);
    background-repeat: repeat; background-size: 118px 118px;
    border: 1px solid var(--ui-edge);
    border-radius: 24px;
    box-shadow: var(--ui-shadow);
    text-align: left;
  }
  .ui-shop-card h2 { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.1; color: var(--ui-cream); }
  .ui-shop-flavour { margin: 0; font-size: 13px; line-height: 1.3; color: var(--ui-cream-dim); }
  /* What the player holds, in the dock sign's own tabular figures so the two read alike. It sits
     above the rows and outside the tab switch: the numbers must not move while the player looks
     from one tab to another. */
  .ui-shop-hold {
    margin-top: 2px; padding: 6px 10px; border-radius: 12px;
    background: rgba(243, 231, 205, 0.1);
    font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
    color: var(--ui-cream-dim); font-variant-numeric: tabular-nums;
  }
  /* The two currencies keep the dock sign's colours in here, because beside them a price has to be
     telling the truth about which purse it comes out of. */
  .ui-shop-hold .ui-shop-coins { color: var(--ui-coins); }
  .ui-shop-hold .ui-shop-starlight { color: var(--ui-gold); }

  /* The tab bar: three even pills across the card, the open one in the shop's own yellow. */
  .ui-shop-tabs { display: flex; gap: 6px; }
  .ui-shop-tabs:empty { display: none; }
  .ui-shop-tab {
    flex: 1 1 0; padding: 6px 8px;
    font: inherit; font-size: 13px; font-weight: 700; color: var(--ui-cream-dim);
    background: rgba(243, 231, 205, 0.08);
    border: 1px solid var(--ui-edge); border-radius: 10px;
    cursor: pointer;
  }
  .ui-shop-tab:not(.is-on):hover { background: rgba(243, 231, 205, 0.16); }
  .ui-shop-tab.is-on {
    color: #101d38; background: rgba(242, 201, 76, 0.92);
    border-color: var(--ui-gold);
  }

  /* The open tab's rows, and no more than a handful of them: the card never scrolls. */
  .ui-shop-rows { display: flex; flex-direction: column; gap: 6px; }
  .ui-shop-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--ui-cream); }
  /* The digit bound to this row, so the row is readable as well as clickable. A row with no digit
     keeps the box, invisible, so every label still starts at the same place. */
  .ui-shop-key {
    flex: none; width: 20px; height: 20px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: var(--ui-cream-dim);
    background: rgba(243, 231, 205, 0.14);
  }
  .ui-shop-key:empty { visibility: hidden; }
  .ui-shop-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
  .ui-shop-label { overflow-wrap: anywhere; }
  /* The optional half-line under a label: why this row is the way it is. Smaller and dimmer, so it
     reads as a footnote to the label and never as a second row to buy. */
  .ui-shop-note { margin-top: 1px; font-size: 12px; line-height: 1.3; opacity: 0.68; }
  .ui-shop-price { flex: none; font-size: 13px; opacity: 0.82; font-variant-numeric: tabular-nums; }
  /* A price in coins and a price in starlight are never allowed to look alike. */
  .ui-shop-price.is-coins { color: var(--ui-coins); opacity: 1; }
  .ui-shop-price.is-starlight { color: var(--ui-gold); opacity: 1; }
  .ui-shop-btn {
    flex: none; min-width: 62px; padding: 6px 12px;
    font: inherit; font-size: 13px; font-weight: 700; color: #101d38;
    background: rgba(242, 201, 76, 0.9);
    border: 1px solid rgba(107, 74, 47, 0.35); border-radius: 10px;
    cursor: pointer;
  }
  .ui-shop-btn:not([disabled]):hover { background: #f2c94c; }
  /* A row the player cannot pay for yet: dim, but the click still lands, so the shop can answer with
     what is missing instead of going quiet. Only 'in use' and 'nothing more to buy' carry the real
     disabled attribute, and those two are genuinely dead. */
  .ui-shop-btn.is-off { opacity: 0.4; }
  .ui-shop-btn[disabled] { cursor: default; }
  /* Close is not a purchase, so it stays the quiet one of the four: cream on navy rather than gold. */
  .ui-shop-close { background: rgba(243, 231, 205, 0.14); color: var(--ui-cream); }
  .ui-shop-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin-top: 2px;
  }
  .ui-shop-hint { margin: 0; font-size: 12px; letter-spacing: 0.04em; color: var(--ui-cream-dim); opacity: 0.7; }

  /* A phone: the card takes what width there is and the rows lose a little air, rather than the
     label, the price and the button being squeezed onto two lines each. */
  @media (max-width: 460px) {
    .ui-screen.ui-shop { padding: 0 12px 12px; }
    /* Still 92vw and not 100%: the card's padding sits outside that width, and a phone cannot
       spare the 26px it would add. */
    .ui-shop-card { width: min(420px, 92vw); padding: 12px 12px 10px; gap: 6px; }
    .ui-shop-tabs { gap: 4px; }
    .ui-shop-tab { padding: 6px 4px; font-size: 12px; }
    .ui-shop-hold { font-size: 12px; padding: 6px 8px; }
    .ui-shop-row { gap: 8px; font-size: 13px; }
    .ui-shop-key { width: 18px; height: 18px; }
    .ui-shop-price { font-size: 12px; }
    .ui-shop-btn { min-width: 54px; padding: 6px 9px; font-size: 12px; }
    .ui-shop-hint { font-size: 11px; }
  }
`;

// Hunger meter colours: comfortable, warm, then a gentle tired coral. Never alarming.
const METER_COMFORT = '#6a8f4e'; // above 0.5
const METER_WARM = '#f2c94c'; // 0.25 to 0.5
const METER_TIRED = '#d9776a'; // below 0.25

export function createUI() {
  const style = document.createElement('style');
  style.id = 'ui-styles';
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'ui-root';
  root.innerHTML = `
    <div class="ui-sign">
      <div class="ui-note"></div>
      <div class="ui-countdown">Train in --</div>
      <div class="ui-readout">
        <div class="ui-meter"><div class="ui-meter-fill"></div></div>
        <div class="ui-stage"></div>
      </div>
      <div class="ui-status"></div>
    </div>
    <!-- Everything the player is carrying, in a panel of its own up in the top-right corner rather
         than inside the sign: the sign says what this moment is, and these say what the player has.
         Still written every frame by setFeed, setSeeds, setCoins and setStarlight. -->
    <div class="ui-stats">
      <div class="ui-feed">Feed --</div>
      <div class="ui-seeds is-empty">Seeds 0</div>
      <div class="ui-coins is-empty">Coins 0</div>
      <div class="ui-starlight">Starlight 0</div>
    </div>
    <div class="ui-screen ui-title">
      <div class="ui-card">
        <h1>Starborne Nursery</h1>
        <div class="ui-rule"></div>
        <p class="ui-sub">Rotate the island. Line up the tracks. Send them home.</p>
        <label class="ui-name">
          <span>Name your Caretaker</span>
          <input class="ui-name-input" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Caretaker" />
        </label>
        <p class="ui-hint">Click or press Space to begin</p>
      </div>
    </div>
    <div class="ui-screen ui-shop">
      <div class="ui-shop-card">
        <h2 class="ui-shop-title">The sky train</h2>
        <p class="ui-shop-flavour">It trades in crops, starlight and things for the garden.</p>
        <div class="ui-shop-tabs" role="tablist"></div>
        <div class="ui-shop-hold"></div>
        <div class="ui-shop-rows"></div>
        <div class="ui-shop-foot">
          <p class="ui-shop-hint">Tab and arrows switch &#183; E or Escape closes</p>
          <button class="ui-shop-btn ui-shop-close" type="button">Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const noteEl = root.querySelector('.ui-note');
  const countdownEl = root.querySelector('.ui-countdown');
  const meterFillEl = root.querySelector('.ui-meter-fill');
  const stageEl = root.querySelector('.ui-stage');
  const feedEl = root.querySelector('.ui-feed');
  const seedsEl = root.querySelector('.ui-seeds');
  const coinsEl = root.querySelector('.ui-coins');
  const starlightEl = root.querySelector('.ui-starlight');
  const statusEl = root.querySelector('.ui-status');
  const titleScreen = root.querySelector('.ui-title');
  const nameInput = root.querySelector('.ui-name-input');
  const shopScreen = root.querySelector('.ui-shop');
  const shopTitleEl = root.querySelector('.ui-shop-title');
  const shopFlavourEl = root.querySelector('.ui-shop-flavour');
  const shopTabsEl = root.querySelector('.ui-shop-tabs');
  const shopHoldEl = root.querySelector('.ui-shop-hold');
  const shopRowsEl = root.querySelector('.ui-shop-rows');
  const shopCloseBtn = root.querySelector('.ui-shop-close');

  let screen = 'none'; // 'none' | 'start' | 'playing'
  // The shop's own memory: the last numbers and the last catalogue the caller handed in, so the
  // panel has nothing of its own to fall out of step with the run — and the open tab, so that
  // switching tabs and refreshing never send the player back to the first one.
  let shopHold = { coins: 0, starlight: 0, feed: 0, seeds: 0 };
  let shopTabs = [];
  let shopTab = '';
  let shopTitle = 'The sky train';
  let shopFlavour = 'It trades in crops, starlight and things for the garden.';
  let shopOpen = false;

  const ui = {
    // The caller assigns this. It starts as null and is always guarded before being called.
    onStart: null,

    setCountdown(seconds) {
      const s = Number(seconds);
      countdownEl.textContent = Number.isFinite(s)
        ? `Train in ${Math.max(0, Math.ceil(s))}s`
        : 'Train in --';
    },

    setStatus(text) {
      const t = text == null ? '' : String(text);
      statusEl.textContent = t;
      statusEl.classList.toggle('is-on', t !== '');
    },

    // Hunger, 0..1. Anything that is not a finite number counts as empty.
    setHunger(ratio) {
      const n = Number(ratio);
      const filled = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
      meterFillEl.style.width = (filled * 100).toFixed(1) + '%';
      meterFillEl.style.background =
        filled > 0.5 ? METER_COMFORT : filled >= 0.25 ? METER_WARM : METER_TIRED;
    },

    // The creature's stage name, shown in small letters beside the meter.
    setStage(name) {
      stageEl.textContent = name == null ? '' : String(name);
    },

    // How much feed is in stock.
    setFeed(count) {
      const n = Number(count);
      const stock = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      feedEl.textContent = 'Feed ' + stock;
    },

    // Seeds, in stock the same way feed is. The player grows from nothing, so it starts faded back
    // like the coins - a sign with no seeds on it yet is not a number worth reading.
    setSeeds(count) {
      const n = Number(count);
      const stock = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      seedsEl.textContent = 'Seeds ' + stock;
      seedsEl.classList.toggle('is-empty', stock === 0);
    },

    // Starlight: earned only by launching, per the design doc. Not a score — it just grows.
    setStarlight(count) {
      const n = Number(count);
      const total = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      starlightEl.textContent = 'Starlight ' + total;
    },

    // Coins: what the train pays for feed. Like starlight it is a stock, not a score, so it is
    // shown the same way — but it starts at nothing and stays faded back until it is worth
    // reading, which keeps a fresh run's sign quiet.
    setCoins(count) {
      const n = Number(count);
      const total = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      coinsEl.textContent = 'Coins ' + total;
      coinsEl.classList.toggle('is-empty', total === 0);
    },

    // Prefill the name field, for a player who has been here before.
    prefillName(name) {
      nameInput.value = name == null ? '' : String(name);
    },

    // One short line at the top of the sign. Empty or null clears it and hides it.
    setHint(text) {
      const t = text == null ? '' : String(text);
      noteEl.textContent = t;
      noteEl.classList.toggle('is-on', t !== '');
    },

    showStart() {
      screen = 'start';
      titleScreen.classList.add('is-on');
    },

    showPlaying() {
      screen = 'playing';
      titleScreen.classList.remove('is-on');
    },

    // --- The sky train's shop ------------------------------------------------------------------
    // The caller assigns these two. Both start null and are guarded before every call.
    onShopBuy: null,   // (id) -> new state, or nothing to leave the panel as it is
    onShopSell: null,  // () -> new state, same rules

    // Open the panel on a catalogue: { hold, tabs, tab }. The hold is what the player has, the tabs
    // are what the train is offering, and tab names the one to open on. Leave tab out and the panel
    // keeps whichever tab the player was on last. ui.js knows this shape and no prices: everything
    // the rows say comes from here.
    openShop(options) {
      readShop(options);
      shopOpen = true;
      renderShop();
      shopScreen.classList.add('is-on');
    },

    // A fresh catalogue for a panel that may or may not be up. Anything the caller leaves out is
    // left alone, and the open tab is kept, so a purchase redraws the numbers without moving the
    // player's view. Closed, the catalogue is still kept for the next open.
    refreshShop(options) {
      readShop(options);
      if (shopOpen) renderShop();
    },

    closeShop() {
      shopOpen = false;
      shopScreen.classList.remove('is-on');
    },

    isShopOpen() {
      return shopOpen;
    },

    // Press a row by its id. A click, a digit and the caller all come through here, so there is
    // one path to a purchase and not three. The handler's return value IS the new state, so a
    // handler that returns nothing leaves the panel showing exactly what it showed a moment ago.
    shopBuy(id) {
      if (!shopOpen) return; // the rows only mean anything while the panel is up
      const next = typeof ui.onShopBuy === 'function' ? ui.onShopBuy(id) : null;
      if (next) readShop(next);
      renderShop();
    },

    // Sell a feed back to the train: the same shape as a buy, with its own handler.
    shopSell() {
      if (!shopOpen) return;
      const next = typeof ui.onShopSell === 'function' ? ui.onShopSell() : null;
      if (next) readShop(next);
      renderShop();
    },
  };

  // --- Reading the caller's catalogue ----------------------------------------------------------
  // Everything the caller hands in is normalised once, on the way in, so the draw below only ever
  // handles whole numbers and known strings: a missing price or a NaN can dim a row but can never
  // break the panel.
  const HOLD_KEYS = ['coins', 'starlight', 'feed', 'seeds'];

  function whole(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  // A number the caller actually gave us, or null for one it did not. null is not zero: it means
  // the caller never mentioned that purse, so nothing in it can be called too expensive.
  function given(value) {
    if (value == null) return null; // "not mentioned" is not the same as "none of it"
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }

  function readHold(source) {
    const o = source || {};
    if (!HOLD_KEYS.some((k) => o[k] != null)) return null; // nothing said: keep what we have
    const hold = {};
    for (const k of HOLD_KEYS) hold[k] = given(o[k]);
    return hold;
  }

  function readTabs(list) {
    const tabs = [];
    for (const entry of (Array.isArray(list) ? list : [])) {
      if (!entry) continue;
      const id = entry.id == null ? 'tab' + tabs.length : String(entry.id);
      const rows = [];
      for (const r of (Array.isArray(entry.rows) ? entry.rows : [])) {
        if (!r || r.id == null) continue; // a row with no id could never be pressed or charged
        rows.push({
          id: String(r.id),
          key: r.key == null ? '' : String(r.key),
          label: r.label == null ? String(r.id) : String(r.label),
          price: whole(r.price),
          currency: r.currency == null ? '' : String(r.currency),
          verb: r.verb == null ? 'Buy' : String(r.verb),
          note: r.note == null ? '' : String(r.note),
          state: r.state == null ? 'buy' : String(r.state),
        });
      }
      tabs.push({ id, label: entry.label == null ? id : String(entry.label), rows });
    }
    return tabs;
  }

  // One reader for both openShop and refreshShop, because the caller sends the same shape to both.
  // The flat shape main.js used to send, { coins, feed, seeds }, still reads as a hold on its own,
  // so an older call brings the numbers in even if it brings no catalogue.
  function readShop(options) {
    const o = options || {};
    const hold = readHold(o.hold || (Array.isArray(o.tabs) ? null : o));
    if (hold) shopHold = hold;
    if (Array.isArray(o.tabs)) {
      shopTabs = readTabs(o.tabs);
      if (!shopTabs.some((tab) => tab.id === shopTab)) shopTab = ''; // the open tab has gone
    }
    if (o.tab != null && shopTabs.some((tab) => tab.id === String(o.tab))) shopTab = String(o.tab);
    if (!shopTab && shopTabs.length) shopTab = shopTabs[0].id;
    // The panel is not only the train's: the pool opens it too, to ask which egg goes in the water.
    // A caller that wants a different heading says so; one that says nothing gets the train's, which
    // is what every trade before the pool was.
    if (o.title != null) shopTitle = String(o.title);
    if (o.flavour != null) shopFlavour = String(o.flavour);
  }

  // --- Drawing the panel -----------------------------------------------------------------------
  function openTab() {
    return shopTabs.find((tab) => tab.id === shopTab) || null;
  }

  // A row is usable only while the player can pay its own price out of its own currency and
  // nothing else stops it: 'worn' is already in use and 'max' is nothing more to buy.
  function rowView(row) {
    const worn = row.state === 'worn';
    const maxed = row.state === 'max';
    const purse = shopHold[row.currency];
    const poor = !worn && !maxed && purse != null && purse < row.price;
    return {
      off: worn || maxed,
      // Dim, but still pressable. A disabled button says nothing at all, and the makers read a shop
      // row that could not be pressed as a broken button: now the press travels to main.js, which
      // answers with what is missing. Only 'in use' and 'nothing more to buy' are truly dead.
      dim: worn || maxed || poor,
      label: worn ? row.label + ' (in use)' : row.label,
    };
  }

  function holdNum(key) {
    const n = shopHold[key];
    return n == null ? 0 : n;
  }

  function holdSpan(label, key, klass) {
    const span = document.createElement('span');
    if (klass) span.className = klass;
    span.textContent = label + ' ' + holdNum(key);
    return span;
  }

  // The hold line: always the same four numbers in the same order, whatever tab is open.
  function drawHold() {
    const parts = [
      holdSpan('Coins', 'coins', 'ui-shop-coins'),
      holdSpan('Starlight', 'starlight', 'ui-shop-starlight'),
      holdSpan('Feed', 'feed', ''),
      holdSpan('Seeds', 'seeds', ''),
    ];
    shopHoldEl.replaceChildren();
    parts.forEach((part, i) => {
      if (i) shopHoldEl.append('  ·  ');
      shopHoldEl.append(part);
    });
  }

  function drawTabs() {
    shopTabsEl.replaceChildren();
    for (const tab of shopTabs) {
      const on = tab.id === shopTab;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-shop-tab';
      btn.dataset.shopTab = tab.id; // so a probe can find the bar without guessing at the order
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
      btn.textContent = tab.label;
      btn.addEventListener('click', (e) => { dropFocus(e); selectTab(tab.id); });
      shopTabsEl.append(btn);
    }
  }

  function rowEl(row) {
    const view = rowView(row);
    const el = document.createElement('div');
    el.className = 'ui-shop-row';
    el.dataset.shopRow = row.id;

    const key = document.createElement('span');
    key.className = 'ui-shop-key';
    key.textContent = row.key;

    const text = document.createElement('span');
    text.className = 'ui-shop-text';
    const label = document.createElement('span');
    label.className = 'ui-shop-label';
    label.textContent = view.label;
    text.append(label);
    if (row.note) {
      const note = document.createElement('span');
      note.className = 'ui-shop-note';
      note.textContent = row.note;
      text.append(note);
    }

    // The price with its currency spelled out, and coloured by that currency: "10 coins" and
    // "10 starlight" are two different things and must never read as one.
    const price = document.createElement('span');
    price.className = 'ui-shop-price' + (row.currency ? ' is-' + row.currency : '');
    price.textContent = row.currency ? row.price + ' ' + row.currency : String(row.price);
    // A row with neither a price nor a currency is not for sale - it is a choice, like one of the
    // eggs the Caretaker is carrying. An empty "0" beside it would read as a price of nothing.
    if (!row.currency && !Number(row.price)) price.hidden = true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-shop-btn';
    btn.textContent = row.verb;
    btn.disabled = view.off;
    btn.classList.toggle('is-off', view.dim);
    btn.addEventListener('click', (e) => {
      dropFocus(e);
      if (view.off) return;
      pressRow(row);
    });

    el.append(key, text, price, btn);
    return el;
  }

  // Draw the whole panel from what we hold. Three or four rows are nothing to build, and drawing
  // the lot means a tab switch and a refresh are the same code path with no stale row left behind.
  function renderShop() {
    shopTitleEl.textContent = shopTitle;
    shopFlavourEl.textContent = shopFlavour;
    drawHold();
    drawTabs();
    const tab = openTab();
    shopRowsEl.replaceChildren(...(tab ? tab.rows.map(rowEl) : []));
  }

  function selectTab(id) {
    if (id === shopTab) return;
    if (!shopTabs.some((tab) => tab.id === id)) return;
    shopTab = id;
    renderShop();
  }

  function cycleTab(step) {
    if (shopTabs.length < 2) return;
    const at = shopTabs.findIndex((tab) => tab.id === shopTab);
    const next = (Math.max(0, at) + step + shopTabs.length) % shopTabs.length;
    selectTab(shopTabs[next].id);
  }

  // A pressed row asks the panel exactly the way a click does, so there is one path to a purchase
  // and not two. 'sell' is the one id that means the sell handler; every other id is a buy.
  function pressRow(row) {
    if (row.id === 'sell') ui.shopSell();
    else ui.shopBuy(row.id);
  }

  function fireStart() {
    // The typed name rides along with the start. Blank is fine; GameState falls back.
    if (typeof ui.onStart === 'function') ui.onStart(nameInput.value);
  }

  // The shop's clicks. The buttons are the only interactive things in the panel, and each one asks
  // the ui the same way the keyboard does, so there is one path to a purchase and not two.
  //
  // A clicked button would otherwise keep the focus, and the next press of Space - the key that
  // starts the game - would press it again and quietly buy something. A real mouse click reports
  // detail > 0, so only those let the focus go; a keyboard press keeps it.
  function dropFocus(e) {
    if (e.detail > 0) e.currentTarget.blur();
  }
  shopCloseBtn.addEventListener('click', (e) => { dropFocus(e); ui.closeShop(); });

  // The shop's own keys. Tab and the left/right arrows move along the tab bar; a digit presses a
  // row of the OPEN tab and nothing else — a digit that tab does not use does nothing, and never
  // falls through to a row of another tab. Those presses stop here rather than travelling on, so a
  // second handler cannot buy the same thing a second time. Escape closes the panel.
  window.addEventListener('keydown', (e) => {
    if (!shopOpen || e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); ui.closeShop(); return; }
    if (e.key === 'Tab') { e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); cycleTab(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); cycleTab(1); return; }
    if (!/^[1-9]$/.test(e.key)) return;
    e.preventDefault();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    const tab = openTab();
    const row = tab ? tab.rows.find((r) => r.key === e.key) : null;
    if (row && !rowView(row).off) pressRow(row);
  });

  // A click anywhere on the title card begins the game — except in the name field, where a
  // click means the player wants to type, not to start.
  titleScreen.addEventListener('click', (e) => {
    if (screen !== 'start') return;
    if (e.target === nameInput) return;
    fireStart();
  });

  // Enter in the name field begins: it is the natural end of typing a name.
  nameInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || screen !== 'start') return;
    e.preventDefault();
    fireStart();
  });

  // Space begins, from anywhere except the name field — there it is just a space.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (document.activeElement === nameInput) return;
    const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';

    if (screen === 'start' && isSpace) {
      e.preventDefault();
      fireStart();
    }
  });

  return ui;
}
