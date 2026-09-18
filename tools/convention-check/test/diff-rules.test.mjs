import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffRules } from '../diff-rules.mjs';

const diff = (body) => body.join('\n');

test('rule 1 fires for a production file created outside the allowed folders', () => {
  const text = diff([
    'diff --git a/src/helpers/overlap.ts b/src/helpers/overlap.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/helpers/overlap.ts',
    '+export const x = 1;',
  ]);
  assert.equal(diffRules(text)[1].violated, true);
});

test('rule 1 does not fire for a new file inside a module', () => {
  const text = diff([
    'diff --git a/src/modules/bookings/rules.ts b/src/modules/bookings/rules.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/modules/bookings/rules.ts',
    '+export const x = 1;',
  ]);
  assert.equal(diffRules(text)[1].violated, false);
});

test('rule 3 fires when a config file changes', () => {
  const text = diff([
    'diff --git a/tsconfig.json b/tsconfig.json',
    '--- a/tsconfig.json',
    '+++ b/tsconfig.json',
    '+  "strict": false,',
  ]);
  assert.equal(diffRules(text)[3].violated, true);
});

test('rule 5 fires when the agent wrote no test', () => {
  const text = diff([
    'diff --git a/src/modules/bookings/service.ts b/src/modules/bookings/service.ts',
    '--- a/src/modules/bookings/service.ts',
    '+++ b/src/modules/bookings/service.ts',
    '+const a = 1;',
  ]);
  assert.equal(diffRules(text)[5].violated, true);
});

test('rule 5 does not fire when a test file gains lines', () => {
  const text = diff([
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it("rejects overlap", () => {});',
  ]);
  assert.equal(diffRules(text)[5].violated, false);
});

test('rule 6 tolerates additions to a seed test file', () => {
  const text = diff([
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it("rejects overlap", () => {});',
  ]);
  assert.equal(diffRules(text)[6].violated, false);
});

test('rule 6 fires when a seed test line is removed', () => {
  const text = diff([
    'diff --git a/tests/rooms.test.ts b/tests/rooms.test.ts',
    '--- a/tests/rooms.test.ts',
    '+++ b/tests/rooms.test.ts',
    '-it("lists rooms", () => {});',
  ]);
  assert.equal(diffRules(text)[6].violated, true);
});

test('rule 8 fires for a skipped test', () => {
  const text = diff([
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it.skip("later", () => {});',
  ]);
  assert.equal(diffRules(text)[8].violated, true);
});

test('parses a plain "diff -ruN" header, not just "diff --git"', () => {
  // reference/T1/reference.patch is generated with `diff -ruN`, not
  // `git diff`: its file-boundary line reads "diff -ruN ... a/X b/Y" and
  // its "---"/"+++" lines carry a tab-separated timestamp after the path.
  const text = diff([
    "diff -ruN '--exclude=node_modules' a/tests/bookings.test.ts b/tests/bookings.test.ts",
    '--- a/tests/bookings.test.ts\t2026-09-15 23:38:35.000000000 -0300',
    '+++ b/tests/bookings.test.ts\t2026-09-15 23:33:21.000000000 -0300',
    '+it("rejects overlap", () => {});',
  ]);
  assert.equal(diffRules(text)[5].violated, false);
});

test('a clean diff violates nothing', () => {
  const text = diff([
    'diff --git a/src/modules/bookings/service.ts b/src/modules/bookings/service.ts',
    '--- a/src/modules/bookings/service.ts',
    '+++ b/src/modules/bookings/service.ts',
    '+const a = 1;',
    'diff --git a/tests/bookings.test.ts b/tests/bookings.test.ts',
    '--- a/tests/bookings.test.ts',
    '+++ b/tests/bookings.test.ts',
    '+it("rejects overlap", () => {});',
  ]);
  const rules = diffRules(text);
  for (const id of [1, 3, 5, 6, 8]) assert.equal(rules[id].violated, false, `rule ${id}`);
});
