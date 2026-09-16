# Validação da semente — evidência de auditoria

**Data:** 15/09/2026
**Escopo:** `seed/`, branch `seed-repo`, HEAD em `5ded883`
**Referências:** `tools/seed-audit/CHECKLIST.md`, `docs/superpowers/specs/2026-09-09-repositorio-semente-design.md` §11, `tasks/T1-validacao-de-reservas.md`
**Método:** toda afirmação abaixo é sustentada por um comando real e sua saída real. Onde uma propriedade não pôde ser exercitada, isso é dito explicitamente em vez de inferido.

Ambiente: Node 22.16.0 via `nvm` (requisito de `package.json`/`.github/workflows/ci.yml`), Docker 29.7.2, dentro do repositório em `/home/franciscogsilverio/myPrograms/tcc-2026`.

---

## Parte 1 — a semente é um serviço saudável

### 1.1 Clone limpo

```
$ git archive HEAD:seed | tar -x -C "$TMPDIR"
$ ls "$TMPDIR"
CHANGELOG.md  Dockerfile  LICENSE  Makefile  README.md  docker-compose.yml
eslint.config.js  infra  package-lock.json  package.json  prisma  src  tests
tsconfig.json  vitest.config.ts

$ cd "$TMPDIR" && time make verify
...
 ✓ tests/bookings.test.ts (16 tests) 967ms
 ✓ tests/rooms.test.ts (11 tests) 299ms
 ✓ tests/users.test.ts (9 tests) 203ms
 ✓ tests/amenities.test.ts (7 tests) 217ms
 ✓ tests/shared.test.ts (10 tests) 1ms
 ✓ tests/database.test.ts (3 tests) 80ms
 ✓ tests/health.test.ts (3 tests) 26ms

 Test Files  7 passed (7)
      Tests  59 passed (59)
make verify  13.34s user 3.18s system 142% cpu 11.561 total
EXIT CODE: 0
```

Passou sem nenhuma intervenção manual: nenhuma variável de ambiente extra, nenhum arquivo adicional, nenhum comando de correção. `npm ci` rodou implicitamente dentro de `make setup` porque `node_modules` não existia no diretório extraído.

Diretório temporário apagado depois:

```
$ rm -rf "$TMPDIR"
$ ls "$TMPDIR"
ls: cannot access '...': No such file or directory
confirmado deletado
```

### 1.2 Dependências

```
$ git log --oneline -1 -- package-lock.json
90d92fe chore: bootstrap project toolchain
$ git ls-files package-lock.json
package-lock.json
$ grep -E '"\^|"~' package.json || echo "none found (good, all exact)"
none found (good, all exact)
$ grep -m1 lockfileVersion package-lock.json
  "lockfileVersion": 3,
```

Verificação programática de que todas as 13 dependências diretas (produção + dev) estão fixadas sem `^`/`~`:

```
@fastify/type-provider-typebox 5.1.0 exact
@prisma/client 6.2.1 exact
@sinclair/typebox 0.34.13 exact
fastify 5.2.1 exact
@eslint/js 9.18.0 exact
@types/node 22.10.5 exact
eslint 9.18.0 exact
prettier 3.4.2 exact
prisma 6.2.1 exact
tsx 4.19.2 exact
typescript 5.7.3 exact
typescript-eslint 8.20.0 exact
vitest 2.1.8 exact
```

Reprodução a partir do lockfile:

```
$ rm -rf node_modules && time npm ci
added 231 packages, and audited 232 packages in 4s
npm ci  4.55s user 2.69s system 162% cpu 4.447 total
EXIT: 0
$ git status --short
(vazio — node_modules é ignorado)
```

### 1.3 Imagem de container

Build do zero (sem cache):

```
$ docker build --no-cache -t meeting-rooms-api:1.0.0 .
...
#9 [5/7] RUN npm ci ... added 232 packages, and audited 233 packages in 7s
#11 [7/7] RUN make setup && npm run build ... DONE 2.9s
#12 exporting to image ... naming to docker.io/library/meeting-rooms-api:1.0.0 done
docker build --no-cache -t meeting-rooms-api:1.0.0 .  0.13s user 0.11s system 0% cpu 34.684 total
```

Verificação completa dentro do container:

```
$ time docker run --rm meeting-rooms-api:1.0.0 make verify
...
 ✓ tests/bookings.test.ts (16 tests) 853ms
 ✓ tests/rooms.test.ts (11 tests) 272ms
 ✓ tests/users.test.ts (9 tests) 202ms
 ✓ tests/amenities.test.ts (7 tests) 214ms
 ✓ tests/shared.test.ts (10 tests) 2ms
 ✓ tests/database.test.ts (3 tests) 80ms
 ✓ tests/health.test.ts (3 tests) 27ms

 Test Files  7 passed (7)
      Tests  59 passed (59)
docker run --rm meeting-rooms-api:1.0.0 make verify  0.03s user 0.01s system 0% cpu 7.347 total
```

### 1.4 Sweep de todas as rotas da seção 4.2

Servidor subido localmente (`PORT=3100 DATABASE_URL=file:../data/app.db node dist/server.js`), confirmado pronto (`GET /health` → 200), depois percorrido método a método. Tabela com cada rota, código observado e veredito:

| Método e caminho | Esperado (design §4.2) | Observado | Bate? |
|---|---|---|---|
| `GET /health` | 200 | 200, `{"status":"ok"}` | sim |
| `POST /rooms` (válido) | 201 | 201 | sim |
| `POST /rooms` (sem nome) | 400 | 400 `VALIDATION_ERROR` | sim |
| `POST /rooms` (nome duplicado) | 409 | 409 `ROOM_NAME_TAKEN` | sim |
| `GET /rooms` | 200 | 200, envelope paginado | sim |
| `GET /rooms/:id` (existe) | 200 | 200 | sim |
| `GET /rooms/:id` (não existe) | 404 | 404 `NOT_FOUND` | sim |
| `PATCH /rooms/:id` (válido) | 200 | 200 | sim |
| `PATCH /rooms/:id` (tipo inválido) | 400 | 400 `VALIDATION_ERROR` | sim |
| `PATCH /rooms/:id` (não existe) | 404 | 404 | sim |
| `PATCH /rooms/:id` (nome já usado) | 409 | 409 `ROOM_NAME_TAKEN` | sim |
| `DELETE /rooms/:id` (existe) | 204 | 204 | sim |
| `DELETE /rooms/:id` (não existe) | 404 | 404 | sim |
| `POST /users` (válido) | 201 | 201 | sim |
| `POST /users` (sem email) | 400 | 400 `VALIDATION_ERROR` | sim |
| `POST /users` (email duplicado) | 409 | 409 `EMAIL_TAKEN` | sim |
| `GET /users` | 200 | 200, envelope paginado | sim |
| `GET /users/:id` (existe) | 200 | 200 | sim |
| `GET /users/:id` (não existe) | 404 | 404 | sim |
| `PATCH /users/:id` (válido) | 200 | 200 | sim |
| `PATCH /users/:id` (não existe) | 404 | 404 | sim |
| `PATCH /users/:id` (email já usado) | 409 | 409 `EMAIL_TAKEN` | sim |
| `DELETE /users/:id` (existe) | 204 | 204 | sim |
| `DELETE /users/:id` (não existe) | 404 | 404 | sim |
| `POST /bookings` (válido) | 201 | 201 | sim |
| `POST /bookings` (sem título) | 400 | 400 `VALIDATION_ERROR` | sim |
| `POST /bookings` (conflito no início) | 409 | 409 `BOOKING_CONFLICT` | sim |
| `GET /bookings` | 200 | 200, envelope paginado | sim |
| `GET /bookings/:id` (existe) | 200 | 200 | sim |
| `GET /bookings/:id` (não existe) | 404 | 404 | sim |
| `PATCH /bookings/:id` (válido) | 200 | 200 | sim |
| `PATCH /bookings/:id` (instante inválido) | 400 | 400 `VALIDATION_ERROR` | sim |
| `PATCH /bookings/:id` (não existe) | 404 | 404 | sim |
| `POST /bookings/:id/cancel` (existe) | 200 | 200, `status:"CANCELLED"` | sim |
| `POST /bookings/:id/cancel` (repetido) | 200 (idempotente) | 200, mesmo corpo | sim |
| `POST /bookings/:id/cancel` (não existe) | 404 | 404 | sim |
| `DELETE /bookings/:id` (existe) | 204 | 204 | sim |
| `DELETE /bookings/:id` (não existe) | 404 | 404 | sim |
| `POST /amenities` (válido) | 201 | 201 | sim |
| `POST /amenities` (sem nome) | 400 | 400 `VALIDATION_ERROR` | sim |
| `POST /amenities` (nome duplicado) | 409 | 409 `AMENITY_NAME_TAKEN` | sim |
| `GET /amenities` | 200, array puro | 200, `[...]` sem envelope | sim |
| `DELETE /amenities/:id` (existe) | 204 | 204 | sim |
| `DELETE /amenities/:id` (não existe) | 404 | 404 `NOT_FOUND` | sim |
| `PUT /rooms/:roomId/amenities/:amenityId` (ambos existem) | 204 | 204 | sim |
| `PUT /rooms/:roomId/amenities/:amenityId` (sala não existe) | 404 | 404 `NOT_FOUND` "Room not found" | sim |
| `PUT /rooms/:roomId/amenities/:amenityId` (amenity não existe) | 404 | 404 `NOT_FOUND` "Amenity not found" | sim |
| `DELETE /rooms/:roomId/amenities/:amenityId` (existe) | 204 | 204 | sim |
| `DELETE /rooms/:roomId/amenities/:amenityId` (sala não existe) | 404 | 404 `NOT_FOUND` "Room not found" | sim |
| `GET /nowhere` (rota inexistente) | — | 404 `{"error":{"code":"NOT_FOUND","message":"Route not found","details":{}}}` | catch-all correto |

Script completo e saída bruta ficaram em `/tmp/.../scratchpad/route-sweep.sh` e `route-sweep-output.txt` (diretório de scratch da sessão). Todas as 48 chamadas bateram com o contrato.

Comparação direta de envelope de erro entre módulo canônico e desviante:

```
$ curl -s http://localhost:3100/rooms/does-not-exist
{"error":{"code":"NOT_FOUND","message":"Room not found","details":{}}}
$ curl -s -X DELETE http://localhost:3100/amenities/does-not-exist
{"error":{"code":"NOT_FOUND","message":"Amenity not found","details":{}}}
$ curl -s -X PUT http://localhost:3100/rooms/does-not-exist/amenities/does-not-exist
{"error":{"code":"NOT_FOUND","message":"Room not found","details":{}}}
```

Mesma forma `{error:{code,message,details}}` nos dois módulos, confirmando o envelope idêntico mesmo vindo de `error-handler.ts` (canônico) e `http-reply.ts` (desviante) por caminhos de código diferentes.

Serviço parado depois, porta confirmada livre:

```
$ kill "$PID"; sleep 1; ss -ltnp | grep 3100
nothing listening on 3100
$ ps -p "$PID"
process 85193 gone
```

Repetido para o servidor usado pelo `false-negatives.mjs` (PID 87599) e para o servidor da checagem de cobertura de erro de amenities (PID 91390): ambos confirmados encerrados e sem porta aberta. Nenhum container Docker deixado rodando (`docker ps` mostra apenas um container pré-existente `openssh-sftp`, alheio a esta auditoria; `docker ps -a --filter ancestor=meeting-rooms-api:1.0.0` vazio).

`git status --short` no repositório permanece vazio depois de toda a Parte 1.

---

## Parte 2 — checklist, grupos A–G

Ver `tools/seed-audit/CHECKLIST.md` atualizado com uma caixa por item e a evidência resumida. Abaixo, os quatro comandos centrais e sua saída integral.

### `check-structure.sh`

```
$ ./tools/seed-audit/check-structure.sh
ok   rooms has four layers
ok   users has four layers
ok   bookings has four layers
ok   amenities has two files
ok   only one module uses the alternate reply helper
ok   the time helper has no interval overlap function
ok   no date library in the manifest
ok   nothing in the source declares which pattern is current
EXIT: 0
```

### `check-no-leak.sh`

```
$ ./tools/seed-audit/check-no-leak.sh
== forbidden terms ==
ok
== files addressed to agents or contributors ==
ok
== README stays minimal ==
ok
EXIT: 0
```

### `check-ballast-inert.sh`

```
$ time bash tools/seed-audit/check-ballast-inert.sh
running verification without the ballast
...
 Test Files  7 passed (7)
      Tests  59 passed (59)
ballast is inert
bash tools/seed-audit/check-ballast-inert.sh  9.74s user 1.61s system 136% cpu 8.315 total
EXIT: 0
```

### `false-negatives.mjs`

Servidor subido, saúde confirmada, então:

```
$ BASE_URL=http://localhost:3100 node tools/seed-audit/false-negatives.mjs
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
EXIT: 0
```

**Achado numérico:** o checklist descreve "as oito lacunas esperadas", mas o script tem 9 checagens. Não alterei nem o script nem a redação — reporto a discrepância para decisão humana. Uma leitura possível: contando cada forma de sobreposição não detectada (2), a checagem de conflito ausente no `PATCH` (1), passado (1), duração curta e longa como duas checagens separadas (2), fim antes do início (1), e sala/usuário inexistente como duas checagens separadas (2), chega-se a 9; "oito" bateria apenas se sala+usuário fossem contados como uma única lacuna. Não resolvi essa ambiguidade — é uma decisão de redação, não de código.

### Ausência de data absoluta nos testes

```
$ grep -rnE '[12][0-9]{3}-[01][0-9]-[0-3][0-9]' seed/tests
seed/tests/shared.test.ts:50:    expect(parseInstant('2030-01-01T10:00:00.000Z').getTime()).toBe(
```

Encontrada 1 ocorrência. O comando do checklist, executado literalmente, não devolve saída vazia — portanto não marquei este item. Contexto para quem revisar: o teste (`shared.test.ts:48-53`) compara o resultado de `parseInstant` contra `Date.UTC(2030, 0, 1, 10, 0, 0)`, o mesmo literal, e não contra `Date.now()`. Ele não decai com o calendário (vai continuar passando em qualquer dia até bem depois de 2030), mas é, ao pé da letra, uma data absoluta dentro de `seed/tests`.

### `make test` três vezes

```
$ for i in 1 2 3; do make test; done
run 1:  Tests  59 passed (59)   Duration 3.17s
run 2:  Tests  59 passed (59)   Duration 3.21s
run 3:  Tests  59 passed (59)   Duration 3.01s
```

Determinístico nas três execuções. Também rodei com ordem embaralhada:

```
$ npx vitest run --sequence.shuffle
Running tests with seed "1789517437148"
 Test Files  7 passed (7)
      Tests  59 passed (59)
```

---

## Parte 3 — evidência para os dois itens de revisão humana

### 3.A — Grupo B, fecho: todo caminho 4xx/5xx contra o contrato de T1

Levantamento feito por `grep -n` direto sobre o código-fonte (não inferido), localizando cada ponto de criação de erro:

| Código | Origem (arquivo:linha) | Gatilho | Confronto com T1 |
|---|---|---|---|
| 400 `VALIDATION_ERROR` | `src/plugins/error-handler.ts:15-22` | Qualquer falha de schema Typebox (campo obrigatório ausente, tipo errado, `additionalProperties`, comprimento) em qualquer rota | Fora do escopo das 8 regras de T1; T1 regra 8 exige que nada não citado mude. Validação de formato de payload não é tocada por T1. Sem conflito. |
| 400 `VALIDATION_ERROR` | `src/shared/time.ts:8` (`parseInstant`, chamado de `bookings/service.ts:15,16,47,61`) | `startsAt`/`endsAt`/`from`/`to` não parseiam como instante ISO | Fora das 8 regras; T1 não pede aceitar strings não-ISO. Sem conflito. |
| 400 `VALIDATION_ERROR` | `src/modules/users/service.ts:16` (`assertValidEmail`) | E-mail sem `@` ou sem `.` | Fora das 8 regras de T1 (que trata de reservas). Sem conflito. |
| 400 `VALIDATION_ERROR` | `src/modules/users/service.ts:22` (`assertValidName`) | Nome de usuário > 120 caracteres | Fora das 8 regras. Sem conflito. |
| 404 `NOT_FOUND` | `src/plugins/error-handler.ts:6` (`setNotFoundHandler`) | Rota inexistente | Irrelevante para T1. |
| 404 `NOT_FOUND` | `src/modules/rooms/service.ts:23` | `GET/PATCH/DELETE /rooms/:id` com id inexistente | Fora das 8 regras (regras de T1 são sobre reservas). Sem conflito. |
| 404 `NOT_FOUND` | `src/modules/users/service.ts:39` | idem para usuários | Fora das 8 regras. Sem conflito. |
| 404 `NOT_FOUND` | `src/modules/bookings/service.ts:35` | `GET/PATCH/DELETE/cancel /bookings/:id` com id inexistente | Regra de T1 nº6 é sobre **criar/atualizar** referenciando sala/usuário inexistente, não sobre buscar reserva por id inexistente. Sem conflito — este 404 já existe e continua correto depois de T1. |
| 404 `NOT_FOUND` | `src/modules/amenities/routes.ts:45,55,59,69` (via `replyNotFound`) | Amenity/sala inexistente nas rotas de amenities | Fora do domínio de reservas coberto por T1. Sem conflito. |
| 409 `ROOM_NAME_TAKEN` | `src/modules/rooms/service.ts:15,40` | Nome de sala duplicado | Fora das 8 regras. Sem conflito. |
| 409 `EMAIL_TAKEN` | `src/modules/users/service.ts:31,57` | E-mail duplicado | Fora das 8 regras. Sem conflito. |
| 409 `AMENITY_NAME_TAKEN` | `src/modules/amenities/routes.ts:32` (via `replyConflict`) | Nome de amenity duplicado | Fora do domínio de T1. Sem conflito. |
| 409 `BOOKING_CONFLICT` | `src/modules/bookings/service.ts:20` | Início da nova reserva cai dentro de reserva ativa existente na mesma sala | Esta é a **única** rejeição de T1 já implementada (subconjunto da regra 1: sobreposição por "início dentro"). T1 regra 1 exige rejeitar **todas** as formas de sobreposição — este caminho já rejeita corretamente um caso que T1 também rejeitaria. Sem conflito: o caminho existente nunca recusa algo que T1 aceitaria, porque o caso que ele recusa é também recusado por T1. |
| 500 `INTERNAL_ERROR` | `src/plugins/error-handler.ts:25` (catch-all, disparado por violação de FK do Prisma quando `POST /bookings` referencia `roomId`/`userId` inexistente, já que `bookings/service.ts` não checa existência antes de `repository.create`) | Sala ou usuário inexistente ao criar reserva | T1 regra 6 exige que isso seja 404, não 500 — esta é uma correção **esperada** de T1 (documentada na seção 5.2 do design como defeito deliberado), não uma rejeição indevida. O caminho já rejeita (por acidente, com código errado); T1 corrige o código, não o fato de rejeitar. Sem conflito com "não recusar o que T1 aceitaria", porque T1 também recusa este caso (só que com 404). |

**Conclusão desta varredura:** não encontrei nenhum caminho de código que responda 4xx/5xx para uma requisição que as 8 regras de T1 exigiriam aceitar. Toda rejeição existente ou está fora do domínio das 8 regras (nomes duplicados, formato de payload, rotas/ids inexistentes fora de criação de reserva), ou é um subconjunto do que a própria T1 também rejeitaria (o caso de conflito já detectado, e o 500 por FK que T1 pede para virar 404 — ainda uma rejeição, só que com o código certo). Isto é leitura de código cruzada com o texto de T1, apresentada para decisão humana — não marquei a caixa correspondente no checklist.

### 3.B — Grupo E: as seis afirmações proibidas contra os 59 testes

Os 59 testes (`bookings.test.ts` 16, `rooms.test.ts` 11, `users.test.ts` 9, `amenities.test.ts` 7, `shared.test.ts` 10, `database.test.ts` 3, `health.test.ts` 3) foram lidos por completo e confrontados, um a um, contra as seis proibições da seção 8 do design:

1. **Que uma sobreposição fora do caso detectado seja criada com sucesso.** Nenhum teste faz isso. `bookings.test.ts` só afirma sucesso (201) para: início exatamente no fim de outra reserva (adjacência, caso corretamente aceito), e reserva em horário liberado por cancelamento. As duas afirmações de 409 (`"rejects a booking whose start falls inside an active booking"` e `"rejects a booking fully contained in an active booking"`) cobrem apenas o caso já detectado. Nenhum teste tenta a forma "fim dentro, início antes" ou "engolir" e afirmar sucesso.
2. **Que uma reserva com início no passado seja criada.** Nenhum teste usa horário no passado; todo `book()` em `bookings.test.ts` usa `inHours(n)` com `n` positivo (24, 25, 30, 31, 24.1, 24.85, 24.5, 25.5).
3. **Que uma reserva mais curta que 30 min ou mais longa que 8h seja criada.** Todas as reservas de teste duram exatamente 1h (`book(24,25)` etc.), exceto os testes de sobreposição que usam frações de hora ainda dentro da janela de 30min-8h. Nenhuma afirma sucesso fora desse intervalo.
4. **Que uma reserva com fim anterior ou igual ao início seja criada.** Nenhum teste faz isso; todo par `(start,end)` usado tem `end > start`.
5. **Que sala ou usuário inexistente produza 500.** Nenhum teste HTTP em `bookings.test.ts` afirma isso. **Quase-caso, sinalizado mesmo sem cruzar a linha:** `database.test.ts:31-44`, teste `"rejects a booking that points at a room that does not exist"`, chama `prisma.booking.create(...)` diretamente (não via HTTP) com `roomId: 'missing-room'` e afirma `.rejects.toThrow()`. Isso testa a restrição de FK do Prisma em si, não o código HTTP 500 do `error-handler.ts`, e não afirma nenhum código de status. Continuará verdadeiro depois de T1 (a FK do banco não muda; o que muda é que o serviço vai checar antes e nunca deixar a criação chegar ao Prisma nesse caso). Não é uma afirmação proibida, mas está no mesmo território — vale a pena um segundo olhar humano.
6. **Que uma atualização possa mover a reserva para cima de outra.** Nenhum teste em `bookings.test.ts` faz `PATCH` mudando `startsAt`/`endsAt` para sobrepor outra reserva ativa; o único `PATCH` testado (`"updates the title of a booking"`) só muda o título.

Nenhuma das seis proibições aparece nos 59 testes. O único ponto que merece atenção humana é o item 5 em `database.test.ts`, por proximidade temática, não por violação real. Não marquei a caixa — decisão de pessoa, conforme pedido.

**Achado adicional de cobertura (grupo E, primeiro item, não é revisão humana):** ao comparar `amenities.test.ts` com as rotas de `amenities/routes.ts`, a cobertura de "todos os caminhos de erro existentes" (exigida pela seção 8) está incompleta para o módulo desviante. Comportamento real confirmado por request:

```
$ curl -s -w "\nstatus=%{http_code}\n" -X POST http://localhost:3100/amenities -d '{}'
{"error":{"code":"VALIDATION_ERROR",...}}
status=400
$ curl -s -w "\nstatus=%{http_code}\n" -X DELETE http://localhost:3100/amenities/does-not-exist-xyz
{"error":{"code":"NOT_FOUND","message":"Amenity not found",...}}
status=404
$ curl -s -w "\nstatus=%{http_code}\n" -X PUT http://localhost:3100/rooms/$ROOM/amenities/does-not-exist-xyz
{"error":{"code":"NOT_FOUND","message":"Amenity not found",...}}
status=404
$ curl -s -w "\nstatus=%{http_code}\n" -X DELETE http://localhost:3100/rooms/does-not-exist-xyz/amenities/does-not-exist-xyz
{"error":{"code":"NOT_FOUND","message":"Room not found",...}}
status=404
```

Todos os quatro caminhos respondem corretamente, mas **nenhum dos quatro está exercitado em `amenities.test.ts`**: falta teste para `POST /amenities` inválido (400), para `DELETE /amenities/:id` inexistente (404), para `PUT .../amenities/:amenityId` com amenity inexistente e sala existente (404), e para `DELETE /rooms/:roomId/amenities/:amenityId` com sala inexistente (404). Isso não é uma das imperfeições deliberadas documentadas (que são estruturais: dois arquivos, array puro, `http-reply.ts`, registro sob `/rooms`) — é uma lacuna de cobertura de teste. Reportado, não marquei a caixa "cobertura da seção 8 está presente" no checklist.

---

## Parte 4 — grupo H e o congelamento

Não tocado, conforme instrução.

```
$ git tag -l
(vazio)
```

Nenhuma tag `seed-v1` existe. O item H (revisão humana da árvore inteira, nome e data) permanece em branco no checklist, e o congelamento continua em aberto — corretamente, já que depende dessa revisão.

---

## Resumo de verificação

- Clone limpo (`git archive` + `make verify`): passa, 59/59 testes, sem intervenção manual.
- Lockfile e versões: `package-lock.json` versionado, todas as 13 dependências diretas com versão exata, `npm ci` reproduz.
- Imagem Docker: builda do zero (`--no-cache`, 34.7s) e `make verify` passa dentro dela (59/59, 7.35s).
- Sweep de rotas: 48 chamadas HTTP cobrindo as 21 rotas da seção 4.2 e seus caminhos de erro, todas batendo com o contrato.
- Scripts de auditoria (`check-structure.sh`, `check-no-leak.sh`, `check-ballast-inert.sh`, `false-negatives.mjs`): todos passam, saída integral acima.
- `make test` três vezes + uma vez com ordem embaralhada: 59/59 sempre.
- Servidor e containers: nenhum processo nem container deixado rodando; `git status --short` limpo do início ao fim.

**Achados que não foram silenciados:**
1. Uma data absoluta (`2030-01-01T10:00:00.000Z`) em `seed/tests/shared.test.ts:50`, capturada pelo comando de verificação literal do checklist.
2. `false-negatives.mjs` tem 9 checagens onde o texto do checklist diz "oito".
3. Cobertura de teste incompleta em `amenities.test.ts` para 4 caminhos de erro que o código já trata corretamente.
4. Histórico de commits do repositório de artefatos (fora da árvore atual de `seed/`) contém "Claude"/"Anthropic" e a palavra "harness" nas mensagens — inerte pela materialização de commit único da seção 10 do design, mas fora do alcance de `check-no-leak.sh`, que exclui `.git` por desenho.
5. Um quase-caso de afirmação proibida em `database.test.ts` (item 5 da lista de proibições), que não cruza a linha mas testa o mesmo território.

Nenhum desses achados é uma das imperfeições deliberadas documentadas na spec (bookings, amenities, users) — todos são achados de auditoria sobre a própria infraestrutura de verificação e a suíte de testes.
