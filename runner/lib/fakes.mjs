import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyIn, exec } from './container.mjs';

const cannedTranscript = (turns, toolCalls) => {
  const lines = [
    JSON.stringify({
      type: 'system', subtype: 'init', model: 'fake-model',
      claude_code_version: '0.0.0-fake', session_id: 'fake-session', cwd: '/app',
    }),
  ];
  for (let index = 0; index < toolCalls; index += 1) {
    lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] } }));
  }
  lines.push(JSON.stringify({
    type: 'result', subtype: 'success', num_turns: turns, stop_reason: 'end_turn',
    is_error: false, total_cost_usd: 0, duration_ms: 0,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    modelUsage: { 'fake-model': {} },
  }));
  return `${lines.join('\n')}\n`;
};

export const FAKES = {
  noop: {
    describe: 'does nothing, so the session has no diff',
    run: () => cannedTranscript(1, 0),
  },

  reference: {
    describe: 'applies the reference implementation patch',
    run: (name, repoRoot) => {
      const staging = mkdtempSync(join(tmpdir(), 'ref-'));
      const patch = resolve(repoRoot, 'reference', 'T1', 'reference.patch');
      execFileSync('cp', [patch, join(staging, 'reference.patch')]);
      copyIn(name, join(staging, 'reference.patch'), '/tmp/reference.patch');
      // The patch was generated with paths beginning a/seed/ and b/seed/,
      // because reference/T1/verify.sh applies it against a checkout that
      // has a seed/ directory (extracted with `git archive`). The working
      // copy inside the session container is /app, with no seed segment,
      // so a tree named "seed" is recreated under a scratch directory and
      // the patch applied there with -p2 (strips "a/" and "seed/"), then
      // copied back onto /app.
      const applied = exec(name, ['sh', '-c',
        'mkdir -p /tmp/apply/seed && cp -a /app/. /tmp/apply/seed/ && cd /tmp/apply && patch -p2 -d seed < /tmp/reference.patch && cp -a /tmp/apply/seed/. /app/']);
      if (applied.status !== 0) {
        throw new Error(`the reference patch did not apply: ${applied.stderr}`);
      }
      return cannedTranscript(12, 20);
    },
  },

  break: {
    describe: 'deletes a source file, so the application stops building',
    run: (name) => {
      exec(name, ['sh', '-c', 'rm -f /app/src/modules/bookings/service.ts']);
      return cannedTranscript(3, 4);
    },
  },
};
