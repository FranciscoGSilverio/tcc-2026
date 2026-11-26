---
name: estender-modulo
description: Use ao acrescentar comportamento a um módulo existente desta API — nova rota, nova regra de negócio, nova consulta ao banco.
---

# Estender um módulo existente

Procedimento para acrescentar comportamento a um módulo de
`src/modules/<recurso>/`. A arquitetura e as regras de domínio estão no
guia do projeto, já no seu contexto; aqui está a ordem de trabalho.

## Passo a passo

1. **Schema.** Campo, parâmetro ou formato de resposta novo entra em
   `schema.ts` do módulo, com Typebox. Reaproveite `src/shared/schema.ts`
   (por exemplo `DateString`) em vez de reinventar validação de data.
2. **Repositório.** Consulta nova vira função nova em `repository.ts`. O
   serviço nunca chama o Prisma diretamente.
3. **Serviço.** A decisão acontece em `service.ts`: o que é permitido, o
   que gera erro de domínio, o que é calculado. Erros pelos auxiliares de
   `src/shared/errors.ts`, nunca um formato novo. Valores fixos (durações,
   limites, janelas) viram constantes nomeadas, não literais espalhados.
4. **Rota.** `routes.ts` declara método, caminho e schemas, e só repassa
   ao serviço — nenhuma condicional de negócio na rota.
5. **Teste.** Siga a skill `escrever-testes`.

## Antes de começar

Se o pedido deixa em aberto como a funcionalidade deve se comportar, use
antes a skill `decidir-ambiguidades`.

## Ao mexer com reservas

Toda operação que cria ou altera sala ou horário de uma reserva precisa
respeitar as regras de domínio do guia. Reaproveite as verificações que o
serviço de reservas já tem em vez de reimplementá-las.
