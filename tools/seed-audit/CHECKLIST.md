# Aceite do repositório-semente

Referência: `docs/superpowers/specs/2026-09-09-repositorio-semente-design.md`, seção 11.

Auditoria executada em 2026-09-15. Evidência completa, com cada comando e sua saída real, em
`docs/superpowers/2026-09-15-validacao-da-semente.md`. Caixas marcadas somente para itens
verificados por comando/execução real, nunca por leitura inferida.

## A. Contrato funcional
- [x] Todas as rotas da seção 4.2 respondem com os códigos listados — `cd seed && make verify`; sweep manual de todas as 21 rotas via curl contra o servidor rodando (ver relatório §Parte 1.4). Todas bateram com os códigos do contrato, incluindo caminhos de erro.
- [x] O envelope de erro é idêntico em todos os caminhos, inclusive no módulo desviante — comparado por request real: `GET /rooms/does-not-exist` (canônico, via `error-handler.ts`) e `DELETE /amenities/does-not-exist` / `PUT /rooms/does-not-exist/amenities/x` (desviante, via `http-reply.ts`) devolvem a mesma forma `{"error":{"code","message","details"}}`.
- [x] Listagens canônicas usam o auxiliar de paginação; a do desviante devolve array puro — `GET /rooms` devolveu `{"data":[...],"pagination":{...}}`; `GET /amenities` devolveu `[...]` puro. Confirmado também por `check-structure.sh`.
- [x] `GET /health` responde 200 — confirmado repetidamente (`{"status":"ok"}`).
- [x] O cancelamento é idempotente — `POST /bookings/:id/cancel` duas vezes seguidas: ambas 200, corpo idêntico (`status:"CANCELLED"`), nunca 409.

## B. Regra do falso negativo
- [x] As nove lacunas esperadas estão presentes — `node tools/seed-audit/false-negatives.mjs` contra o servidor rodando: 9 verificações, todas `ok`, saída final `all expected gaps are present`, exit 0. A regra combinada "sala ou usuário inexistente" conta como duas lacunas distintas (uma por lado); a checagem da metade "usuário" foi adicionada depois (commit `61d5fb0`, "audit the missing-user half of the false-negative rule"), o que eleva o total de 8 para 9. Contagem corrigida nesta rodada.
- [ ] **Fecho, revisão humana:** lendo o contrato de T1 contra o código, não existe nenhum caminho que recuse um pedido que T1 aceitaria. **Não marcado — decisão de pessoa.** Evidência completa (tabela de todo caminho 4xx/5xx com arquivo:linha, confrontada rule a rule contra T1) no relatório, seção Parte 3.A. Conclusão da auditoria, para revisão: nenhum caminho encontrado rejeita algo que o contrato de T1 aceitaria.

## C. Estrutura e convenções
- [x] Contagens de arquivos e ausência de marcações — `./tools/seed-audit/check-structure.sh`, todas as 8 checagens `ok`, exit 0.
- [x] O serviço de usuários carrega exatamente as duas imperfeições nomeadas, e nenhuma outra — leitura integral de `src/modules/users/{routes,service,repository,schema}.ts`: `assertValidEmail` (service.ts:14-18) duplica a validação que `EMAIL_PATTERN` já faz no schema; `MAX_NAME_LENGTH = 120` (service.ts:12) é constante fixa no código, ausente de `src/config.ts`. Nenhuma terceira imperfeição encontrada nas quatro camadas.
- [x] A regra de negócio nunca está nas rotas dos módulos canônicos — leitura integral de `rooms/routes.ts`, `users/routes.ts`, `bookings/routes.ts`: toda rota só valida por schema e delega a `service.*`, sem condicional de negócio.

## D. Ausência de vazamento
- [x] Termos, arquivos dirigidos a agente e README — `./tools/seed-audit/check-no-leak.sh`, três checagens `ok`, exit 0. **Nota:** o histórico de commits deste repositório de artefatos (não só os que tocam `seed/`; ver `git log --all --oneline`) contém termos banidos — "harness" na mensagem do commit `5a492c8` ("test harness"), "semente"/"repositório-semente" em várias mensagens, e "Claude"/"Anthropic" nas linhas `Co-Authored-By`/`Claude-Session`. Isso já é inerte: pela seção 10 da spec, o runner materializa a cópia como um repositório novo, extraindo só a árvore de `seed/` na tag `seed-v1` e criando um único commit de mensagem neutra — o histórico deste repositório de artefatos nunca chega à sessão do agente. `check-no-leak.sh` exclui `.git` do escopo por desenho, e é por isso que não pega esses termos — não é uma falha do script. Registrado aqui para que não seja redescoberto e tratado como vazamento real.
- [x] Nenhum teste oculto, ponto de decisão ou implementação de referência na árvore ou no histórico — árvore atual: nenhum arquivo suspeito. Histórico completo de `seed/` (14 commits) revisado; único arquivo removido foi `seed/tests/smoke.test.ts` (placeholder de bootstrap, teste trivial "toolchain", sem conteúdo sensível) — conteúdo inspecionado via `git show`.
- [x] O runner materializa a cópia com um único commit de mensagem neutra — a tag `seed-v1` ainda não existe, então o mecanismo foi exercitado contra `HEAD` (`19230d8`) em vez da tag: `git archive HEAD:seed | tar -x -C "$TMPDIR"`, `git init` no diretório extraído, um commit (`git commit -m "seed"`), `git rev-list --count HEAD` devolveu `1`, e `make verify` dentro da cópia extraída passou (59/59 testes, exit 0 — contagem de antes desta rodada de correções; ver relatório). Rodado contra `HEAD` porque a tag `seed-v1` não foi criada ainda; repetir contra a tag assim que ela existir.

## E. Testes da semente
- [x] Nenhuma fixture com instante derivado do calendário — `grep -rnE '[12][0-9]{3}-[01][0-9]-[0-3][0-9]' seed/tests` (mecanismo do critério, mantido como está) encontra 1 ocorrência: `seed/tests/shared.test.ts:50`. O que o critério protege de verdade é uma FIXTURE cujo instante vem do calendário (ex.: um ano fixo somado a `Date.now()`), o que faria a suíte congelada começar a falhar numa data futura real — não um parser sendo exercitado com um literal ISO. Única ocorrência conhecida e aceitável, com sua justificativa: `shared.test.ts:48-53`, teste "parses an ISO instant", compara `parseInstant('2030-01-01T10:00:00.000Z')` contra `Date.UTC(2030, 0, 1, 10, 0, 0)` — o mesmo literal dos dois lados, é o parser que está sob teste, não uma fixture de negócio, e não depende de `Date.now()`; não apodrece com o calendário. Esta é a única ocorrência permitida pelo item; uma segunda ocorrência do grep continua reprovando o critério.
- [ ] **Revisão humana:** nenhuma das seis afirmações proibidas da spec seção 8 aparece. **Não marcado — decisão de pessoa.** Todos os 63 testes confrontados um a um no relatório (59 na primeira rodada, mais os 4 de caminhos de erro de `amenities` acrescentados depois, que tratam apenas daquele módulo e não podem cruzar a linha, já que as seis afirmações proibidas são todas sobre reservas), seção Parte 3.B. Nenhum cruza a linha; um teste (`tests/database.test.ts:31-44`, "rejects a booking that points at a room that does not exist") chega perto da proibição 5 (que sala/usuário inexistente produza 500) mas testa a rejeição do Prisma diretamente, não o código HTTP, e não afirma o código de status 500 — sinalizado para revisão apesar de não cruzar a linha.
- [x] A suíte passa em execuções repetidas — `make test` rodado 3 vezes seguidas: 59/59 em todas, tempos 3.17s/3.21s/3.01s. Adicionalmente `npx vitest run --sequence.shuffle`: 59/59 com ordem de arquivos embaralhada.

## F. Inércia do lastro
- [x] `./tools/seed-audit/check-ballast-inert.sh` — remove `data .cache dist infra .github CHANGELOG.md LICENSE .editorconfig` de uma cópia e roda `make verify`: 59/59 testes, "ballast is inert", exit 0.
- [x] Nenhum alvo do Makefile e nenhuma etapa do Dockerfile dependem do lastro — demonstrado pelo mesmo script: `make verify` completo (typecheck, lint, build, test) passa sem nenhum dos arquivos de lastro presentes.

## G. Reprodutibilidade e operação
- [x] De um clone limpo, `make verify` passa — `git archive HEAD:seed` extraído em diretório temporário (Node 22.16.0 via nvm), `make verify` rodou sem intervenção manual: 59/59 testes, exit 0. Diretório temporário apagado depois.
- [x] Versões exatas e lockfile versionado — `package-lock.json` rastreado no git (`lockfileVersion: 3`); nenhuma dependência em `package.json` usa `^`/`~`; todas as 13 dependências diretas confirmadas com versão exata via script Node. `npm ci` a partir do lockfile reproduz a instalação (232 pacotes, exit 0).
- [x] `docker run --rm meeting-rooms-api:1.0.0 make verify` passa — imagem construída do zero com `docker build --no-cache` (34.7s), depois `docker run --rm ... make verify`: 59/59 testes, exit 0.
- [x] Tempo de verificação medido e registrado aqui: **~7.3s a ~11.6s**, conforme o cenário — `docker run --rm meeting-rooms-api:1.0.0 make verify` (dependências e schema já preparados na imagem): **7.35s** de parede. Clone limpo via `git archive` (inclui `npm ci` do zero, ~4s): **11.56s** de parede total (`make verify` user+sys 13.34s/3.18s, 142% cpu). `make test` isolado, três execuções: 3.17s / 3.21s / 3.01s. Valor anterior no arquivo era `7.7s`; substituído pelas medições desta auditoria, consistentes com aquele valor no cenário de imagem pronta.

## H. Revisão humana
- [ ] Integrante que revisou a árvore inteira: `______`  Data: `______`

**Tag `seed-v1`: não existe** (`git tag -l` vazio). Confirmado, não criada por esta auditoria — o congelamento depende da revisão humana do grupo H, que permanece em aberto.
