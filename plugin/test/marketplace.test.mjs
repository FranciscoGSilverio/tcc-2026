// The marketplace catalog at the repository root must point at the published
// plugin and carry the same version as its manifest, or
// `/plugin marketplace add FranciscoGSilverio/tcc-2026` installs something
// other than what this folder holds.
//
// This file used to also guard that the plugin was a byte-for-byte copy of
// contexts/P2/. That rule was dropped on 13/11/2026 (round 11 of
// docs/00-log-sessao-planejamento.md): the plugin is now a deliverable derived
// from the study's results and may evolve. The version identical to the
// measured P2 condition is the tag plugin-v1.0.0-p2; contexts/P2/ stays frozen
// and is what the runner uses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const PUBLISHED = join(REPO_ROOT, 'plugin', 'meeting-rooms-conventions');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('the marketplace entry points at the published plugin', () => {
  const marketplace = readJson(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'));
  const manifest = readJson(join(PUBLISHED, '.claude-plugin', 'plugin.json'));
  const [entry, ...others] = marketplace.plugins;

  assert.equal(others.length, 0);
  assert.equal(entry.name, manifest.name);
  assert.equal(entry.version, manifest.version);
  assert.equal(resolve(REPO_ROOT, entry.source), PUBLISHED);
});
