# Avaliador cego

Terceiro instrumento de medida do experimento, definido em
`docs/superpowers/specs/2026-09-21-avaliador-cego-design.md`. Um modelo de
linguagem responde perguntas fechadas sobre o diff de uma sessão — nunca dá
nota em escala. Alimenta duas colunas do dataset (protocolo, seção 5.1):

| Função | Perguntas | Coluna | Aplicável |
|---|---|---|---|
| Checklist de qualidade | 6 binárias (`sim`/`nao`) | `qualidade`, 0 a 6 | T1 e T2 |
| Pontos de decisão | 10 de categoria fechada | `decisao_1` a `decisao_10` | só T2 |

Roda inteiramente no host, depois da sessão, sobre o diff já arquivado em
`sessions/<id>/session.diff` — não é etapa de `runner/run-session.mjs`
(spec D4). Pode ser reexecutado quando um prompt mudar, sem recoletar
sessão nenhuma.

## Cegueira: o que é garantido, e o que não é

O avaliador é **cego à condição**: nunca recebe o nível de P, o nível de O,
o modelo da sessão avaliada, nem qualquer identificação da célula. As
funções que montam os prompts (`lib/prompts.mjs`) recebem só `statement`,
`diff` e, no checklist, `referenceMaterial` — nenhum dos três varia com a
condição. `tools/blind-evaluator/test/prompts.test.mjs` afirma isso
construindo os dois prompts a partir de um identificador de sessão
contaminado (`T2-P2-O2-abc123`) e verificando que o texto enviado não o
contém, nem contém `P0`/`P1`/`P2`/`O1`/`O2` nem o nome de um modelo.

Ele **não é** cego ao resto do código do projeto. A pergunta 6 do checklist
("o código novo reusa utilitários do material de referência?") recebe o
conteúdo congelado de `src/shared/` e `src/plugins/`
(`lib/reference-material.mjs`, lido via `git show HEAD:seed/...`, nunca do
contêiner da sessão). Isso não fere a cegueira à condição: esse material é
**idêntico bit a bit** em toda sessão, qualquer que seja P, O ou modelo —
entregá-lo não informa nada sobre a condição, só dá ao avaliador o mesmo
inventário de utilitários que toda sessão teve disponível (spec D9). A
seção 3 da spec justifica em detalhe por que nenhum outro tratamento
especial (por exemplo, mascarar o `CLAUDE.md` quando ele aparece no diff)
é aplicado — o próprio código é o canal de evidência que o trabalho existe
para medir, não um vazamento a tapar.

Modelo do avaliador fixo em `claude-sonnet-5`, sempre, independentemente do
modelo sob teste na sessão. Nenhum parâmetro de amostragem
(`temperature`, `top_p`, `top_k`) é enviado — a API rejeita os três com
erro 400 para este modelo (verificado empiricamente; ver
`lib/client.mjs`). Uma passagem por instrumento, sem votação por maioria
(spec D1): a confiabilidade do instrumento passa a ser medida por
concordância com uma amostra classificada por humano (D3), não por
concordância consigo mesmo.

## Uso

Inspecionar o prompt de uma sessão sem gastar nada:

```bash
node tools/blind-evaluator/evaluate.mjs --session T1-P0-O1-mu69pgsx --dry-run
node tools/blind-evaluator/evaluate.mjs --all --dry-run
```

Avaliar de verdade (gasta dinheiro de API):

```bash
node tools/blind-evaluator/evaluate.mjs --session T1-P0-O1-mu69pgsx
node tools/blind-evaluator/evaluate.mjs --all
```

`--all` percorre `resultados.csv`, avalia toda linha com `status: valid`
e pula qualquer sessão que já tenha `sessions/<id>/evaluation.json` — a
reexecução é barata e idempotente. Uma sessão com `status` diferente de
`valid` não é avaliada: não há diff que valha classificar.

Categoria ou resposta fora do formato esperado é erro, nunca aproximação
(spec D7): a avaliação daquela sessão falha, nada é gravado — nem
`evaluation.json`, nem a linha do dataset — e o erro aparece em stderr sem
interromper as demais sessões de um `--all`.

## Onde o resultado vai parar

Por sessão, `sessions/<id>/evaluation.json`: respostas, justificativas,
modelo e data da avaliação, e o custo em dólares da própria chamada. Esse
custo **não** entra em `custo_usd` do dataset — aquela coluna é o custo do
agente na sessão, não do instrumento que a mede depois. Em seguida,
`runner/lib/dataset.mjs#updateRow` grava `qualidade` (contagem de `sim`) e,
só em T2, `decisao_1` a `decisao_10` na linha correspondente.

## O que ainda não existe

O conjunto rotulado à mão para medir concordância entre o avaliador e uma
classificação humana (spec D3) depende de diffs reais de T2, que ainda não
existem em número suficiente. É o próximo passo depois desta ferramenta,
não parte dela — fica para quando a primeira leva real de sessões de T2
for coletada.

## Rodando os testes

Use concorrência 1 quando a suíte servir de portão antes de gastar API:

```bash
node --test --test-concurrency=1 tools/blind-evaluator/test/*.test.mjs tools/convention-check/test/*.test.mjs runner/test/*.test.mjs
```

Dois motivos. O `node --test` roda **arquivos em paralelo** por padrão, e três arquivos do runner (`end-to-end`, `measure`, `prepare`) sobem contêiner Docker — em paralelo eles disputam recursos, e já foi observada uma falha intermitente em que uma sessão falsa terminou com `status: invalid` numa execução e `valid` na seguinte, com o mesmo comando. Isolados, os três passam de forma consistente. E `node --test <diretório>` não funciona no Node 24 desta máquina: passe glob, não diretório.

Isso não ameaça a coleta real, que é serial por protocolo (seção 3.4) — uma sessão por vez, numa máquina só. E quando acontece, o runner marca a linha como inválida com motivo registrado, que é o comportamento desenhado para falha de infraestrutura: a sessão é re-executada, não aproveitada pela metade.
