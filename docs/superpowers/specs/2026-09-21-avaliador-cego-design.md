# Avaliador cego — design

**Data:** 2026-09-21
**Protocolo afetado:** `docs/02-protocolo-experimental.md`, seções 2.7 e 6.4; `docs/03-plano-de-execucao.md`, verificação 10 do portão de M3.

---

## 1. O que é, e o que não é

O terceiro instrumento de medida do experimento. As seções 2.4 e 2.7 do protocolo já congelaram **o que ele pergunta**: o checklist de qualidade e os dez pontos de decisão de T2 com suas categorias fechadas. Esta spec define **como se pergunta**, e revisita uma pergunta do checklist que se mostrou impossível de responder sob a restrição original — seção 2 abaixo, D8.

Ele **não dá nota em escala**. Responde perguntas fechadas sobre o que o diff contém. A distinção é o que torna o instrumento defensável: "nota de 1 a 5 para extensibilidade" produz número sem âncora; "a lógica nova está na camada de serviço, sim ou não" produz resposta estável.

**"Cego" tem dois sentidos possíveis, e só um deles é requisito de validade.** Cego à **condição** — nunca saber P, O, modelo ou identificação da célula — protege o experimento contra viés de expectativa, é o que a seção 6.4 do protocolo lista como mitigação, e é inegociável: é o próprio efeito que o trabalho mede. Cego ao **resto do código**, isto é, receber só o diff e nada do que não mudou, nunca foi requisito de validade — era um jeito simples de escrever o prompt que ninguém tinha testado contra as perguntas que precisava responder. A seção 3 revisita essa segunda parte.

Duas funções, e elas alimentam colunas diferentes:

| Função | Perguntas | Coluna | Aplicável |
|---|---|---|---|
| Checklist de qualidade | 6 binárias (protocolo 2.7, após D8) | `qualidade`, 0 a 6 | T1 e T2 |
| Pontos de decisão | 10 de categoria fechada (protocolo 2.4) | `decisao_1` a `decisao_10` | só T2 |

## 2. Decisões de desenho

**D1. Uma passagem por instrumento, não três com voto majoritário.** Isto **revoga** a regra de votação por maioria da seção 2.7. Três motivos. O instrumento não é objeto de estudo do trabalho, e máquina de votação é complexidade num lugar que não paga por ela. A regra atual tem um caso não especificado: três respostas distribuídas entre quatro categorias dão empate triplo sem maioria, e o protocolo não diz o que fazer. E, mesmo que o modelo variasse entre chamadas — o que a plataforma não deixa nem controlar por temperatura, D2 abaixo —, o que sempre importou nunca foi se o avaliador concorda consigo mesmo, e sim se concorda com um humano: rodar três vezes e votar reduziria variância em torno de uma resposta que pode estar sistematicamente enviesada, sem corrigir o viés. É D3 que mede a coisa certa.

**D2. Sem parâmetro de amostragem — restrição da plataforma, não escolha de design.** Verificado empiricamente em 21/09/2026: a API rejeita `temperature` para Sonnet 5 com erro 400 (`'temperature' is deprecated for this model`), e o mesmo vale para `top_p`/`top_k`. Não existe hoje alavanca de determinismo disponível via API para este modelo — a chamada usa os parâmetros de amostragem padrão, sem tentar forçá-los. Uma versão anterior desta decisão previa `temperature: 0` como a peça que tornaria a reexecução estável; isso está descartado, e a justificativa de D1 foi ajustada para não depender disso — o argumento contra votação nunca precisou de determinismo, precisa só de D3.

**D3. A confiabilidade passa a ser medida contra classificação humana, não contra si mesmo.** A pergunta que interessa nunca foi "o modelo repete a si mesmo", e sim "o modelo classifica como um humano classificaria". Concordância com humano é validade de classificador; concordância consigo mesmo é só estabilidade de amostragem. Um conjunto rotulado à mão sobre uma amostra de diffs reais dá esse número.

**Isto fica adiado por necessidade, não por conveniência:** rotular exige diffs reais de T2, e não existe nenhum. É a única ordem possível. O trabalho entra no portão de M3, cuja verificação 8 já exige conferir que os dez pontos são classificáveis nas saídas produzidas — a conferência humana não é trabalho novo, é o trabalho que já estava marcado, com um número saindo dele.

**D4. Roda sobre diffs arquivados, fora da sessão.** Não é etapa do `run-session.mjs`. Consequências, todas favoráveis: pode ser reexecutado quando um prompt mudar, sem recoletar sessão; pode avaliar retroativamente as sessões já coletadas; e não acrescenta modo de falha a uma sessão que custou dinheiro para produzir. A seção 6 do protocolo lista o avaliador como passo 7 do runner, e essa redação é corrigida.

**D5. Duas chamadas por sessão de T2, uma por sessão de T1.** Checklist e pontos de decisão são instrumentos separados, com prompts congelados separadamente e corrigíveis separadamente. Juntá-los numa chamada faria o raciocínio de um contaminar o outro, e amarraria duas listas que o protocolo trata como independentes.

**D6. Chamada direta à API, não pelo CLI.** O CLI é um harness de codificação interativo, feito para decidir sozinho quantas ferramentas usar e quantos turnos gastar — instrumento errado para uma classificação de resposta única, mesmo sem a questão de temperatura que motivou esta decisão originalmente (D2 explica por que essa alavanca não existe de qualquer forma). A chamada usa `fetch`, sem dependência nova, com a chave que já está em `.env`.

**D7. Categoria fora da lista é erro, nunca aproximação.** Se o modelo devolver algo que não está nas categorias fechadas daquele ponto, a avaliação daquela sessão falha e não grava nada. Mesmo princípio da guarda de capacidades: um instrumento não substitui em silêncio. `ausente` é categoria legítima e declarada, e é diferente de resposta inválida.

**D8. A pergunta 7 do checklist ("contratos HTTP pré-existentes seguem compatíveis, sem quebra não solicitada") é retirada.** Decisão do orientando em 21/09/2026, sobre conteúdo que a seção 2.7 já tinha congelado. O motivo: essa propriedade já é medida, de forma estritamente melhor, por `regressoes` — que **executa** a suíte pré-existente e vê se algo quebrou, contra um avaliador que só tem o diff e não tem como saber o que não mudou nem rodar nada. Manter a pergunta 7 pedia a um instrumento pior para redizer o que um instrumento melhor já mede, mesmo defeito de duplicação que motivou cortar, na direção oposta, a antiga regra determinística de "rota sem schema" do script de convenções — lá o julgamento frágil foi trocado por pergunta estável; aqui a própria pergunta é a parte frágil, e o determinístico já existe. O checklist passa a ter seis perguntas (seção 4.1), e `qualidade` passa a variar de zero a seis. O texto retirado fica registrado abaixo, no lugar de onde saiu, pelo mesmo motivo que a remoção da regra de rota sem schema ficou documentada em vez de simplesmente desaparecer: para que ninguém a restaure por parecer lacuna.

**D9. A pergunta 6 do checklist ("utilitários já existentes foram reusados") ganha material de referência fixo: o conteúdo congelado de `src/shared/` e `src/plugins/`.** Reúso deixa rastro no diff quando exige import novo — o patch de referência mostra isso literalmente, `bookingConflict, notFound` virando `bookingConflict, notFound, validationFailed` na linha de import. Mas quando o utilitário já estava importado por outro motivo, o novo uso não deixa marca alguma, e o avaliador não tem como distinguir reúso genuíno de nome inventado sem ter visto `src/shared/errors.ts`. A correção não fere a cegueira de condição: o conteúdo de `src/shared/` e `src/plugins/` é **idêntico em toda sessão**, de todo P, todo O, todo modelo, porque vem do commit congelado da semente — entregá-lo não informa nada sobre a condição, só dá ao avaliador o mesmo inventário de ferramentas que toda sessão teve disponível. É o equivalente a dar a um revisor humano a documentação das bibliotecas internas antes de perguntar se o PR as usou.

## 3. A cegueira, e como ela é garantida

A seção 2.7 exige que o avaliador nunca receba o nível de P, o nível de O, o modelo usado, ou qualquer identificação da célula — cegueira **à condição**, na distinção da seção 1. O conteúdo que ele recebe é `diff` e `statement` sempre, mais `referenceMaterial` só na chamada do checklist (D9); nenhum dos três varia com a condição, então nenhum deles pode vazá-la.

Isso é garantido por construção e verificado por teste. As funções que montam as chamadas recebem só esses campos de conteúdo e não têm acesso à linha do dataset. Um teste monta o corpo das duas requisições a partir de uma sessão cujo identificador é `T2-P2-O2-abc123` e afirma que o texto enviado — diff, enunciado e, no checklist, material de referência — não contém `P2`, `O2`, o nome do modelo, nem o identificador da sessão.

**Nenhum tratamento especial é dado ao `CLAUDE.md` aparecer num diff, e o motivo precisa ficar registrado para que ninguém reintroduza a ideia.** Uma versão anterior desta spec previa detectar e marcar esse caso, sob o argumento de que a edição do arquivo de contexto revelaria ao avaliador que a sessão não era P0. O argumento não se sustenta, por três razões.

A primeira é que ele mira o vetor errado. O diff carrega evidência correlacionada com a condição por um canal muito mais largo e que não tem conserto: **o próprio código**. Um diff que segue as quatro camadas, reusa `validationFailed` e escreve teste no padrão é evidência de que a sessão teve contexto — e isso não é vazamento a tapar, é a variável-resposta. Marcar um vetor raro enquanto o vetor dominante fica aberto não fecha classe de risco nenhuma; só faz o documento parecer cuidadoso.

A segunda é que a correlação entre contexto e nota não é contaminação, é a medição. Contexto → o agente segue as convenções → o código é de fato melhor → a nota sobe. Cada elo está correto e o resultado é o efeito que o trabalho existe para medir. Erro de medida seria o avaliador responder contra a evidência que ele mesmo cita, e contra isso o prompt já exige que cada resposta cite o trecho do diff que a sustenta — conferível depois, no `evaluation.json`, por qualquer pessoa.

A terceira é que não há espaço de julgamento livre onde uma impressão prévia pudesse entrar: as seis perguntas **são** a rubrica. Não se pergunta "isso é bom?", pergunta-se se a lógica está na camada de serviço. É o mesmo motivo pelo qual a seção 2.7 proibiu escala numérica.

O conteúdo do `CLAUDE.md` nunca chega ao avaliador por via nenhuma: o prompt recebe enunciado, material de referência e diff, e só.

## 4. Os prompts

Congelados junto com o protocolo e publicados como artefato. Escritos em português, como os enunciados e as categorias.

### 4.1 `tools/blind-evaluator/prompts/checklist.md`

> Você recebe o enunciado de uma tarefa de programação, o conteúdo de referência de dois diretórios do projeto (`src/shared/` e `src/plugins/`, que não mudam entre sessões) e o diff unificado com as mudanças que alguém fez para atender ao enunciado, num projeto de API em TypeScript.
>
> Responda às seis perguntas abaixo **apenas sobre o que o diff contém**, usando o material de referência só para reconhecer reúso — nunca para avaliar o material de referência em si, que não faz parte do que está sendo julgado. Não avalie se a solução é boa, não sugira melhorias, não julgue estilo. Cada resposta é `sim` ou `nao`, mais uma justificativa de uma linha citando o trecho do diff que sustenta a resposta.
>
> Se o diff não contém informação suficiente para decidir uma pergunta, responda `nao` e diga na justificativa que o diff não mostra isso. Não deduza o que provavelmente existe fora do diff e do material de referência.
>
> 1. A lógica de negócio nova está na camada de serviço, e não nas rotas?
> 2. As entradas novas são validadas por schema?
> 3. Os caminhos de erro têm resposta explícita com código de status apropriado?
> 4. Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?
> 5. Há testes escritos que verificam comportamento observável, e não implementação interna?
> 6. O código novo reusa utilitários do material de referência quando um deles se aplica, em vez de reimplementar?
>
> Responda **somente** com um objeto JSON, sem texto antes ou depois, nesta forma:
>
> ```json
> {"1": {"resposta": "sim", "justificativa": "..."}, "2": {...}, ..., "6": {...}}
> ```

A instrução de responder `nao` quando o diff não mostra é deliberada e precisa ser dita no artigo: ela faz o instrumento medir **o que foi entregue**, não o que se supõe existir. Sem ela, o modelo preenche lacuna com expectativa, e a métrica passa a medir o conhecimento prévio do avaliador sobre como projetos costumam ser.

**Material de referência — o que é e como é obtido.** `readReferenceMaterial(repoRoot)` extrai, via `git show HEAD:seed/src/shared/<arquivo>` e o equivalente para `plugins/`, o conteúdo congelado desses dois diretórios, e concatena com um cabeçalho por arquivo. Não é lido do contêiner da sessão — sai do commit da semente no próprio repositório de pesquisa, o mesmo lugar de onde `runner/lib/measure.mjs` já lê a configuração congelada do ESLint. Isto é o que garante D9: o texto é **idêntico bit a bit** em toda chamada, qualquer que seja P, O ou modelo, o que um teste confirma comparando a saída da função para duas sessões diferentes.

**Pergunta 7 retirada, texto preservado aqui para que ninguém a restaure por parecer lacuna.** A versão anterior deste documento incluía: *"7. Os contratos HTTP pré-existentes seguem compatíveis, sem quebra não solicitada?"*. Cortada pela decisão D8: a propriedade já é medida, de forma estritamente melhor, por `regressoes`, que executa a suíte pré-existente em vez de pedir a um avaliador que só vê o diff para adivinhar o que não mudou.

### 4.2 `tools/blind-evaluator/prompts/pontos-de-decisao.md`

> Você recebe o enunciado de um chamado de suporte e o diff unificado com as mudanças que alguém fez para atendê-lo, num projeto de API em TypeScript.
>
> O chamado é deliberadamente ambíguo: ele descreve um sintoma e não determina a solução. Quem implementou precisou tomar uma série de decisões que o texto não decide. Sua tarefa é **identificar qual decisão foi tomada em cada ponto**, a partir do diff.
>
> Para cada ponto abaixo, escolha **exatamente uma** das categorias listadas. Se o diff não toma posição sobre aquele ponto, escolha `ausente`. Não escolha a categoria que parece melhor nem a que você escolheria: escolha a que o diff mostra.
>
> Não invente categoria. Use exatamente uma das palavras oferecidas para aquele ponto, ou `ausente`.
>
> [os dez pontos, cada um com suas categorias fechadas mais `ausente`, gerados a partir de `tools/blind-evaluator/lib/pontos.mjs` para que a lista do prompt e a lista que valida a resposta não possam divergir]
>
> Responda **somente** com um objeto JSON, sem texto antes ou depois, nesta forma:
>
> ```json
> {"1": {"categoria": "...", "justificativa": "..."}, ..., "10": {...}}
> ```

A frase "não escolha a que você escolheria" existe porque o classificador é o mesmo modelo que também resolve tarefas. Sem ela, há risco real de ele relatar a solução que considera correta em vez da que está no diff.

**Considerado e descartado: capturar o diff com mais linhas de contexto especificamente para o avaliador.** Os dez pontos são todos sobre comportamento **novo**, que por definição está inteiro no diff — não há conhecimento pré-existente para faltar, ao contrário da pergunta 6 do checklist. A hipótese de que o contexto padrão do git pudesse cortar uma mudança no meio de uma função longa era especulação, não defeito demonstrado, e a implementação exigiria capturar um segundo diff **durante** `measure()`, antes de o contêiner ser parado — o avaliador roda depois, sobre sessão já arquivada, sem contêiner disponível. É complexidade paga por um problema que não foi visto acontecer; fica como refinamento a considerar só se a avaliação real de T2 mostrar sinal de truncamento.

## 5. As listas como dado, não como texto

`tools/blind-evaluator/lib/pontos.mjs` declara os dez pontos e suas categorias, transcritos da seção 2.4 do protocolo:

```js
export const PONTOS = [
  { n: 1, nome: 'Forma da solução', categorias: ['endpoint novo', 'altera listagem existente', 'enriquece o erro 409', 'combinação'] },
  { n: 2, nome: 'Semântica do retorno', categorias: ['horários livres', 'horários ocupados', 'ambos'] },
  { n: 3, nome: 'Granularidade dos intervalos', categorias: ['fixa', 'derivada das reservas', 'parametrizável'] },
  { n: 4, nome: 'Janela temporal padrão', categorias: ['dia', 'semana', 'obrigatória no parâmetro'] },
  { n: 5, nome: 'Limite de horário', categorias: ['comercial', '24 horas', 'configurável'] },
  { n: 6, nome: 'Escopo de salas', categorias: ['uma sala', 'várias por parâmetro', 'todas'] },
  { n: 7, nome: 'Fuso horário', categorias: ['UTC', 'local', 'explícito no contrato'] },
  { n: 8, nome: 'Sala sem reservas', categorias: ['tudo livre', 'lista vazia', '404'] },
  { n: 9, nome: 'Tratamento do passado', categorias: ['filtrado', 'incluído'] },
  { n: 10, nome: 'Contrato do POST de reserva', categorias: ['inalterado', 'passa a sugerir alternativas no 409'] },
];

export const AUSENTE = 'ausente';
```

O prompt é **montado** a partir dessa lista, e a validação da resposta usa a mesma lista. É o mesmo princípio da tabela de capacidades: a pergunta e a checagem saem da mesma fonte, para que não possam divergir. Um teste afirma que os dez pontos e todas as categorias batem com a tabela da seção 2.4 do protocolo.

## 5.1 De onde vêm a tarefa e o enunciado

O avaliador precisa saber, para cada sessão, qual é a tarefa — para escolher o enunciado que acompanha o diff e para decidir se os pontos de decisão se aplicam. **As duas respostas saem da tabela de capacidades**, `runner/lib/capabilities.mjs`, que desde 21/09 é a fonte única do que um rótulo significa. `TASKS[task].statement` dá o enunciado; a tabela ganha um campo irmão de `hiddenSuite`:

```js
T1: { statement: '...', hiddenSuite: true,  decisionPoints: false },
T2: { statement: '...', hiddenSuite: false, decisionPoints: true  },
```

Os dois campos são declarados lado a lado de propósito: eles dizem qual instrumento mede qual tarefa, e é exatamente o tipo de informação que já divergiu uma vez neste projeto por estar espalhada.

A tarefa de uma sessão é lida da coluna `task` da linha dela no dataset, e **não** do prefixo do identificador. O identificador é rótulo para humano; a coluna é o dado. Derivar comportamento de texto de identificador seria reintroduzir, num instrumento novo, a separação entre rótulo e comportamento que a guarda de capacidades fechou.

Ler a linha do dataset dá ao código acesso a `p_level`, `o_level` e `model`. **Isso não fere a cegueira**, que é sobre o que chega ao prompt, não sobre o que o processo enxerga: o construtor da chamada recebe apenas `diff` e `statement`, e o teste da seção 3 afirma isso sobre o texto efetivamente enviado.

## 6. Onde o resultado vai parar

Por sessão, `sessions/<id>/evaluation.json`, com as respostas, as justificativas, o modelo e a data da avaliação, e o custo em dólares da própria avaliação.

Depois, as colunas do dataset são atualizadas para aquela sessão: `qualidade` recebe a contagem de `sim` no checklist; `decisao_1` a `decisao_10` recebem as categorias, e ficam vazias em T1.

Isto exige uma função nova em `runner/lib/dataset.mjs`, porque o módulo hoje só sabe acrescentar linha:

```js
// Rewrites one session's row in place. The dataset is append-only for
// collection, but the blind evaluator runs afterwards over archived
// diffs, so it has to fill columns on rows that already exist.
export function updateRow(path, sessionId, fields) { /* ... */ }
```

Ela recusa, lançando, se o identificador de sessão não existir no arquivo, e se qualquer campo não for uma coluna declarada no cabeçalho. A guarda de cabeçalho que já existe continua valendo.

**O custo da avaliação não entra em `custo_usd`.** Aquela coluna é o custo do agente na sessão, e misturar o custo do instrumento corromperia a única medida de custo que o trabalho reporta. O custo da avaliação fica em `evaluation.json` e é somado à parte, no relatório de viabilidade.

## 7. A interface

```
node tools/blind-evaluator/evaluate.mjs --session T1-P0-O1-mu69pgsx
node tools/blind-evaluator/evaluate.mjs --all
node tools/blind-evaluator/evaluate.mjs --all --dry-run
```

`--all` percorre `sessions/`, pulando as que já têm `evaluation.json`, de modo que a reexecução é barata e idempotente. `--dry-run` monta os prompts e imprime o que seria enviado, sem chamar a API — é como se confere a cegueira e o conteúdo do prompt sem gastar.

Uma sessão com `status` inválido não é avaliada: não há diff que valha classificar.

## 8. Emendas ao protocolo

**Seção 2.7.** A regra de votação por maioria é substituída por passagem única, com a justificativa de D1 — sem depender de controle de temperatura, que D2 mostra não existir para Sonnet 5. A regra de prompts congelados, a de modelo fixo em Sonnet 5 e a de cegueira permanecem, com a cegueira agora explicitamente definida como cegueira **à condição** — P, O, modelo, identificação da célula — e não ao restante do código do projeto, conforme a seção 1 deste documento. Acrescenta-se que a confiabilidade é medida por concordância com uma amostra classificada por humano, conforme D3. O checklist perde a pergunta 7, redundante com `regressoes`, e passa a ter seis perguntas; a pergunta 6 passa a ser respondida com o conteúdo congelado de `src/shared/` e `src/plugins/` como referência, conforme D8 e D9. O texto retirado e a justificativa ficam preservados na seção 4.1 deste documento.

**Seção 5.1.** A coluna `qualidade` passa de "0–7" para "0–6", em consequência de D8.

**Seção 6.** O passo 7, que hoje descreve o avaliador como etapa do runner, passa a descrevê-lo como passagem posterior sobre os diffs arquivados, com a justificativa de D4.

**Seção 6.4.** O item 6 da análise deixa de ser "taxa de desacordo do avaliador entre suas três chamadas" e passa a ser "concordância entre o avaliador e a amostra classificada por humano".

**Plano de execução, verificação 10 do portão de M3.** Deixa de exigir taxa de desacordo aceitável entre três chamadas e passa a exigir concordância aceitável com a amostra humana, avaliada junto da verificação 8, que já conferia se os dez pontos são classificáveis.

## 9. Explicitamente fora do escopo

O conjunto rotulado à mão e o número de concordância, que dependem de diffs reais de T2 e vêm depois da primeira coleta de T2, conforme D3. O plugin de P2 e a sequência O2. Qualquer mudança na semente, nos enunciados, nos testes ocultos ou no script de convenções.

## 10. Critérios de aceite

- `--dry-run` sobre uma sessão cujo identificador contém `P1` imprime um prompt que não contém `P1`, `O1`, o nome do modelo nem o identificador da sessão.
- O prompt do checklist, impresso por `--dry-run`, contém exatamente seis perguntas, não sete, e não contém o texto da antiga pergunta 7.
- `readReferenceMaterial(repoRoot)` devolve bytes idênticos para duas sessões diferentes, de P e O diferentes.
- Um teste afirma que os dez pontos e todas as categorias de `pontos.mjs` são idênticos à tabela da seção 2.4 do protocolo.
- Um teste afirma que `decisionPoints` é falso em T1 e verdadeiro em T2, e que nenhuma sessão de T1 grava coluna de decisão.
- Uma resposta com categoria fora da lista faz a avaliação daquela sessão falhar, sem gravar `evaluation.json` e sem tocar no dataset.
- `updateRow` recusa identificador de sessão inexistente e campo que não seja coluna declarada.
- As duas sessões de T1 já presentes em `resultados.csv` — a piloto não conta, ela foi movida para `resultados-piloto.csv` por medir o enunciado antigo — são avaliadas e recebem `qualidade` preenchida (contagem de 0 a 6), com `decisao_1` a `decisao_10` vazias.
- `custo_usd` das três sessões permanece exatamente igual ao que era antes da avaliação.
- Rodar `--all` duas vezes não faz a segunda chamar a API.
