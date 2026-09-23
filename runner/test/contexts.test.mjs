import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');

test('the P2 context file is byte-identical to P1', () => {
  const p1 = readFileSync(resolve(REPO, 'contexts/P1/CLAUDE.md'));
  const p2 = readFileSync(resolve(REPO, 'contexts/P2/CLAUDE.md'));
  assert.equal(Buffer.compare(p1, p2), 0);
});

test('neither context file leaks a study term', () => {
  const forbidden = /TCC|INATEL|harness|semente|experimento|Claude|Anthropic/i;
  for (const path of ['contexts/P1/CLAUDE.md', 'contexts/P2/CLAUDE.md']) {
    assert.doesNotMatch(readFileSync(resolve(REPO, path), 'utf8'), forbidden, path);
  }
});

test('the P2 plugin declares a manifest and three skills', () => {
  const manifest = JSON.parse(readFileSync(resolve(REPO, 'contexts/P2/plugin/.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length > 0);
  for (const skill of ['estender-modulo', 'escrever-testes', 'convencoes-do-projeto']) {
    assert.equal(existsSync(resolve(REPO, `contexts/P2/plugin/skills/${skill}/SKILL.md`)), true, skill);
  }
});

test('no plugin file leaks a study term either', () => {
  const forbidden = /TCC|INATEL|harness|experimento|Anthropic/i;
  for (const skill of ['estender-modulo', 'escrever-testes', 'convencoes-do-projeto']) {
    const text = readFileSync(resolve(REPO, `contexts/P2/plugin/skills/${skill}/SKILL.md`), 'utf8');
    assert.doesNotMatch(text, forbidden, skill);
  }
});
