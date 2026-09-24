# tools/collect — coleta em lotes

Duas ferramentas. O driver gasta dinheiro; o auditor não.

## Driver

```
node tools/collect/run-grid.mjs [--limite N] [--seed S] [--dataset <caminho>] [--dry-run]
```

Descobre o que falta comparando a grade (`grid.mjs`) com as linhas `valid`
do dataset, embaralha com uma semente que imprime, e executa até `--limite`
sessões. Sem `--limite`, executa tudo que falta.

É **retomável por construção**: o que falta é sempre relido do dataset, então
rodar o mesmo comando de novo continua de onde parou, sem repetir nada e sem
ninguém precisar dizer onde estava.

- `--dry-run` imprime o plano e não gasta nada. É como se confere o que vai
  rodar antes de autorizar.
- `--seed` reproduz uma ordem anterior. A semente vai impressa em toda
  execução e gravada no registro do lote.
- O número de repetição é derivado do dataset, nunca digitado.
- Uma sessão que falhe duas vezes seguidas para o lote: continuar gastaria
  crédito produzindo mais do mesmo.
- Ao fim do lote, chama o avaliador cego sobre tudo que ainda não tem
  `evaluation.json`.
- Cada lote deixa um registro em `sessions/lotes/<instante>.json` com o que
  foi prometido, o que executou e onde parou.

## Auditor

```
node tools/collect/check-dataset.mjs [--dataset <caminho>]
```

Oito verificações de integridade, cada uma nomeando as sessões que falham.
Sai com código diferente de zero se qualquer uma reprovar, para poder virar
portão. **Não escreve nada, em lugar nenhum**, e pode rodar quantas vezes
quiser.

Ele decide se o dado é **íntegro**, nunca se é **bom**. Nenhuma verificação
olha para o valor de `taxa_aceitacao`, `qualidade` ou convergência: um
auditor que reprovasse resultado ruim estaria filtrando o dataset pela
hipótese.

Duas verificações foram consideradas e cortadas, e o motivo fica registrado
para que ninguém as restaure por parecerem lacuna: "modelo reportado
compatível com o pedido" é redundante, porque `assertModelMatches` já recusa
a sessão em tempo de execução; "custo por sessão em faixa plausível"
dependeria de um limiar escolhido no chute.

## Entre lotes

`/verificar-lote` — a skill que roda o auditor, confere que o lote entregou
o que prometeu, lê um transcript com atenção, e responde `all clear` ou
`parar`.

## Testes

```
node --test tools/collect/test/*.test.mjs
```

Nenhum teste sobe contêiner, chama a API, ou escreve no dataset real.
