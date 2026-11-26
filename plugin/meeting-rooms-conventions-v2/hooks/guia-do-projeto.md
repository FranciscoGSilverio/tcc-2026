# Guia do projeto

API HTTP para gestão de salas de reunião e reservas, em TypeScript sobre
Fastify e Prisma.

## Arquitetura

- `src/modules/<recurso>/` — um diretório por recurso (`rooms`, `users`,
  `bookings`, `amenities`), em camadas: `routes.ts` (rotas e schemas de
  validação), `service.ts` (regra de negócio e erros de domínio),
  `repository.ts` (única camada que fala com o banco, via Prisma),
  `schema.ts` (tipos e schemas Typebox).
- `src/shared/` — auxiliares comuns: `errors.ts`, `pagination.ts`,
  `time.ts`, `http-reply.ts`, `schema.ts` (com `DateString`).
- `src/plugins/` — plugins do Fastify da aplicação inteira.

Funções são nomeadas por verbo mais recurso (`createRoom`, `listRooms`).
Erros saem de `src/shared/errors.ts` (`validationFailed` → 400,
`notFound` → 404, `bookingConflict` e afins → 409), sempre no envelope
`{ error: { code, message, details } }`.

## Comandos

`make setup` · `make typecheck` · `make lint` · `make build` · `make test`
· `make verify` (os quatro em sequência). Os mesmos existem como scripts
do `package.json`.

## Regras de domínio — reservas

- O intervalo inclui o início e exclui o fim: sala liberada às 10:00 pode
  ser reservada a partir das 10:00.
- Só reserva ativa ocupa horário; cancelar libera o intervalo na hora.
- Duas reservas ativas da mesma sala nunca se sobrepõem.
- O início nunca está no passado.
- A duração vai de 30 minutos a 8 horas, ambos permitidos; o fim é sempre
  posterior ao início.
- Sala e usuário precisam existir; recurso inexistente é 404, não erro
  interno.
- As regras valem para toda operação que crie ou altere sala ou horário
  de uma reserva, não só para a criação.

## Como este projeto apoia o trabalho

- Procedimentos sob demanda, nas skills: `estender-modulo` (onde entra
  cada camada), `escrever-testes` (padrão de teste),
  `decidir-ambiguidades` (quando o pedido deixa comportamento em aberto) e
  `convencoes-do-projeto` (checklist antes de encerrar).
- As convenções são **verificadas automaticamente**: arquivos de
  configuração e o `package.json` não podem ser editados, dependência nova
  não pode ser instalada, e ao encerrar a tarefa o que foi alterado passa
  por uma checagem das oito convenções. Se a checagem apontar algo,
  corrija antes de encerrar.
