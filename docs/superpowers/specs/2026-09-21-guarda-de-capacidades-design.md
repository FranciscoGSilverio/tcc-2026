# Guarda de capacidades do runner — design

**Data:** 2026-09-21
**Escopo:** mudança limitada em `runner/`, sem tocar em semente, testes ocultos, referência ou enunciados.
**Protocolo afetado:** `docs/02-protocolo-experimental.md`, seção 6.

---

## 1. O problema

O runner recebe `--task`, `--p` e `--o`. Cada opção é usada para duas coisas: **rotular** a sessão, indo para o nome do diretório e para colunas do dataset, e **mudar o comportamento** dentro do contêiner. Nos três casos o rótulo funcionava e o comportamento não.

| Opção | O que grava | O que faz hoje |
|---|---|---|
| `--task T2` | `task: T2`, diretório `T2-...` | entrega o enunciado de **T1**, porque o caminho está fixo em `run-session.mjs:85` |
| `--o O2` | `o_level: O2` | executa **uma** chamada; a sequência de quatro não existe |
| `--p P1` | `p_level: P1` | corrigido em 17/09; antes rodava sem contexto |

A causa é comum: a opção era lida para uma variável que ia para a planilha, enquanto o comportamento vinha de outra fonte — um valor padrão, um caminho fixo, ou nada. **Rótulo e comportamento tinham fontes separadas, então podiam divergir sem que nada percebesse.**

O perigo está no formato da falha. Nada quebra: a sessão roda, o agente produz código, os instrumentos medem, a linha entra completa no dataset. O sintoma apareceria só na análise, como "a ordem de execução não teve efeito" — que se lê como resultado, não como defeito. Um número errado que se anuncia como errado custa uma hora; um que se disfarça de descoberta custa o trabalho.

## 2. O princípio

**Um instrumento nunca substitui em silêncio: ou faz o que foi pedido, ou recusa.** Operacionalmente, isto vira duas exigências. Rótulo e comportamento saem da **mesma fonte**, de modo que não exista um segundo lugar de onde o comportamento possa vir. E combinação não implementada **aborta antes de gastar**, nomeando o que falta.

## 3. As mudanças

### 3.1 Nova fonte única: `runner/lib/capabilities.mjs`

```js
export class UnsupportedSessionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedSessionError';
  }
}

// The single source for what a session's labels mean. Every label the
// dataset records comes from here, and so does the behaviour it stands
// for. When the two had separate sources they diverged in silence:
// `--task T2` recorded T2 and delivered T1's statement, `--o O2`
// recorded O2 and ran a single call, `--p P1` recorded P1 and ran bare.
// A session that cannot be run exactly as it is labelled must not run.
export const TASKS = {
  T1: { statement: 'tasks/T1-validacao-de-reservas.md', hiddenSuite: true },
  T2: { statement: 'tasks/T2-res-142.md', hiddenSuite: false },
};

// P2 is the plugin, which does not exist yet: it is absent here on
// purpose, so asking for it fails instead of quietly running P0.
export const CONTEXTS = {
  P0: null,
  P1: 'contexts/P1/CLAUDE.md',
};

// O2 chains four calls and is not built: same reasoning as P2.
export const ORDERS = {
  O1: { calls: 1 },
};

export function resolveSession({ task, pLevel, oLevel }) {
  const missing = [];
  if (!(task in TASKS)) missing.push(`task ${task} (available: ${Object.keys(TASKS).join(', ')})`);
  if (!(pLevel in CONTEXTS)) missing.push(`context level ${pLevel} (available: ${Object.keys(CONTEXTS).join(', ')})`);
  if (!(oLevel in ORDERS)) missing.push(`order level ${oLevel} (available: ${Object.keys(ORDERS).join(', ')})`);
  if (missing.length > 0) {
    throw new UnsupportedSessionError(
      `this session cannot be run as labelled, so it will not run at all: ${missing.join('; ')}`,
    );
  }
  return {
    statement: TASKS[task].statement,
    hiddenSuite: TASKS[task].hiddenSuite,
    contextFile: CONTEXTS[pLevel],
    calls: ORDERS[oLevel].calls,
  };
}
```

### 3.2 `runner/lib/prepare.mjs` — deixa de ter a sua própria tabela

A tabela `CONTEXT_FILES` local é removida e o módulo passa a importar `CONTEXTS`. Manter duas listas de níveis recriaria, num lugar novo, exatamente a divergência que esta mudança existe para fechar.

```diff
-const CONTEXT_FILES = {
-  P0: null,
-  P1: 'contexts/P1/CLAUDE.md',
-};
+import { CONTEXTS } from './capabilities.mjs';
```

`applyContext` passa a consultar `CONTEXTS`. O resto da função, inclusive a recusa de nível desconhecido e a ordem de chamada dentro de `prepare`, fica como está.

### 3.3 `runner/run-session.mjs` — a guarda e a origem do enunciado

A guarda roda como **primeira coisa** de `main()`, antes de criar o diretório da sessão, antes de construir a imagem e antes de qualquer chamada paga.

```diff
   const datasetPath = resolve(
     argument('--dataset', process.env.RUNNER_DATASET_PATH ?? join(REPO, 'resultados.csv')),
   );
 
+  // Before anything is created or spent: refuse a session that cannot be
+  // run exactly as it will be labelled.
+  const plan = resolveSession({ task, pLevel, oLevel });
+
   const sessionId = `${task}-${pLevel}-${oLevel}-${Date.now().toString(36)}`;
   const outDir = join(REPO, 'sessions', sessionId);
   mkdirSync(outDir, { recursive: true });
```

A recusa é esperada, não é acidente, e por isso não deve sair como stack trace. `await main()` no fim do arquivo ganha tratamento próprio, com código de saída distinto dos que já existem — 3 é o estouro de relógio de parede:

```diff
-await main();
+try {
+  await main();
+} catch (error) {
+  if (error instanceof UnsupportedSessionError) {
+    process.stderr.write(`${error.message}\n`);
+    process.exit(2);
+  }
+  throw error;
+}
```

O caminho do enunciado passa a vir do plano, e o arquivo fixo some:

```diff
-    const statement = resolve(REPO, 'tasks', 'T1-validacao-de-reservas.md');
-    deliverStatement(name, statement);
+    deliverStatement(name, resolve(REPO, plan.statement));
```

A medição recebe se a tarefa tem suíte oculta:

```diff
-    const measured = await measure({ name, outDir, hostPort, repoRoot: REPO });
+    const measured = await measure({
+      name, outDir, hostPort, repoRoot: REPO, hiddenSuite: plan.hiddenSuite,
+    });
```

E a coluna deixa de fabricar um zero para tarefa que não tem suíte oculta:

```diff
-    row.taxa_aceitacao = measured.hidden ? measured.hidden.rate : 0;
+    // Empty, not zero: section 5.1 declares taxa_aceitacao as T1-only, and
+    // a zero here would read as "the agent got nothing right" instead of
+    // "this task is not measured this way". For T1 the zero stays, and is
+    // deliberate -- a session whose application does not serve is scored
+    // zero rather than discarded.
+    row.taxa_aceitacao = plan.hiddenSuite ? (measured.hidden ? measured.hidden.rate : 0) : '';
```

Se a guarda disparar, `UnsupportedSessionError` escapa antes do `try`, o processo termina com código diferente de zero e **nenhuma linha é acrescentada ao dataset** — sessão recusada não é sessão inválida, ela não aconteceu.

### 3.4 `runner/lib/measure.mjs` — a suíte oculta vira condicional

Só a chamada à suíte oculta é condicional. O servidor continua subindo nas duas tarefas: é uma verificação genuína de que a aplicação responde, ela alimenta `travou_build`, e mantê-la preserva a semântica de `travou` idêntica entre T1 e T2. Pular o servidor marcaria toda sessão de T2 como travada, porque `row.travou` inclui `!measured.serverUp`.

```diff
-export async function measure({ name, outDir, hostPort, repoRoot }) {
+export async function measure({ name, outDir, hostPort, repoRoot, hiddenSuite = true }) {
...
-  const hidden = serverUp ? runHiddenSuite(repoRoot, hostPort) : null;
+  const hidden = hiddenSuite && serverUp ? runHiddenSuite(repoRoot, hostPort) : null;
```

### 3.5 `runner/run-session.mjs` — conferir que o modelo que rodou é o pedido

Esta é a quarta ocorrência da mesma classe e a única ainda aberta. O fator M entra por `--model`, e até 16/09 a coluna registrava o modelo errado. Agora que `readTranscript` lê o modelo que **de fato** executou, dá para fechar o laço: comparar o que foi pedido com o que rodou.

```js
// The fourth face of the same defect: --model states the M factor, and
// nothing checked that the session actually ran on it. The CLI reports
// either the exact id or an alias, so a requested name matches when it
// equals the reported key, equals its canonicalModel, or prefixes either.
function assertModelMatches(requested, parsed) {
  const reported = parsed.model;
  const canonical = parsed.modelUsage?.[reported]?.canonicalModel ?? reported;
  const matches = [reported, canonical].some(
    (name) => name === requested || name.startsWith(requested),
  );
  if (!matches) {
    throw new InfrastructureError(
      `the session was asked for ${requested} but ran on ${reported}`,
    );
  }
}
```

Chamada logo depois de `readTranscript`, junto da verificação de limite de taxa que já existe.

**Desvio encontrado na implementação.** Os agentes falsos de `runner/lib/fakes.mjs` reportam `fake-model` de propósito, então a conferência precisa isentá-los — sem isso, toda a suíte de testes do runner quebraria contra um defeito que não existe. A chamada é `if (!fake) assertModelMatches(model, parsed);`. Exige que `readTranscript` passe a devolver `modelUsage` no objeto, o que é um campo a mais no retorno.

**Esta subseção é separável.** Se você achar que ela extrapola o pedido, corte-a: as seções 3.1 a 3.4 fecham a classe nos três fatores que hoje têm defeito comprovado, e esta fecha o quarto, que é uma precaução e não uma correção.

## 4. O que passa a ser recusado

`--p P2` e `--o O2` param de funcionar. **Isso é o objetivo, não um efeito colateral:** os dois já não funcionam, apenas em silêncio. Quando o plugin e a sequência de quatro chamadas existirem, entram nas tabelas e voltam a ser aceitos, no mesmo commit que os implementa.

`--task T2` passa a funcionar de verdade pela primeira vez.

## 5. A lacuna que fica declarada em vez de escondida

Uma sessão de T2 roda e grava tudo que é mensurável hoje — diff, transcript, regressões, violações, custo, turnos — mas `decisoes` e `qualidade` continuam vazias, porque o avaliador cego não existe. Isso é aceitável e diferente do defeito que esta spec conserta: a sessão de T2 **é** uma sessão de T2, entrega o enunciado de T2, e as colunas que não podem ser preenchidas ficam vazias em vez de receberem um número inventado. A classificação dos dez pontos de decisão é feita depois, sobre o diff arquivado, que é exatamente para isso que o protocolo arquiva diffs e transcripts.

Recomendação de uso, não regra de código: não colete T2 para valer antes do avaliador cego existir, porque o custo de uma sessão é o mesmo e a ordem natural é medir depois de saber medir.

## 6. Testes

`runner/test/capabilities.test.mjs`, sem Docker, cobrindo: que cada tarefa declarada devolve o caminho do seu próprio enunciado e que os dois caminhos são diferentes entre si, que é a regressão exata do defeito do `--task`; que `P2` e `O2` são recusados hoje e que a mensagem nomeia o que falta; que os arquivos apontados por `TASKS` e `CONTEXTS` existem no disco, o que impede a tabela de apodrecer se um arquivo for renomeado; e que um plano válido devolve `hiddenSuite` verdadeiro para T1 e falso para T2.

Em `runner/test/measure.test.mjs`, um caso confirmando que `hiddenSuite: false` não chama a suíte e devolve `hidden` nulo, sem alterar `serverUp`.

## 7. Fora de escopo

Não se constrói aqui o plugin de P2, a sequência O2, nem o avaliador cego. Esta mudança apenas impede que os três sejam simulados por engano. A semente, os testes ocultos, a referência e os enunciados não são tocados.

## 8. Emenda ao protocolo

A seção 6 ganha o princípio da seção 2 deste documento, junto das três garantias de isolamento que ela já declara: o runner recusa executar combinação de tarefa, contexto e ordem que não implemente, e nunca registra um rótulo que não corresponda ao que executou.

## 9. Critérios de aceite

- `node runner/run-session.mjs --task T1 --p P0 --o O2 --run 1` sai com código 2 e uma mensagem de uma linha, sem stack trace, sem criar diretório de sessão e sem acrescentar linha ao dataset.
- O mesmo para `--p P2`.
- Um teste falha se `TASKS.T1.statement` e `TASKS.T2.statement` apontarem para o mesmo arquivo.
- Um teste falha se qualquer caminho declarado em `TASKS` ou `CONTEXTS` não existir no disco.
- `grep -n "T1-validacao-de-reservas" runner/run-session.mjs` não retorna nada: não sobrou caminho de enunciado fixo no runner.
- `runner/lib/prepare.mjs` não declara lista própria de níveis de contexto.
- A suíte completa do runner continua verde, incluindo o caso que afirma a linha de base de 13/26.
