// Runs the project's own deterministic checks: `make verify` (typecheck,
// lint, build and tests in the seed), the same command the repository's CI
// runs on every pull request. The Stop hook calls it so the agent sees a
// failure inside the session, before CI does.
//
// A project without a Makefile, or whose Makefile has no `verify` target,
// is not verified here: ran is false and the hook carries on with the
// convention check alone.
import { spawnSync } from 'node:child_process';

const TAIL_LINES = 40;

export function runVerify(dir) {
  const dryRun = spawnSync('make', ['-n', 'verify'], { cwd: dir, stdio: 'ignore' });
  if (dryRun.error || dryRun.status !== 0) return { ran: false, ok: true, tail: '' };

  const result = spawnSync('make', ['verify'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd();
  const tail = output.split('\n').slice(-TAIL_LINES).join('\n');
  return { ran: true, ok: !result.error && result.status === 0, tail };
}
