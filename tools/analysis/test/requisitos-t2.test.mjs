import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyRow } from '../../../runner/lib/dataset.mjs';
import { analyze, classifyRequirements, EXCEPTIONS, summarize } from '../requisitos-t2.mjs';

function addFile(path, lines) {
  return [
    `diff --git a/${path} b/${path}`,
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');
}

const QUERY = addFile('src/routes.ts', ["app.get('/availability', { schema: { querystring: Q } }, h);"]);

test('a query for free times meets the explicit requirement; nothing new does not', () => {
  const met = classifyRequirements({ sessionId: 's', diff: QUERY, regressoes: '0', decisao9: 'filtrado' });
  assert.equal(met.explicito, 'sim');
  assert.match(met.explicito_evidencia, /GET \/availability/);
  const none = classifyRequirements({ sessionId: 's', diff: addFile('src/x.ts', ['const a = 1;']), regressoes: '0', decisao9: 'ausente' });
  assert.equal(none.explicito, 'nao');
});

test('a batch route or a multi-room query serves several bookings at once', () => {
  const batch = addFile('src/routes.ts', ["app.post('/batch', { schema: { body: B } }, h);"]);
  const rooms = addFile('src/schema.ts', ['export const Q = Type.Object({ roomIds: Type.Array(Type.String()) });']);
  assert.equal(classifyRequirements({ sessionId: 's', diff: batch, regressoes: '0', decisao9: '' }).varias_reservas, 'sim');
  assert.equal(classifyRequirements({ sessionId: 's', diff: rooms, regressoes: '0', decisao9: '' }).varias_reservas, 'sim');
  assert.equal(classifyRequirements({ sessionId: 's', diff: QUERY, regressoes: '0', decisao9: '' }).varias_reservas, 'nao');
});

test('not breaking comes from regressoes, and the past only applies when there is something to offer', () => {
  const broke = classifyRequirements({ sessionId: 's', diff: QUERY, regressoes: '1', decisao9: 'filtrado' });
  assert.equal(broke.nao_quebra, 'nao');
  assert.equal(broke.passado, 'sim');
  assert.match(broke.passado_evidencia, /avaliador cego/);
  const nothing = classifyRequirements({ sessionId: 's', diff: '', regressoes: '0', decisao9: 'filtrado' });
  assert.equal(nothing.passado, '');
});

test('the exception table decides the cases the rule cannot, in both directions', () => {
  const entries = Object.entries(EXCEPTIONS).map(([id, labels]) => [id, labels.explicito.value]);
  assert.ok(entries.some(([, value]) => value === 'sim'));
  assert.ok(entries.some(([, value]) => value === 'nao'));
  for (const [sessionId, value] of entries) {
    const opposite = value === 'sim' ? '' : QUERY;
    const record = classifyRequirements({ sessionId, diff: opposite, regressoes: '0', decisao9: 'incluído' });
    assert.equal(record.explicito, value);
    assert.match(record.explicito_evidencia, /^exceção manual: /);
  }
});

test('analyze takes valid T2 rows only, and summarize groups by model and by guide', () => {
  const row = (id, model, pLevel, oLevel, extra = {}) => ({
    ...emptyRow(), session_id: id, task: 'T2', model, p_level: pLevel, o_level: oLevel, status: 'valid', regressoes: '0', decisao_9: 'incluído', ...extra,
  });
  const rows = [
    row('a', 'claude-sonnet-5', 'P0', 'O1'),
    row('b', 'claude-sonnet-5', 'P1', 'O2'),
    row('c', 'claude-haiku-4-5', 'P2', 'O2'),
    { ...row('d', 'claude-sonnet-5', 'P0', 'O1'), task: 'T1' },
    { ...row('e', 'claude-sonnet-5', 'P0', 'O1'), status: 'invalid' },
  ];
  const diffs = { a: QUERY, b: QUERY, c: '' };
  const records = analyze({ rows, read: (_root, id) => ({ diff: diffs[id] }) });
  assert.deepEqual(records.map((record) => record.session_id), ['a', 'b', 'c']);
  const summary = summarize(records);
  assert.deepEqual(summary.sonnet_sem_guia.explicito, { sim: 1, de: 1 });
  assert.deepEqual(summary.sonnet_com_guia.explicito, { sim: 1, de: 1 });
  assert.deepEqual(summary.extremos_por_modelo['claude-haiku-4-5'].explicito, { sim: 0, de: 1 });
  assert.deepEqual(summary.extremos_por_modelo['claude-haiku-4-5'].passado, { sim: 0, de: 0 });
});
