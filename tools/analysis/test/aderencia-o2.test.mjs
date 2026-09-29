import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandWrites, writesInStep } from '../aderencia-o2.mjs';

const toolUse = (name, input) => JSON.stringify({
  type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] },
});

test('the editing tools count as a write', () => {
  const text = [
    toolUse('Edit', { file_path: '/app/src/modules/bookings/service.ts' }),
    toolUse('Write', { file_path: '/app/tests/bookings.test.ts' }),
  ].join('\n');
  assert.equal(writesInStep(text).length, 2);
});

// The reason shell commands cannot be skipped: opus never touches an
// editing tool, so a tools-only count reports a clean zero for every opus
// session and the measure is silently wrong in one condition.
test('a heredoc into a source file counts, the way opus edits', () => {
  assert.match(commandWrites("cat > src/modules/bookings/service.ts <<'EOF'\nconst x = 1;\nEOF"), /heredoc|redirecion/);
});

test('sed -i counts', () => {
  assert.ok(commandWrites("sed -i 's/a/b/' src/app.ts"));
});

test('a formatter that rewrites counts, one that only checks does not', () => {
  assert.ok(commandWrites('npx prettier --write src/**/*.ts'));
  assert.equal(commandWrites("npx prettier --check 'src/**/*.ts'"), null);
});

test('installing a dependency counts, because it rewrites the manifest', () => {
  assert.ok(commandWrites('npm install dayjs'));
});

// The distinction that keeps the measure honest: scratch space is not the
// deliverable. Agents redirect into /tmp and /dev/null constantly.
test('writing outside the working copy does not count', () => {
  assert.equal(commandWrites('npm test 2>&1 > /dev/null'), null);
  assert.equal(commandWrites('find . -type f > /tmp/listing.txt'), null);
  assert.equal(commandWrites('cat /app/package.json'), null);
});

test('reading and running tests does not count', () => {
  assert.equal(commandWrites('npm test'), null);
  assert.equal(commandWrites('git status'), null);
  assert.equal(commandWrites('grep -rn "booking" src/'), null);
  assert.equal(commandWrites('ls -la /app'), null);
});

test('a malformed transcript line does not lose the rest', () => {
  const text = ['{nao e json', toolUse('Edit', { file_path: '/app/src/a.ts' })].join('\n');
  assert.equal(writesInStep(text).length, 1);
});

test('an empty step reports no writes', () => {
  assert.deepEqual(writesInStep(''), []);
});

// Both of these were false positives on the real dataset before the
// working-copy check covered heredocs as well as plain redirects.
test('a scratch file outside the working copy does not count', () => {
  assert.equal(commandWrites("cat > /tmp/test-conflict.js << 'EOF'\nconsole.log(1)\nEOF"), null);
});

test('a heredoc carrying a commit message does not count', () => {
  assert.equal(commandWrites(`git add -A && git commit -m "$(cat <<'EOF'\nRES-142: fix\nEOF\n)"`), null);
});

// The real command from T1-P2-O2-muhckhv4. Its commit message describes an
// overlap condition, and the ">" inside it read as a shell redirect until
// heredoc bodies stopped being scanned.
test('a > inside a commit message is not a redirect', () => {
  const command = [
    `git add -A && git commit -m "$(cat <<'EOF'`,
    'Enforce booking domain validation rules',
    '',
    '2. Detects cases where a new booking starts before an existing one',
    '   but endsAt > start, which the old query missed.',
    'EOF',
    ')"',
  ].join('\n');
  assert.equal(commandWrites(command), null);
});

test('a heredoc into a real file still counts after the body is stripped', () => {
  const command = [
    "cat > src/modules/bookings/service.ts <<'EOF'",
    'export function x() { return a > b; }',
    'EOF',
  ].join('\n');
  assert.ok(commandWrites(command));
});
