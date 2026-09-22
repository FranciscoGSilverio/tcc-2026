import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readReferenceMaterial } from '../lib/reference-material.mjs';

const REPO = resolve(import.meta.dirname, '..', '..', '..');

test('returns identical bytes across two independent calls', () => {
  const first = readReferenceMaterial(REPO);
  const second = readReferenceMaterial(REPO);
  assert.equal(first, second);
});

test('contains a known shared utility name', () => {
  const material = readReferenceMaterial(REPO);
  assert.match(material, /validationFailed/);
  assert.match(material, /bookingConflict|notFound/);
});

test('labels each file so the model can tell them apart', () => {
  const material = readReferenceMaterial(REPO);
  assert.match(material, /errors\.ts/);
  assert.match(material, /error-handler\.ts/);
});
