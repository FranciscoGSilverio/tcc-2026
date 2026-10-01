---
name: convencoes-do-projeto
description: Use antes de finalizar qualquer mudança neste projeto — checklist procedimental do que o código precisa respeitar para se encaixar no padrão já estabelecido.
---

# Convenções do projeto

Um código que segue este roteiro costuma se encaixar sem ressalvas no
que já existe na base. Use-o como checklist antes de considerar uma
mudança pronta.

## 1. Local do arquivo novo

Um arquivo de código de produção novo entra em `src/modules/<recurso>/`,
`src/shared/` ou `src/plugins/`. Antes de criar um arquivo em qualquer
outro lugar de `src/`, pare e confira se ele não pertence a um desses
três — quase sempre pertence.

## 2. Nenhuma dependência nova

O que já está instalado é suficiente para estender rota, regra de
negócio, acesso a dado ou teste. Se a tarefa parecer pedir uma
biblioteca nova, prefira resolver com o que o projeto já tem — por
exemplo, aritmética de data com `Date` puro — antes de acrescentar
entrada ao `package.json`.

## 3. Arquivos de configuração ficam como estão

`tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`,
`Makefile`, `Dockerfile`, os arquivos do Docker Compose,
`.editorconfig`, `.gitignore`, o schema do Prisma e a seção `scripts` do
`package.json` não precisam de alteração para acrescentar ou ajustar
comportamento de um módulo. Se uma mudança parecer exigir mexer em um
desses, é sinal para reconsiderar a abordagem antes de editá-lo.

## 4. Sem escape de tipo

`any`, `as any`, `@ts-ignore`, `@ts-expect-error` e asserção não-nula
com `!` não são o padrão daqui. Quando um valor não tem um tipo óbvio,
modele o tipo em vez de escapar da checagem — `DateString`, em
`src/shared/schema.ts`, é um exemplo já pronto para strings de data, e
reusá-lo não é escapar, é aproveitar o que já existe.

## 5. Mudança de comportamento vem com teste

Código de produção que muda comportamento observável é acompanhado de
teste que observa esse comportamento — não é o código sozinho.

## 6. Teste existente descreve comportamento que continua valendo

Acrescentar caso a um arquivo de teste existente é o padrão esperado.
Remover ou enfraquecer um teste existente para fazer algo passar não é
o caminho — se um teste existente parece incompatível com a mudança, o
teste provavelmente está certo e vale a pena entender por quê antes de
tocar nele.

## 7. Sem `console.*` em código de produção

O projeto não tem esse padrão de log. Uma chamada de depuração esquecida
em `src/` não deveria sobreviver até o fim da tarefa — em código de
teste não há esse problema.

## 8. Teste ativo, não parado

Um teste marcado com `.skip`, `.only` ou `.todo` não fica parado no
repositório ao final da tarefa: ou ele roda de verdade, ou não existe.
Antes de finalizar, procure por esses marcadores no que foi alterado.
