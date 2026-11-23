import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyRow } from '../../../runner/lib/dataset.mjs';
import {
  analyze, classifySecurity, EXCEPTIONS, parseDiff, summarize, toCsv,
} from '../seguranca.mjs';

// Builds a unified diff that adds `lines` to `path`, starting at line 1.
function addFile(path, lines) {
  return [
    `diff --git a/${path} b/${path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');
}

test('parseDiff numbers added lines in the new file, across hunks, and ignores carriage returns', () => {
  const diff = [
    '--- a/src/x.ts', '+++ b/src/x.ts',
    '@@ -1,2 +1,3 @@', ' keep', '+added at 2', ' keep',
    '@@ -10,2 +11,2 @@', '-gone', '+added at 11', ' keep',
  ].join('\r\n');
  assert.deepEqual(parseDiff(diff)['src/x.ts'], [
    { line: 2, text: 'added at 2' },
    { line: 11, text: 'added at 11' },
  ]);
});

test('an interactive transaction counts as treating the race; the array form and a comment do not', () => {
  const treated = addFile('src/repo.ts', ['return prisma.$transaction(async (tx) => {', '});']);
  const arrayForm = addFile('src/repo.ts', ['return prisma.$transaction([a, b]);']);
  const comment = addFile('src/repo.ts', ['// wrap this in prisma.$transaction(async () => ...) later']);
  const inTests = addFile('tests/x.test.ts', ['await prisma.$transaction(async (tx) => {});']);

  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: treated }).corrida_tratada, 'sim');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: arrayForm }).corrida_tratada, 'nao');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: comment }).corrida_tratada, 'nao');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: inTests }).corrida_tratada, 'nao');
});

test('an exception overrides the label and says why, in the evidence too', () => {
  const [sessionId] = Object.keys(EXCEPTIONS);
  const diff = addFile('src/repo.ts', ['return prisma.$transaction(async (tx) => {', '});']);
  const record = classifySecurity({ sessionId, task: 'T2', diff });
  assert.equal(record.corrida_tratada, 'nao');
  assert.match(record.corrida_evidencia, /^exceção manual: /);
  assert.match(record.excecao, /^corrida_tratada: /);
});

test('a GET route naming availability is a query; a limit counts only when declared and used', () => {
  const route = ["app.get('/availability',", '  { schema: { querystring: Q } },', '  async () => service.find());'];
  const declaredOnly = addFile('src/routes.ts', [...route, 'const MAX_WINDOW_DAYS = 31;']);
  const used = addFile('src/routes.ts', [...route, 'const MAX_WINDOW_DAYS = 31;', 'if (days > MAX_WINDOW_DAYS) throw tooWide();']);
  const notAQuery = addFile('src/routes.ts', ["app.get('/bookings/:id',", '  { schema: { params: P } },', '  async () => x);']);

  const a = classifySecurity({ sessionId: 's', task: 'T2', diff: declaredOnly });
  assert.equal(a.consulta_horarios, 'sim');
  assert.equal(a.limite_periodo, 'nao');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T2', diff: used }).limite_periodo, 'sim');
  const b = classifySecurity({ sessionId: 's', task: 'T2', diff: notAQuery });
  assert.equal(b.consulta_horarios, 'nao');
  assert.equal(b.limite_periodo, '');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: used }).consulta_horarios, '');
});

test('a route with no schema in its first lines is unvalidated input', () => {
  const diff = addFile('src/routes.ts', [
    "app.post('/batch', async (request) => service.batch(request.body));",
    "app.get('/availability', { schema: { querystring: Q } }, async () => x);",
  ]);
  const record = classifySecurity({ sessionId: 's', task: 'T2', diff });
  assert.equal(record.rotas_sem_validacao, 1);
  assert.equal(record.rotas_sem_validacao_evidencia, 'src/routes.ts:1');
});

test('raw SQL and literal secrets are counted; the tagged template is not raw SQL', () => {
  const diff = addFile('src/repo.ts', [
    'await prisma.$queryRawUnsafe(`SELECT * FROM b WHERE id = ${id}`);',
    'await prisma.$queryRaw`SELECT * FROM b WHERE id = ${id}`;',
    "const apiKey = 'sk-live-123456';",
  ]);
  const record = classifySecurity({ sessionId: 's', task: 'T1', diff });
  assert.equal(record.sql_cru, 1);
  assert.equal(record.segredo_no_codigo, 1);
});

test('duration without a limit comes from the hidden suite, for T1 only', () => {
  const hidden = { byRule: { 4: { passed: 2, total: 4 } } };
  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: '', hidden }).duracao_sem_limite, 'sim');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T1', diff: '', hidden: { byRule: { 4: { passed: 4, total: 4 } } } }).duracao_sem_limite, 'nao');
  assert.equal(classifySecurity({ sessionId: 's', task: 'T2', diff: '', hidden }).duracao_sem_limite, '');
});

test('analyze skips invalid rows and summarize counts what persisted', () => {
  const rows = [
    { ...emptyRow(), session_id: 'a', task: 'T1', model: 'claude-sonnet-5', p_level: 'P0', o_level: 'O1', status: 'valid' },
    { ...emptyRow(), session_id: 'b', task: 'T2', model: 'claude-opus-5', p_level: 'P0', o_level: 'O1', status: 'valid' },
    { ...emptyRow(), session_id: 'c', task: 'T2', model: 'claude-opus-5', p_level: 'P0', o_level: 'O1', status: 'invalid' },
  ];
  const diffs = {
    a: { diff: addFile('src/repo.ts', ['return prisma.$transaction(async (tx) => tx);']), hidden: { byRule: { 4: { passed: 0, total: 4 } } } },
    b: { diff: addFile('src/routes.ts', ["app.get('/availability', { schema: {} }, h);"]), hidden: null },
  };
  const records = analyze({ rows, read: (_root, id) => diffs[id] });
  assert.equal(records.length, 2);
  const summary = summarize(records);
  assert.equal(summary.corrida_persiste, 1);
  assert.deepEqual(summary.corrida_tratada, ['a']);
  assert.equal(summary.consultas, 1);
  assert.equal(summary.consultas_sem_limite, 1);
  assert.equal(summary.t1_sem_guia_duracao_sem_limite, 1);
  assert.equal(summary.limite_por_modelo_extremos['claude-opus-5'].com_consulta, 1);
});

test('toCsv quotes fields that carry commas, quotes or newlines', () => {
  const csv = toCsv([{ a: 'x, y', b: 'say "hi"', c: 1 }], ['a', 'b', 'c']);
  assert.equal(csv, 'a,b,c\n"x, y","say ""hi""",1\n');
});
