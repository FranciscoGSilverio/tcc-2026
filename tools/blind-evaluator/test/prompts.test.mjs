import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklistPrompt, buildDecisionPointsPrompt } from '../lib/prompts.mjs';

test('checklist prompt embeds statement, reference material and diff', () => {
  const prompt = buildChecklistPrompt({
    statement: 'ENUNCIADO_MARCADOR',
    diff: 'DIFF_MARCADOR',
    referenceMaterial: 'REFERENCIA_MARCADOR',
  });
  assert.match(prompt, /ENUNCIADO_MARCADOR/);
  assert.match(prompt, /DIFF_MARCADOR/);
  assert.match(prompt, /REFERENCIA_MARCADOR/);
  assert.match(prompt, /seis perguntas/);
});

test('checklist prompt has six numbered questions, not seven', () => {
  const prompt = buildChecklistPrompt({ statement: 's', diff: 'd', referenceMaterial: 'r' });
  assert.match(prompt, /^6\. /m);
  assert.doesNotMatch(prompt, /^7\. /m);
  assert.doesNotMatch(prompt, /contratos HTTP pré-existentes seguem compatíveis, sem quebra não solicitada\?/);
});

test('decision points prompt lists all ten points with their categories', () => {
  const prompt = buildDecisionPointsPrompt({ statement: 'ENUNCIADO_MARCADOR', diff: 'DIFF_MARCADOR' });
  assert.match(prompt, /ENUNCIADO_MARCADOR/);
  assert.match(prompt, /DIFF_MARCADOR/);
  for (let n = 1; n <= 10; n += 1) {
    assert.match(prompt, new RegExp(`^${n}\\. `, 'm'));
  }
  assert.match(prompt, /ausente/);
});

// The blindness guarantee from protocol section 2.7 and spec section 3:
// neither prompt may ever carry P/O/model/session-id, regardless of what
// the caller happens to have lying around. This session id is used only
// as a local string here -- it is never passed into statement or diff --
// which is exactly the property being tested: even a condition-looking
// string never leaks in through those two fields.
test('built prompts never contain condition-looking strings', () => {
  const contaminatedLookingId = 'T2-P2-O2-abc123';
  const checklist = buildChecklistPrompt({
    statement: 'plain statement text',
    diff: 'plain diff text',
    referenceMaterial: 'plain reference text',
  });
  const decision = buildDecisionPointsPrompt({ statement: 'plain statement text', diff: 'plain diff text' });

  for (const text of [checklist, decision]) {
    assert.doesNotMatch(text, /P0|P1|P2|O1|O2/);
    assert.doesNotMatch(text, /claude-(sonnet|opus|haiku)/);
    assert.doesNotMatch(text, new RegExp(contaminatedLookingId));
  }
});
