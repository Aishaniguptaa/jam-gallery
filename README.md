# Anthropic Game Jam Gallery

Games made in 5 hours with three.js and Claude Code, November 6, 2026.

## Submitting a game (students)

Run `/jam-ship` in your jam folder. It forks this repo, adds your game under `games/<handle>/`, and opens a pull request. You don't need to edit anything here by hand.

Each game folder holds `index.html`, `meta.json`, its `.js`/`.css`, credited assets, and `DEVLOG.md`. The PR check fails if:

- the folder name doesn't match `meta.json` `handle` (2-30 lowercase letters, numbers, dashes)
- `title` or `description` is empty
- a file other than code, `index.html`, `meta.json`, or `DEVLOG.md` isn't credited in `meta.json` `assets` (with `source` and `license`) or `ai_assets`

## Merging (facilitator)

```bash
gh pr list -R SchoolofCreativeTechnology/jam-gallery
gh pr checks <n> -R SchoolofCreativeTechnology/jam-gallery
gh pr merge <n> -R SchoolofCreativeTechnology/jam-gallery --squash
```

Vercel rebuilds on merge: `node scripts/build-index.mjs` validates every game and writes `games.json`, which the gallery page reads.

## Local

```bash
npm test
npm run build && python3 -m http.server 8000
```
