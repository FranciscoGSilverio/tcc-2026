# Primeira célula completa de T2 — três execuções e a validação dos pontos de decisão

**Data:** 2026-09-22
**Célula:** T2, P0, O1, Sonnet 5, três execuções
**Objetivo:** responder se os dez pontos de decisão da seção 2.4 do protocolo são classificáveis contra saída real. Eles nunca haviam sido testados contra nenhuma saída.

---

## 1. As três sessões

| | execução 1 | execução 2 | execução 3 |
|---|---|---|---|
| `session_id` | `T2-P0-O1-mudcr5pg` | `T2-P0-O1-mudcyv6z` | `T2-P0-O1-muddre1p` |
| `status` | valid | valid | valid |
| `taxa_aceitacao` | vazia | vazia | vazia |
| `regressoes` | 0 | **1** | 0 |
| `violacoes` | 0 | **1** (regra 6) | 0 |
| `qualidade` | 6 | 6 | 6 |
| `n_turns` | 34 | 43 | 37 |
| `custo_usd` | 0,5912 | 0,7857 | 0,6300 |

`taxa_aceitacao` vazia e não zero nas três, como a guarda de capacidades determina: T2 não tem suíte oculta, e um zero ali se leria como nota.

## 2. Os dez pontos, execução a execução

| # | Ponto | Execução 1 | Execução 2 | Execução 3 | Convergiu |
|---|---|---|---|---|---|
| 1 | Forma da solução | endpoint novo | combinação | endpoint novo | não |
| 2 | Semântica do retorno | ambos | horários livres | horários livres | não |
| 3 | Granularidade | derivada das reservas | derivada das reservas | parametrizável | não |
| 4 | Janela temporal padrão | obrigatória no parâmetro | obrigatória no parâmetro | obrigatória no parâmetro | sim |
| 5 | Limite de horário | **ausente** | **ausente** | **ausente** | sim (inerte) |
| 6 | Escopo de salas | uma sala | uma sala | uma sala | sim |
| 7 | Fuso horário | **ausente** | **ausente** | **ausente** | sim (inerte) |
| 8 | Sala sem reservas | tudo livre | tudo livre | tudo livre | sim |
| 9 | Tratamento do passado | incluído | ausente | ausente | não |
| 10 | Contrato do POST | inalterado | sugere alternativas no 409 | inalterado | não |

**`convergencia` sobre os dez pontos congelados: 5/10 = 0,50.**
**`convergencia` sobre os oito pontos vivos: 3/8 = 0,38.**
Métrica secundária da seção 5.2, média de categorias distintas por ponto vivo: **1,62**.

## 3. O achado: dois pontos são inertes, e inertes inflam a convergência

Os pontos 5 (limite de horário) e 7 (fuso horário) voltaram `ausente` nas três execuções. Isto **não** é falha dos agentes: os pontos de decisão não são requisitos, são eixos ao longo dos quais soluções podem divergir, e `ausente` significa que a solução não toma posição naquele eixo — não que deixou de atender algo.

A causa não é acaso. **Nada no material que o agente enxerga aponta para esses dois eixos.** O chamado RES-142 não menciona horário comercial nem fuso; `contexts/P1/CLAUDE.md` também não, o que estende a previsão para P1 e P2, já que P2 carrega o mesmo conteúdo de domínio; e a semente não tem noção de nenhum dos dois — `src/shared/time.ts` traz apenas `parseInstant`, `durationMinutes` e `isBefore`. Os dois eixos foram inventados no planejamento sem nada no enunciado que os provocasse.

**A consequência é de medida.** Pela seção 2.4, `ausente` conta como categoria própria, então um ponto sempre ausente registra concordância nas três execuções e entra como convergência. Mas nada convergiu ali: o eixo nunca existiu para haver desacordo. A diferença medida é exatamente isto: 0,50 sobre os dez congelados contra 0,38 sobre os oito vivos — cerca de um quarto do valor reportado é enchimento.

**Por que não cortamos os dois pontos.** Seria o mesmo pecado que a seção 2.4 proíbe, invertido. A lista é congelada antes das sessões "porque definir pontos de decisão depois de ver as saídas seria escolher os pontos onde a divergência já apareceu". Remover os pontos que concordaram é a outra face disso — são precisamente os que puxam a convergência para cima, e tirá-los faria o trabalho **parecer ter encontrado mais divergência do que encontrou**, na direção da hipótese.

**O que se faz em vez disso, e custa zero:** reportar os dois números. Convergência sobre os dez pontos congelados, como o protocolo define, e convergência sobre os pontos vivos, declarando quais foram inertes e por quê. Nada é removido, nada é escondido, e a inflação fica explícita em vez de corrigida à mão.

## 4. Situação contra o portão de M3

**Verificação 8 — "os dez pontos são classificáveis nas saídas produzidas; nenhum ficou `ausente` nas três execuções": FALHA**, por dois pontos. A falha está diagnosticada e a resposta proposta é o relato duplo da seção 3, não a alteração da lista.

**Verificação 9 — "as três execuções não foram nem idênticas nem incomparáveis": PASSA com folga.** Cinco dos dez pontos divergem, e três dos oito vivos convergem. As três soluções são claramente comparáveis (todas construíram alguma noção de disponibilidade, como a seção 2.3 previa) e claramente distintas.

## 5. O instrumento funciona, e há evidência disso além do resultado

O classificador é **coerente consigo mesmo** onde dois pontos se amarram. Na execução 2 ele respondeu "combinação" no ponto 1 e "sugere alternativas no 409" no ponto 10; nas execuções 1 e 3, "endpoint novo" e "inalterado". As duas leituras se sustentam mutuamente em cada caso, e ambas foram conferidas contra os diffs à mão. Um classificador chutando não produziria essa amarração.

A decomposição das métricas também se comportou como desenhada. A execução 2 quebrou um teste da semente e alterou `tests/shared.test.ts` — `regressoes` 1, `violacoes` 1 — e ainda assim marcou `qualidade` 6. Quebra de contrato é assunto de `regressoes`, não do checklist, que é exatamente o motivo pelo qual a pergunta 7 foi retirada (decisão D8 da spec do avaliador cego). As três métricas mediram coisas diferentes em vez de colapsarem uma na outra.

## 6. Custo, agora medido para T2

| | T1 | T2 |
|---|---|---|
| Custo médio por sessão | US$ 0,44 | **US$ 0,67** |
| Turnos | 30, 31 | 34, 43, 37 |

T2 custa cerca de **52% mais** que T1 por sessão, confirmando a previsão de que uma tarefa sem suíte de testes como critério de parada consome mais turnos. Gasto acumulado em sessões até aqui: US$ 2,88. Gasto acumulado em avaliação cega: US$ 0,22.

A extrapolação de orçamento precisa ser refeita com dois custos distintos por tarefa, não com um número único.

## 7. Por que sessões reais e não sondagens escritas à mão

O log de implementação previa duas soluções de sondagem escritas à mão para este passo. A troca por sessões reais foi deliberada, e o achado justifica a troca: sondagens escritas **conhecendo as dez categorias** teriam contemplado os dez eixos por construção, e os pontos 5 e 7 pareceriam saudáveis. O buraco só apareceria na coleta, depois de o protocolo estar congelado.
