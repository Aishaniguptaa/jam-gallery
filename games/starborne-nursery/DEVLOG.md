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

**What did you decide that Claude didn't?** We decided everything, so we didn't really reject anything besides a lever and a few small things.

**What did you reject from Claude, and why?** We rejected a lever. We didn't like it and had no use for it.

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*

MZ and WB directed the design, world, creatures, colours, and every change. Claude Code in the build terminal (model: jam-lead) wrote all the code, using `jam-builder` subagents for some tasks. Claude Code in the devlog terminal helped write and commit this devlog. Everything in the game (island, train, rail, creatures, shop, UI, sky) is built from code shapes; there are no AI-generated asset files. The only files we did not create are the Silkscreen font and its license file (`fonts/Silkscreen-OFL.txt`) from Google Fonts, credited in `meta.json`. Reference photos from online are in `context/` for planning and are not in the game; one is a drawing by MZ. No other AI tools were used.
