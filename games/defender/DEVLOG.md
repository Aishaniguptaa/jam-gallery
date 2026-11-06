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

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

The idea I started with was a tower defense game. What I cut, and why: building the walls, because the scope was too big. I started late and had about 2 hours. What surprised me in playtesting: how simple it was to get something going.

**What I decided that Claude didn't:** the wave defense with the base in the center and enemies from random corners, a boss every 5 waves that bursts into smaller enemies, erratic and circling enemies, goblins and a stone archer tower shooting arrows, abilities after bosses, and stopping at wave 20.

**What I rejected:** the companion wanted to drop abilities and the fantasy art. I kept both.

**What I'd do next:** a troll, a gargoyle and a better tower made in Blender, plus the wall building.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

I directed the design. Claude Code (the jam companion and its builder helpers) wrote most of the code and generated `base.glb`, `turret.glb` and `drone.glb` with headless Blender, using a Blender script Claude wrote (`assets/blender/make_assets.py`). A second Claude session in the desktop app helped me plan, playtest and write prompts, suggested the ability list and wave progression, and wrote `art.js` (the stone archer tower, goblins and arrows, from three.js shapes) and `abilities.js` (the ability picks). I confirm the second Claude session (Claude Opus 5.5 in the desktop app) wrote and committed art.js and abilities.js, not me and not the build terminal. Art references by EV Ganin were used as inspiration only.

AI-generated game assets: `assets/base.glb`, `assets/turret.glb`, `assets/drone.glb` (listed in `meta.json` under `ai_assets`). The sounds (`sounds.js`) and the arena floor (`textures.js`) are made in code; there are no downloaded or generated audio or image files.
