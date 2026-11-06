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

### 13:55: Chose resource-management game
- **Changed:** Picked our original idea, a resource-management game. Story and mechanics carry it, not advanced graphics.
- **Expected:** didn't predict (no prediction until a usable prototype exists)
- **Saw:** not built yet
- **Decided, and why (C, N):** Both of us decided, as our plan. Chose it for better engagement.

### 14:34: Cut steps to max 15 per phase
- **Changed:** Shortened the progression of steps: fewer, max 15 per phase.
- **Expected:** Resource allocation logic does not go negative.
- **Saw:** not played yet
- **Decided, and why (C, N):** Both of us. The game felt slow and bloated.

### 14:56: M1 check-in
- **Expected:** More detailed decisions.
- **Saw when we played it:** It lacked accurate costs.
- **Next (who decided):** Both of us: display hidden costs.

### 15:02: M2 check-in
- **Expected:** Flight events to be varied.
- **Saw when we played it:** We did not get to them. Resource drain was too big to see enough of them.
- **Next (who decided):** Both of us: introduce alternative event options, and scale down the resource impact of each decision.

### 15:12: M3 check-in
- **Expected:** The game starts in the plan phase, not skipping it.
- **Saw when we played it:** It starts on phase 1 correctly.
- **Next (who decided):** Both of us: change how months progress and how many resources you can bring to your ship.

### 15:52: M6 investigation option was buggy
- **Changed:** M6, ten randomized worlds, buying costs credits, tap restart.
- **Expected:** The investigation option reveals all the unknown data about the planets.
- **Saw:** The buttons were hiding the planets instead of revealing the info.
- **Decided, and why (C, N):** Both of us. Fixed it in M8 (`ef97ad2`): one orbital probe for the whole survey, ten visually distinct worlds. We decided the fix together.

### 15:52: M7 parallel missions did not work; shipping anyway
- **Changed:** M7, parallel mission lanes, side instrument panels, mission-coloured events (`35bd485`).
- **Expected:** [to confirm: what you expected from parallel missions]
- **Saw:** Parallel missions did not end up working correctly.
- **Decided, and why (C, N):** Both of us. We have to ship, so we're shipping with parallel missions broken.

## Reflection

*At the end: What did you decide that Claude didn't? What did you reject from Claude, and why? What would you do with another jam session?*

## AI Use Disclosure

*Short summary for the gallery, taken from your running log in `devlog/AI-USE-LOG.md` (not from memory at the last minute). Say what you directed yourselves, what Claude Code did in the build terminal (and its builder subagents), and what other AI tools did. List every AI-generated asset file again here, or cite the log row that names it.*

*Be accurate: neither more nor less than what happened.*
