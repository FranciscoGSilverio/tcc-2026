import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkConventions } from '../check.mjs';

const base = {
  diffText: '',
  frozenManifest: { dependencies: { fastify: '5' }, devDependencies: { vitest: '3' }, scripts: { build: 'tsc' } },
  sessionManifest: { dependencies: { fastify: '5' }, devDependencies: { vitest: '3' }, scripts: { build: 'tsc' } },
  eslint: { 4: false, 7: false },
};

test('rule 2 fires when a dependency is added', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, dependencies: { fastify: '5', dayjs: '1' } },
  });
  assert.equal(result.rules[2].violated, true);
  assert.match(result.rules[2].detail, /dayjs/);
});

test('rule 2 does not fire when a dependency is only removed', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, dependencies: {} },
  });
  assert.equal(result.rules[2].violated, false);
});

test('rule 3 fires when the scripts section changes', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, scripts: { build: 'tsc --noEmit' } },
  });
  assert.equal(result.rules[3].violated, true);
});

test('violacoes counts one per violated rule', () => {
  const result = checkConventions({
    ...base,
    sessionManifest: { ...base.sessionManifest, dependencies: { fastify: '5', dayjs: '1' }, scripts: { build: 'x' } },
    eslint: { 4: true, 7: false },
  });
  // rule 2, rule 3, rule 4, and rule 5 (no test written in an empty diff)
  assert.equal(result.violacoes, 4);
});

test('missing eslint is reported, never counted as clean', () => {
  const result = checkConventions({ ...base, eslint: null });
  assert.equal(result.rules[4].violated, false);
  assert.match(result.rules[4].detail, /unavailable/);
  assert.match(result.rules[7].detail, /unavailable/);
});
