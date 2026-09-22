import { readFileSync } from 'node:fs';
import { AUSENTE, PONTOS } from './pontos.mjs';

const CHECKLIST_TEMPLATE = readFileSync(new URL('../prompts/checklist.md', import.meta.url), 'utf8');
const DECISION_POINTS_TEMPLATE = readFileSync(new URL('../prompts/pontos-de-decisao.md', import.meta.url), 'utf8');

export function buildChecklistPrompt({ statement, diff, referenceMaterial }) {
  return CHECKLIST_TEMPLATE
    .replace('{{STATEMENT}}', statement)
    .replace('{{REFERENCE_MATERIAL}}', referenceMaterial)
    .replace('{{DIFF}}', diff);
}

// Built from PONTOS, not typed out separately, so the prompt and the
// validation in parse.mjs read the exact same list and can never diverge
// from each other (only from pontos.mjs, which its own test guards).
export function buildDecisionPointsPrompt({ statement, diff }) {
  const pointsBlock = PONTOS
    .map((point) => `${point.n}. ${point.nome}: ${point.categorias.map((c) => `\`${c}\``).join(', ')}, ou \`${AUSENTE}\`.`)
    .join('\n');

  return DECISION_POINTS_TEMPLATE
    .replace('{{PONTOS}}', pointsBlock)
    .replace('{{STATEMENT}}', statement)
    .replace('{{DIFF}}', diff);
}
