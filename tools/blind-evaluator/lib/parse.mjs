import { AUSENTE, PONTOS } from './pontos.mjs';

// Models sometimes wrap JSON in a markdown fence despite being told not
// to. Stripping it here is tolerance for formatting, not for content --
// the JSON itself is still validated strictly below.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

const CHECKLIST_SIZE = 6;

export function parseChecklistResponse(text) {
  const parsed = extractJson(text);
  const answers = {};
  for (let n = 1; n <= CHECKLIST_SIZE; n += 1) {
    const entry = parsed[String(n)];
    if (!entry || (entry.resposta !== 'sim' && entry.resposta !== 'nao')) {
      throw new Error(`checklist answer ${n} is missing or is not exactly sim/nao`);
    }
    answers[n] = { resposta: entry.resposta, justificativa: String(entry.justificativa ?? '') };
  }
  const qualidade = Object.values(answers).filter((answer) => answer.resposta === 'sim').length;
  return { answers, qualidade };
}

// D7: a category outside the closed list fails the whole evaluation for
// that session rather than being coerced to the nearest option or to
// ausente -- an instrument does not substitute in silence.
export function parseDecisionPointsResponse(text) {
  const parsed = extractJson(text);
  const answers = {};
  for (const point of PONTOS) {
    const entry = parsed[String(point.n)];
    const allowed = [...point.categorias, AUSENTE];
    if (!entry || !allowed.includes(entry.categoria)) {
      throw new Error(`decision point ${point.n} category is missing or outside the closed list`);
    }
    answers[point.n] = { categoria: entry.categoria, justificativa: String(entry.justificativa ?? '') };
  }
  return { answers };
}
