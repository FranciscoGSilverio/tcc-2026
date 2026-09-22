import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChecklistResponse, parseDecisionPointsResponse } from '../lib/parse.mjs';

const validChecklistJson = JSON.stringify({
  1: { resposta: 'sim', justificativa: 'a' },
  2: { resposta: 'nao', justificativa: 'b' },
  3: { resposta: 'sim', justificativa: 'c' },
  4: { resposta: 'nao', justificativa: 'd' },
  5: { resposta: 'sim', justificativa: 'e' },
  6: { resposta: 'nao', justificativa: 'f' },
});

test('parses a well-formed checklist response and counts sim', () => {
  const result = parseChecklistResponse(validChecklistJson);
  assert.equal(result.qualidade, 3);
  assert.equal(result.answers[1].resposta, 'sim');
});

test('strips a markdown code fence around the JSON', () => {
  const fenced = `\`\`\`json\n${validChecklistJson}\n\`\`\``;
  const result = parseChecklistResponse(fenced);
  assert.equal(result.qualidade, 3);
});

test('throws, does not default, when a checklist answer is missing', () => {
  const incomplete = JSON.stringify({ 1: { resposta: 'sim', justificativa: 'a' } });
  assert.throws(() => parseChecklistResponse(incomplete));
});

test('throws when a checklist answer is neither sim nor nao', () => {
  const bad = validChecklistJson.replace('"sim"', '"talvez"');
  assert.throws(() => parseChecklistResponse(bad));
});

test('parses a well-formed decision points response', () => {
  const json = JSON.stringify({
    1: { categoria: 'endpoint novo', justificativa: 'a' },
    2: { categoria: 'horários livres', justificativa: 'b' },
    3: { categoria: 'fixa', justificativa: 'c' },
    4: { categoria: 'dia', justificativa: 'd' },
    5: { categoria: 'comercial', justificativa: 'e' },
    6: { categoria: 'uma sala', justificativa: 'f' },
    7: { categoria: 'UTC', justificativa: 'g' },
    8: { categoria: 'tudo livre', justificativa: 'h' },
    9: { categoria: 'filtrado', justificativa: 'i' },
    10: { categoria: 'ausente', justificativa: 'j' },
  });
  const result = parseDecisionPointsResponse(json);
  assert.equal(result.answers[1].categoria, 'endpoint novo');
  assert.equal(result.answers[10].categoria, 'ausente');
});

test('throws, does not approximate, when a category is outside the closed list', () => {
  const json = JSON.stringify({
    1: { categoria: 'algo que o modelo inventou', justificativa: 'a' },
    2: { categoria: 'horários livres', justificativa: 'b' },
    3: { categoria: 'fixa', justificativa: 'c' },
    4: { categoria: 'dia', justificativa: 'd' },
    5: { categoria: 'comercial', justificativa: 'e' },
    6: { categoria: 'uma sala', justificativa: 'f' },
    7: { categoria: 'UTC', justificativa: 'g' },
    8: { categoria: 'tudo livre', justificativa: 'h' },
    9: { categoria: 'filtrado', justificativa: 'i' },
    10: { categoria: 'ausente', justificativa: 'j' },
  });
  assert.throws(() => parseDecisionPointsResponse(json));
});

test('throws on text that is not JSON at all', () => {
  assert.throws(() => parseChecklistResponse('desculpe, não posso ajudar com isso'));
  assert.throws(() => parseDecisionPointsResponse('desculpe, não posso ajudar com isso'));
});
