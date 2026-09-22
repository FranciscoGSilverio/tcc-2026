# Execução — Testes ocultos de T1 e implementação de referência

**Data:** 15/09/2026
**Plano:** `docs/superpowers/plans/2026-09-15-testes-ocultos-e-referencia.md`
**Spec:** `docs/superpowers/specs/2026-09-15-testes-ocultos-e-referencia-design.md`

Este documento registra a execução das cinco tarefas do plano, com a saída real de cada comando de verificação, as três divergências encontradas e como cada uma foi investigada e resolvida.

---

## 1. Resultado por regra contra a semente intocada

### Task 1 — regra 1 (dez asserções)

```
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs
```

Resultado: **7 aprovadas de 10**. Falhas: `1.2`, `1.3`, `1.8` — exatamente as três previstas pelo plano, pelos motivos previstos (a semente só detecta o caso de início-dentro-de-reserva-existente; a atualização não faz nenhuma checagem de conflito).

**Bateu com a previsão.** Nenhuma investigação necessária nesta etapa.

### Task 2 — regras 2 a 5 (mais onze asserções, total 21)

Primeira execução: **11 aprovadas de 21**, com a regra 2 marcando 1/2 em vez dos 2/2 previstos (`2.1` falhando com 409 em vez de 201).

**Divergência investigada.** Reproduzi a sequência de `2.1` manualmente por `curl`: cancelar uma reserva e depois reservar sobre o intervalo liberado retorna 201 quando a chamada de cancelamento é feita sem o cabeçalho `content-type: application/json`. Repeti a mesma sequência via `fetch`, exatamente como o apoio da suíte (`call()`) monta a requisição — sempre com esse cabeçalho, mesmo em chamadas sem corpo — e o cancelamento voltou **500** (`INTERNAL_ERROR`), porque a semente rejeita corpo vazio com esse cabeçalho de um jeito que o manipulador de erros não reconhece, caindo no branch de erro não tratado. A reserva ficava com o cancelamento falho, então a segunda reserva de fato conflitava.

Conclusão: **o entendimento da regra 2 estava certo** (cancelar libera o intervalo — confirmado manualmente sem o cabeçalho), mas **o apoio da suíte tinha um defeito**: enviava `content-type` mesmo sem corpo. Corrigido em `hidden-tests/T1/run.mjs` (`call()` só define o cabeçalho quando há corpo). Reexecutei e obtive **12 aprovadas de 21**, batendo com a previsão do plano regra por regra:

| Regra | Aprovadas | Falhas |
|---|---|---|
| 1 | 7/10 | 1.2, 1.3, 1.8 |
| 2 | 2/2 | nenhuma |
| 3 | 1/3 | 3.1, 3.2 |
| 4 | 2/4 | 4.2, 4.4 |
| 5 | 0/2 | 5.1, 5.2 |

Confirmei também que rodar a suíte duas vezes seguidas sem resetar o banco produz saída idêntica (`diff` vazio).

### Task 3 — regras 6 e 7 (total 26)

```
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs
  | node -e '... soma por regra ...'
```

Resultado: **total 26, soma por regra 26, aprovadas 13**.

| Regra | Aprovadas | Falhas |
|---|---|---|
| 1 | 7/10 | 1.2, 1.3, 1.8 |
| 2 | 2/2 | nenhuma |
| 3 | 1/3 | 3.1, 3.2 |
| 4 | 2/4 | 4.2, 4.4 |
| 5 | 0/2 | 5.1, 5.2 |
| 6 | 0/3 | 6.1, 6.2, 6.3 — todas por a semente responder 500 |
| 7 | 1/2 | 7.2, porque a semente não produz o 400 da regra 3 |

**Bateu exatamente com a previsão do plano**, treze de vinte e seis, metade.

---

## 2. Linha de base medida

**Treze aprovadas de vinte e seis (0.5)**, medida contra uma cópia limpa da semente extraída de `git archive HEAD seed`. Remedida depois da correção de deriva de relógio (seção 3 abaixo) contra uma segunda cópia limpa independente — resultado idêntico, 13/26, mesmas falhas. Registrada em `docs/05-log-de-implementacao.md`.

Isso significa que a faixa real de `taxa_aceitacao` vai de 0,5 a 1, não de 0 a 1. Uma sessão que pontue a linha de base não fez nada.

---

## 3. Divergência adicional encontrada durante a Task 4

Ao rodar a suíte contra a implementação de referência (que implementa as sete regras corretamente), o resultado foi **25 de 26**, não 26 de 26 como esperado — a única falha era `1.6` ("new booking ends exactly when another starts"), esperando 201 e recebendo 409.

**Investigação.** Reproduzi o par de reservas de `1.6` manualmente, uma vez com os dois horários derivados de uma única leitura de `Date.now()` (sem deriva) — resultado 201, correto — e uma vez replicando exatamente o código da suíte, que lê `Date.now()` de novo a cada chamada a `hours()`. Como a reserva "existente" é criada antes da "nova" (com uma requisição HTTP real de permeio), a segunda leitura do relógio ocorre estritamente depois da primeira, deslocando o instante da nova reserva alguns milissegundos para a frente. Para `1.5` essa deriva empurra a fronteira para o lado seguro (sem conflito); para `1.6` ela empurra para o lado que produz uma sobreposição real de alguns milissegundos, fazendo qualquer servidor correto reportar 409.

Conclusão: **defeito de construção na suíte**, não na referência nem no entendimento da regra 1. Corrigido acrescentando `hoursFrom(anchor, h)` e um parâmetro opcional de âncora a `book()`, usados por `1.5` e `1.6` para que as duas reservas de cada checagem derivem de uma única leitura do relógio. Remedi a linha de base contra uma semente limpa depois da correção — permaneceu 13/26, porque a checagem lenientíssima da semente pristina nunca disparava esse caso limite em nenhuma direção; o defeito só ficou visível contra uma implementação correta, que é exatamente o papel da Task 4.

Depois da correção, a suíte contra a referência marcou **26 de 26**.

---

## 4. O que a referência precisou mudar, por regra

Arquivos tocados: `seed/src/modules/bookings/repository.ts`, `seed/src/modules/bookings/service.ts`, `seed/tests/bookings.test.ts`. Nenhum outro arquivo.

- **Regra 1 (sobreposição):** `findConflictAtStart` (detectava só o caso em que o início da nova reserva cai dentro de uma existente) foi substituída por `findOverlapping`, uma checagem padrão de sobreposição de intervalo meio-aberto (`existing.startsAt < new.endsAt AND existing.endsAt > new.startsAt`), aplicada tanto na criação quanto na atualização (excluindo a própria reserva ao atualizar).
- **Regra 2 (cancelada libera):** já verdadeira por construção, porque a nova consulta de sobreposição filtra por `status ACTIVE`.
- **Regra 3 (sem passado):** checagem nova contra `Date.now()`, aplicada na criação e na atualização sempre que `startsAt` ou `endsAt` mudam.
- **Regra 4 (30 min a 8 h):** checagem de duração reaproveitando `durationMinutes()`, que já existia em `shared/time.ts`.
- **Regra 5 (fim após início):** checagem de ordem explícita, antes da checagem de duração.
- **Regra 6 (sala/usuário inexistente → 404):** `roomExists`/`userExists` acrescentadas a `bookings/repository.ts` (checagens diretas via Prisma, sem acoplamento novo entre módulos), usadas antes de criar ou atualizar.
- **Regra 7 (envelope do erro):** de graça, porque todas as rejeições novas passam pelos auxiliares já existentes (`validationFailed`, `notFound`, `bookingConflict`).

Quinze testes novos foram acrescentados a `tests/bookings.test.ts`, cobrindo o comportamento novo, seguindo a convenção da semente.

**Auditoria manual de convenção** (o script ainda não existe): nenhum arquivo de produção fora de `src/modules/bookings/`; nenhuma dependência nova (`package.json`/`package-lock.json` intocados); nenhum arquivo de configuração alterado; nenhum `any` ou asserção não-nula nos arquivos tocados; testes escritos; nenhum teste da semente alterado (só acrescentados); nenhum `console`; nenhum teste pulado (`.skip`/`.only`) — todos confirmados por `grep` nos arquivos tocados.

---

## 5. Saída do verificador da referência

```
$ ./reference/T1/verify.sh
== extracting a clean seed ==
== applying the reference patch ==
patching file seed/src/modules/bookings/repository.ts
patching file seed/src/modules/bookings/service.ts
patching file seed/tests/bookings.test.ts
== seed suite must still pass, meaning zero regressions ==
[...]
 ✓ tests/bookings.test.ts (31 tests)
 ✓ tests/amenities.test.ts (11 tests)
 ✓ tests/rooms.test.ts (11 tests)
 ✓ tests/users.test.ts (9 tests)
 ✓ tests/shared.test.ts (10 tests)
 ✓ tests/database.test.ts (3 tests)
 ✓ tests/health.test.ts (3 tests)

 Test Files  7 passed (7)
      Tests  78 passed (78)
== hidden suite must score 100% ==
hidden suite: 26/26
reference is valid
```

Exit code: `0`. Rodado do zero (cópia limpa extraída por `git archive`, `npm ci` completo) três vezes ao longo da execução deste plano, com o mesmo resultado nas três.

**Defeito de robustez encontrado e corrigido durante a Task 5.** A primeira versão do roteiro derrubava o servidor só com `kill %1` na saída. Numa das execuções, isso deixou um processo `node dist/server.js` órfão retendo a porta — `make start` roda `npm start` roda `node dist/server.js`, e o SIGTERM entregue ao job de `make` nem sempre se propaga ao neto do processo. Corrigido acrescentando `fuser -k` (TERM seguido de KILL) sobre a porta na armadilha de saída, além do `kill %1` original. Confirmado por três execuções adicionais consecutivas, todas terminando sem processo `node dist/server.js` remanescente e com a porta liberada.

---

## 6. Prova de que a checagem de vazamento falha quando deve

Duas vias, como o passo 2 da Task 5 exige.

### Via 1 — arquivo vazado

```
$ cp hidden-tests/T1/run.mjs seed/src/run.mjs
$ ./tools/seed-audit/check-no-leak.sh; echo "exit=$?"
== forbidden terms ==
ok
== files addressed to agents or contributors ==
ok
== README stays minimal ==
ok
== research artefacts must stay outside the seed ==
/home/franciscogsilverio/myPrograms/tcc-2026/seed/src/run.mjs
FAIL: research artefacts reachable from the seed
exit=1

$ rm seed/src/run.mjs
$ ./tools/seed-audit/check-no-leak.sh; echo "exit=$?"
== forbidden terms ==
ok
== files addressed to agents or contributors ==
ok
== README stays minimal ==
ok
== research artefacts must stay outside the seed ==
ok
exit=0

$ git status --short
(vazio)
```

### Via 2 — referência textual vazada

```
$ echo "// see hidden-tests for the contract" >> seed/README.md
$ ./tools/seed-audit/check-no-leak.sh; echo "exit=$?"
== forbidden terms ==
ok
== files addressed to agents or contributors ==
ok
== README stays minimal ==
ok
== research artefacts must stay outside the seed ==
seed/README.md:20:// see hidden-tests for the contract
FAIL: research artefacts reachable from the seed
exit=1

$ git checkout -- seed/README.md
$ ./tools/seed-audit/check-no-leak.sh; echo "exit=$?"
== forbidden terms ==
ok
== files addressed to agents or contributors ==
ok
== README stays minimal ==
ok
== research artefacts must stay outside the seed ==
ok
exit=0

$ git status --short
(vazio)
```

Nas duas vias, o roteiro nomeou o arquivo/linha ofensor, saiu com código diferente de zero, e depois de restaurado voltou a passar com a árvore limpa.

---

## 7. Auditoria completa em sequência

```
$ ./tools/seed-audit/check-no-leak.sh \
    && ./tools/seed-audit/check-structure.sh \
    && ./tools/seed-audit/check-ballast-inert.sh \
    && ./reference/T1/verify.sh
[...]
ok   rooms has four layers
ok   users has four layers
ok   bookings has four layers
ok   amenities has two files
ok   only one module uses the alternate reply helper
ok   the time helper has no interval overlap function
ok   no date library in the manifest
ok   nothing in the source declares which pattern is current
[...]
Tests  63 passed (63)
[...]
hidden suite: 26/26
reference is valid
CHAIN_EXIT=0
```

Os quatro terminaram com código zero. Nenhum processo `node dist/server.js` ficou para trás ao final.

---

## 8. Divergências encontradas — resumo

Três, todas investigadas antes de prosseguir, nenhuma resolvida ajustando a previsão para bater com o observado:

1. **`call()` enviava `content-type` sem corpo** (Task 2) — expôs um defeito não relacionado da semente (corpo vazio com esse cabeçalho vira 500) e derrubava falsamente `2.1`. Corrigido no apoio da suíte.
2. **Deriva de relógio em `1.5`/`1.6`** (Task 4) — duas leituras independentes de `Date.now()` separadas por uma requisição HTTP real deslocavam a fronteira exata em alguns milissegundos, sempre na mesma direção, fazendo `1.6` falhar contra qualquer implementação correta. Corrigido com uma âncora de tempo compartilhada nessas duas checagens.
3. **`kill %1` insuficiente para derrubar o servidor** (Task 5) — `make start` não propaga sinal de forma confiável ao neto `node dist/server.js`. Corrigido com `fuser -k` sobre a porta na armadilha de saída de `reference/T1/verify.sh`.

Nenhuma delas era um erro de entendimento sobre o comportamento da semente; as três eram defeitos de construção nos próprios artefatos de pesquisa, encontrados exatamente pela disciplina de comparar cada resultado contra a previsão antes de seguir adiante.

---

## 9. Verificação final da árvore

```
$ cd seed && make verify
[...]
Tests  63 passed (63)
$ echo $?
0
$ git status --short
(vazio, após o commit da Task 5)
```

---

## 10. Correção de um defeito acidental no manipulador de erros (16/09/2026)

**Defeito, fora dos cinco deliberados da seção 5.2 da spec:** `seed/src/plugins/error-handler.ts` descartava o `statusCode` que o próprio Fastify já atribui a erros de framework. Sintoma reproduzido manualmente: `POST /bookings/:id/cancel` sem corpo e sem `content-type` respondia 200 (correto); a mesma chamada com `content-type: application/json` e corpo vazio respondia 500, porque o Fastify rejeita corpo vazio com esse cabeçalho com um erro `statusCode: 400` que o catch-all da semente não reconhecia. `hidden-tests/T1/run.mjs` já contornava esse defeito de propósito (comentário em `call()`), então ele nunca afetou a linha de base medida.

**Correção:** um ramo novo em `error-handler.ts`, entre a checagem de validação de schema e o catch-all, que honra qualquer `statusCode` 4xx que o Fastify já tenha definido, respondendo com o mesmo envelope e o código `VALIDATION_ERROR` já existente. Nenhuma dependência nova, nenhuma reestruturação do manipulador. Um teste foi acrescentado a `seed/tests/health.test.ts`, ao lado dos testes existentes de envelope de erro.

**A armadilha verificada, não assumida:** o defeito deliberado "sala ou usuário inexistente vira 500" depende do catch-all. `PrismaClientKnownRequestError` carrega `code` (ex.: `P2025`) mas não carrega `statusCode` — confirmado instanciando a classe diretamente (`'statusCode' in e` → `false`). Por isso o novo ramo, que só olha `statusCode`, nunca intercepta erros do Prisma, e o defeito deliberado permanece.

### 10.1 Sintoma antes e depois

```
$ curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/bookings/$ID/cancel
status=200
$ curl -s -w "status=%{http_code}\n" -X POST $BASE/bookings/$ID/cancel -H 'content-type: application/json'
{"error":{"code":"VALIDATION_ERROR","message":"Body cannot be empty when content-type is set to 'application/json'","details":{}}}
status=400
```

### 10.2 Os cinco defeitos deliberados sobrevivem

```
$ BASE_URL=http://localhost:3901 node tools/seed-audit/false-negatives.mjs
ok   end falls inside an existing booking and start is before it
ok   new booking engulfs an existing one
ok   update moves a booking on top of another
ok   booking that starts in the past
ok   booking shorter than thirty minutes
ok   booking longer than eight hours
ok   booking whose end is before its start
ok   booking that points at a room that does not exist
ok   booking that points at a user that does not exist

all expected gaps are present
exit=0
```

### 10.3 Linha de base da suíte oculta, inalterada

```
$ BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs
"total": 26, "passed": 13, "rate": 0.5
byRule: 1: 7/10, 2: 2/2, 3: 1/3, 4: 2/4, 5: 0/2, 6: 0/3, 7: 1/2
```

Idêntico, regra por regra, à linha de base registrada nas seções 1 e 2 deste documento.

### 10.4 `make verify` na semente

```
$ cd seed && make verify
...
 Test Files  7 passed (7)
      Tests  64 passed (64)
```

63 testes originais mais o teste novo do envelope de erro.

### 10.5 `./reference/T1/verify.sh`, do zero, contra a árvore já com a correção

```
$ PORT=3312 ./reference/T1/verify.sh
== extracting a clean seed ==
== applying the reference patch ==
patching file seed/src/modules/bookings/repository.ts
patching file seed/src/modules/bookings/service.ts
patching file seed/tests/bookings.test.ts
== seed suite must still pass, meaning zero regressions ==
 Test Files  7 passed (7)
      Tests  79 passed (79)
== hidden suite must score 100% ==
hidden suite: 26/26
reference is valid
$ echo $?
0
```

O patch de referência não conflita: toca apenas `seed/src/modules/bookings/{repository,service}.ts` e `seed/tests/bookings.test.ts`, disjuntos do arquivo corrigido. 79 = 78 da referência (seção 5) mais o teste novo do error-handler.

### 10.6 Os três scripts de auditoria

```
$ ./tools/seed-audit/check-no-leak.sh; echo exit=$?
ok / ok / ok / ok
exit=0
$ ./tools/seed-audit/check-structure.sh; echo exit=$?
ok em todas as checagens
exit=0
$ ./tools/seed-audit/check-ballast-inert.sh; echo exit=$?
Tests  64 passed (64)
ballast is inert
exit=0
```

### 10.7 Estado final

Servidores das portas 3901, 3310, 3311 e 3312 todos derrubados e confirmados livres após cada uso. `git status --short` vazio após o commit desta rodada.
