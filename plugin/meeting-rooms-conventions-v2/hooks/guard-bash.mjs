// PreToolUse on Bash: blocks installing a new package (convention 2).
// `npm install` / `npm ci` with no package named only restores what the
// lockfile already has, and stays allowed.
import { installsPackage } from './lib/guards.mjs';
import { isProject, projectDir, readInput } from './lib/project.mjs';

const input = readInput();
const dir = projectDir(input);
if (!isProject(dir)) process.exit(0);

const packages = installsPackage(input.tool_input?.command ?? '');
if (packages) {
  process.stderr.write(
    `Bloqueado pela convenção do projeto: instalar \`${packages}\` acrescenta dependência nova ` +
    '(convenção 2). O que já está instalado basta para este tipo de tarefa — por exemplo, ' +
    'aritmética de data com `Date` puro.\n',
  );
  process.exit(2);
}
