import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyRow } from '../../../runner/lib/dataset.mjs';
import { analyze, effort, failed, parseTranscript, summarize } from '../esforco.mjs';

// One assistant event with a tool call and one user event with its
// result, as the CLI writes them to transcript.jsonl.
let counter = 0;
function call(name, input, output = '') {
  counter += 1;
  const id = `t${counter}`;
  return [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: output }] } },
  ];
}
const bash = (command, output) => call('Bash', { command }, output);

test('parseTranscript skips lines that are not JSON', () => {
  const text = `${JSON.stringify({ type: 'system' })}\nnot json\n\n${JSON.stringify({ type: 'result' })}\n`;
  assert.equal(parseTranscript(text).length, 2);
});

test('a chained command is one execution, and a heredoc that mentions vitest is none', () => {
  const steps = [[
    ...bash('npm run typecheck && npm test 2>&1 | tail -20', 'ok'),
    ...bash("cat > tests/x.test.ts <<'EOF'\nimport { it } from 'vitest';\nEOF", ''),
    ...bash('make verify 2>&1', 'ok'),
    ...bash('npm run lint', 'ok'),
  ]];
  const result = effort(steps);
  assert.equal(result.execucoes_verificacao, 3);
  assert.equal(result.execucoes_teste, 2);
});

test('failures are read through ANSI colours, and a fix is a write after one', () => {
  assert.equal(failed('\x1b[31m1 failed\x1b[39m'), true);
  assert.equal(failed('Exit code 2\nsomething'), true);
  assert.equal(failed('src/a.ts(3,1): error TS2322: nope'), true);
  assert.equal(failed('Tests  26 passed (26)'), false);

  const fixedSteps = [[
    ...bash('npm test', 'Tests  1 failed | 25 passed'),
    ...call('Edit', { file_path: '/app/src/a.ts' }),
    ...bash('npm test', 'Tests  26 passed'),
  ]];
  const fixed = effort(fixedSteps);
  assert.equal(fixed.falha_observada, 'sim');
  assert.equal(fixed.corrigiu_apos_falha, 'sim');

  const giveUp = effort([[...call('Edit', { file_path: '/app/src/a.ts' }), ...bash('npm test', 'Tests  1 failed')]]);
  assert.equal(giveUp.falha_observada, 'sim');
  assert.equal(giveUp.corrigiu_apos_falha, 'nao');
});

test('reading before the first write counts across O2 steps, and step 4 writes are counted', () => {
  const steps = [
    [...call('Read', { file_path: '/app/src/a.ts' }), ...bash('ls /app/src')],
    [...call('Grep', { pattern: 'x' })],
    [...call('Edit', { file_path: '/app/src/a.ts' }), ...call('Read', { file_path: '/app/src/b.ts' })],
    [...call('Write', { file_path: '/app/src/c.ts' })],
  ];
  const result = effort(steps, { oLevel: 'O2' });
  assert.equal(result.leituras_antes_da_primeira_edicao, 3);
  assert.equal(result.escritas_passo_4, 1);
  assert.equal(effort(steps).escritas_passo_4, '');
});

test('a skill is consulted through the tool or by reading its file, but not by reading src/plugins', () => {
  const steps = [[
    ...call('Skill', { skill: 'meeting-rooms-conventions:estender-modulo' }),
    ...bash('cat /opt/plugin/skills/escrever-testes/SKILL.md'),
    ...call('Read', { file_path: '/app/src/plugins/error-handler.ts' }),
  ]];
  assert.equal(effort(steps).skills_consultadas, 2);
});

test('analyze and summarize, over valid rows only', () => {
  const row = (id, model, pLevel, oLevel, status = 'valid') => ({
    ...emptyRow(), session_id: id, task: 'T1', model, p_level: pLevel, o_level: oLevel, status,
  });
  const rows = [
    row('a', 'claude-sonnet-5', 'P2', 'O1'),
    row('b', 'claude-haiku-4-5', 'P2', 'O2'),
    row('c', 'claude-sonnet-5', 'P0', 'O1', 'invalid'),
  ];
  const transcripts = {
    a: [[...call('Skill', { skill: 'x' }), ...bash('npm test', 'Tests  1 failed'), ...call('Edit', { file_path: '/app/src/a.ts' })]],
    b: [[...bash('npm test', 'ok')], [], [], []],
  };
  const records = analyze({ rows, read: (_root, r) => transcripts[r.session_id] });
  assert.equal(records.length, 2);
  const summary = summarize(records);
  assert.equal(summary.media_execucoes_verificacao, 1);
  assert.equal(summary.sessoes_que_corrigiram, 1);
  assert.equal(summary.p2_com_skill, 1);
  assert.deepEqual(summary.p2_com_skill_por_modelo['claude-haiku-4-5'], { com_skill: 0, de: 1 });
  assert.equal(summary.o2_com_escrita_no_passo_4, 0);
});
