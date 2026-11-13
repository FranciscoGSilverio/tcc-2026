// The experimental v2 plugin: its hooks run as real processes against a
// throwaway git repository shaped like the seed, the way Claude Code runs
// them (JSON on stdin, exit code and stdout/stderr back).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installsPackage, removedLines } from '../meeting-rooms-conventions-v2/hooks/lib/guards.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const V2 = join(REPO_ROOT, 'plugin', 'meeting-rooms-conventions-v2');
const HOOKS = join(V2, 'hooks');

const SEED_TEST = "import { test } from 'vitest';\n\ntest('keeps a booking', () => {\n  expect(1).toBe(1);\n});\n";

function makeProject({ name = 'meeting-rooms-api' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mrc-v2-'));
  const manifest = { name, scripts: { test: 'vitest run' }, dependencies: { fastify: '5.2.1' } };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, 'tsconfig.json'), '{}\n');
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'tests', 'bookings.test.ts'), SEED_TEST);
  mkdirSync(join(dir, 'src', 'modules', 'rooms'), { recursive: true });
  writeFileSync(join(dir, 'src', 'modules', 'rooms', 'service.ts'), 'export const a = 1;\n');
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'inicio');
  return dir;
}

let sessionCounter = 0;
const newSession = () => `teste-${process.pid}-${Date.now()}-${sessionCounter++}`;

function runHook(script, dir, input) {
  const result = spawnSync(process.execPath, [join(HOOKS, script)], {
    input: JSON.stringify({ cwd: dir, ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('the scoring rules are a byte-for-byte copy of the ones the collection used', () => {
  assert.ok(
    readFileSync(join(HOOKS, 'lib', 'diff-rules.mjs'))
      .equals(readFileSync(join(REPO_ROOT, 'tools', 'convention-check', 'diff-rules.mjs'))),
  );
});

test('hooks.json references only scripts that exist', () => {
  const config = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const commands = Object.values(config.hooks).flat().flatMap((group) => group.hooks.map((hook) => hook.command));
  for (const command of commands) {
    const script = command.match(/hooks\/([\w-]+\.mjs)/)[1];
    assert.doesNotThrow(() => readFileSync(join(HOOKS, script)), script);
  }
});

test('installsPackage tells installing apart from restoring', () => {
  assert.equal(installsPackage('npm install dayjs'), 'dayjs');
  assert.equal(installsPackage('cd x && npm i -D date-fns'), 'date-fns');
  assert.equal(installsPackage('pnpm add luxon'), 'luxon');
  assert.equal(installsPackage('npm install'), null);
  assert.equal(installsPackage('npm ci && npm test'), null);
  assert.equal(installsPackage('make verify'), null);
});

test('removedLines counts moves as kept and deletions as removed', () => {
  assert.deepEqual(removedLines('a\nb\nc', 'c\na\nb\nd'), []);
  assert.deepEqual(removedLines('a\nb\nc', 'a\nc'), ['b']);
});

test('every hook is a no-op outside the meeting-rooms project', () => {
  const dir = makeProject({ name: 'outro-projeto' });
  try {
    const session = newSession();
    assert.deepEqual(runHook('session-start.mjs', dir, { session_id: session }), { code: 0, stdout: '', stderr: '' });
    assert.equal(runHook('guard-edit.mjs', dir, {
      session_id: session, tool_name: 'Edit', tool_input: { file_path: join(dir, 'tsconfig.json'), old_string: '{}', new_string: '{ }' },
    }).code, 0);
    assert.equal(runHook('guard-bash.mjs', dir, { session_id: session, tool_input: { command: 'npm install dayjs' } }).code, 0);
    writeFileSync(join(dir, 'src', 'modules', 'rooms', 'service.ts'), 'export const a = 2;\n');
    assert.equal(runHook('stop-check.mjs', dir, { session_id: session }).stdout, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('session start injects the project guide', () => {
  const dir = makeProject();
  try {
    const result = runHook('session-start.mjs', dir, { session_id: newSession() });
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.match(output.hookSpecificOutput.additionalContext, /Regras de domínio — reservas/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the edit guard blocks configuration and the manifest, and lets source through', () => {
  const dir = makeProject();
  try {
    const session = newSession();
    runHook('session-start.mjs', dir, { session_id: session });
    const edit = (path) => runHook('guard-edit.mjs', dir, {
      session_id: session, tool_name: 'Edit', tool_input: { file_path: join(dir, path), old_string: 'x', new_string: 'y' },
    });
    assert.equal(edit('tsconfig.json').code, 2);
    assert.match(edit('tsconfig.json').stderr, /convenções 2 e 3/);
    assert.equal(edit('package.json').code, 2);
    assert.equal(edit('src/modules/rooms/service.ts').code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the edit guard blocks removing an original test line, and allows adding tests', () => {
  const dir = makeProject();
  try {
    const session = newSession();
    runHook('session-start.mjs', dir, { session_id: session });
    const file = join(dir, 'tests', 'bookings.test.ts');
    const removing = runHook('guard-edit.mjs', dir, {
      session_id: session, tool_name: 'Edit',
      tool_input: { file_path: file, old_string: '  expect(1).toBe(1);\n', new_string: '' },
    });
    assert.equal(removing.code, 2);
    assert.match(removing.stderr, /convenção 6/);

    const adding = runHook('guard-edit.mjs', dir, {
      session_id: session, tool_name: 'Write',
      tool_input: { file_path: file, content: `${SEED_TEST}\ntest('new', () => {});\n` },
    });
    assert.equal(adding.code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the bash guard blocks installing a package', () => {
  const dir = makeProject();
  try {
    const run = (command) => runHook('guard-bash.mjs', dir, { session_id: newSession(), tool_input: { command } });
    assert.equal(run('npm install dayjs').code, 2);
    assert.equal(run('npm ci').code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the stop check lets a clean session end', () => {
  const dir = makeProject();
  try {
    const session = newSession();
    runHook('session-start.mjs', dir, { session_id: session });
    assert.deepEqual(runHook('stop-check.mjs', dir, { session_id: session }), { code: 0, stdout: '', stderr: '' });

    writeFileSync(join(dir, 'src', 'modules', 'rooms', 'service.ts'), 'export const a = 2;\n');
    writeFileSync(join(dir, 'tests', 'bookings.test.ts'), `${SEED_TEST}\ntest('a is 2', () => {});\n`);
    assert.equal(runHook('stop-check.mjs', dir, { session_id: session }).stdout, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the stop check sends the agent back, at most twice, and sees untracked and committed changes', () => {
  const dir = makeProject();
  try {
    const session = newSession();
    runHook('session-start.mjs', dir, { session_id: session });
    // A source change without a test, a stray production file, a skipped
    // test -- the last one committed, which must not hide it.
    writeFileSync(join(dir, 'src', 'modules', 'rooms', 'service.ts'), 'export const a = 2;\n');
    writeFileSync(join(dir, 'src', 'solto.ts'), 'export const b = 1;\n');
    writeFileSync(join(dir, 'tests', 'bookings.test.ts'), `${SEED_TEST.replace('test(', 'test.skip(')}`);
    execFileSync('git', ['-C', dir, 'add', 'tests']);
    execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'x']);

    const first = runHook('stop-check.mjs', dir, { session_id: session });
    const output = JSON.parse(first.stdout);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /Convenção 1 .*src\/solto\.ts/);
    assert.match(output.reason, /Convenção 6 /);
    assert.match(output.reason, /Convenção 8 /);
    assert.match(output.reason, /verificação 1 de 2/);

    assert.match(runHook('stop-check.mjs', dir, { session_id: session }).stdout, /verificação 2 de 2/);
    assert.equal(runHook('stop-check.mjs', dir, { session_id: session }).stdout, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the stop check flags a source change with no test', () => {
  const dir = makeProject();
  try {
    const session = newSession();
    runHook('session-start.mjs', dir, { session_id: session });
    writeFileSync(join(dir, 'src', 'modules', 'rooms', 'service.ts'), 'export const a = 2;\n');
    const output = JSON.parse(runHook('stop-check.mjs', dir, { session_id: session }).stdout);
    assert.match(output.reason, /Convenção 5 /);
    assert.match(output.reason, /ESLint indisponível/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
