import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUSENTE, PONTOS } from '../lib/pontos.mjs';

// Transcribed independently from protocol section 2.4, not derived from
// PONTOS — comparing the module against itself would never catch a
// transcription error in the module.
const PROTOCOLO_2_4 = [
  { n: 1, nome: 'Forma da solução', categorias: ['endpoint novo', 'altera listagem existente', 'enriquece o erro 409', 'combinação'] },
  { n: 2, nome: 'Semântica do retorno', categorias: ['horários livres', 'horários ocupados', 'ambos'] },
  { n: 3, nome: 'Granularidade dos intervalos', categorias: ['fixa', 'derivada das reservas', 'parametrizável'] },
  { n: 4, nome: 'Janela temporal padrão', categorias: ['dia', 'semana', 'obrigatória no parâmetro'] },
  { n: 5, nome: 'Limite de horário', categorias: ['comercial', '24 horas', 'configurável'] },
  { n: 6, nome: 'Escopo de salas', categorias: ['uma sala', 'várias por parâmetro', 'todas'] },
  { n: 7, nome: 'Fuso horário', categorias: ['UTC', 'local', 'explícito no contrato'] },
  { n: 8, nome: 'Sala sem reservas', categorias: ['tudo livre', 'lista vazia', '404'] },
  { n: 9, nome: 'Tratamento do passado', categorias: ['filtrado', 'incluído'] },
  { n: 10, nome: 'Contrato do POST de reserva', categorias: ['inalterado', 'passa a sugerir alternativas no 409'] },
];

test('PONTOS matches protocol section 2.4 exactly, point by point', () => {
  assert.equal(PONTOS.length, 10);
  for (const expected of PROTOCOLO_2_4) {
    const actual = PONTOS.find((p) => p.n === expected.n);
    assert.ok(actual, `missing point ${expected.n}`);
    assert.equal(actual.nome, expected.nome);
    assert.deepEqual(actual.categorias, expected.categorias);
  }
});

test('AUSENTE is the literal string used by the protocol', () => {
  assert.equal(AUSENTE, 'ausente');
});
