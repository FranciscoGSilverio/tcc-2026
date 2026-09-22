# Script de convenções

Implementa a seção 2.6 do protocolo experimental: oito regras de convenção
de engenharia, sem acrescentar nem remover nenhuma. A saída alimenta a
coluna `violacoes` do dataset (seção 5.1 do protocolo) e o detalhamento
regra a regra que explica *qual* convenção foi violada.

## As oito regras

| Regra | O que mede | Onde roda |
|---|---|---|
| 1 | Arquivo de produção `.ts` criado fora de `src/modules/<recurso>/`, `src/shared/` ou `src/plugins/` | Host, sobre o diff |
| 2 | Dependência acrescentada em `dependencies` ou `devDependencies` | Host, comparando o `package.json` congelado com o da sessão |
| 3 | Arquivo de configuração alterado (`tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `Makefile`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.editorconfig`, `.gitignore`, `prisma/schema.prisma`) **ou** a seção `scripts` do `package.json` mudou | Host, diff + comparação de manifesto |
| 4 | Escape de tipo: `any`, `as any`, `@ts-ignore`, `@ts-expect-error`, asserção não-nula | **Contêiner**, ESLint com a configuração congelada |
| 5 | Nenhuma linha acrescentada em arquivo sob `tests/` | Host, sobre o diff |
| 6 | Linha removida num dos sete arquivos de teste da semente | Host, sobre o diff |
| 7 | `console.*` em código de produção | **Contêiner**, ESLint com a configuração congelada |
| 8 | Linha acrescentada com `.skip(`, `.only(` ou `.todo(` | Host, sobre o diff |

Seis regras (1, 2, 3, 5, 6, 8) são análise de texto barata sobre o diff ou
sobre os dois manifestos — nenhuma delas precisa do contêiner. As regras 4
e 7 precisam do ESLint da própria semente, e o `node_modules` que o ESLint
resolve (`@eslint/js`, `typescript-eslint`) só existe dentro da imagem, não
no host; por isso essas duas rodam dentro do contêiner, depois que a sessão
termina — não há risco de contaminar a sessão, porque o agente já não está
mais executando.

## Por que a configuração congelada, e não a do contêiner

O ESLint roda com a cópia de `seed/eslint.config.js` tirada de `git show
HEAD:seed/eslint.config.js`, escrita por cima de `/app/eslint.config.js`
dentro do contêiner — nunca com o arquivo que o agente pode ter editado.
Um flat config resolve os próprios imports (`@eslint/js`,
`typescript-eslint`) relativos à sua própria localização em disco; uma
cópia estagiada fora de `/app` não enxerga o `node_modules` de onde esses
pacotes vêm, então a sobrescrita precisa acontecer dentro da árvore de
trabalho, e só depois que o diff da sessão já foi capturado (a mesma ordem
que `runner/lib/measure.mjs` já segue para os testes congelados).

**Conferência empírica do mapeamento regra-ESLint → regra do protocolo.**
Antes de fixar as listas `RULE_4_ESLINT` e `RULE_7_ESLINT`, um arquivo de
produção descartável combinando os quatro escapes de tipo e uma chamada de
`console` foi rodado contra a configuração congelada dentro do contêiner
de sessão (`meeting-rooms-session:1.0.0`). A saída em JSON reportou
exatamente estes quatro identificadores de regra do ESLint para a regra 4
— `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-non-null-assertion`,
`@typescript-eslint/ban-ts-comment` — e um para a regra 7 —
`no-console`. `@ts-ignore` é detectado: a configuração da semente traz
`tseslint.configs.recommended`, que inclui `@typescript-eslint/ban-ts-comment`
e por padrão marca tanto `@ts-ignore` quanto `@ts-expect-error`.

O reúso do auxiliar `DateString` de `src/shared/schema.ts` não conta como
violação da regra 4: ele usa `Type.Unsafe` dentro da própria semente, que
não é código do agente e não aparece no diff da sessão.

A configuração desliga `no-console` para `tests/**`, o que é o
comportamento correto: a regra 7 fala de código de produção, não de teste.

## Uso

Como função pura, sem I/O — usada pelos testes e por
`runner/lib/measure.mjs`:

```js
import { checkConventions } from './check.mjs';

const result = checkConventions({ diffText, frozenManifest, sessionManifest, eslint });
// { violacoes: <inteiro 0-8>, rules: { 1: {violated, detail}, ..., 8: {...} } }
```

`eslint` é `{ 4: boolean, 7: boolean }`, já apurado por quem chamou (por
exemplo `runEslintInContainer`), ou `null` quando o ESLint não pôde rodar
— nesse caso as regras 4 e 7 aparecem como `violated: false` com
`detail: 'eslint unavailable'`, nunca como conformidade silenciosa.

Como CLI, contra uma sessão arquivada e um contêiner ainda em pé com a
cópia de trabalho daquela sessão:

```bash
node tools/convention-check/check.mjs --session sessions/T1-P0-O1-xxxx --container <nome-do-conteiner>
```

Imprime o JSON de `checkConventions` em stdout: extrai `/app/package.json`
de dentro do contêiner com `docker cp`, lê o manifesto congelado com
`git show HEAD:seed/package.json`, roda o ESLint congelado sobre os
arquivos `.ts` que aparecem do lado `+++` do diff, e combina tudo.
