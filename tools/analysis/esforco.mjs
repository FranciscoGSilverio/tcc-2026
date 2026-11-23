// Criterion C6's effort half (article, section III-F item f.6, and the
// process numbers in sections IV-B and IV-E), as a rule with one
// implementation. It reads the archived transcripts -- transcript.jsonl
// for O1, transcript-1..4.jsonl for O2, one per chained call -- and never
// the dataset's own counters, which do not separate verification from
// the rest of the agent's activity.
//
// Per session:
//
// execucoes_verificacao
//   Bash calls that run any of the project's checks: `npm test`,
//   `npm run test|typecheck|lint|build`, `npx vitest|tsc|eslint`,
//   `vitest`, or `make test|verify|typecheck|lint|build`. One Bash call
//   counts once however many checks it chains (`npm run typecheck && npm
//   test` is one execution). Heredoc bodies are removed before matching
//   (aderencia-o2.mjs's withoutHeredocBodies), so a test file written
//   with `cat > x.test.ts <<'EOF'` that imports vitest is not a run.
//
// execucoes_teste
//   The subset that runs the test suite proper: `npm test`,
//   `npm run test`, `npx vitest`, `vitest`, `make test`, `make verify`.
//
// falha_observada
//   "sim" when the output of at least one verification call shows a
//   failure, after stripping ANSI colour codes: a line starting
//   "Exit code N" with N > 0 (the CLI prefixes it on a non-zero exit),
//   vitest's "N failed", "FAIL" or "Failed Suites", tsc's "error TSnnnn",
//   eslint's "✖ N problem(s)", make's "make: ***", npm's "npm ERR!".
//
// corrigiu_apos_falha
//   "sim" when a write to the working copy follows a failed verification
//   call in the same session (aderencia-o2.mjs's definition of a write:
//   an editing tool, or a shell command that writes inside /app). This is
//   the article's "corrigiu ao menos uma falha antes de entregar".
//
// leituras_antes_da_primeira_edicao
//   Read, Grep, Glob, LS, Task and non-writing Bash calls before the
//   session's first write. Counted across the chained calls of O2.
//
// skills_consultadas
//   Number of calls that consult a skill: the Skill tool, or any tool
//   whose input names /opt/plugin/skills or a SKILL.md (some agents cat
//   the files instead of invoking the tool). Only meaningful for P2.
//
// escritas_passo_4 (O2 only)
//   Writes made during the fourth chained call, the one that asks the
//   agent to test and verify.
//
// Usage:
//   node tools/analysis/esforco.mjs            report in markdown
//   node tools/analysis/esforco.mjs --json     the same numbers as JSON
//   node tools/analysis/esforco.mjs --csv      also writes docs/dados/esforco.csv
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';
import { commandWrites, EDITING_TOOLS, withoutHeredocBodies } from './aderencia-o2.mjs';
import { toCsv } from './seguranca.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export const VERIFICATION = /\b(npm\s+(run\s+)?(test|typecheck|lint|build)\b|npx\s+(vitest|tsc|eslint)\b|make\s+(test|verify|typecheck|lint|build)\b|vitest\b)/;
export const TEST_RUN = /\b(npm\s+(run\s+)?test\b|npx\s+vitest\b|vitest\b|make\s+(test|verify)\b)/;
const ANSI = /\x1b\[[0-9;]*m/g;
export const FAILURE = [
  /^Exit code [1-9]/m,
  /\b\d+ failed\b/,
  /\bFAIL\b|Failed Suites/,
  /error TS\d+/,
  /✖ \d+ problems?/,
  /make: \*\*\* /,
  /npm ERR! /,
];
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'Task', 'Bash']);
const SKILL_PATH = /\/opt\/plugin\/skills|SKILL\.md/;

// Reads the events of one transcript file; a line that is not JSON is
// skipped, the way aderencia-o2.mjs does.
export function parseTranscript(text) {
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // not an event
    }
  }
  return events;
}

// Flattens the steps of a session into tool calls in order, each with its
// step number and the text of its result.
export function toolCalls(steps) {
  const calls = [];
  const results = {};
  steps.forEach((events, stepIndex) => {
    for (const event of events) {
      const content = event.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'tool_use') calls.push({ ...block, step: stepIndex + 1 });
        if (block.type === 'tool_result') {
          results[block.tool_use_id] = typeof block.content === 'string'
            ? block.content
            : (block.content ?? []).map((part) => part.text ?? '').join('\n');
        }
      }
    }
  });
  return calls.map((call) => ({ ...call, output: results[call.id] ?? '' }));
}

const isWrite = (call) => EDITING_TOOLS.includes(call.name)
  || (call.name === 'Bash' && Boolean(commandWrites(call.input?.command)));
const shell = (call) => (call.name === 'Bash' ? withoutHeredocBodies(String(call.input?.command ?? '')) : '');
export const failed = (output) => {
  const clean = output.replace(ANSI, '');
  return FAILURE.some((pattern) => pattern.test(clean));
};

export function effort(steps, { oLevel = 'O1' } = {}) {
  const calls = toolCalls(steps);
  const verification = calls.filter((call) => VERIFICATION.test(shell(call)));
  const failures = verification.filter((call) => failed(call.output));
  const firstWrite = calls.findIndex(isWrite);
  const beforeFirstWrite = firstWrite === -1 ? calls : calls.slice(0, firstWrite);
  const fixed = failures.some((failure) => calls.slice(calls.indexOf(failure) + 1).some(isWrite));
  return {
    execucoes_verificacao: verification.length,
    execucoes_teste: calls.filter((call) => TEST_RUN.test(shell(call))).length,
    falha_observada: failures.length > 0 ? 'sim' : 'nao',
    corrigiu_apos_falha: fixed ? 'sim' : 'nao',
    leituras_antes_da_primeira_edicao: beforeFirstWrite.filter((call) => READING_TOOLS.has(call.name)).length,
    skills_consultadas: calls.filter((call) => call.name === 'Skill' || SKILL_PATH.test(JSON.stringify(call.input ?? {}))).length,
    escritas_passo_4: oLevel === 'O2' ? calls.filter((call) => call.step === 4 && isWrite(call)).length : '',
  };
}

export function readSteps(repoRoot, row) {
  const dir = join(repoRoot, 'sessions', row.session_id);
  const files = row.o_level === 'O2'
    ? [1, 2, 3, 4].map((step) => join(dir, `transcript-${step}.jsonl`))
    : [join(dir, 'transcript.jsonl')];
  return files.map((path) => (existsSync(path) ? parseTranscript(readFileSync(path, 'utf8')) : []));
}

export const COLUMNS = [
  'session_id', 'task', 'model', 'p_level', 'o_level',
  'execucoes_verificacao', 'execucoes_teste', 'falha_observada', 'corrigiu_apos_falha',
  'leituras_antes_da_primeira_edicao', 'skills_consultadas', 'escritas_passo_4',
];

export function analyze({ rows, repoRoot = REPO_ROOT, read = readSteps }) {
  return rows
    .filter((row) => row.status === 'valid')
    .map((row) => ({
      session_id: row.session_id, task: row.task, model: row.model, p_level: row.p_level, o_level: row.o_level,
      ...effort(read(repoRoot, row), { oLevel: row.o_level }),
    }));
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN);

export function summarize(records) {
  const sonnet = records.filter((record) => record.model === 'claude-sonnet-5');
  const p2 = records.filter((record) => record.p_level === 'P2');
  const o2 = records.filter((record) => record.o_level === 'O2');
  return {
    sessoes: records.length,
    media_execucoes_verificacao: mean(records.map((record) => record.execucoes_verificacao)),
    media_execucoes_teste: mean(records.map((record) => record.execucoes_teste)),
    sessoes_com_falha_observada: records.filter((record) => record.falha_observada === 'sim').length,
    sessoes_que_corrigiram: records.filter((record) => record.corrigiu_apos_falha === 'sim').length,
    sonnet_leituras_antes: {
      O1: mean(sonnet.filter((record) => record.o_level === 'O1').map((record) => record.leituras_antes_da_primeira_edicao)),
      O2: mean(sonnet.filter((record) => record.o_level === 'O2').map((record) => record.leituras_antes_da_primeira_edicao)),
    },
    p2_sessoes: p2.length,
    p2_com_skill: p2.filter((record) => record.skills_consultadas > 0).length,
    p2_com_skill_por_modelo: Object.fromEntries(['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'].map((model) => {
      const own = p2.filter((record) => record.model === model);
      return [model, { com_skill: own.filter((record) => record.skills_consultadas > 0).length, de: own.length }];
    })),
    o2_sessoes: o2.length,
    o2_com_escrita_no_passo_4: o2.filter((record) => record.escritas_passo_4 > 0).length,
  };
}

const decimal = (value, digits = 2) => value.toFixed(digits).replace('.', ',');

export function formatReport(summary) {
  return [
    '## Esforço (C6)',
    '',
    `Sessões válidas: ${summary.sessoes}.`,
    '',
    '| medida | valor |',
    '|---|---|',
    `| execuções de verificação por sessão (teste, typecheck, lint, build) | ${decimal(summary.media_execucoes_verificacao)} |`,
    `| execuções da suíte de testes por sessão | ${decimal(summary.media_execucoes_teste)} |`,
    `| sessões com falha observada numa verificação | ${summary.sessoes_com_falha_observada} de ${summary.sessoes} |`,
    `| sessões que alteraram código depois de uma falha | ${summary.sessoes_que_corrigiram} de ${summary.sessoes} |`,
    `| Sonnet, leituras antes da primeira edição, O1 · O2 | ${decimal(summary.sonnet_leituras_antes.O1, 1)} · ${decimal(summary.sonnet_leituras_antes.O2, 1)} |`,
    `| sessões P2 que consultaram alguma skill | ${summary.p2_com_skill} de ${summary.p2_sessoes} (${Object.entries(summary.p2_com_skill_por_modelo).map(([model, value]) => `${model.replace(/^claude-/, '')} ${value.com_skill}/${value.de}`).join(', ')}) |`,
    `| sessões O2 que alteraram arquivo no passo 4 | ${summary.o2_com_escrita_no_passo_4} de ${summary.o2_sessoes} |`,
    '',
  ].join('\n');
}

function main() {
  const records = analyze({ rows: readRows(join(REPO_ROOT, 'resultados.csv')) });
  const summary = summarize(records);
  if (process.argv.includes('--csv')) {
    const path = join(REPO_ROOT, 'docs', 'dados', 'esforco.csv');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, toCsv(records, COLUMNS));
  }
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ resumo: summary, sessoes: records }, null, 2)}\n`);
    return;
  }
  process.stdout.write(formatReport(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
