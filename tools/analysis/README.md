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
