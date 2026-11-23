# tools/analysis

Regras aplicadas ao dataset no momento da análise. Nenhum script aqui escreve
no dataset; os únicos que escrevem arquivo são `figuras.py` e
`preparar-rotulagem.mjs`, cada um só na sua pasta de saída.

## `aderencia-o2.mjs`

```
node tools/analysis/aderencia-o2.mjs
```

Conta, por passo, quantas alterações de arquivo cada sessão O2 fez, e nomeia
as que alteraram nos passos 1 ou 2 — onde o enunciado do passo proíbe.

Existe porque a fronteira entre os passos de O2 é **instrução, não trava**.
Uma sessão que implementa durante a exploração está rotulada O2 e executou
algo mais próximo de O1, e a análise do fator O precisa saber quais são.

A contagem é heurística, e os padrões estão no topo do arquivo. Duas famílias
de escrita, e nenhuma pode ser ignorada: as ferramentas de edição, que são
inequívocas, e comandos de shell, que não são — o Opus edita com
`cat > arquivo <<'EOF'` e nunca toca numa ferramenta de edição. Escrita fora
da cópia de trabalho não conta, e o corpo de heredoc não é lido como shell.

## `resumo.mjs`

```
node tools/analysis/resumo.mjs            # relatório em markdown
node tools/analysis/resumo.mjs --json     # os mesmos números, para figuras.py
```

Os itens 1, 3, 4 e 5 do plano de análise (protocolo, seção 7): média e
desvio-padrão de cada métrica por célula; o efeito do modelo nas duas
configurações extremas; o delta de Cliff nos dois contrastes que o plano
nomeia (efeito total do harness em Sonnet, e Haiku P2-O2 contra Opus P0-O1),
mais três exploratórios dentro da grade Sonnet, rotulados como fora do plano;
e o piso de ruído de T1. Sem teste de significância, como o protocolo manda.

A convergência não é recalculada: vem de `convergencia.mjs`. O relatório
gerado está em `docs/08-analise-descritiva.md`; se o dataset mudar, gere de
novo em vez de editar à mão.

## `figuras.py`

```
python tools/analysis/figuras.py [--saida docs/figuras]
```

Item 2 do plano: as figuras do artigo em escala de cinza com hachura, na
largura de uma coluna, em PDF (artigo) e PNG (slides). Lê os números de
`resumo.mjs --json`. **É o único script daqui que escreve**, e só na pasta de
saída. Requer matplotlib.

- `fig1-t1-taxa-aceitacao-grade` — T1 na grade principal, com cada sessão
  marcada e a linha da semente intocada (13/26).
- `fig2-t2-convergencia-grade` — convergência de T2 na grade principal.
- `fig3-modelo-x-harness` — os três modelos nas duas configurações extremas,
  T1 e T2 lado a lado.
- `artigo-fig2` a `artigo-fig5` — as figuras do artigo final; ver "Os
  critérios do artigo final", abaixo.

## `preparar-rotulagem.mjs` e `concordancia.mjs`

Item 6 do plano: a concordância entre o avaliador cego e uma pessoa (spec do
avaliador cego, D3), que a coleta deixou sem medir.

```
node tools/analysis/preparar-rotulagem.mjs [--seed S] [--saida rotulagem]
node tools/analysis/concordancia.mjs [--rotulos rotulagem/rotulos.csv] [--chave rotulagem/chave.json]
```

O primeiro sorteia uma sessão de T2 por célula (dez) e monta um kit às cegas:
enunciado, material de referência, os dez diffs numerados em ordem embaralhada,
um `LEIA-ME.md` com as perguntas e categorias, e um `rotulos.csv` em branco
que abre no Excel. As respostas do avaliador ficam de fora de propósito. A
correspondência entre item e sessão vai para `chave.json`, que quem rotula
não abre até terminar. Também escreve, mas só na pasta do kit, e se recusa
a sobrescrever um `rotulos.csv` existente.

O segundo compara os rótulos com os `evaluation.json` arquivados e dá a
concordância bruta e o kappa de Cohen por pergunta, por ponto e agregados,
listando cada desacordo com a justificativa do avaliador. Rótulo fora da lista
fechada é erro, como no avaliador (D7).

## Os critérios do artigo final

Acrescentados em 23/11/2026, **depois** da entrega do artigo. O artigo
avaliou as sessões por critérios que não estavam no protocolo (C2, a
complexidade de C3, C4, a convergência substantiva de C5 e o esforço de
C6), e os números deles não tinham script nem dado no repositório. Estes
scripts são **reconstruções**: aplicam aos artefatos arquivados regras
escritas a partir das definições da seção III-F do artigo. Onde a regra é
heurística, o cabeçalho de cada script diz exatamente qual é, e as
exceções decididas à mão estão numa tabela no próprio script, com o id da
sessão e o motivo.

Quase todos os números do artigo se reproduzem. Onde não, o script publica
o que os dados dão, sem forçar o número do artigo, e a divergência está em
`docs/10-reproducao-do-artigo.md`, que liga cada afirmação do artigo ao
comando que a reproduz.

| Script | Critério do artigo | Lê | Escreve |
|---|---|---|---|
| `requisitos-t1.mjs` | C2 em T1, Fig. 2, "48% → 100%" | `sessions/*/result.json` (`hidden.byRule`) | nada |
| `requisitos-t2.mjs` | C2 em T2 (seção IV-D) | `session.diff`, `resultados.csv` | `docs/dados/requisitos-t2.csv` com `--csv` |
| `convergencia.mjs` | C5, convergência oficial e substantiva, Fig. 5 | `resultados.csv` | nada |
| `complexidade.mjs` | C3, complexidade ciclomática, Fig. 4 | `session.diff`, imagem `meeting-rooms-api:1.0.0` | `docs/dados/complexidade.csv` |
| `seguranca.mjs` | C4, Tabela VI | `session.diff`, `result.json` | `docs/dados/seguranca.csv` com `--csv` |
| `esforco.mjs` | C6, esforço; leituras antes da 1ª edição; skills consultadas | `transcript*.jsonl` | `docs/dados/esforco.csv` com `--csv` |

```
node tools/analysis/requisitos-t1.mjs
node tools/analysis/requisitos-t2.mjs [--json] [--csv]
node tools/analysis/convergencia.mjs [--json]
node tools/analysis/complexidade.mjs              # Docker; grava o CSV
node tools/analysis/complexidade.mjs --do-csv     # sem Docker: agrega o CSV publicado
node tools/analysis/seguranca.mjs [--json] [--csv]
node tools/analysis/esforco.mjs [--json] [--csv]
```

`convergencia.mjs` continua sendo a regra oficial do protocolo; a medida
substantiva é uma coluna a mais, com a mesma fórmula do artigo
(C = D/10), em que concordar em `ausente` não conta.

Os CSVs de `docs/dados/` são publicados para que se possa conferir sessão
por sessão sem rodar nada, inclusive sem Docker. O de complexidade tem uma
linha por função tocada, e as funções da semente com `session_id=semente`.

`figuras.py` desenha também as Figs. 2 a 5 do artigo a partir destes
scripts, como `artigo-fig2` a `artigo-fig5` em `docs/figuras/`. São
redesenhos com os mesmos dados e o mesmo estilo em cinza, não cópia do PDF.
A Fig. 1 é um diagrama do processo, sem dados.

Para rodar os testes, use o glob: `node --test tools/analysis/test/*.test.mjs`.
No Windows com Node 22, `node --test tools/analysis/test/` trata o
diretório como módulo e falha.
