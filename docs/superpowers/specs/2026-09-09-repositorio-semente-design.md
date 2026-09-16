# Spec — Repositório-semente

**Data:** 09/09/2026
**Componente:** repositório-semente, `seed/`
**Entrega:** M2, 13/09/2026 · congelado na tag `seed-v1`
**Origem das decisões:** Rodada 4 de `docs/00-log-sessao-planejamento.md`
**Pressupõe leitura de:** `01-plano-de-projeto.md` seção 2 (glossário) e `02-protocolo-experimental.md`

---

## 1. Propósito e fronteira

O repositório-semente é o estado inicial idêntico de toda sessão do experimento. Ele não é um entregável de software: é instrumento de medida. Toda decisão de projeto aqui é subordinada a uma pergunta única — esta escolha aumenta ou diminui a capacidade do experimento de distinguir efeito de harness de ruído?

**Dentro do componente:** a aplicação, o tooling, a suíte de testes da própria semente, o Makefile, a imagem Docker base, o lastro inerte e o README.

**Fora do componente:** enunciados de T1 e T2, testes ocultos, lista de pontos de decisão, o `CLAUDE.md` de P1, a configuração P2, o runner, o script de convenções, os prompts do avaliador cego e a implementação de referência humana.

**Invariante de fronteira:** nenhum artefato da segunda lista pode existir dentro da árvore da semente em nenhum momento, nem em branch, nem em histórico, nem em comentário. Violação disso invalida o experimento inteiro pela verificação 5 do portão de M3.

**Onde vive e como congela.** A semente ocupa o diretório `seed/` do repositório único de artefatos, conforme a seção 7 do `03-plano-de-execucao.md`. O congelamento é a tag `seed-v1` sobre esse repositório, que é um instantâneo imutável mesmo que o restante da árvore continue evoluindo. O runner materializa a cópia de trabalho extraindo apenas `seed/` a partir da tag, e não clonando o repositório de artefatos, que contém os testes ocultos e o protocolo.

## 2. Decisões estruturantes desta spec

| # | Decisão | Racional resumido | Log |
|---|---|---|---|
| 1 | A semente contém detecção de conflito **parcial**, não ausente | Sem 409 na semente, o ticket RES-142 de T2 é incoerente e o agente colapsa T2 em T1 | R4.1 |
| 2 | **Regra do falso negativo**: todo defeito da semente deixa passar, nenhum recusa | Um falso positivo explicaria o sintoma do ticket e faria T2 virar correção de bug | R4.2 |
| 3 | Prisma com SQLite, imagem pré-construída, verificação auto-curativa | Variância vinda de brigar com a tecnologia é ruído que levanta o piso de interpretação | R4.3 |
| 4 | Quatro módulos, sendo um estruturalmente desviante | Ambiguidade de padrão é o que dá valor ao mapa que P1 fornece | R4.7, seção 6 |
| 5 | Código e README em inglês, enunciados em português | Padrão de base Node e legibilidade do artefato publicado | R4.10 |
| 6 | README mínimo, sem arquitetura nem convenções | Informação dirigida ao agente é o tratamento, não pode vazar para P0 | R4.11 |
| 7 | Lastro inerte comprovadamente inerte | Compra validade aparente a custo zero, desde que não possa quebrar nada | R4.7, seção 7 |

**Definição operacional de P0 que governa esta spec:** P0 não é ausência de informação, é ausência de informação **dirigida ao agente**. A semente contém tudo que um desenvolvedor recém-contratado encontraria no repositório, e nada que tenha sido escrito para instruir um agente.

## 3. Domínio e modelo de dados

API REST de reservas de salas. Sem autenticação, sem autorização, sem multi-tenancy.

| Entidade | Campos |
|---|---|
| `Room` | `id`, `name` único, `capacity`, `floor` opcional, `createdAt`, `updatedAt` |
| `User` | `id`, `name`, `email` único, `createdAt`, `updatedAt` |
| `Booking` | `id`, `roomId`, `userId`, `title`, `startsAt`, `endsAt`, `status`, `createdAt`, `updatedAt` |
| `Amenity` | `id`, `name` único, `description` opcional |
| `RoomAmenity` | tabela de junção explícita entre `Room` e `Amenity` |

Restrições técnicas registradas:

- O conector SQLite do Prisma não suporta enumerações. `status` é texto com padrão `ACTIVE`, e o domínio `ACTIVE | CANCELLED` é expresso como união de literais em TypeScript.
- Chaves estrangeiras são aplicadas pelo banco. Referência a sala ou usuário inexistente estoura na inserção, o que é a origem deliberada do erro 500 descrito na seção 5.
- Índice composto em `Booking` por `roomId` e `startsAt`.
- Todos os instantes trafegam como texto ISO 8601 em UTC.

A semente **não inclui nenhuma biblioteca de data**. Aritmética de tempo usa `Date` puro mais `src/shared/time.ts`. Isso é deliberado: é a única tentação honesta que se pode criar para a regra 2 do script de convenções, "dependência acrescentada", sem tocar no texto dos enunciados.

## 4. Contrato HTTP

### 4.1 Envelope de resposta

Erro, idêntico em toda a API:

```json
{ "error": { "code": "NOT_FOUND", "message": "Room not found", "details": {} } }
```

Códigos existentes na semente: `VALIDATION_ERROR` 400, `NOT_FOUND` 404, `ROOM_NAME_TAKEN` 409, `EMAIL_TAKEN` 409, `BOOKING_CONFLICT` 409, `INTERNAL_ERROR` 500.

Listagem paginada dos módulos canônicos:

```json
{ "data": [], "pagination": { "total": 0, "limit": 20, "offset": 0 } }
```

O módulo desviante devolve array puro, sem envelope. Ver seção 6.

### 4.2 Rotas

| Método e caminho | Respostas | Observação |
|---|---|---|
| `GET /health` | 200 | Usado pelo runner como sinal de prontidão |
| `POST /rooms` | 201, 400, 409 | |
| `GET /rooms` | 200 | Filtros `name`, `limit`, `offset` |
| `GET /rooms/:id` | 200, 404 | |
| `PATCH /rooms/:id` | 200, 400, 404, 409 | |
| `DELETE /rooms/:id` | 204, 404 | Remoção real, em cascata nas reservas |
| `POST /users` | 201, 400, 409 | |
| `GET /users` | 200 | Filtros `email`, `limit`, `offset` |
| `GET /users/:id` | 200, 404 | |
| `PATCH /users/:id` | 200, 400, 404, 409 | |
| `DELETE /users/:id` | 204, 404 | Remoção real, em cascata nas reservas |
| `POST /bookings` | 201, 400, 409 | Conflito parcial, ver seção 5 |
| `GET /bookings` | 200 | Filtros `roomId`, `userId`, `status`, `from`, `to`, `limit`, `offset` |
| `GET /bookings/:id` | 200, 404 | |
| `PATCH /bookings/:id` | 200, 400, 404 | **Nenhuma checagem de conflito** |
| `DELETE /bookings/:id` | 204, 404 | Remoção real |
| `POST /bookings/:id/cancel` | 200, 404 | Idempotente, ver seção 5 |
| `POST /amenities` | 201, 400, 409 | Módulo desviante |
| `GET /amenities` | 200 | Array puro, sem paginação |
| `DELETE /amenities/:id` | 204, 404 | |
| `PUT /rooms/:roomId/amenities/:amenityId` | 204, 404 | Registrado pelo módulo desviante |
| `DELETE /rooms/:roomId/amenities/:amenityId` | 204, 404 | Registrado pelo módulo desviante |

O cancelamento é rota de ação própria, e não um `DELETE` que apaga por baixo dos panos. Duas razões: mantém a semântica de `DELETE` consistente nos três módulos canônicos, e dá ao agente um exemplo de rota fora do padrão CRUD, que é o formato que uma solução de T2 provavelmente vai querer imitar.

## 5. A regra do falso negativo

**Invariante central da semente.** Nenhum comportamento da semente pode recusar um pedido que o contrato de T1 aceitaria. Todos os defeitos deixam passar; nenhum recusa.

O motivo é estrutural. Se a semente recusasse indevidamente, o sintoma do ticket RES-142 — usuários esbarrando em conflito — passaria a ser explicado por esse defeito. O agente de T2 encontraria o bug, corrigiria, e T2 colapsaria em T1 por um segundo caminho. Isso destruiria o instrumento de convergência, que é o resultado central do trabalho.

### 5.1 Checagem de conflito na criação

O serviço de reservas consulta reservas **ativas** da mesma sala e verifica se o **início** da nova reserva cai dentro de alguma delas. A condição de repositório é `roomId` igual, `status` igual a `ACTIVE`, `startsAt` menor ou igual ao novo início, e `endsAt` estritamente maior que o novo início.

| Caso de sobreposição | Comportamento da semente |
|---|---|
| Novo início cai dentro de uma reserva existente | Detectado, responde 409 |
| Nova reserva contida inteiramente em uma existente | Detectado, pois o início cai dentro |
| Novo fim cai dentro de uma existente, início antes dela | **Não detectado**, falso negativo |
| Nova reserva engole uma existente | **Não detectado**, falso negativo |
| Reservas adjacentes, fim de uma igual ao início da outra | Aceito, correto, sem falso positivo |
| Reserva existente cancelada | Ignorada, correto, sem falso positivo |

A borda já é estrita e reservas canceladas já são ignoradas **precisamente para não haver falso positivo**. Esses dois acertos não são generosidade com o agente: são exigência da invariante.

### 5.2 Demais defeitos, todos falsos negativos

- `PATCH /bookings/:id` não faz nenhuma checagem de conflito.
- Não há validação de reserva no passado.
- Não há duração mínima nem máxima.
- Não há validação de que o fim seja posterior ao início. O schema valida apenas que ambos são instantes ISO válidos.
- Sala ou usuário inexistente estoura na chave estrangeira e sai como 500, não como 404.

**Nota de manutenção (16/09/2026).** O manipulador de erros (`seed/src/plugins/error-handler.ts`) tinha um defeito acidental, fora desta lista: seu catch-all ignorava o `statusCode` que o próprio Fastify já atribuía a erros de framework (por exemplo, corpo vazio com `content-type: application/json`), respondendo 500 para esses casos em vez do 400 que o framework já havia decidido. Isso não é um dos cinco defeitos deliberados acima — não afirma nenhuma regra de negócio de T1, apenas descarta uma informação que o próprio framework fornece. Foi corrigido acrescentando um ramo, entre a checagem de validação de schema e o catch-all, que honra um `statusCode` de erro de cliente (4xx) já definido pelo Fastify, mantendo o mesmo envelope de resposta e usando o código `VALIDATION_ERROR` já existente. A correção foi verificada para não alterar nenhum dos cinco defeitos desta seção nem a linha de base da suíte oculta: erros do Prisma não carregam `statusCode`, então o caso de sala ou usuário inexistente continua caindo no catch-all e saindo como 500.

### 5.3 Cancelamento idempotente

Cancelar uma reserva já cancelada responde 200 com a reserva inalterada, e não 409. Um 409 aqui seria uma recusa, e recusa é proibida pela invariante.

## 6. Estrutura de código e convenções

### 6.1 Árvore

```
seed/
  Makefile  Dockerfile  docker-compose.yml  .dockerignore
  .gitignore  .editorconfig  .env.example  LICENSE  CHANGELOG.md  README.md
  package.json  package-lock.json  tsconfig.json  eslint.config.js  .prettierrc  vitest.config.ts
  prisma/schema.prisma
  infra/terraform/            <- lastro inerte
  .github/workflows/ci.yml    <- lastro inerte
  src/
    server.ts  app.ts  config.ts
    db/client.ts
    plugins/       request-id.ts  error-handler.ts  register-modules.ts
    shared/        errors.ts  pagination.ts  time.ts  http-reply.ts
    modules/rooms/     routes.ts  service.ts  repository.ts  schema.ts
    modules/users/     routes.ts  service.ts  repository.ts  schema.ts
    modules/bookings/  routes.ts  service.ts  repository.ts  schema.ts
    modules/amenities/ routes.ts  queries.ts
  tests/
    helpers/app.ts  rooms.test.ts  users.test.ts  bookings.test.ts  amenities.test.ts
```

### 6.2 Padrão canônico

Três módulos seguem quatro camadas. As rotas validam entrada e saída por schema e delegam. O serviço tem a regra de negócio. O repositório é o único que fala com o banco. O schema declara requisição e resposta.

Seis convenções são estabelecidas **pelo exemplo**, e são as mesmas que P1 declara em texto: camadas; schema de requisição e resposta por rota; erros pelo tipo de erro da aplicação; paginação pelo auxiliar compartilhado; logger em vez de `console`; testes no diretório próprio.

### 6.3 Desvios deliberados, e o teto que não pode ser ultrapassado

O padrão canônico precisa continuar **claramente dominante**. Duas coisas dependem disso. O script de convenções conta violações contra um padrão, e um padrão minoritário torna a contagem injusta. E o arquivo de contexto de P1 afirma "este é o padrão do projeto", afirmação que o agente pode verificar lendo o código; se for falsa, P1 vira ruído em vez de tratamento.

O orçamento de desvio da semente é este, e está fechado:

1. **Módulo desviante.** `amenities` tem dois arquivos, rotas e consultas, sem separação em serviço e repositório. Devolve array puro na listagem, sem o envelope de paginação. É o único módulo que responde erro pelo auxiliar `http-reply.ts` em vez de lançar o tipo de erro da aplicação. Registra rotas sob o caminho de salas, e não sob o próprio.
2. **Auxiliar substituído.** `src/shared/http-reply.ts` produz o **mesmo envelope externo** que o tratador de erro atual, por caminho de código diferente. O contrato externo da API permanece consistente; a convenção interna, não. Isso importa porque a regra 7 de T1 manda seguir o formato de erro já usado pela API, e dois formatos externos tornariam essa regra ambígua.
3. **Imperfeições no serviço de usuários.** Exatamente duas, nomeadas: uma validação de e-mail duplicada que o schema já faz, e um limite de tamanho de nome fixo no código em vez de na configuração. As camadas permanecem intactas.

**Escolha do domínio do módulo desviante.** `amenities` foi escolhido por ser distante de tempo e intervalos. Um módulo desviante orientado a relatórios de ocupação seria mais provável de ser notado pelo agente, mas empurraria todas as sessões de T2 para a mesma forma de solução, reduzindo artificialmente a divergência que o instrumento de convergência precisa medir. Trocaria um problema por outro pior.

**Nada no código declara qual padrão é o vigente.** Sem comentário de migração pendente, sem marcação de obsoleto, sem nome de arquivo que entregue o jogo. Se a semente declarasse isso, P0 receberia de graça exatamente o que P1 deveria acrescentar, e o fator de contexto perderia um de seus canais.

**Explicitamente recusado:** serviço chamando o banco sem passar pelo repositório, regra de negócio dentro das rotas, e acoplamento a tecnologia dentro do serviço. Qualquer um dos três derruba a dominância do padrão e contamina a pergunta 1 do checklist do avaliador cego, que passaria a medir resistência à bagunça local em vez de qualidade.

### 6.4 Tooling

TypeScript em modo estrito. ESLint com `no-explicit-any` como **erro**, decisão consciente: se o agente roda a verificação ele corrige, e se não roda a violação é contada pelo script; rodar ou não rodar passa a ser parte do efeito de harness medido. Prettier. Vitest em thread única, para o banco de arquivo não sofrer corrida. Node 22 fixado por versão exata, com lockfile versionado.

## 7. Lastro inerte

Propósito honesto: validade aparente. Um agente não lê pastas inteiras, faz busca dirigida, então uma pasta de infraestrutura custa uma ou duas chamadas de ferramenta dentro de uma variância normal muito maior. Ela **não compra efeito de harness**. Compra a defesa contra a crítica de que a semente é um brinquedo, e isso tem valor na banca a custo próximo de zero.

**Aceito:** `infra/terraform/` copiado de um layout convencional, fluxo de integração contínua chamando alvos do Makefile, changelog, licença e configuração de editor.

**Recusado, com motivo:** especificação OpenAPI, porque correta entrega estrutura demais e desatualizada vira armadilha injusta de alta variância; layout de monorepo, porque complica build, imagem e diff de verdade; e qualquer lastro do qual o Makefile ou a imagem dependam, porque deixa de ser inerte e vira mais uma coisa que pode quebrar de madrugada.

**Regra dura:** o lastro precisa ser comprovadamente inerte. Ver critério F na seção 11.

## 8. Testes da semente

Vivem em `tests/`, fora de `src/`, e exercitam a aplicação por injeção do Fastify.

**Cobertura exigida:** o CRUD dos três módulos canônicos e do desviante; a paginação e seus limites; todos os caminhos de erro existentes; e o único caso de conflito que a semente detecta. Não há meta numérica de asserções — o critério é a cobertura acima, e testes com conteúdo correto valem mais que uma contagem.

**Duas restrições valem como critério de aceite.**

Primeira, **nenhuma data absoluta**. Todo instante é derivado do momento da execução. Uma data fixa faz a suíte congelada apodrecer, e ela precisa passar igual em qualquer dia do calendário.

Segunda, e mais importante, **nenhum teste pode afirmar como esperado um comportamento que o contrato de T1 corrige**. Se um teste existente afirmasse que uma reserva sobreposta é criada com sucesso, a solução correta de T1 quebraria um teste pré-existente e **toda sessão de T1 registraria regressão falsa**. Afirmações proibidas, item a item:

- que uma sobreposição fora do caso detectado seja criada com sucesso
- que uma reserva com início no passado seja criada
- que uma reserva mais curta que trinta minutos ou mais longa que oito horas seja criada
- que uma reserva com fim anterior ou igual ao início seja criada
- que sala ou usuário inexistente produza 500
- que uma atualização possa mover a reserva para cima de outra

O que a suíte pode e deve afirmar sobre reservas: que o caso detectado responde 409; que reservas adjacentes convivem; que uma reserva cancelada libera o horário; e o CRUD e a listagem com seus filtros. Todas essas seguem verdadeiras depois de T1.

## 9. Ambiente, Makefile e Docker

### 9.1 Alvos do Makefile

| Alvo | O que faz |
|---|---|
| `setup` | Idempotente e auto-curativo: instala dependências se faltarem, regenera o cliente do Prisma se o hash do schema mudou, aplica o schema, deixa o banco vazio |
| `verify` | Chama `setup` e encadeia checagem de tipos, lint, build e testes, com um único código de saída |
| `typecheck` `lint` `format` `build` `test` | Alvos individuais |
| `start` | Sobe o servidor compilado na porta de `PORT` |
| `dev` | Sobe em modo de observação |
| `db-reset` | Recria o banco vazio |
| `demo-data` | Popula dados de demonstração. **O runner nunca chama** |
| `image` | Constrói a imagem Docker com tag fixa |
| `clean` | Remove build, banco e temporários |

A auto-cura de `setup` é o que anula a única fraqueza estrutural do Prisma, que é o cliente gerado viver em `node_modules` e ficar velho se o schema mudar. Um arquivo de carimbo em diretório ignorado guarda o hash do schema, e a regeneração só acontece quando ele difere.

### 9.2 Variáveis de ambiente

`PORT`, `DATABASE_URL`, `LOG_LEVEL` e `NODE_ENV`, com `.env.example` versionado e valores padrão que funcionam sem configuração.

### 9.3 Docker

A semente entrega a **imagem base**: Node fixado por digest, `make`, `git`, `curl`, código em `/app`, dependências instaladas e cliente do Prisma gerado na construção.

O runner constrói uma **imagem derivada** acrescentando o CLI do agente. A divisão tem razão de ser: a imagem base é o que precisa ser reproduzível e congelar junto com a semente, enquanto a versão do CLI muda por fora e é registrada por sessão como constante do protocolo.

A árvore de trabalho da sessão vive na camada gravável do contêiner, e o runner monta apenas um diretório de saída para os artefatos. Isso evita o custo de copiar dependências por sessão e mantém o desempenho de disco alto no WSL.

## 10. Contrato congelado entre a semente e o runner

Esta é a fronteira que torna as sessões de implementação seguintes mecânicas. Ela congela junto com `seed-v1`.

**O que o runner pode assumir:** os alvos `setup`, `verify`, `start`, `test` e `db-reset`; a porta vinda de `PORT`; e `GET /health` respondendo 200 quando a aplicação está pronta.

**Por que existe o endpoint de saúde.** Os testes ocultos precisam exercitar a aplicação por HTTP real, sem importar nenhum módulo interno. Se importassem, quebrariam quando o agente renomeasse um arquivo, e a falha seria defeito do instrumento, não do agente — exatamente o que a verificação 7 do portão de M3 proíbe. O runner sobe o servidor, aguarda a saúde responder, roda a suíte oculta contra a porta e derruba.

**Três garantias de isolamento**, que protegem as medições de serem sabotadas pelo próprio agente:

1. Os comandos de verificação vêm do Makefile **congelado**, nunca da cópia que o agente pode ter editado.
2. Os arquivos de teste da semente são **restaurados a partir da versão congelada** antes de medir regressão. Separadamente, o runner registra se o agente os alterou, o que é a regra 6 do script de convenções.
3. Os testes ocultos são copiados **apenas depois** que a sessão termina, para um diretório que não existe na semente, e rodam com configuração fornecida pelo runner.

**Materialização da cópia de trabalho.** O runner extrai a árvore a partir da tag congelada e inicializa um repositório git novo, com um único commit de mensagem neutra. Isso elimina por construção o vazamento por histórico, que seria fatal e é fácil de esquecer.

**Higiene do diff.** O arquivo de exclusões cobre dependências, build, banco, cobertura, temporários e variáveis de ambiente, de modo que o diff da sessão nunca carregue ruído.

## 11. Critérios de aceite

### A. Contrato funcional

- Todas as rotas da seção 4.2 existem e respondem com os códigos de status listados.
- O envelope de erro é idêntico em todos os caminhos de erro, inclusive nos do módulo desviante.
- As listagens dos módulos canônicos usam o auxiliar de paginação compartilhado; a do módulo desviante devolve array puro.
- `GET /health` responde 200 com corpo JSON pequeno.
- O cancelamento é idempotente.

### B. Regra do falso negativo — verificação item a item

- A tabela da seção 5.1 é verificada caso a caso, com um teste por linha.
- Nenhum dos defeitos da seção 5.2 foi corrigido por engano.
- **Verificação de fecho:** não existe na semente nenhum caminho que recuse um pedido que o contrato de T1 aceitaria. Este item é revisado por uma pessoa, lendo o contrato de T1 contra o código, e não apenas por teste.

### C. Estrutura e convenções

- Três módulos canônicos com quatro arquivos cada; um módulo desviante com dois.
- O módulo desviante é o único usuário de `http-reply.ts`.
- O serviço de usuários carrega exatamente as duas imperfeições nomeadas, e nenhuma outra.
- Nenhum comentário, nome de arquivo ou marcação declara qual padrão é o vigente.
- A camada de plugins existe e a regra de negócio nunca está nas rotas dos módulos canônicos.

### D. Ausência de vazamento

- Não existe `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `CONTRIBUTING.md`, `.claude/` nem qualquer arquivo dirigido a agente ou a contribuidor.
- O README contém uma linha de descrição e os comandos. Sem arquitetura, sem convenções, sem explicação de camadas.
- Nenhuma ocorrência dos termos do estudo, do TCC ou da instituição em toda a árvore, lastro e changelog incluídos. Verificado por busca.
- Nenhum teste oculto, lista de pontos de decisão, enunciado ou implementação de referência em qualquer lugar da árvore ou do histórico.
- O histórico da cópia materializada é um único commit de mensagem neutra.

### E. Testes da semente

- A cobertura da seção 8 está presente.
- Nenhuma data absoluta. A suíte passa igual em qualquer dia.
- Nenhuma das afirmações proibidas da seção 8 aparece. Verificado por revisão humana, item a item, contra a lista.
- A suíte passa de forma determinística em execuções repetidas e em qualquer ordem.

### F. Inércia do lastro

- Apagar todo o lastro deixa a verificação passando e com resultado idêntico.
- Nenhum alvo do Makefile e nenhuma etapa do Dockerfile dependem do lastro.

### G. Reprodutibilidade e operação

- De um clone limpo, um único comando leva a uma verificação passando.
- Versões exatas fixadas e lockfile versionado.
- A imagem constrói do zero e a verificação passa dentro dela.
- O tempo de verificação é **medido e registrado no piloto**. Não há alvo fixado, mas se ele dominar o tempo de sessão, a suíte é reduzida antes do congelamento. O motivo é que a verificação roda várias vezes dentro de cada sessão e compete com o limite de turnos.

### H. Revisão humana

- Um integrante da equipe revisou a árvore inteira. Isto é obrigatório porque a semente será escrita por um agente, e a autoria por agente é declarada nas ameaças à validade.

## 12. O que a semente explicitamente não contém

Autenticação, autorização, multi-tenancy, cache, filas, envio de e-mail, frontend, biblioteca de data, especificação OpenAPI, layout de monorepo, e qualquer arquivo de orientação a agente.

## 13. Ameaças à validade introduzidas por este componente

| Ameaça | Tratamento |
|---|---|
| Semente escrita por agente da mesma família de modelos sob teste | Revisão humana da árvore inteira; declarada no artigo; aplica-se igualmente a todas as condições |
| Domínio de reservas é abundante em material público | Já declarada como contaminação de treino no protocolo; afeta o nível absoluto, não a comparação |
| Repositório pequeno atenua o canal de mapa do fator contexto | Módulo desviante, camada de plugins e auxiliar substituído compram ambiguidade estruturada em vez de ruído aleatório; comparação de violações entre a sessão de fumaça em P0 e as sessões em P2 no piloto detecta atenuação a tempo |
| Com internet liberada, o agente pode encontrar os artefatos do estudo | Repositório de artefatos privado até o encerramento da coleta em M6; nenhum termo do estudo dentro da semente |
| Dois formatos de convenção interna podem tornar o script de convenções injusto | Padrão canônico mantido claramente dominante; orçamento de desvio fechado na seção 6.3 |

## 14. O que este componente destrava

O congelamento em `seed-v1` é pré-requisito de quatro artefatos, e por isso a semente é o primeiro a ser construído.

- **Testes ocultos de T1**, que exercitam o contrato por HTTP contra o servidor da semente e precisam da suíte de referência humana para provar que cem por cento é alcançável.
- **Runner**, que consome o contrato congelado da seção 10.
- **Script de convenções**, cujas nove regras se referem à estrutura definida na seção 6.
- **Configuração P1 e P2**, cujo conteúdo é a declaração em texto das convenções que a seção 6.2 estabelece pelo exemplo.
