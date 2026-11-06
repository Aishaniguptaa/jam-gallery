// Every number the makers might tune: parry windows, attack timing, damage, gauge and enemy shape.
export const perfectParryOpensAt = 0.37; // seconds into the swing when a perfect parry becomes possible;
                                         // press earlier in the swing than this and you only block.
                                         // MUST stay under swingTime. THIS is the difficulty number: the
                                         // perfect window is swingTime - perfectParryOpensAt = 0.18s now.
                                         // The lord scales this with finalBossSwingScale to 0.137s, so the
                                         // intro boss still hands you 31% more time than he does.
export const blockDamage = 5;            // health a block costs you. A block drains NO guard at all
// How often he attacks. This is a pure WAIT that starts once he has recovered from the last swing, so it
// is added to the animation rather than fitting inside it: the real gap between two blades landing is
// attackInterval + windupTime + swingTime + enemyRecoverTime. Every one of those four was sped up
// together, which is the only way it works — dropping the WAIT alone is swallowed whole by the wind-up,
// because he can never swing again until his telegraph and his swing have finished.
export const attackIntervalMin = 0.6;    // seconds of breathing room between attacks, lower bound
export const attackIntervalMax = 0.9;    // and upper bound
export const windupTime = 1.0;           // seconds of telegraph before the swing starts: no parry yet
export const playerHealthMax = 100;
export const enemyGaugeMax = 100;
export const gaugeDrainPerfect = 34;     // gauge removed by a perfect parry. Only a perfect parry drains it
export const hitDamage = 20;             // damage to the player when a swing lands
export const heavyHitDamage = 35;        // damage when a HEAVY swing lands: same parry, dearer mistake
export const heavyBlockDamage = 10;      // health a BLOCK against a heavy costs: twice a light's block

// The stamina gauge: the guard's wind. A perfect parry is free and always available; a block spends
// stamina, and a block you cannot pay for fails outright.
export const staminaMax = 100;           // full wind
export const blockStaminaCost = 34;      // three blocks in a row and you are winded
export const staminaRegenPerSecond = 25; // a full refill in about 4 seconds
export const staminaRegenDelay = 0.6;    // seconds after a block before stamina starts coming back

// The boss loop: break his guard and you get a timed window to cut him down. The guard snapping back
// to full the moment the window closes is the point — the window is the reward, not the empty gauge.
export const stunTime = 5;               // seconds he is out cold after his guard breaks
export const attackDamage = 10;          // health one of the player's cuts takes off a stunned enemy
export const swingCooldown = 0.35;       // seconds between the player's cuts, one swing at a time

export const arenaRadius = 7;            // how far the player can walk from the centre
export const restartKey = 'r';           // the key that restarts a fight
export const enemySpawnZ = -3;           // where the enemy stands in front of the player
export const lookHeight = 1.4;           // chest height the locked camera stays aimed at, at the enemy's spot
export const impactHeight = 1.25;        // chest height where the two blades meet: where the sparks burst
export const impactAlongBlades = 0.45;   // how far along the line from you to the enemy that meeting point sits
export const playerCanWalk = false;      // false = the view is locked: WASD does nothing, no head bob

// Swing timing and placeholder shape for the gray-box enemy.
export const swingTime = 0.55;           // seconds the swing lasts; the blade lands at the end of it.
                                         // 0.95 -> 0.60 -> 0.55: the blade comes through fast, so the press
                                         // has to be late and exact. Must stay above perfectParryOpensAt.

// THE LORD'S OWN SWING. Both bosses share every number above except this one: his blade comes through in
// 0.42s against the intro boss's 0.55s, and his perfect-parry window shrinks with it — 0.137s against the
// intro boss's 0.18s. This is the only number in the file that tightens the timing TEST itself rather
// than just the warning, which makes it the cruellest one here. Lower it to make the lord crueller still.
// Raised from 0.70 to 0.76 to hold him at exactly 0.42s when the shared swing above came down to 0.55.
export const finalBossSwingScale = 0.76;
export const enemyStrikeTime = 0.15;     // no longer used: the swing absorbs the old separate strike
export const enemyRecoverTime = 0.25;    // seconds spent recovering after a swing lands
export const enemyLunge = 0.7;           // metres the enemy lunges forward through the swing

// The windup telegraph: how far it leans, how fast it turns orange, how brightly it glows.
export const enemyLeanBack = 0.35;       // radians the enemy leans back during a windup
export const telegraphRampTime = 0.4;    // seconds for the telegraph to reach full strength
export const enemyGlow = 0.5;            // emissive strength at full telegraph
export const enemyWidth = 0.7;
export const enemyHeight = 1.8;
export const enemyDepth = 0.6;
export const enemyColor = 0x4a4f56;      // dark grey calm
export const enemyWarningColor = 0xff6a2a; // warning orange while he winds up
export const enemyStrikeColor = 0xffc46a;  // hotter tint as the blade comes through
export const enemyStunColor = 0x9aa0a4;    // washed-out grey: guard gone, wind knocked out of him
export const enemyStunSlump = 0.45;        // radians he pitches forward while stunned: the slump
export const enemyStunBladeDrop = 0.9;     // radians the katana falls below its rest angle while stunned

// The heavy attack's read. It is parried exactly like a light — the same windows, the same outcomes —
// so the telegraph has to say "this one costs more" before it lands, or the extra damage is an ambush.
// Deep red and nothing of the light's orange anywhere in it, a longer wind-up, and a bigger lean.
export const enemyHeavyColor = 0xb3202a;      // deep blood red: a HEAVY is winding up
export const enemyHeavyStrikeColor = 0xff4a3a; // hotter red as the heavy comes through
export const heavyWindupScale = 1.6;          // a heavy telegraphs 60% longer than a light
export const enemyHeavyLeanScale = 1.8;       // and leans 80% further back: a bigger shape at a glance

// The enemy's katana: a plain box on a pivot at the shoulder, swept over the swing.
export const enemyBladeLength = 1.1;     // metres of steel
export const enemyBladeArc = 1.6;        // radians swept, from held back and up through to down and across
export const enemyBladeRestAngle = 0.17; // blade angle in idle and windup: up, tilted back off his shoulder
export const enemyBladeBack = -0.35;     // blade tilt away from the player before the swing (radians, about x)
export const enemyBladeThrough = 0.35;   // blade tilt forward, through the player, as the swing lands
export const enemyBladeForward = 0.3;    // metres in front of his chest the sweep happens, so it is not hidden
export const enemyBladeThickness = 0.045; // how thick the box is; it is 0.09 wide across the frame

// Per-enemy values, scaling the shared numbers above. Two fights: the intro boss, then the lord.
export const introBossHealth = 100;
export const finalBossHealth = 200;
export const finalBossCadenceScale = 0.4;  // the lord waits far less than the intro boss: 0.24-0.36s
                                           // between his attacks, so he is the faster of the two
// THE DIFFICULTY LEVER FOR THE LORD. His parry WINDOW is deliberately the same as the intro boss's — the
// test of timing does not change between fights. What changes is how much warning he gives you: at 0.7 he
// telegraphs in 0.70s against the intro boss's 1.00s, so you get 30% less time to read which blade is
// coming. That carries to his heavies too: 1.12s of red against the intro boss's 1.6s. Turn it down to
// make him crueller, up to be kinder — the perfect window stays 0.4s either way.
export const finalBossWindupScale = 0.7;   // and telegraphs for less time
// HOW BIG THE LORD STANDS. His sprite is scaled by this and by nothing else — the intro boss is left
// exactly as he was, so the size difference between the two is itself a piece of information: the figure
// that fills more of the doorway is the one that matters. 1 = the same size as the intro boss.
export const finalBossSizeScale = 1.3;
// How often each enemy winds up a HEAVY instead of a light, decided as each wind-up begins.
// The intro boss throws one only now and then, so the first fight stays readable; the lord leans on them.
export const introBossHeavyChance = 0.12; // about one heavy in eight
export const finalBossHeavyChance = 0.5;  // every other swing is a heavy
// May this enemy throw a heavy straight after a heavy? A heavy following a heavy reads as unfair rather
// than hard, so the INTRO BOSS is OFF: the swing after a heavy is always a light. The FINAL BOSS is ON:
// chaining them is his to do, and it is what makes the last fight the last fight. Flip either one.
export const introBossAllowConsecutiveHeavies = false;
export const finalBossAllowConsecutiveHeavies = true;

// THE HAND-OVER between the two fights. Killing the intro boss does not build the lord: one line fades up,
// holds, fades away, and then the room sits empty for a real beat of silence before anything happens.
// That silence is the whole point of the request, not a formality — do not shorten it away.
export const transitionFadeIn = 1.4;   // seconds the line takes to come up from nothing
export const transitionHold = 2.0;     // seconds the line sits at full strength
export const transitionFadeOut = 1.4;  // seconds the line takes to go back to nothing
export const transitionSilence = 2.5;  // seconds of empty room, no line, no enemy, nothing moving
