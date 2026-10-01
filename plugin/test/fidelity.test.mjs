// The published plugin is the P2 condition of the collection, packaged --
// not a new version of it. docs/03-plano-de-execucao.md, section 5, makes
// "corresponde à condição P2 usada na coleta" a done criterion, and the
// article cites the plugin as the thing that lets a third party reproduce
// P2. So every byte the agent under test saw in P2 has to reach the
// installer unchanged: the three skills, and the CLAUDE.md that P2
// inherited from P1. Only manifest metadata (homepage, repository,
// keywords) may be added, because the agent never read it as instruction.
//
// The copy is checked against contexts/P2/, never the other way around:
// contexts/P2/ is what ran, and it is frozen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const COLLECTED = join(REPO_ROOT, 'contexts', 'P2');
const PUBLISHED = join(REPO_ROOT, 'plugin', 'meeting-rooms-conventions');

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('every skill is published byte for byte, and no skill is added', () => {
  const collectedSkills = join(COLLECTED, 'plugin', 'skills');
  const publishedSkills = join(PUBLISHED, 'skills');
  const names = (dir) => filesUnder(dir).map((path) => relative(dir, path)).sort();

  assert.deepEqual(names(publishedSkills), names(collectedSkills));
  for (const name of names(collectedSkills)) {
    assert.ok(
      readFileSync(join(publishedSkills, name)).equals(readFileSync(join(collectedSkills, name))),
      `skills/${name} differs from the one the collection ran`,
    );
  }
});

test('the CLAUDE.md template is the one P2 ran with', () => {
  assert.ok(
    readFileSync(join(PUBLISHED, 'templates', 'CLAUDE.md'))
      .equals(readFileSync(join(COLLECTED, 'CLAUDE.md'))),
    'templates/CLAUDE.md differs from contexts/P2/CLAUDE.md',
  );
});

test('the manifest keeps the identity the collection recorded', () => {
  const collected = readJson(join(COLLECTED, 'plugin', '.claude-plugin', 'plugin.json'));
  const published = readJson(join(PUBLISHED, '.claude-plugin', 'plugin.json'));

  for (const field of Object.keys(collected)) {
    assert.equal(published[field], collected[field], `plugin.json field "${field}" changed`);
  }
});

test('the marketplace entry points at the published plugin', () => {
  const marketplace = readJson(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'));
  const manifest = readJson(join(PUBLISHED, '.claude-plugin', 'plugin.json'));
  const [entry, ...others] = marketplace.plugins;

  assert.equal(others.length, 0);
  assert.equal(entry.name, manifest.name);
  assert.equal(entry.version, manifest.version);
  assert.equal(resolve(REPO_ROOT, entry.source), PUBLISHED);
});
