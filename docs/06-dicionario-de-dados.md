# Dicionário de dados

Este documento descreve, coluna a coluna, o que `resultados.csv` contém, e
arquivo a arquivo, o que cada `sessions/<id>/` guarda. É o primeiro
documento que a fase de análise deveria abrir: `resultados.csv` sozinho
não diz o que uma coluna vazia significa, nem por que duas colunas que
parecem a mesma coisa (`travou` e `travou_turnos`, `qualidade` e
`violacoes`, `custo_usd` e o custo do avaliador cego) não são.

O esquema tem **41 colunas**, definidas em código em `runner/lib/dataset.mjs`
(export `COLUMNS`), que é a fonte de verdade sobre o cabeçalho. Este
documento explica o que cada coluna significa; o código garante que o
cabeçalho escrito seja sempre esse. Nenhum dos dois substitui o outro.

Referências: `docs/02-protocolo-experimental.md` (protocolo, abreviado
"protocolo" abaixo), `docs/05-log-de-implementacao.md` ("log de
implementação"), `runner/README.md`, `tools/blind-evaluator/README.md`.

## 1. Convenções gerais

- **Uma linha por sessão.** Uma sessão é uma execução completa e isolada
  do agente sob uma configuração (plano de projeto, glossário, seção 2).
- **O CSV é append-only na coleta.** `runner/run-session.mjs` grava a
  linha assim que a sessão termina (`status: valid` ou `status: invalid`).
  Duas colunas — `qualidade` e `decisao_1`..`decisao_10` — são
  preenchidas depois, numa passagem separada, por
  `tools/blind-evaluator/evaluate.mjs`, que reabre a linha por
  `session_id` e faz um patch nela (`updateRow`). Até essa passagem
  rodar, essas colunas ficam vazias numa linha por outro lado completa.
- **Vazio (`""`) tem três significados diferentes conforme a coluna**, e
  confundi-los é o erro mais caro que este documento existe para evitar:
  "não se aplica a esta tarefa" (`taxa_aceitacao` em T2, `decisao_*` em
  T1), "ainda não foi medido" (`decisao_*`/`qualidade` numa sessão T2
  válida que ainda não passou pelo avaliador cego) e "medido e o valor é
  zero" (que nunca é representado como vazio — é sempre o dígito `0`).
  Cada verbete abaixo diz explicitamente qual dos três se aplica.
- **`convergencia` não é uma coluna.** É calculada na análise, sobre três
  linhas de uma célula (mesmo `p_level` e `o_level`, `task = T2`), por
  `tools/analysis/convergencia.mjs`. Ver a seção 3 deste documento.

## 2. Colunas de `resultados.csv`

### 2.1 Identificação da sessão

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `session_id` | string | ambas | Identificador único da sessão: `${task}-${p_level}-${o_level}-${timestamp em base36}` (`runner/run-session.mjs`). Não é aleatório — carrega o rótulo da condição, então nunca deve ser usado como prova de identidade cega em nada que passe pelo avaliador cego (que por isso nunca o recebe). |
| `task` | `T1` \| `T2` | ambas | Qual das duas tarefas essa sessão executou. Define, por si só, se `taxa_aceitacao` e `decisao_*` se aplicam (`runner/lib/capabilities.mjs`, `TASKS`). |
| `model` | string | ambas | **O apelido pedido na chamada** ao CLI (`--model`), ex.: `claude-sonnet-5`. É sempre conhecido, porque é o runner quem o escolhe. Ver a nota na seção 2.6 sobre a diferença com `model_version`. |
| `model_version` | string | ambas | O que o CLI do agente reportou de volta no evento `system/init` do transcript, sem transformação. Ver a nota na seção 2.6 — para modelos chamados por apelido, isto **não** é a versão datada. |
| `p_level` | `P0` \| `P1` \| `P2` | ambas | Nível do fator de contexto estático (protocolo, seção 3.2): P0 sem contexto, P1 com `contexts/P1/CLAUDE.md`, P2 com o mesmo arquivo mais o plugin de convenções. |
| `o_level` | `O1` \| `O2` | ambas | Nível do fator de ordem de execução (protocolo, seção 3.3): O1 é uma chamada só; O2 é quatro chamadas encadeadas (explorar, planejar, implementar, verificar), definidas em `orders/O2/*.md`. |
| `run_number` | inteiro | ambas | Número da repetição dentro da célula: 1–2 para T1 (duas repetições, servem para estimar ruído), 1–3 para T2 (três repetições, é o instrumento de convergência — protocolo, seção 4.1). É passado por `--run` na chamada do runner. A partir da coleta em lotes (23/09/2026) este número deixou de ser digitado: `tools/collect/run-grid.mjs` conta quantas sessões válidas daquela célula já existem no dataset e usa a próxima. Um número repetido deixou de ser possível por construção. O risco anterior — quem dispara erra o número e o dataset passa a ter duas sessões "run 1" na mesma célula — vale apenas para as sete sessões coletadas antes dessa data, e nelas foi conferido à mão. |
| `started_at` | ISO 8601 (UTC) | ambas | Timestamp de quando o runner começou a preparar a sessão. |
| `ended_at` | ISO 8601 (UTC) | ambas | Timestamp de quando a sessão terminou (sucesso ou falha de infraestrutura). `ended_at - started_at` inclui a preparação do contêiner e a medição, não só o tempo do agente — para o tempo do agente use `duracao_s` (seção 2.4). |

### 2.2 Ambiente de execução

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `image_digest` | string (`sha256:...`) | ambas | Digest da imagem de contêiner em que a sessão rodou. **Mina #11.** O protocolo (seção 3.4) trata a imagem como constante do experimento, e nas **nove primeiras sessões o valor é diferente em todas as nove**. **O ambiente não variou**; a coluna é que não conseguia registrá-lo. Duas causas, ambas corrigidas. (a) Até 23/09/2026 o runner reconstruía a imagem antes de cada sessão. (b) Até 25/09/2026 o `buildImage()` deixava o BuildKit anexar um atestado de proveniência, cujos timestamps de build mudam o `.Id` **a cada build, mesmo com todas as camadas `CACHED`** — medido diretamente em 25/09: dois builds consecutivos deram `.Id` diferentes com `RootFS.Layers` idênticos e `Config` idêntica. Ou seja, a coluna vinha registrando o nonce do BuildKit, não o contêiner. Uma versão anterior desta entrada atribuía a instabilidade ao contexto de build (`runner/`) mudar; isso estava errado — o `Dockerfile.session` não tem nenhum `COPY`, então o contexto não invalida camada nenhuma. Evidência independente de que as entradas eram as mesmas: imagem base presa por digest (`node:22-bookworm-slim@sha256:83f487e0…`), 301 dependências presas pelo `package-lock.json`, e a árvore `seed/` inalterada desde 16/09/2026 (hash `4a5e8206…`). A partir de 25/09 o build passa `--provenance=false` e o digest é estável para conteúdo idêntico, então a coluna **comprova** a constante e a guarda de deriva do runner passa a significar alguma coisa: um digest que muda agora quer dizer que o ambiente mudou de verdade. **As nove linhas antigas mantêm o valor medido e não foram reescritas** — as imagens em que rodaram não existem mais e o conteúdo delas não pode ser conferido hoje; substituir valor medido por valor inferido não é coisa que um dataset deva carregar. O auditor (`tools/collect/check-dataset.mjs`, verificação 4) exclui essas nove **nomeando-as** a cada execução. |
| `cli_version` | string | ambas | Versão do CLI do Claude Code rodando dentro do contêiner (`claude --version`, capturado por `prepare.mjs`). O README do runner fixa essa versão na imagem (`2.1.272` no momento da última verificação) — esta coluna é a confirmação empírica disso por sessão, não uma leitura da imagem. |

### 2.3 Validade

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `status` | `valid` \| `invalid` | ambas | **Mina #10.** `invalid` significa **falha de infraestrutura** — não desempenho ruim do agente. A fronteira é temporal, não de sintoma (`runner/README.md`, "A regra de invalidação"): o runner prova que a aplicação respondia à saúde **antes** de entregá-la ao agente; qualquer falha do servidor a partir daí é dado (`valid`), não descarte. Container que não sobe, checagem de vazamento que falha, servidor que não responde no preflight, CLI que não inicia, API indisponível ou com rate limit, erro do próprio runner, ou 30 minutos de parede estourados — tudo isso é `invalid`, e a sessão é **re-executada**; não é ponto de dado e por isso o script de convergência (seção 3 deste documento) a ignora inteiramente. Em contraste, agente que estourou turnos, terminou sem diff, ou deixou o build/typecheck ou o servidor quebrados **depois** — isso é `valid`, e vira `travou = true` (seção 2.4), não `invalid`. O substituto `--fake break` do runner existe justamente para provar isso: ele apaga um arquivo de produção, quebra o build, e a sessão sai `status: valid`, `travou_build: true`, `taxa_aceitacao: 0` — registrada como dado com nota zero, não descartada. Se esse substituto algum dia voltar `invalid`, o runner está removendo silenciosamente as piores sessões do dataset. |
| `invalid_reason` | string | ambas | Preenchida só quando `status = invalid`; vazia quando `status = valid`. Mensagem da exceção que causou a invalidação (`InfrastructureError`, ou erro genérico do runner) — texto livre, não categórico. |

### 2.4 Métricas de sessão (protocolo, seção 5.1)

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `taxa_aceitacao` | decimal, 0–1 | só T1 | **Mina #1.** Testes ocultos aprovados dividido pelo total (26 asserções — log de implementação, 15/09). **Vazia** significa "não se aplica, é T2" (T2 não tem suíte oculta por desenho — `capabilities.mjs` documenta em comentário por que escrever uma destruiria a pergunta de pesquisa de T2). **Zero** é um valor medido e real: a aplicação não respondeu (ex.: build quebrado, servidor não sobe) e a sessão é pontuada com nota zero em vez de descartada (`run-session.mjs`, comentário junto à linha `row.taxa_aceitacao = ...`; `runner/README.md`, substituto `--fake break`). Vazio e zero são opostos, não graus da mesma coisa. |
| `regressoes` | inteiro | ambas | Quantos dos testes pré-existentes da semente (sete arquivos, `SEED_TEST_FILES` em `runner/lib/measure.mjs`) que passavam antes da sessão passam a falhar depois. Roda depois de restaurar os arquivos de teste congelados por cima do que o agente deixou (para medir contra o contrato original, não contra testes que o agente possa ter editado). Zero é um valor real e comum, não "não medido"; `null` só ocorre se a própria medição falhar, caso em que `measure.mjs` cai para `buildOk ? 0 : SEED_TEST_FILES.length` — isto é, se o build está ok mas a leitura do relatório falhou, assume zero; se o build está quebrado, assume que todos os arquivos de teste falharam. |
| `violacoes` | inteiro, 0–8 | ambas | **Mina #9.** Contagem de quantas das oito regras determinísticas da seção 2.6 do protocolo dispararam (`tools/convention-check/check.mjs`, `checkConventions`). O **detalhamento regra a regra** (qual das oito disparou, com o texto do porquê) não está no CSV — está em `sessions/<id>/conventions.json`, escrito só se a medição de convenções não falhou (ver `runner/run-session.mjs`: `if (measured.conventions) writeFileSync(...)`). Em P0 o agente não é informado das regras; em P1 e P2 são declaradas no contexto — o próprio ponto do fator P. |
| `qualidade` | inteiro, **0–6** | ambas | **Mina #2.** Itens "sim" no checklist de seis perguntas binárias do avaliador cego (protocolo, seção 2.7). **Não vai a sete**: a pergunta 7 original ("os contratos HTTP pré-existentes seguem compatíveis?") foi retirada em 21/09/2026 por ser redundante com `regressoes`, que mede a mesma coisa executando a suíte em vez de pedir a um avaliador que só vê o diff para adivinhar (protocolo, seção 2.7, "Pergunta 7 retirada"; decisão completa em `docs/superpowers/specs/2026-09-21-avaliador-cego-design.md`, seção 4.1). **Vazia** numa linha `valid` significa que a sessão ainda não passou pelo avaliador cego — `tools/blind-evaluator/evaluate.mjs` preenche essa coluna numa passagem separada, depois da coleta, via `updateRow`; não é possível distinguir "avaliador respondeu zero perguntas como sim" (que também seria um `0`, valor legítimo) de "não avaliado ainda" olhando só o número — é preciso checar se a coluna está vazia. |

### 2.5 Custo e esforço

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `custo_usd` | decimal, dólares | ambas | **Mina #8.** Soma de `total_cost_usd` de todos os eventos `result` do transcript da sessão (`runner/lib/transcript.mjs`, `sum((r) => r.total_cost_usd)`) — em O2, soma das quatro chamadas encadeadas. É **só o custo do agente que produziu o diff**. O custo do avaliador cego (checklist + pontos de decisão) fica em `sessions/<id>/evaluation.json`, campo `totalCostUsd`, e não é somado aqui nem em nenhuma coluna do CSV — são instrumentos diferentes medindo coisas diferentes, e somá-los misturaria o custo do objeto de estudo com o custo do instrumento de medida. |
| `duracao_s` | inteiro, segundos | ambas | Tempo de parede da chamada ao agente, medido pelo próprio runner (`Date.now()` antes e depois de `runAgent`/`FAKES[fake].run`), **não** o `duration_ms` que o CLI reporta no transcript (essa métrica nem chega ao CSV). Não inclui a preparação do contêiner nem a medição pós-sessão — só a execução do agente. |
| `n_tool_calls` | inteiro | ambas | Contagem de blocos `tool_use` em eventos `assistant` no transcript inteiro (`runner/lib/transcript.mjs`, `countToolCalls`), somando os quatro passos em O2. Custa zero código adicional — já está no transcript — e serve para separar, na assimetria O1/O2, se O2 ganha por conduzir melhor ou só por gastar mais (protocolo, seção 5.1). |
| `n_turns` | inteiro | ambas | Soma de `num_turns` de todos os eventos `result` (um por chamada; quatro somados em O2). **Mina #5.** É dado observado, nunca teto nem medida de esforço — ver `travou_turnos` abaixo e a seção 3.4 do protocolo. |

### 2.6 Trava (`travou`) e suas três causas

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `travou` | booleano | ambas | **Mina #4.** É a disjunção `travou_turnos \|\| travou_sem_diff \|\| travou_build` (`runner/run-session.mjs`, literalmente `row.travou = hitTurnLimit \|\| !measured.hasDiff \|\| !measured.buildOk \|\| !measured.serverUp`). Não é medida diretamente; é sempre reconstruível a partir das três colunas seguintes, e é o que o protocolo (seção 5.1) documenta como definição da coluna. |
| `travou_turnos` | booleano | ambas | Verdadeiro se a sessão foi interrompida pela rede de segurança de turnos (`stop_reason != 'end_turn'` **e** `num_turns >= 40`). **Mina #5.** `--max-turns 40` é rede de segurança contra laço infinito, **não teto efetivo de esforço** — as duas grandezas não contam a mesma unidade. Uma sonda de 22/09/2026 mediu `--max-turns 3` produzindo `num_turns = 6` com `stop_reason = end_turn` (a sessão terminou sozinha, sem ser cortada), e cinco sessões reais sob `--max-turns 40` registraram turnos de 30 a 43, nenhuma interrompida pelo limite. Por isso esta coluna praticamente nunca dispara nas sessões coletadas até 22/09/2026 (protocolo, seção 3.4; log de implementação, "Registrada em 22/09/2026"). Em O2, o mesmo limite de 40 se aplica a cada uma das quatro chamadas independentemente. |
| `travou_sem_diff` | booleano | ambas | Verdadeiro se a sessão terminou sem produzir diff nenhum (`!measured.hasDiff`, de `git diff --cached` vazio). |
| `travou_build` | booleano | ambas | Verdadeiro se o build/typecheck falhou ao final da sessão, **ou** se o servidor não voltou a responder depois — `!measured.buildOk \|\| !measured.serverUp` (`runner/lib/measure.mjs`). O nome cobre as duas causas juntas; não há coluna separada para "servidor não sobe" versus "typecheck falhou". |

### 2.7 Pontos de decisão (só T2)

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `decisao_1` … `decisao_10` | string (categoria fechada) | só T2 | **Mina #3.** A categoria que o avaliador cego atribuiu a cada um dos dez pontos de decisão congelados no protocolo (seção 2.4) — forma da solução, semântica do retorno, granularidade dos intervalos, janela temporal padrão, limite de horário, escopo de salas, fuso horário, sala sem reservas, tratamento do passado, contrato do POST. Em **T1, ficam vazias por desenho**: T1 não tem pontos de decisão, é a tarefa bem especificada. Em **T2**, uma linha `valid` com as dez vazias significa que a sessão ainda não passou pelo avaliador cego — "pendente de avaliação", não "não convergiu" (`tools/blind-evaluator/evaluate.mjs` preenche as dez juntas, numa única chamada `updateRow`, então em condições normais estão todas vazias ou todas preenchidas — nunca uma mistura). O valor **`ausente`** é uma categoria legítima, escrita quando a sessão não tomou posição sobre aquele ponto (ex.: não construiu nada sobre fuso horário) — conta como categoria própria na comparação de convergência, nunca como falta de dado. As justificativas ponto a ponto do avaliador (por que ele escolheu aquela categoria) não estão no CSV — estão em `sessions/<id>/evaluation.json`, campo `decisionPoints.answers.<n>.justificativa`. |

### 2.8 Uso de tokens

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `tokens_input` | inteiro | ambas | Soma de `usage.input_tokens` de todos os eventos `result` da sessão (todos os passos, em O2). |
| `tokens_output` | inteiro | ambas | Soma de `usage.output_tokens`. Usado também para decidir, entre os modelos que aparecem no `modelUsage` de um evento, qual produziu o trabalho da sessão (o de maior volume de saída) — é assim que `model_version` é atribuído quando o transcript relata mais de um modelo (ver seção 2.6, e log de implementação, 17/09). |
| `tokens_cache_create` | inteiro | ambas | Soma de `usage.cache_creation_input_tokens`. |
| `tokens_cache_read` | inteiro | ambas | Soma de `usage.cache_read_input_tokens`. |

### 2.9 Caminhos de artefatos

| Coluna | Tipo / unidade | Aplica-se a | O que é |
|---|---|---|---|
| `diff_path` | caminho relativo | ambas | Sempre `sessions/<session_id>/session.diff`. Relativo à raiz do repositório. |
| `transcript_path` | caminho relativo | ambas | Sempre `sessions/<session_id>/transcript.jsonl` — o transcript **bruto** (JSON Lines), já com os passos de O2 concatenados em ordem. Para uma versão legível por humano, ver `transcript.md` na mesma pasta (não referenciado por coluna nenhuma, ver seção 4 abaixo). |

## 3. `convergencia`: por que não está aqui

`convergencia` é a variável-resposta principal de T2 (protocolo, seção
5.2) e **não é uma coluna de `resultados.csv`**. Ela é uma propriedade de
uma **célula** (três linhas com o mesmo `p_level`/`o_level`, `task = T2`),
não de uma linha, então não cabe no formato de uma coluna por sessão. Ela
é calculada na hora da análise por `tools/analysis/convergencia.mjs`, que
lê `decisao_1`..`decisao_10` das três sessões de uma célula e conta em
quantos dos dez pontos as três registraram a mesma categoria — `ausente`
incluído como categoria própria. Guardar um CSV derivado já calculado
envelheceria em silêncio assim que uma sessão fosse recoletada; o dado
cru fica no dataset e o derivado se recalcula quando é preciso. Detalhes
completos da regra, incluindo as três guardas (célula incompleta,
sessão pendente de avaliação, segundo recorte sem os dados completos),
estão em `docs/superpowers/specs/2026-09-23-script-de-convergencia-design.md`.

## 4. O que fica em `sessions/<id>/`

Cada sessão grava sua pasta própria em `sessions/<session_id>/`. Nem todo
arquivo existe em toda sessão — alguns dependem de uma etapa que só roda
depois, ou de uma medição que não falhou.

| Arquivo | Sempre presente? | O que contém |
|---|---|---|
| `session.diff` | Sim (linhas `valid`) | O diff da sessão inteira, via `git add -A && git diff --cached` dentro do contêiner. É a fonte primária que todo instrumento posterior (convenções, avaliador cego) lê — nunca o estado vivo do contêiner. |
| `transcript.jsonl` | Sim (linhas `valid`) | O transcript bruto em JSON Lines, como o CLI o produz (`stream-json`). Em O2, os quatro passos já vêm concatenados em ordem numa única sequência de linhas. |
| `transcript.md` | Sim (linhas `valid`) | Versão legível do transcript: respostas de texto e chamadas de ferramenta, sem os eventos de protocolo brutos. Gerada por `runner/lib/transcript.mjs`, função `toMarkdown`. |
| `result.json` | Sim (linhas `valid`) | `{ row, hidden }` — a própria linha que foi (ou seria) escrita no CSV, mais o relatório asserção por asserção da suíte oculta (`hidden`, só em T1; `null` em T2). Serve para auditar uma sessão sem ir ao CSV. |
| `conventions.json` | Só se a medição de convenções não falhou | `{ violacoes, rules: { "1": { violated, detail }, ..., "8": {...} } }` — o detalhamento regra a regra que `violacoes` no CSV resume a um número. |
| `regressions.json` | Sim (linhas `valid`) | Saída bruta do `vitest --reporter=json` rodando os sete arquivos de teste congelados da semente — o que `regressoes` resume a um número. |
| `evaluation.json` | Só depois que `tools/blind-evaluator/evaluate.mjs` rodar sobre a sessão | `{ checklist, decisionPoints, totalCostUsd }` — as respostas do avaliador cego com justificativa por pergunta e por ponto de decisão, mais `costUsd` de cada uma das duas chamadas e o total. É a fonte de `qualidade` e `decisao_*` no CSV, e a única fonte das justificativas, que o CSV não carrega. |
| `preflight.log` | Sim | Saída de `make start` rodado **antes** de o agente receber a tarefa — prova de que a aplicação respondia à saúde no início (a base da fronteira temporal que decide `status`, seção 2.3 acima). |
| `server.log` | Sim (linhas `valid`) | Saída de `make start` rodado **depois** que o agente termina — usado para calcular `travou_build` (servidor não sobe) junto com o resultado do build/typecheck. |
| `agent.log` | Condicional | `stderr` acumulado das chamadas ao CLI do agente (`2>>/out/agent.log`). Útil para depurar uma sessão que terminou com transcript vazio ou incompleto; pode não existir ou estar vazio numa sessão que não gerou stderr. |

## 5. Armadilhas conhecidas (recapitulação)

Lista curta, para conferência rápida — cada item tem o verbete completo
na seção correspondente acima.

1. `taxa_aceitacao` vazia = não se aplica (T2). `taxa_aceitacao` zero =
   medida e ruim (a aplicação não respondeu). Opostos (seção 2.4).
2. `qualidade` vai de 0 a 6, não a 7 — a pergunta 7 foi cortada em
   21/09/2026 por redundância com `regressoes` (seção 2.4).
3. `decisao_1`..`decisao_10` vazias em T1 são por desenho; `ausente` é
   categoria legítima em T2, não falta de dado (seção 2.7).
4. `travou` é a disjunção de `travou_turnos`, `travou_sem_diff` e
   `travou_build` (seção 2.6).
5. `travou_turnos` quase nunca dispara: `--max-turns` é rede de
   segurança, não teto efetivo — ver a sonda de 22/09/2026 (seção 2.6).
6. `model` é o apelido pedido; `model_version` é o que o CLI reporta, que
   para apelidos não traz a versão datada — limitação da fonte (seção 2.1).
7. `convergencia` não está no CSV — é calculada na análise sobre três
   linhas de uma célula (seção 3).
8. `custo_usd` é só o custo do agente; o custo da avaliação cega fica em
   `evaluation.json`, não é somado a `custo_usd` (seção 2.5).
9. `violacoes` é a contagem das oito regras da seção 2.6 do protocolo; o
   detalhamento fica em `conventions.json` (seção 2.4).
10. `status = invalid` é falha de infraestrutura, com `invalid_reason`
    preenchido — a sessão é re-executada e não é ponto de dado
    (seção 2.3).
