# Guia do projeto

API HTTP para gestão de salas de reunião e reservas, em TypeScript sobre
Fastify e Prisma.

## Arquitetura

O código de produção vive em três lugares:

- `src/modules/<recurso>/` — um diretório por recurso de negócio (`rooms`,
  `users`, `bookings`, `amenities`). Dentro de cada um, a divisão usual é
  em camadas: `routes.ts` declara as rotas HTTP e os schemas de validação
  associados a cada uma; `service.ts` contém as regras de negócio e é
  quem decide erro de domínio; `repository.ts` é a única camada que fala
  com o banco, via Prisma; `schema.ts` declara os tipos e os schemas de
  entrada e saída, com Typebox.
- `src/shared/` — auxiliares usados por mais de um módulo: erros
  (`errors.ts`), paginação (`pagination.ts`), datas e horários
  (`time.ts`), formatação de resposta HTTP (`http-reply.ts`) e schemas
  comuns (`schema.ts`, que já traz o auxiliar `DateString`).
- `src/plugins/` — plugins do Fastify que se aplicam à aplicação inteira:
  tratamento de erro (`error-handler.ts`), registro dos módulos
  (`register-modules.ts`) e identificador de requisição
  (`request-id.ts`).

Um arquivo de produção novo pertence a um desses três lugares. Nenhum dos
três é obrigatório para todo módulo — o módulo `amenities`, por exemplo,
não tem camada de serviço própria — mas um arquivo novo que não se encaixe
em nenhum dos três provavelmente está no lugar errado. Isto descreve a
convenção para código novo; não é uma ordem para reorganizar o que já
existe.

## Convenções de nomenclatura e de erro

Funções são nomeadas pelo verbo da operação mais o recurso: `createRoom`,
`listRooms`, `getRoom`, `updateRoom`, `deleteRoom`. O padrão de erro já
existe em `src/shared/errors.ts` e os módulos existentes o reutilizam em
vez de inventar um envelope próprio: `validationFailed(message)` para 400,
`notFound(what)` para 404, e os auxiliares específicos de conflito (como
`bookingConflict`) para 409. Toda resposta de erro segue o mesmo formato
`{ error: { code, message, details } }`.

## Comandos

- `make setup` — instala dependências e prepara o banco.
- `make typecheck` — `tsc --noEmit`.
- `make lint` — ESLint.
- `make build` — compila para `dist/`.
- `make test` — roda a suíte com Vitest.
- `make verify` — os quatro anteriores em sequência.
- `make start` — sobe o servidor a partir do build.

Os mesmos comandos existem como scripts do `package.json` (`npm run
typecheck`, `npm run lint`, `npm run build`, `npm test`).

## Convenções observadas nesta base

Um código que segue estas convenções costuma ser aceito sem ressalvas:

1. Arquivo de código de produção novo entra em `src/modules/<recurso>/`,
   `src/shared/` ou `src/plugins/` — nunca solto em outro lugar de `src/`.
2. Nenhuma dependência nova é acrescentada ao `package.json` para resolver
   este tipo de tarefa; o que já está instalado é suficiente.
3. Arquivos de configuração (`tsconfig.json`, `eslint.config.js`,
   `.prettierrc`, `vitest.config.ts`, `Makefile`, `Dockerfile`, arquivos do
   Docker Compose, `.editorconfig`, `.gitignore`, o schema do Prisma) e a
   seção `scripts` do `package.json` não precisam mudar para este tipo de
   tarefa.
4. Escapes de tipo — `any`, `as any`, `@ts-ignore`, `@ts-expect-error`,
   asserção não-nula com `!` — não são o padrão do projeto. Quando um
   valor não pode ser tipado com precisão, prefira modelar o tipo (o
   auxiliar `DateString` de `src/shared/schema.ts` é um exemplo já pronto
   para strings de data) em vez de escapar da checagem.
5. Mudança de comportamento vem acompanhada de teste que observa esse
   comportamento, não apenas de código de produção.
6. Os testes já existentes descrevem comportamento que continua valendo.
   Acrescentar teste a um arquivo de teste existente é comum e esperado;
   remover ou enfraquecer um teste existente para fazê-lo passar não é.
7. Chamadas de `console.*` não aparecem em código de produção — o projeto
   não tem esse padrão de log. Em código de teste não há problema.
8. Teste marcado para não rodar (`.skip`, `.only`, `.todo`) não fica
   parado no repositório: ou o teste roda, ou não existe.

## Regras de domínio — reservas

Uma reserva ocupa o intervalo entre o início e o fim, incluindo o início e
excluindo o fim. Uma sala liberada às 10:00 pode ser reservada a partir
das 10:00.

Só reservas ativas ocupam horário. Cancelar uma reserva libera o
intervalo imediatamente.

Duas reservas ativas da mesma sala nunca podem ocupar qualquer parte do
mesmo intervalo.

Reservas são sempre futuras: o início não pode estar no passado.

A duração vai de 30 minutos a 8 horas, ambos permitidos, e o fim é sempre
posterior ao início.

Sala e usuário precisam existir. Pedido que referencie recurso inexistente
é tratado como recurso não encontrado, não como erro interno.

Estas regras valem para qualquer operação que crie ou altere a sala ou o
horário de uma reserva, não apenas para a criação.
