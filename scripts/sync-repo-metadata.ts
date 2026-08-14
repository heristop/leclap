#!/usr/bin/env node
// Applies .github/repo-metadata.json to the GitHub repo. Run after changing the manifest:
//   node scripts/sync-repo-metadata.ts
// Requires an authenticated `gh` with admin rights on the repo. Idempotent — GitHub returns the
// same state for a PATCH that changes nothing, so re-running is free.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'heristop/leclap';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(repoRoot, '.github/repo-metadata.json'), 'utf8'));

const gh = (args: string[], body?: string): string => execFileSync('gh', args, { input: body, encoding: 'utf8' });

// Description and homepage live on the repo object; topics have their own endpoint with a
// replace-all payload (PUT, not PATCH) — sending a subset silently deletes the rest.
gh(
  ['api', '-X', 'PATCH', `repos/${REPO}`, '--input', '-'],
  JSON.stringify({ description: manifest.description, homepage: manifest.homepage })
);

gh(['api', '-X', 'PUT', `repos/${REPO}/topics`, '--input', '-'], JSON.stringify({ names: manifest.topics }));

console.log(`synced ${manifest.topics.length} topics and the description to ${REPO}`);
