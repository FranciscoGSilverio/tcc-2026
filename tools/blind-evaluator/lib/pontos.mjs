// Transcribed verbatim from protocol section 2.4. The prompt is built
// from this list and the response is validated against it (see
// prompts.mjs and parse.mjs), so the question and the check can never
// silently diverge from each other -- only from this file, which the
// test in this directory guards against.
export const PONTOS = [
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

export const AUSENTE = 'ausente';
