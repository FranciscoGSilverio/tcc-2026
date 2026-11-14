// PreToolUse on file edits: blocks, before it happens, the two kinds of
// edit the conventions forbid and that can be recognised from the edit
// alone -- touching configuration or the manifest (rules 2 and 3), and
// removing a line that the project's tests had when the session started
// (rule 6). Exit code 2 blocks the tool call and shows stderr to the agent.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIG_FILES, MANIFEST_FILES, baseCommit, git, isProject, projectDir, projectPath, readInput,
} from './lib/project.mjs';
import { applyEdit, originalLinesRemoved } from './lib/guards.mjs';

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

const input = readInput();
const dir = projectDir(input);
if (!isProject(dir)) process.exit(0);

const toolInput = input.tool_input ?? {};
const filePath = toolInput.file_path ?? toolInput.notebook_path;
const path = projectPath(dir, filePath);
if (!path) process.exit(0);

if (CONFIG_FILES.includes(path) || MANIFEST_FILES.includes(path)) {
  block(
    `Bloqueado pela convenção do projeto: \`${path}\` é configuração ou manifesto e não muda ` +
    'para este tipo de tarefa (convenções 2 e 3). Resolva a tarefa sem alterar esse arquivo.',
  );
}

if (path.startsWith('tests/') && path.endsWith('.test.ts')) {
  const base = baseCommit(dir, input.session_id);
  const original = base ? git(dir, ['show', `${base}:${path}`]) : null;
  if (original !== null) {
    const absolute = join(dir, path);
    const current = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
    const after = applyEdit(input.tool_name, toolInput, current);
    const removed = originalLinesRemoved(original, current, after);
    if (removed.length > 0) {
      block(
        `Bloqueado pela convenção do projeto: a edição remove ${removed.length} linha(s) que ` +
        `\`${path}\` já tinha no início da sessão (convenção 6), por exemplo:\n` +
        `  ${removed[0].trim()}\n` +
        'Teste existente descreve comportamento que continua valendo. Acrescente casos sem ' +
        'remover os existentes; se um deles parece errado, investigue o porquê antes.',
      );
    }
  }
}
