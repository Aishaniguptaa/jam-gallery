// The three impacts, and nothing else: steel on steel, you taking a blade, and him taking one. Every
// sound is one small WAV played through one Audio element; there is no mixer and no library.
//
// One element per sound, rewound and replayed. A flurry can land two hits inside one ring, and the second
// hit must not be silent just because the first is still sounding — so each call rewinds its own element
// rather than starting a copy. The trade is that a sound cuts itself off if it retriggers, which for
// short impacts is exactly what you want.

function load(path, volume) {
  const el = new Audio(path);
  el.preload = 'auto';
  el.volume = volume;
  return el;
}

export function createSfx() {
  const sounds = {
    parry: load('assets/audio/parry.wav', 0.85),
    playerHurt: load('assets/audio/player-hurt.wav', 0.9),
    bossHurt: load('assets/audio/boss-hurt.wav', 0.9),
    block: load('assets/audio/block.wav', 0.8),
  };

  // The block is its own recording, not the parry pitched down, and it must never be silent if that file
  // is ever missing: this catches the load failing and plays the parry low and slow instead.
  let blockFallback = false;
  sounds.block.addEventListener('error', () => {
    blockFallback = true;
    sounds.block.src = 'assets/audio/parry.wav';
  });

  // rate is the pitch: 1 is the file as recorded, below 1 is the same impact, heavier and duller.
  function play(el, rate = 1) {
    if (!el) return;
    el.playbackRate = rate;
    try {
      el.currentTime = 0; // not seekable until the file has loaded; if it refuses, let it play on
    } catch (err) {
      /* the element is not ready to seek yet, which is not a reason to lose the sound */
    }
    const started = el.play();
    if (started && started.catch) started.catch(() => {}); // a browser that refuses audio is not a crash
  }

  return {
    // PERFECT: the parry file pitched UP to 1.1 — brighter, sharper and more metallic than it was
    // recorded. This is the sound the player is chasing, and it is the loudest and brightest thing here.
    // BLOCK: a different recording entirely — a dead, un-metallic thud with the ring killed before it
    // starts. The two have to be tellable apart with your eyes shut, because the difference between them
    // is the entire skill of the game.
    parry(perfect) {
      if (perfect) {
        play(sounds.parry, 1.1);
        return;
      }
      play(sounds.block, blockFallback ? 0.7 : 1);
    },
    // The player eating a blade: a light hit or a heavy one, either way this is you being cut.
    playerHurt() {
      play(sounds.playerHurt);
    },
    // The player's blade getting through his guard and into him. Deliberately a different sound from
    // playerHurt, because the player has to know which way the damage went without looking at a bar.
    bossHurt() {
      play(sounds.bossHurt);
    },
  };
}
