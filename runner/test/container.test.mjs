import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildImage, imageId, start, exec, stop, copyIn } from '../lib/container.mjs';

const NAME = 'runner-selftest';
const outDir = mkdtempSync(join(tmpdir(), 'runner-out-'));

after(() => stop(NAME));

test('builds the session image and reports an id', () => {
  buildImage();
  assert.match(imageId('meeting-rooms-session:1.0.0'), /^sha256:/);
});

// The property the whole image_digest column rests on. Before
// --provenance=false this failed: BuildKit's provenance attestation
// carries build timestamps, so rebuilding identical content produced a new
// .Id every time, and the eight sessions collected before 25/09 each
// recorded a different digest for the same environment.
test('rebuilding identical content reports the same id', () => {
  const first = imageId('meeting-rooms-session:1.0.0');
  buildImage();
  assert.equal(imageId('meeting-rooms-session:1.0.0'), first);
});

test('the image carries the pinned agent cli', () => {
  start({ name: NAME, outDir, hostPort: 3510, env: {} });
  const result = exec(NAME, ['claude', '--version']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /2\.1\.272/);
});

test('the application is inside the image at the working directory', () => {
  const result = exec(NAME, ['sh', '-c', 'test -f /app/package.json && echo present']);
  assert.match(result.stdout, /present/);
});

test('the output mount reaches the host', () => {
  exec(NAME, ['sh', '-c', 'echo hello > /out/probe.txt']);
  assert.equal(readFileSync(join(outDir, 'probe.txt'), 'utf8').trim(), 'hello');
});

test('copying a file in lands where asked', () => {
  const source = join(outDir, 'probe.txt');
  copyIn(NAME, source, '/app/probe-copied.txt');
  assert.match(exec(NAME, ['cat', '/app/probe-copied.txt']).stdout, /hello/);
});

test('nothing of the artefacts repository is reachable from inside', () => {
  const result = exec(NAME, ['sh', '-c', 'ls /app | tr "\\n" " "']);
  for (const forbidden of ['hidden-tests', 'reference', 'tasks', 'docs', 'tools']) {
    assert.equal(result.stdout.includes(forbidden), false, `found ${forbidden} inside the container`);
  }
});

test('stopping removes the container', () => {
  stop(NAME);
  const result = exec(NAME, ['true']);
  assert.notEqual(result.status, 0);
});
