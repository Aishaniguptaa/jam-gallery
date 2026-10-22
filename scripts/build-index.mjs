// Validate every games/<handle>/ folder and write games.json for the gallery page.
// Runs on Vercel deploy and on every PR; any invalid game fails the build.
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HANDLE = /^[a-z0-9-]{2,30}$/;
// Files a game may contain without crediting them in meta.json.
const FREE_NAMES = new Set(['index.html', 'meta.json', 'DEVLOG.md']);
const FREE_EXTS = new Set(['.js', '.mjs', '.css']);

function walk(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p).split('\\').join('/')];
  });
}

function checkGame(gamesDir, folder) {
  const dir = join(gamesDir, folder);
  const fail = (msg) => { throw new Error(`games/${folder}: ${msg}`); };

  if (!existsSync(join(dir, 'meta.json'))) fail('missing meta.json');
  if (!existsSync(join(dir, 'index.html'))) fail('missing index.html');

  let meta;
  try { meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')); }
  catch (e) { fail(`meta.json is not valid JSON (${e.message})`); }

  if (!HANDLE.test(meta.handle ?? '')) fail(`handle "${meta.handle}" must be 2-30 lowercase letters, numbers, or dashes`);
  if (meta.handle !== folder) fail(`folder name must match meta.json handle "${meta.handle}"`);
  for (const key of ['title', 'description']) {
    if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`meta.json ${key} is empty`);
  }

  const assets = Array.isArray(meta.assets) ? meta.assets : [];
  const aiAssets = Array.isArray(meta.ai_assets) ? meta.ai_assets : [];
  for (const a of assets) {
    for (const key of ['file', 'source', 'license']) {
      if (typeof a?.[key] !== 'string' || !a[key].trim()) fail(`asset ${a?.file ?? '(unnamed)'} needs a ${key}`);
    }
  }

  const credited = new Set([...assets.map((a) => a.file), ...aiAssets]);
  for (const f of walk(dir)) {
    const name = f.split('/').pop();
    if (FREE_NAMES.has(name) || FREE_EXTS.has(extname(f)) || credited.has(f)) continue;
    fail(`${f} is not credited; add it to meta.json assets (with source and license) or ai_assets`);
  }

  return { handle: meta.handle, title: meta.title.trim(), description: meta.description.trim(), path: `games/${folder}/` };
}

export function buildIndex(gamesDir) {
  const folders = readdirSync(gamesDir).filter((n) => statSync(join(gamesDir, n)).isDirectory());
  return folders.map((f) => checkGame(gamesDir, f)).sort((a, b) => a.title.localeCompare(b.title));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), '..', '..');
  try {
    const games = buildIndex(join(root, 'games'));
    writeFileSync(join(root, 'games.json'), JSON.stringify(games, null, 2) + '\n');
    console.log(`games.json: ${games.length} game(s)`);
  } catch (e) {
    console.error(`build failed: ${e.message}`);
    process.exit(1);
  }
}
