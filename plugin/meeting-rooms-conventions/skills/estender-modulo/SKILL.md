---
name: estender-modulo
description: Use ao acrescentar comportamento a um módulo existente desta API — nova rota, nova regra de negócio, nova consulta ao banco.
---

# Estender um módulo existente

Procedimento para acrescentar comportamento a um módulo que já existe em
`src/modules/<recurso>/` (por exemplo `rooms`, `bookings`, `users`,
`amenities`).

## Onde cada coisa entra

1. **Schema primeiro.** Se a mudança introduz um campo, um parâmetro ou
   um formato de resposta novo, declare-o em `schema.ts` do módulo, com
   Typebox. Reaproveite os auxiliares de `src/shared/schema.ts` (por
   exemplo `DateString`) em vez de reinventar validação de data.
2. **Rota depois do schema.** `routes.ts` declara o método HTTP, o
   caminho, e associa o schema recém-criado à validação de entrada e
   saída da rota. A rota não decide nada por conta própria — ela recebe
   a requisição já validada e repassa para o serviço.
3. **Regra de negócio no serviço.** `service.ts` é onde a decisão
   acontece: o que é permitido, o que gera erro de domínio, o que
   precisa ser calculado. Nomeie a função pelo verbo da operação mais o
   recurso (`createRoom`, `listRooms`, `updateBooking`), no mesmo padrão
   das funções que já existem no módulo.
4. **Banco só no repositório.** `repository.ts` é a única camada que
   importa o cliente do Prisma. Se o serviço precisar de uma consulta
   nova, ela entra como função nova no repositório — nunca como chamada
   direta ao Prisma de dentro do serviço.
5. **Erros pelos auxiliares existentes.** Um erro de domínio sai de
   `src/shared/errors.ts`: `validationFailed(message)` para entrada
   inválida, `notFound(what)` para recurso inexistente, e o auxiliar de
   conflito apropriado (como `bookingConflict`) para violação de regra
   de negócio. Não crie um formato de erro novo — toda resposta segue
   `{ error: { code, message, details } }`.

## Ordem recomendada de trabalho

Schema → repositório → serviço → rota → teste. Seguir essa ordem evita
descobrir, já na rota, que falta um método no repositório ou um tipo no
schema.

## Ao mexer com reservas

O módulo `bookings` tem regras de domínio próprias: o intervalo de uma
reserva inclui o início e exclui o fim; só reserva ativa ocupa horário;
duas reservas ativas da mesma sala nunca podem se sobrepor; o início não
pode estar no passado; a duração vai de 30 minutos a 8 horas. Essas
regras valem para qualquer operação que crie ou altere sala ou horário
de uma reserva, não só para a criação — ao estender esse módulo, verifique
se a mudança as respeita em vez de reimplementá-las.
