// Criterion C3's second half (article, section III-F item f.3, and Fig. 4):
// cyclomatic complexity of every function a session created or changed,
// as a rule with one implementation.
//
// The measure is ESLint's core `complexity` rule (McCabe: 1 per function,
// plus 1 per if, loop, case, catch, ternary, `&&`, `||` and `??`), set to
// a maximum of 0 so that it reports every function with its number. It
// runs inside the seed's own image, meeting-rooms-api:1.0.0, which carries
// the ESLint and typescript-eslint parser the sessions had: no version of
// either is installed on the host, so the number does not depend on what
// the reader happens to have.
//
// The rule, per session:
//   1. Copy the seed (/app in the image, the same tree every session
//      started from) and apply the archived session.diff to it. Line
//      endings may disagree: an image built from a Windows checkout has
//      CRLF files, one built on Linux has LF, and the diff follows
//      whatever checkout the reader has. The diff is applied as it is
//      first and, only if that fails, again with carriage returns
//      removed and whitespace ignored -- which changes no line number.
//   2. Run the complexity rule over every .ts file under src/. Tests are
//      outside src/ and are not measured: Fig. 4 is about the
//      deliverable's code.
//   3. A function is "touched" when at least one line the diff added, in
//      that file, falls inside the function's span (start to end line in
//      the patched file). A function enclosing a touched inner function is
//      touched too, because its span contains the added line.
//   4. The seed's own functions are measured the same way, with no diff,
//      as the reference distribution.
//
// Fig. 4 compares models in the two extreme configurations (P0-O1 and
// P2-O2), so the per-model numbers below are restricted to those; the
// count of functions over McCabe's limit is also given over all fifty
// sessions, as the article's text does.
//
// Usage:
//   node tools/analysis/complexidade.mjs              runs Docker, writes docs/dados/complexidade.csv, prints markdown
//   node tools/analysis/complexidade.mjs --do-csv     no Docker: only aggregates the published CSV
//   node tools/analysis/complexidade.mjs --json       either mode, numbers as JSON for figuras.py
//   --csv-path <path>                                 read or write another CSV (tests use this)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRows } from '../../runner/lib/dataset.mjs';
import { parseDiff, toCsv } from './seguranca.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const DEFAULT_CSV = join(REPO_ROOT, 'docs', 'dados', 'complexidade.csv');
export const IMAGE = 'meeting-rooms-api:1.0.0';
export const MCCABE_LIMIT = 10;
export const MODELS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'];
export const SEED = 'semente';
export const COLUMNS = ['session_id', 'task', 'model', 'p_level', 'o_level', 'arquivo', 'funcao', 'linha', 'linha_final', 'complexidade'];

// Runs inside the container. Reads /out/ids.txt, writes /out/<id>.json
// and /out/semente.json. node_modules is linked, not copied: it is the
// image's, it is never patched, and copying it fifty times is most of the
// run's time.
const CONTAINER_SCRIPT = `set -e
cat > /tmp/complexidade.config.mjs <<'JS'
import tseslint from 'typescript-eslint';
export default [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, rules: { complexity: ['error', 0] } }];
JS
measure() {
  cp /tmp/complexidade.config.mjs ./complexidade.config.mjs
  node node_modules/eslint/bin/eslint.js --no-config-lookup -c complexidade.config.mjs -f json $(find src -name '*.ts') > "$1" || true
}
copy_seed() {
  rm -rf /tmp/w && mkdir /tmp/w
  (cd /app && tar cf - --exclude=./node_modules .) | (cd /tmp/w && tar xf -)
  ln -s /app/node_modules /tmp/w/node_modules
  cd /tmp/w
}
copy_seed
measure /out/${SEED}.json
for id in $(tr -d '\\r' < /out/ids.txt); do
  copy_seed
  if ! git apply --whitespace=nowarn "/sessions/$id/session.diff" 2> "/out/$id.apply.log"; then
    tr -d '\\r' < "/sessions/$id/session.diff" > /tmp/session.diff
    if ! git apply --ignore-whitespace --whitespace=nowarn /tmp/session.diff 2>> "/out/$id.apply.log"; then echo "APPLY_FAILED $id"; fi
  fi
  measure "/out/$id.json"
done
`;

// One entry per function ESLint reported, with its span in the file.
export function functionsFromEslint(results, root) {
  return results.flatMap((file) => file.messages
    .filter((message) => message.ruleId === 'complexity')
    .map((message) => {
      const complexity = Number(message.message.match(/complexity of (\d+)/)?.[1]);
      const name = message.message.match(/'([^']+)'/)?.[1] ?? message.message.split(' has a complexity')[0];
      return {
        arquivo: file.filePath.replace(/\\/g, '/').replace(`${root.replace(/\/$/, '')}/`, ''),
        funcao: name,
        linha: message.line,
        linha_final: message.endLine ?? message.line,
        complexidade: complexity,
      };
    }));
}

// The functions whose span contains a line the diff added in that file.
export function touchedFunctions(functions, diffText) {
  const added = parseDiff(diffText);
  return functions.filter((fn) => {
    const lines = added[fn.arquivo];
    if (!lines) return false;
    return lines.some(({ line }) => line >= fn.linha && line <= fn.linha_final);
  });
}

function docker(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
}

export function measureWithDocker({ rows, repoRoot = REPO_ROOT }) {
  const probe = docker(['image', 'inspect', IMAGE]);
  if (probe.status !== 0) {
    throw new Error(`a imagem ${IMAGE} não está disponível (construa com "cd seed && make image"), ou use --do-csv`);
  }
  const sessions = rows.filter((row) => row.status === 'valid');
  const out = mkdtempSync(join(tmpdir(), 'complexidade-'));
  try {
    writeFileSync(join(out, 'ids.txt'), `${sessions.map((row) => row.session_id).join('\n')}\n`);
    writeFileSync(join(out, 'run.sh'), CONTAINER_SCRIPT);
    // Arguments go as an array, never through a shell, so a path with
    // spaces (C:\Users\Some Name\...) reaches Docker intact on Windows and
    // Linux alike. MSYS_NO_PATHCONV stops Git Bash's runtime from
    // rewriting /out and /sessions into Windows paths if node was started
    // from it.
    const run = docker([
      'run', '--rm',
      '-v', `${out}:/out`,
      '-v', `${join(repoRoot, 'sessions')}:/sessions:ro`,
      '-w', '/app',
      '--entrypoint', 'sh',
      IMAGE, '/out/run.sh',
    ], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    if (run.status !== 0) throw new Error(`docker run falhou: ${run.stderr || run.stdout}`);
    const failedApply = (run.stdout.match(/APPLY_FAILED \S+/g) ?? []).map((line) => line.split(' ')[1]);
    if (failedApply.length > 0) throw new Error(`o diff não se aplicou à semente em: ${failedApply.join(', ')}`);

    const seed = functionsFromEslint(JSON.parse(readFileSync(join(out, `${SEED}.json`), 'utf8')), '/tmp/w')
      .map((fn) => ({ session_id: SEED, task: '', model: '', p_level: '', o_level: '', ...fn }));
    const touched = sessions.flatMap((row) => {
      const functions = functionsFromEslint(JSON.parse(readFileSync(join(out, `${row.session_id}.json`), 'utf8')), '/tmp/w');
      const diff = readFileSync(join(repoRoot, 'sessions', row.session_id, 'session.diff'), 'utf8');
      return touchedFunctions(functions, diff).map((fn) => ({
        session_id: row.session_id, task: row.task, model: row.model, p_level: row.p_level, o_level: row.o_level, ...fn,
      }));
    });
    return [...seed, ...touched];
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

export function parseCsv(text) {
  const records = [];
  let field = '';
  let record = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; } else if (char === '"') quoted = false; else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { record.push(field); field = ''; } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field); field = '';
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
    } else field += char;
  }
  if (field !== '' || record.length > 0) { record.push(field); records.push(record); }
  const [header, ...body] = records;
  return body.map((values) => Object.fromEntries(header.map((column, index) => [column, values[index] ?? ''])));
}

const extreme = (record) => (record.p_level === 'P0' && record.o_level === 'O1')
  || (record.p_level === 'P2' && record.o_level === 'O2');

export function summarize(records) {
  const value = (record) => Number(record.complexidade);
  const over = (list) => list.filter((record) => value(record) > MCCABE_LIMIT);
  const seed = records.filter((record) => record.session_id === SEED);
  const sessions = records.filter((record) => record.session_id !== SEED);
  const byFunction = {};
  for (const record of over(sessions)) {
    const key = `${record.arquivo}:${record.funcao}`;
    byFunction[key] = (byFunction[key] ?? 0) + 1;
  }
  return {
    semente: { n: seed.length, acima: over(seed).length, maximo: Math.max(0, ...seed.map(value)) },
    por_modelo_extremos: Object.fromEntries(MODELS.map((model) => {
      const own = sessions.filter((record) => record.model === model && extreme(record));
      return [model, { n: own.length, acima: over(own).length, proporcao: own.length ? over(own).length / own.length : NaN }];
    })),
    todas_as_sessoes: { n: sessions.length, acima: over(sessions).length, por_funcao: byFunction },
    distribuicoes: {
      semente: seed.map(value),
      ...Object.fromEntries(MODELS.map((model) => [model, sessions.filter((record) => record.model === model && extreme(record)).map(value)])),
    },
  };
}

const percent = (value) => `${(value * 100).toFixed(1).replace('.', ',')}%`;

export function formatReport(summary) {
  return [
    '## Complexidade ciclomática (C3, Fig. 4)',
    '',
    `Limite de McCabe: ${MCCABE_LIMIT}. Por modelo, só as configurações extremas (P0-O1 e P2-O2).`,
    '',
    '| grupo | funções | acima de 10 | proporção |',
    '|---|---|---|---|',
    `| semente (referência) | ${summary.semente.n} | ${summary.semente.acima} | ${percent(summary.semente.n ? summary.semente.acima / summary.semente.n : 0)} |`,
    ...Object.entries(summary.por_modelo_extremos).map(([model, value]) => `| ${model.replace(/^claude-/, '')} | ${value.n} | ${value.acima} | ${percent(value.proporcao)} |`),
    '',
    `Nas 50 sessões: ${summary.todas_as_sessoes.n} funções tocadas, ${summary.todas_as_sessoes.acima} acima do limite.`,
    '',
    '| função | ocorrências acima de 10 |',
    '|---|---|',
    ...Object.entries(summary.todas_as_sessoes.por_funcao).sort((a, b) => b[1] - a[1]).map(([name, count]) => `| ${name} | ${count} |`),
    '',
  ].join('\n');
}

function argument(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

function main() {
  const csvPath = resolve(argument('--csv-path', DEFAULT_CSV));
  let records;
  if (process.argv.includes('--do-csv')) {
    if (!existsSync(csvPath)) throw new Error(`CSV não encontrado: ${csvPath}`);
    records = parseCsv(readFileSync(csvPath, 'utf8'));
  } else {
    records = measureWithDocker({ rows: readRows(join(REPO_ROOT, 'resultados.csv')) });
    mkdirSync(dirname(csvPath), { recursive: true });
    writeFileSync(csvPath, toCsv(records, COLUMNS));
  }
  const summary = summarize(records);
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  process.stdout.write(formatReport(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
