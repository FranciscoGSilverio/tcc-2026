# Execução do runner mínimo — Tasks 1 a 6

**Data:** 16/09/2026
**Plano:** `docs/superpowers/plans/2026-09-16-runner-minimo.md`
**Spec:** `docs/superpowers/specs/2026-09-16-runner-minimo-design.md`
**Escopo desta execução:** Tasks 1 a 6. **A Task 7 não foi executada** — gasta orçamento de API real e exige autorização explícita do usuário, que não foi dada nesta sessão.

---

## Resumo por tarefa

| Task | Commit | Testes | Resultado |
|---|---|---|---|
| 1 — Leitura do transcript | `2e4ca9a` | `runner/test/transcript.test.mjs` | 9/9 PASS |
| 2 — Esquema do dataset | `e7dc6e1` | `runner/test/dataset.test.mjs` | 6/6 PASS |
| 3 — Imagem de sessão e ciclo de contêiner | `41a38dc` | `runner/test/container.test.mjs` | 7/7 PASS |
| 4 — Fase de preparar | `3334dda` | `runner/test/prepare.test.mjs` | 4/4 PASS |
| 5 — Fase de medir | `13a5184` | `runner/test/measure.test.mjs` | 2/2 PASS |
| 6 — Orquestração e os três substitutos | (nesta entrega) | `runner/test/end-to-end.test.mjs` | 3/3 PASS |

Suíte completa do runner, rodada limpa uma única vez ao final: **31/31 testes, 0 falhas.**

---

## Task 1 — Leitura do transcript

Implementado exatamente como o plano descreve: `readTranscript(text)` e `toMarkdown(parsed)` em `runner/lib/transcript.mjs`. Nenhum desvio.

```
✔ reads the final result event
✔ separates the four token counters
✔ reads the exact model identifier and the cli version
✔ counts tool calls, which is zero in this fixture
✔ counts tool calls when the transcript has them
✔ fails loudly when there is no result event
✔ survives a malformed line without losing the rest
✔ detects a rate limit event
✔ renders markdown naming the model and the turn count
ℹ tests 9, pass 9, fail 0
```

## Task 2 — Esquema do dataset

Implementado exatamente como o plano descreve: `COLUMNS`, `emptyRow()`, `appendRow()` em `runner/lib/dataset.mjs`. Nenhum desvio.

```
✔ the schema carries every group the spec lists
✔ the ten decision columns of the ambiguous task exist
✔ an empty row has one key per column and no extras
✔ writes the header once and appends rows under it
✔ quotes a value that carries a comma, so the row keeps its shape
✔ refuses a row carrying a column the schema does not know
ℹ tests 6, pass 6, fail 0
```

## Task 3 — Imagem de sessão e ciclo de contêiner

**Desvio do plano, descoberto e corrigido:** o `Dockerfile.session` do plano faz só `RUN npm install -g @anthropic-ai/claude-code@2.1.272`. Isso se mostrou não confiável neste host: o pacote resolve o binário nativo da plataforma (`@anthropic-ai/claude-code-linux-x64`) como dependência opcional, baixada em paralelo ao `postinstall` do pacote principal (`install.cjs`). Reproduzido isoladamente várias vezes:

- Às vezes o `postinstall` roda antes do fetch da dependência opcional terminar, e escreve um stub `claude.exe` não funcional em `bin/`.
- Às vezes o **fetch da dependência opcional falha silenciosamente** (sem opção `--omit=optional`, sem `--ignore-scripts`), e o pacote de plataforma nunca é colocado em `node_modules/`. Confirmado repetindo `npm install -g` três vezes seguidas na mesma imagem base: "added 2 packages" (dependência presente) em duas rodadas, "added 1 package" (ausente) em uma.

Corrigido com `--ignore-scripts` mais um laço de repetição (até 5 tentativas) que confirma a dependência de plataforma no disco antes de rodar `install.cjs` manualmente, falhando o build se ela nunca aparecer:

```dockerfile
RUN set -eux; \
  for attempt in 1 2 3 4 5; do \
    npm install -g @anthropic-ai/claude-code@2.1.272 --ignore-scripts; \
    if [ -d "$(npm root -g)/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-linux-x64" ]; then \
      break; \
    fi; \
    echo "attempt $attempt: platform-native optional dependency missing, retrying" >&2; \
  done; \
  test -d "$(npm root -g)/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-linux-x64"; \
  node "$(npm root -g)/@anthropic-ai/claude-code/install.cjs"; \
  claude --version
```

```
✔ builds the session image and reports an id
✔ the image carries the pinned agent cli
✔ the application is inside the image at the working directory
✔ the output mount reaches the host
✔ copying a file in lands where asked
✔ nothing of the artefacts repository is reachable from inside
✔ stopping removes the container
ℹ tests 7, pass 7, fail 0
```

O sexto teste, que é o que importa (nada de `hidden-tests`, `reference`, `tasks`, `docs` ou `tools` visível dentro do contêiner), passou.

## Task 4 — Fase de preparar

Implementado como o plano descreve, com um ajuste no próprio teste.

**Desvio no teste (bug no plano, corrigido):** o teste de `prepare.test.mjs` do plano usa `assert.throws(() => prepare(...), InfrastructureError)`, mas `prepare` é `async` — sempre devolve uma Promise, nunca lança de forma síncrona, mesmo quando a causa interna é síncrona. `assert.throws` nunca observaria a rejeição, e o teste passaria vazio (falso positivo) independentemente de `prepare` funcionar. Troquei por `assert.rejects` com `await`, que de fato observa a rejeição.

```
✔ prepares a working copy and reports the reproducibility anchors
✔ the working copy history holds exactly one neutral commit
✔ the working copy is clean, so any later diff belongs to the agent
✔ aborts as infrastructure failure when an artefact is reachable
ℹ tests 4, pass 4, fail 0
```

## Task 5 — Fase de medir

Implementado como o plano descreve, com uma correção descoberta ao rodar o segundo teste (o mais importante do arquivo).

**Desvio do plano, descoberto e corrigido — o mesmo problema que `reference/T1/verify.sh` já documenta.** A imagem da semente não tem `pkill` nem `fuser` instalados. A linha do plano `exec(name, ['sh', '-c', 'pkill -f "node dist/server.js" || true'])` falha de forma **silenciosa**: `sh: pkill: not found` devolve status diferente de zero, engolido pelo `|| true`, e o servidor anterior nunca é derrubado. Isso apareceu exatamente como o teste "a broken application reports the server down and no measurement" esperava: com o servidor antigo (da rodada anterior) ainda vivo na porta, `serverUp` saía `true` em vez de `false`, e a suíte oculta rodava contra um servidor com banco de dados inconsistente (resetado por baixo dele), produzindo uma pontuação incoerente em vez de `null`.

O próprio repositório já tinha a causa e o remédio documentados em `reference/T1/verify.sh` (comentário no trap de limpeza: "kill %1 alone is not reliable here [...] fuser -k targets whatever is actually listening on the port"). Apliquei a mesma correção: `runner/Dockerfile.session` agora instala `psmisc` (traz `fuser`), e tanto `prepare.mjs` quanto `measure.mjs` derrubam o servidor com `fuser -k -TERM` seguido de `fuser -k -KILL` contra a porta, em vez de `pkill` por nome de processo.

```
✔ an untouched working copy scores the documented baseline
✔ a broken application reports the server down and no measurement
ℹ tests 2, pass 2, fail 0
```

O primeiro teste confirma a linha de base exata da suíte oculta contra a semente intocada: **13 de 26** (0.5), zero regressões, build ok, servidor no ar — batendo com `hidden-tests/README.md`.

## Task 6 — Orquestração e os três substitutos

### Entrega do enunciado: `copyIn`, não heredoc

Como instruído, usei `copyIn` (via `docker cp`) para levar o enunciado (`tasks/T1-validacao-de-reservas.md`) para dentro do contêiner, em `/tmp/statement.txt` — fora de `/app`, então nunca aparece no diff nem é visível ao agente como arquivo do projeto. `run-session.mjs` grava o conteúdo em um arquivo de staging no host (`mkdtempSync` + `writeFileSync`) e faz `copyIn(name, staged, '/tmp/statement.txt')`. O comando que invoca o agente referencia só o **caminho** (`$(cat /tmp/statement.txt)`) dentro do `sh -c` que roda `claude -p`, nunca o texto do enunciado — então nenhuma prosa em português com aspas ou parênteses passa por uma segunda camada de interpretação de shell construída por concatenação de string em JS, que era o risco de fragilidade da abordagem original do plano (heredoc montado via template string).

### Nível de tira-caminho do patch de referência

Verificado diretamente, sem precisar ajustar nada: `grep '^+++' reference/T1/reference.patch` mostra caminhos `b/seed/src/modules/bookings/repository.ts`, `b/seed/src/modules/bookings/service.ts`, `b/seed/tests/bookings.test.ts`. A abordagem do plano — recriar uma árvore `seed/` em `/tmp/apply` copiando `/app` para dentro dela, e aplicar com `patch -p2 -d seed` — bateu com esses caminhos de primeira: `-p2` descarta `a/` e `seed/`, sobrando `src/modules/bookings/repository.ts` etc., relativo a `/tmp/apply/seed/`, exatamente onde a cópia foi colocada. Testado isoladamente antes de integrar ao `run-session.mjs`:

```
patch applied OK
typecheck status 0
```

**Critério de sucesso confirmado: o substituto `reference` pontua 26 de 26** (ver tabela de linhas abaixo).

### `patch` também não vem na imagem da semente

Descoberto ao testar o substituto `reference` pela primeira vez: `sh: 1: patch: not found`. Acrescentado `patch` ao mesmo `apt-get install` que já trazia `psmisc` no `Dockerfile.session`.

### O teste mais importante do plano

`a broken application is recorded as data, not discarded` (substituto `break`) passou:

```
status: valid
taxa_aceitacao: 0
travou_build: true
travou: true
invalid_reason: "" (vazio — não "runner error")
```

A sessão que apaga `src/modules/bookings/service.ts` volta **`status: valid`** com nota zero, não `status: invalid`. A regra de invalidação temporal está correta: o preflight do passo de preparar prova que a aplicação respondia antes da entrega, então a quebra do build depois é dado do agente, não falha de infraestrutura.

### Os três substitutos, linhas completas do CSV (rodada final, limpa)

```
session_id,task,model,model_version,p_level,o_level,run_number,started_at,ended_at,image_digest,cli_version,status,invalid_reason,taxa_aceitacao,regressoes,violacoes,qualidade,custo_usd,duracao_s,n_tool_calls,travou,decisao_1..decisao_10,n_turns,travou_turnos,travou_sem_diff,travou_build,tokens_input,tokens_output,tokens_cache_create,tokens_cache_read,diff_path,transcript_path

noop:
T1-P0-O1-mu4qnlnv,T1,claude-sonnet-5,fake-model,P0,O1,1,2026-09-16T23:35:16.075Z,2026-09-16T23:35:37.276Z,
sha256:f4624da3dd87fad6190e9a6a11cbc6cd45455e74c44ba198b37e09c21e4891e6,2.1.272,valid,,0.5,0,,,0,0,0,true,
(decisao_1..10 vazias),1,false,true,false,0,0,0,0,
sessions/T1-P0-O1-mu4qnlnv/session.diff,sessions/T1-P0-O1-mu4qnlnv/transcript.jsonl

reference:
T1-P0-O1-mu4qo2f7,T1,claude-sonnet-5,fake-model,P0,O1,1,2026-09-16T23:35:37.795Z,2026-09-16T23:35:57.263Z,
sha256:b5612604ee97cdc41d03d572f544ae1927e1488525086392a9510ecf69503a7e,2.1.272,valid,,1,0,,,0,1,20,false,
(decisao_1..10 vazias),12,false,false,false,0,0,0,0,
sessions/T1-P0-O1-mu4qo2f7/session.diff,sessions/T1-P0-O1-mu4qo2f7/transcript.jsonl

break:
T1-P0-O1-mu4qoidr,T1,claude-sonnet-5,fake-model,P0,O1,1,2026-09-16T23:35:58.479Z,2026-09-16T23:36:42.780Z,
sha256:b134da013dc7ecb6226b5598c8f8ad161de252e3058f21861102b0cb70461a8b,2.1.272,valid,,0,0,,,0,0,4,true,
(decisao_1..10 vazias),3,false,false,true,0,0,0,0,
sessions/T1-P0-O1-mu4qoidr/session.diff,sessions/T1-P0-O1-mu4qoidr/transcript.jsonl
```

(Quebrado em várias linhas só para leitura; no arquivo real cada sessão é uma linha CSV só, 41 colunas.)

| Substituto | status | taxa_aceitacao | regressoes | travou_sem_diff | travou_build | travou | n_turns | n_tool_calls |
|---|---|---|---|---|---|---|---|---|
| `noop` | valid | 0.5 | 0 | true | false | true | 1 | 0 |
| `reference` | valid | 1 | 0 | false | false | false | 12 | 20 |
| `break` | valid | 0 | 0 | false | true | true | 3 | 4 |

Todos batem com a tabela esperada na seção 7 da spec.

### README

`runner/README.md`, em português, cobre: como construir a imagem de sessão; como rodar uma sessão real e o que ela exige de ambiente (chave por variável, nunca arquivo); os três substitutos e o resultado esperado de cada um; a regra de invalidação em tabela; e a nota sobre `fuser`/`patch` faltando na imagem da semente.

---

## Validação final (comandos e saída reais)

### `node --test runner/test/` — divergência do host, documentada

**O comando literal `node --test runner/test/` falha nesta instalação do Node (v24.13.1)**, e não por causa de nada no runner: reproduzido de forma isolada, fora deste projeto, em um diretório `/tmp` com um único arquivo de teste trivial, o mesmo comando falha com `Cannot find module '.../test'` — a versão do Node instalada neste host não faz descoberta automática de arquivo de teste quando um argumento posicional de **diretório** é passado explicitamente a `--test`; ela tenta resolver o caminho como módulo CJS antes de chegar à lógica de varredura do test runner. Confirmado que não é um problema de shell (reproduzido em `bash` puro) nem de `NODE_OPTIONS`.

O equivalente que funciona, e que rodei como validação final, é a descoberta automática padrão do Node (nenhum argumento de caminho, dentro do diretório):

```
$ cd runner && node --test
...
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

(`node --test runner/test/*.test.mjs`, com o glob expandido pelo shell antes de chegar ao Node, também funciona e dá o mesmo resultado — usado durante o desenvolvimento tarefa a tarefa.)

### `cd seed && make verify`

```
 Test Files  7 passed (7)
      Tests  64 passed (64)
```

Saída completa confirmada, sem regressão em relação à linha de base medida antes de começar (também 64/64).

### `docker ps -a` — sem contêiner remanescente

```
$ docker ps -a --format '{{.Names}}' | grep -Ei 'session|runner'
(saída vazia)
```

Os únicos contêineres presentes em `docker ps -a` são de outros projetos do host (`openssh-sftp`, `api-postgres-1`, `api-redis-1`, `minio`, `datadog-agent`), nenhum criado por esta execução.

### `git status --short`

Limpo depois do commit desta tarefa (ver abaixo). Acrescentado um `.gitignore` na raiz do repositório (`/sessions/`), inexistente antes desta execução, porque `sessions/<id>/` é saída de execução (diff, transcript, markdown, resultado por sessão) e não pertence ao controle de versão — sem ele, cada rodada de teste (inclusive esta validação) deixaria o working tree sujo.

### `resultados.csv`

Cabeçalho + 3 sessões falsas, 41 colunas — confirmado acima.

---

## O que divergiu do plano, resumido

1. **`Dockerfile.session`** (Task 3): instalação do CLI trocada de `npm install -g` simples para instalação com `--ignore-scripts` + laço de repetição + `install.cjs` manual, porque a instalação simples é intermitentemente não confiável neste host (dependência de plataforma às vezes não baixada, e quando baixada, às vezes o postinstall roda antes dela estar no disco).
2. **`Dockerfile.session`**: acrescentado `psmisc` (para `fuser`) e `patch`, nenhum dos dois presente na imagem da semente.
3. **`prepare.mjs` e `measure.mjs`** (Tasks 4 e 5): troca de `pkill -f "node dist/server.js" || true` por `fuser -k` contra a porta — `pkill` nem existe na imagem, e o `|| true` engolia o erro silenciosamente, deixando o servidor anterior vivo. Mesma correção que `reference/T1/verify.sh` já documenta ter aplicado por um motivo equivalente.
4. **`prepare.test.mjs`** (Task 4): `assert.throws` trocado por `assert.rejects` no teste de aborto por artefato vazado, porque `prepare` é `async` e `assert.throws` nunca observa uma Promise rejeitada.
5. **Entrega do enunciado** (Task 6): `copyIn` em vez de heredoc, como instruído.
6. **`.gitignore` na raiz**: criado, ignorando `/sessions/`, para manter `git status --short` limpo entre rodadas — não existia nenhum antes desta execução.

Nenhum desvio afetou o escopo (T1, P0, O1) nem introduziu dependências além da biblioteca padrão do Node. Nenhum teste foi enfraquecido para passar — em particular, o teste do substituto `break` está exatamente como o plano especifica, e passa porque o runner foi corrigido (a causa raiz do `pkill`/`fuser` ausente), não porque a asserção foi relaxada.

---

## Prontidão para a Task 7

Todos os itens do portão de "tudo verde antes de gastar" (seção da Task 7, passo 1) estão confirmados nesta execução:

- `cd runner && node --test` → 31/31 (equivalente funcional de `node --test runner/test/`, ver nota acima)
- `cd seed && make verify` → 64/64
- `./reference/T1/verify.sh` → `hidden suite: 26/26`, `reference is valid` — rodado nesta sessão para reforçar a prontidão, mesmo não estando nas Tasks 1–6. Sem processo ou porta remanescente depois (`lsof -i :3311` vazio, nenhum `node dist/server.js` na lista de processos).

A Task 7 (a primeira sessão real, com `ANTHROPIC_API_KEY`) não foi iniciada. Aguardando autorização explícita do usuário antes de gastar orçamento de API.
