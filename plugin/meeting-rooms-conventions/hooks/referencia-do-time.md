# Convenções do time

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

## Pedido que deixa comportamento em aberto

Toda decisão que o pedido deixou em aberto é tomada explicitamente e fica
registrada em três lugares do código — schema, constante e teste: a
`description` do campo ou parâmetro diz o comportamento, limites e padrões
viram constante nomeada, e um teste fixa o que foi decidido. A skill
`decidir-ambiguidades` detalha o procedimento.

## Verificação

Ao encerrar a tarefa, o que foi alterado na sessão passa pela checagem das
oito convenções e por `make verify` (typecheck, lint, build e testes). Se
algo falhar, o encerramento volta para você corrigir. O CI do repositório
roda o mesmo `make verify` em todo pull request.

Editar arquivo de configuração ou o `package.json`, instalar dependência e
remover linha de um teste que já existia são bloqueados na hora.

## Procedimentos

- `estender-modulo` — onde entra cada camada ao estender um módulo.
- `escrever-testes` — onde vive o teste e o que afirmar sobre a resposta.
- `decidir-ambiguidades` — quando o pedido deixa comportamento em aberto.
- `convencoes-do-projeto` — as oito convenções em forma de checklist.
