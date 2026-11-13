---
name: convencoes-do-projeto
description: Use antes de finalizar qualquer mudança neste projeto — checklist do que o código precisa respeitar, e como ler a verificação automática que roda ao encerrar.
---

# Convenções do projeto

Ao encerrar a tarefa, uma verificação automática confere as oito
convenções abaixo sobre tudo o que foi alterado desde o início da sessão.
Conferir antes poupa uma volta.

| # | Convenção | Como cumprir |
|---|---|---|
| 1 | Arquivo de produção novo só em `src/modules/<recurso>/`, `src/shared/` ou `src/plugins/` | Antes de criar arquivo em outro lugar de `src/`, veja a qual dos três ele pertence |
| 2 | Nenhuma dependência nova | Resolva com o que está instalado — aritmética de data com `Date` puro, por exemplo. A instalação é bloqueada |
| 3 | Configuração intocada: `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `Makefile`, `Dockerfile`, Compose, `.editorconfig`, `.gitignore`, schema do Prisma, `package.json` | A edição é bloqueada. Se parecer necessária, reconsidere a abordagem |
| 4 | Sem escape de tipo: `any`, `as any`, `@ts-ignore`, `@ts-expect-error`, `!` não-nulo | Modele o tipo; `DateString` já existe para datas |
| 5 | Mudança em `src/` vem com teste | Acrescente casos em `tests/` que observem o comportamento novo |
| 6 | Teste existente não é removido nem enfraquecido | Linhas originais dos arquivos de teste não podem sair; a edição que as remove é bloqueada |
| 7 | Sem `console.*` em código de produção | Remova chamadas de depuração de `src/` |
| 8 | Sem `.skip(`, `.only(` ou `.todo(` | O teste roda, ou não existe |

## Se a verificação ao encerrar apontar algo

Ela devolve a lista do que falhou, com arquivo quando há. Corrija cada item
e encerre de novo. Ela insiste no máximo duas vezes por sessão; depois
disso deixa encerrar, mas o problema continua no código.

Rode também `make verify` antes de encerrar: a verificação automática
olha convenções, não se os testes passam.
