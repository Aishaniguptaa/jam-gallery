# Devlog

Your record of the jam, in your words. The devlog terminal (`claude --agent devlog`) helps you write it; you decide what goes in. On a team, initials show who decided.

## Entries

Format for each change (one change per entry):

### HH:MM: short title
- **Changed:**
- **Expected:**
- **Saw:**
- **Decided, and why (who):**

Format for each milestone check-in (M1 to M5):

### HH:MM: M# check-in
- **Expected:**
- **Saw when we played it:**
- **Next (who decided):**

Format for each playtest (after M2 and after M3):

### HH:MM: Playtest N
- **Their story:**
- **Bored or stuck:**
- **What we'll change (who decided):**

### 12:45: Picked the concept and the card
- **Changed:** Picked Timing tapper as our card. The game is a vertical side-scroller set in the Vijaya Vittala Temple at Hampi, Vijayanagara empire, 15th century. The temple has 56 pillars, and 7 pillars surround it, tied to the 7 notes. The pillars glow and you tap the correct ones. Instruments: table, sitar, flute, dhol, santoor, etc. As you progress, a portal opens into outer space. Points system. Two modes: Rhythm Journey and Compose (use the orchestra to play and record).
- **Expected:** didn't predict
- **Saw:** Not built yet. Plan block.
- **Decided, and why (ag, nc):** Both of us. We picked Timing tapper because it suits our design: a vertical side-scroll in the temple, focused on its musical pillars. Team name SaReGaMa is for the seven notes of Indian music. Rhythm Journey is our first choice. Compose is for jam day if it fits.

### 12:47: Real recorded instruments, not synthesized
- **Changed:** Chose real recorded instruments over synthesized ones for the sounds.
- **Expected:** didn't predict
- **Saw:** Not tested yet.
- **Decided, and why (ag, nc):** Both of us. Real recorded instruments would sound better and more real, and would enhance the gameplay experience, since music is our key feature.

### 13:22: First playable M1 build (seven pillars, seven keys, lives)
- **Changed:** Built M1 as plain shapes: seven pillars, seven keys, lives that cost a life on a wrong tap, and restart. Start screen at the bottom says what to do. Score top left, lives top right, grey boxes coming down, dancer placeholder at the bottom.
- **Expected:** Working. We could hear the sound, tap, lose lives, see what happens, and test it.
- **Saw:** We could tap, and we lost lives. Tapping a lane whose pillars had already passed the line was good, and didn't feel like a trap yet. We couldn't see which grey box is which note (we expected that). The centre pillar is annoying: it covers the dancer on its way down. We couldn't judge the timing between pillars because we couldn't see the keys to press. One of us guessed a key, and S worked for Sa. Every note has the same sound right now.
- **Decided, and why (who):** Nothing decided yet.

### 13:26: Keep santoor; find another sample
- **Changed:** The sample search found four of five instruments (tabla, sitar, flute, dhol), with no santoor. We're going to find another santoor sample instead of leaving it out.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. We want to keep santoor for the Indian orchestra aspect.

### 13:30: Label the lanes with their keys
- **Changed:** Changing the lanes: adding labels so we can see which key is which.
- **Expected:** To work out which key to hit, so we can play.
- **Saw:** After the label change, we played again. Below the line, when a note reaches the line, that works well now. It's too fast.
- **Decided, and why (ag, nc):** Both of us. So we can see which key is which.

### 13:33: Slow the notes down
- **Changed:** Slowing the notes down. How much is not set yet.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. It's too fast.

### 13:43: Tap on sight, not on the line
- **Changed:** Changing how we hit the right keys: tap as soon as the block is seen on screen, not when it touches the line.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. It doesn't make for good gameplay.

### 13:59: Pillars in a column, not falling down
- **Changed:** Dropped the falling pillars, like a piano game. The pillars now stand in a column on the right, with the instruments on the left. The light shows when to press.
- **Expected:** An instrument added on each level or as the game goes on. Portals open up as we progress. The seven pillars show which instrument we're on.
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. Falling pillars were like any other traditional game and would get boring. Here you see the pillars placed and get the notes for each instrument. This is what the actual temple design has, and each rhythm hits the glowing pillars.

### 14:53: Tanpura instead of santoor, for now
- **Changed:** Swapped santoor for tanpura. This reverses our 13:26 decision to keep looking for a santoor sample.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us, for now. Claude suggested tanpura because it couldn't find santoor sounds. We accepted the suggestion and stopped looking for santoor.

### 15:27: Rejected 2D pillars in boxes
- **Changed:** Rejected Claude's version, which gave us 2D pillars in boxes.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. It wasn't looking good aesthetically.

### 15:35: Own models, not Blender
- **Changed:** Rejected Claude's suggestion to use Blender. We imported our own models instead.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. We wanted our own visual style.

### 15:39: Animate the rigged dancer
- **Changed:** Asked Claude to animate our rigged Indian dancer. The first try showed a grey box, not the dancer.
- **Expected:** A little dance form to play.
- **Saw:** Only the hands moving up and down. (Both of us tested it ourselves, not a playtest.)
- **Decided, and why (who):** Nothing decided yet.

### 15:43: A late beat scores less
- **Changed:** A beat that's a few seconds late adds less score.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. It is not a missed beat.

### 15:45: Speed fix, left to Claude
- **Changed:** Fixed the game getting quick too easily. We left the exact change to Claude.
- **Expected:** didn't predict
- **Saw:** Speed fix worked well now.
- **Decided, and why (ag, nc):** Both of us. The game becomes really quick really easily. We left the exact change to Claude.

### 15:48: Portal sky sequence, earth to space
- **Changed:** The portal sequence: earthly sky, clouds in the air, space, outer space, and galaxies, from the references we added.
- **Expected:** didn't predict
- **Saw:** Not yet.
- **Decided, and why (ag, nc):** Both of us. It's like we're going up in the sky higher and higher. It also tells how happiness is achieved through dance and music. It is how we reach God.

### 16:09: Demo for a professor (not a playtest)
- **Changed:** Showed the game to a professor. Logged as a demo, not a playtest. Nothing changed.
- **Expected:** didn't predict
- **Saw:** The professor looked at it. They said it works well, and that it was just too fast.
- **Decided, and why (who):** Nothing decided yet.

### 16:26: Playtest (friend from another entry, after M4)
- **Their story:** They opened it, played it, understood the game in two tries, and liked it.
- **Bored or stuck:** No.
- **What we'll change (both):** Nothing in the gameplay. Only the visuals, a little bit.

### 16:41: Facade replaced for the grandeur environment
- **Changed:** Replaced the first facade (made with ChatGPT) with Claude's facade, made from "I want grandeur environment." The first facade was never in the game.
- **Expected:** didn't predict
- **Saw:** The first facade wasn't working well with the environment.
- **Decided, and why (ag, nc):** Both of us. It wasn't working well with the environment.

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

**What did you decide that Claude didn't?** I decided on the instruments on the left, the pillars, the environment, the game design, etc.

**What did you reject from Claude, and why?** We rejected Claude's 2D pillars in boxes, because aesthetically it wasn't looking good. We changed its suggestion of using Blender and imported our own models, because we wanted our own visual style.

**What would you do with another jam session?** I would love to use AI, and now that I can use Claude, I'll use it more frequently.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

Taken from `devlog/AI-USE-LOG.md`, `meta.json`, and the git log.

- **Directed by us (ag, nc):** the concept (a Hampi temple pillar orchestra, Rhythm Journey first, Compose if it fits), the card (Timing tapper), real recorded instruments over synthesized ones, pillars in a column with the light showing the press, the portal sky sequence, the scoring rules, keeping 3D pillars over Claude's 2D boxes, and our own models over Blender. Design and instrument choices were ours.
- **Claude Code, build terminal (jam-companion):** wrote the game code for M1 to M4, including pillars, keys, lives, restart, portals, sky stages, stone walls, and controls. Searched for CC0 instrument samples. Cut a short dhol excerpt from a longer recording. Searched for a tanpura sample after no santoor sample was found; we accepted it for now. Tried to animate the dancer. Wrote the game code and did the rest of the build work. Generated the temple wall and facade images (SVG) and put both into the game code.
- **Tripo AI (paid plan; its terms allow game use):** the seven pillar carvings (`assets/models/pillar1.glb` to `pillar7.glb`) and the dancer (`assets/models/Dancer.glb`, `Dancer_Rig.glb`, retopologized and rigged in Tripo). Listed in `meta.json` `ai_assets`.
- **Sound samples (not AI-generated):** tabla, sitar, flute, and tanpura from Freesound, and dhol from Wikimedia Commons, all credited in `meta.json` `assets`. Claude cut a short excerpt of the dhol from the longer recording; that excerpt is listed in `ai_assets`.
- **Menu images (AI-made):** `assets/homescreen.jpeg` and `assets/gameover.jpeg` were made with ChatGPT. Claude wrote the text for the screens. nc worked on the artwork and adjusted it with Claude, using our game rules. ChatGPT's terms allow game use.
- **Temple wall and facade (AI-made):** `assets/temple-wall.svg` and `assets/temple-facade.svg` were both made with Claude, and both are listed in `ai_assets`. Claude's terms allow game use. A ChatGPT facade was tried first, but it was never used in the game.
- **Build plan:** `context/BUILD-PLAN.md` was drafted by the build terminal, then edited and approved by us (approved 12:36, commit 74234e4).
