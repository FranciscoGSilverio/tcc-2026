# Coleta em lotes — design

**Data:** 2026-09-23
**Protocolo relevante:** seções 4.1 a 4.5 (a grade, as células de modelo, o controle de deriva, a ordem randomizada).
**Objetivo:** coletar as 48 sessões restantes com um comando, em lotes verificáveis, sem que erro de protocolo ou de medição queime crédito produzindo dado errado.

---

## 1. Duas ferramentas, não uma

**`tools/collect/run-grid.mjs`** descobre o que falta, embaralha, e executa até um limite. Retomável por construção.

**`tools/collect/check-dataset.mjs`** audita o que já foi coletado. É a verificação entre lotes, **mecânica em vez de lembrada** — conferência de olho cansa no terceiro lote e deixa passar exatamente quando o dataset já está grande o bastante para doer.

A separação importa: o driver gasta dinheiro, o auditor não. O auditor pode rodar quantas vezes quiser, inclusive depois da coleta inteira.

## 2. O alvo da coleta

Os três blocos da seção 4 do protocolo, declarados como dado numa tabela só — `runner/lib/capabilities.mjs` já é a fonte única do que um rótulo significa, e a composição da grade é a mesma classe de informação:

```js
export const GRID = {
  // §4.1 — seis células, Sonnet, T1 duas vezes e T2 três vezes.
  principal: {
    models: ['claude-sonnet-5'],
    cells: [['P0','O1'],['P0','O2'],['P1','O1'],['P1','O2'],['P2','O1'],['P2','O2']],
  },
  // §4.2 — as duas configurações extremas, nos outros dois modelos.
  modelo: {
    models: ['claude-haiku-4-5', 'claude-opus-5'],
    cells: [['P0','O1'],['P2','O2']],
  },
};
export const REPETITIONS = { T1: 2, T2: 3 };
```

O controle de deriva da seção 4.3 **não entra**: ele só existe se a coleta ocorrer em duas janelas separadas no tempo, e a decisão é rodar de uma vez. Se isso mudar, ele volta — e essa é a única razão pela qual ele ficaria de fora.

Uma sessão é identificada pela quíntupla tarefa, contexto, ordem, modelo e número de repetição. **O que falta é o alvo menos o que o dataset já tem**, contando só linhas `valid`.

## 3. O driver

```
node tools/collect/run-grid.mjs [--limite N] [--seed S] [--dataset <caminho>] [--dry-run]
```

**`--dry-run` imprime o plano e não gasta nada.** É como se confere o que vai rodar antes de autorizar.

**Ordem randomizada, com semente registrada.** A seção 4.5 exige embaralhar "para que variação temporal do serviço não se confunda com uma célula específica". O driver embaralha o que falta com uma semente que ele imprime, de modo que a ordem é aleatória e ao mesmo tempo reproduzível — quem auditar depois consegue refazer a sequência.

**Número de repetição derivado, não digitado.** `--run` é hoje responsabilidade de quem dispara, e o dicionário já registra isso como risco. O driver conta quantas sessões válidas daquela quíntupla já existem e usa a próxima — um número repetido deixa de ser possível.

**A primeira sessão leva `--allow-image-change` automaticamente**, e só a primeira, porque o dataset carrega digests anteriores à mudança de 23/09. Da segunda em diante a guarda de imagem vale integralmente.

**Sessão inválida é tentada mais uma vez, e falha repetida para o lote.** Falhar duas vezes seguidas na mesma sessão significa que algo está quebrado, e continuar gastaria crédito produzindo mais do mesmo. O driver para, diz qual sessão falhou e por quê, e deixa o resto para depois do conserto.

**Ao final do lote, chama o avaliador cego** sobre tudo que ainda não foi avaliado. `evaluate.mjs --all` já é idempotente e pula o que tem `evaluation.json`, então isso é seguro mesmo se o lote parou no meio.

**Imprime progresso e custo acumulado** a cada sessão, para que o gasto seja visível enquanto acontece e não só no fim.

## 4. O auditor

```
node tools/collect/check-dataset.mjs [--dataset <caminho>]
```

Oito verificações, cada uma nomeando as sessões que falham. Sai com código diferente de zero se qualquer uma falhar, para poder virar portão.

1. **Nenhuma linha inválida sem substituta.** Uma sessão `invalid` é aceitável se existir outra `valid` da mesma quíntupla; sozinha, é buraco.
2. **Nenhuma coluna vazia fora do previsto.** Vazios legítimos são os três do dicionário: `decisao_*` em T1, `taxa_aceitacao` em T2, `invalid_reason` em sessão válida.
3. **Toda sessão válida foi avaliada** — `qualidade` preenchida, e `decisao_*` preenchidas em T2.
4. **`image_digest` constante** entre todas as sessões coletadas a partir da primeira do regime novo. Divergência aqui significa que a imagem trocou no meio, e o protocolo a trata como constante.
5. **`cli_version` constante** em toda a coleta, pelo mesmo motivo.
6. **Toda sessão P2 carregou o plugin.** Lê o evento de init do transcript arquivado e exige `plugins` não vazio. A guarda já recusa em tempo de execução; isto confere o que foi gravado, que é o que a análise vai ler.
7. **Todo transcript está são.** Abre, não está truncado, traz evento de init, e traz a quantidade certa de eventos `result` — um em O1, quatro em O2. Menos que o esperado em O2 significa cadeia quebrada com linha gravada assim mesmo; transcript ilegível significa sessão que morreu sem que nada percebesse. É a verificação mais direta de "o laço rodou inteiro".

8. **Nenhuma sessão reporta erro do CLI.** Todo evento `result` do transcript traz `is_error: false` e `subtype: success`. Hoje `is_error` é lido por `readTranscript` e **não é gravado em coluna nenhuma nem verificado por nada** — uma sessão em que o CLI reportasse erro entraria como `valid`, sem rastro, desde que tivesse produzido transcript e diff. Fica como verificação do auditor e não como coluna nova: o dado está no transcript arquivado, e acrescentar coluna agora quebraria a guarda de cabeçalho do dataset e exigiria migrar as linhas já coletadas, por informação que já está guardada.

**Duas verificações foram consideradas e cortadas, e o motivo fica registrado para que ninguém as restaure por parecerem lacuna.** "Modelo reportado compatível com o pedido" é redundante: `assertModelMatches` já recusa a sessão em tempo de execução, e conferir o agregado depois não acrescenta nada que a guarda não tenha impedido. "Custo por sessão em faixa plausível" dependeria de um limiar escolhido no chute; ela vira responsabilidade do agente da seção 5, que olha os números em conjunto sem precisar de um corte numérico arbitrário.

As verificações 6, 7 e 8 são as que justificam guardar os transcripts: elas conferem o que ficou registrado, não o que o runner achou na hora.

## 5. O que isto não faz

Não decide se o dado é bom — só se é íntegro. Nenhuma das sete verificações olha para `taxa_aceitacao`, `qualidade` ou convergência: essas são resultado, e um auditor que reprovasse resultado ruim estaria filtrando o dataset pela hipótese.

Não recoleta automaticamente o que reprovar. O auditor nomeia; a decisão de re-executar é humana.

Não toca no dataset nem em nenhum arquivo.

## 6. A skill de verificação de lote

A skill **não é um segundo auditor**. Ela é o procurador do orientando entre lotes: consome a saída do auditor e faz o olhar que ele faria, para que ele não precise fazê-lo três vezes ao longo da coleta. Vive em `.claude/skills/verificar-lote/SKILL.md`, versionada, porque o roteiro que ela define determina o que é pego.

Quatro passos e uma resposta binária.

**Roda o auditor.** Se reprovar, reporta qual verificação e quais sessões, e para. Não tenta consertar nem interpretar — a decisão de re-executar é humana.

**Confere que o lote entregou o que prometeu.** Esta é a única coisa aqui que o auditor **não pode fazer por construção**: ele só vê o dataset, e não sabe o que o lote deveria ter produzido. Se o driver prometeu dez sessões e parou na sétima sem alarde, o auditor aprova as sete, porque elas estão íntegras. Comparar intenção com resultado é o que revela a parada silenciosa, e é a forma mais direta da pergunta "algo quebrou no meio do laço".

**Lê um transcript do lote, inteiro e com atenção**, procurando qualquer coisa que sugira que a medição não aconteceu como desenhada. É amostral por necessidade: conferir formalmente todos os transcripts é mecânico e já é trabalho do auditor, que faz isso melhor; ler *com atenção* não escala — dez transcripts são mais de um megabyte, e passar o olho neles produz a ilusão de atenção, não atenção.

Uma versão anterior desta spec mandava "confirmar que houve trabalho de verdade". **Isso estava errado** e violava a própria proibição abaixo: uma sessão em que o agente não fez nada é dado, não defeito — `travou_sem_diff` existe para registrá-la, e o protocolo manda preservá-la com nota zero. Conferir se houve trabalho suficiente é julgar resultado pela porta dos fundos.

**Responde `all clear` ou `parar`**, com o motivo em uma linha.

**E carrega uma proibição explícita: não julgar resultado.** `taxa_aceitacao` baixa, `qualidade` baixa, convergência baixa, diff muito maior ou menor que os outros, custo fora do padrão do conjunto, célula que não se comporta como a hipótese previa — **nada disso é problema a reportar.** É dado. Medição fora do padrão é dado desde que a regra tenha sido seguida.

A proibição precisa estar escrita com essas palavras porque um agente encarregado de "ver se está tudo bem" tem tendência natural a encontrar algo, e o que ele encontraria primeiro seria justamente o resultado desfavorável — empurrando a coleta na direção da hipótese, que é o viés que o avaliador cego e a ordem randomizada existem para evitar.

## 7. Critérios de aceite

- `--dry-run` sobre o dataset atual lista exatamente 48 sessões, agrupadas por bloco, sem chamar a API.
- A soma das sessões listadas bate com a tabela da seção 2: 23 da grade principal e 20 das células de modelo.
- Rodar o driver duas vezes com `--limite 1` executa duas sessões **diferentes**, provando que o "o que falta" é lido do dataset e não recomeçado.
- Duas execuções com a mesma `--seed` produzem a mesma ordem; com sementes diferentes, ordens diferentes.
- O número de repetição é derivado: uma célula que já tem `run_number` 1 recebe 2 na próxima, sem que ninguém digite.
- Uma sessão que falhe duas vezes para o lote e o driver imprime qual foi e por quê, sem seguir para a próxima.
- O auditor reprova um dataset de fixture com sessão inválida sem substituta, com coluna vazia indevida, com `image_digest` divergente, e com sessão P2 cujo init não traz plugin — uma fixture por verificação.
- O auditor aprova o dataset real de hoje **exceto** nas verificações que já se sabe falharem por serem anteriores à mudança de imagem, e nomeia essas.
- Nem o driver nem o auditor escrevem em `resultados.csv`: depois de `--dry-run` e de uma execução do auditor, `git status` continua limpo.
- A skill existe em `.claude/skills/verificar-lote/SKILL.md`, é versionada, e contém a proibição de julgar resultado com essas palavras.
- A skill detecta um lote que parou antes do limite pedido — o caso que o auditor aprova por só enxergar o dataset.
