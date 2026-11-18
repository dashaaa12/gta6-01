// Palm Cove Heat — make.fun entry program.
//
// Hands the game in: copies game/ and screenshots/ from this repository
// into the output directory (MAKEFUN_OUTPUT_DIR, or /output when the
// grader runs it), then writes dossier.json there with the kit's own
// buildDossier, so the dossier is byte for byte the one the scorer
// rebuilds from the same files. Nothing here touches the network, and
// the output depends only on the repository's files, so two runs write
// identical bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the bounty's gate.json hands to buildDossier; passing them all
// makes this program refuse exactly where the scorer would.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Every file under a directory, as sorted repo-relative paths. Used both
// for the pre-flight cap checks and for the hand-in manifest below.
function listTree(dir, prefix) {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(full).isDirectory()) entries.push(...listTree(full, rel));
    else entries.push(rel);
  }
  return entries;
}

// Refuse early, with a clear message, when the repository itself is over
// a gate cap — cheaper than discovering it from a rejected submission.
function checkInputs() {
  const shotsDir = join(repoRoot, 'screenshots');
  const shots = readdirSync(shotsDir).filter((n) => n.toLowerCase().endsWith('.png'));
  if (shots.length < 3 || shots.length > DOSSIER_CAPS.screenshots.max) {
    throw new Error(
      `screenshots/ must hold 3–${DOSSIER_CAPS.screenshots.max} PNGs, found ${shots.length}`,
    );
  }
  for (const name of shots) {
    const bytes = statSync(join(shotsDir, name)).size;
    if (bytes > DOSSIER_CAPS.screenshots.max_bytes) {
      throw new Error(
        `screenshot ${name} is ${bytes} bytes, over the ${DOSSIER_CAPS.screenshots.max_bytes} cap`,
      );
    }
  }
  const gameFiles = listTree(join(repoRoot, 'game'), '');
  if (gameFiles.length > DOSSIER_CAPS.game_max_files) {
    throw new Error(`game/ holds ${gameFiles.length} files, over the ${DOSSIER_CAPS.game_max_files} cap`);
  }
}

function handIn() {
  checkInputs();
  for (const part of ['game', 'screenshots']) {
    const from = join(repoRoot, part);
    if (!existsSync(from)) {
      throw new Error(`missing ${part}/ in the repository — nothing to hand in`);
    }
    const to = join(outputDir, part);
    rmSync(to, { recursive: true, force: true });
    mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
  }
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  const files = listTree(outputDir, '');
  let total = 0;
  for (const rel of files) total += statSync(join(outputDir, rel)).size;
  console.log(`handed in Palm Cove Heat to ${outputDir} (dossier ${dossier.length} bytes)`);
  console.log(`output manifest: ${files.length} files, ${total} bytes`);
  for (const rel of files) console.log(`  ${rel}`);
}

handIn();
