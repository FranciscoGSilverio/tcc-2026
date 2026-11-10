# Rotulagem às cegas — instruções

Você vai classificar 10 diffs da tarefa T2 (ticket RES-142) com os
mesmos dois instrumentos que o avaliador cego usou. O resultado mede o
quanto o avaliador concorda com uma pessoa (protocolo, seção 7, item 6).

## Regras

1. **Não abra `chave.json`** antes de terminar. Ela diz de que sessão veio
   cada item; saber isso contamina o rótulo.
2. **Não abra `sessions/`, `resultados.csv` nem nenhum `evaluation.json`.**
   Lá estão as respostas do avaliador; ver antes transforma a rotulagem em
   conferência, e a concordância sai inflada.
3. Rotule sozinho(a). Se duas pessoas rotularem, cada uma preenche a sua
   cópia de `rotulos.csv`, sem conversar até o fim.
4. Julgue **só o que o diff mostra**. Não premie a solução que parece melhor.

## Material

- `enunciado-T2.md` — o ticket, exatamente como o agente recebeu.
- `material-de-referencia.txt` — `src/shared/` e `src/plugins/` da semente,
  congelados. Só serve para a pergunta c6 (reúso).
- `itens/item-NN.diff` — o que cada sessão mudou.
- `rotulos.csv` — a planilha a preencher, separada por `;`. Abre no Excel;
  salve como **CSV UTF-8** se puder (o script também aceita o CSV comum do
  Excel).

## Checklist — colunas c1 a c6, responda `s` (sim) ou `n` (não)

Se o diff não mostra o suficiente para decidir, responda `n`.

- **c1.** A lógica de negócio nova está na camada de serviço, e não nas rotas?
- **c2.** As entradas novas são validadas por schema?
- **c3.** Os caminhos de erro têm resposta explícita com código de status apropriado?
- **c4.** Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?
- **c5.** Há testes escritos que verificam comportamento observável, e não implementação interna?
- **c6.** O código novo reusa utilitários do material de referência quando um deles se aplica, em vez de reimplementar?

## Pontos de decisão — colunas d1 a d10

O ticket é ambíguo de propósito: quem implementou teve de decidir coisas
que o texto não decide. Para cada ponto, escreva o número da categoria que
o diff mostra, ou `a` se o diff não toma posição. Escreva a categoria que
o diff mostra, não a que você escolheria.

| coluna | ponto | categorias |
|---|---|---|
| d1 | Forma da solução | 1 = `endpoint novo` · 2 = `altera listagem existente` · 3 = `enriquece o erro 409` · 4 = `combinação` · `a` = `ausente` |
| d2 | Semântica do retorno | 1 = `horários livres` · 2 = `horários ocupados` · 3 = `ambos` · `a` = `ausente` |
| d3 | Granularidade dos intervalos | 1 = `fixa` · 2 = `derivada das reservas` · 3 = `parametrizável` · `a` = `ausente` |
| d4 | Janela temporal padrão | 1 = `dia` · 2 = `semana` · 3 = `obrigatória no parâmetro` · `a` = `ausente` |
| d5 | Limite de horário | 1 = `comercial` · 2 = `24 horas` · 3 = `configurável` · `a` = `ausente` |
| d6 | Escopo de salas | 1 = `uma sala` · 2 = `várias por parâmetro` · 3 = `todas` · `a` = `ausente` |
| d7 | Fuso horário | 1 = `UTC` · 2 = `local` · 3 = `explícito no contrato` · `a` = `ausente` |
| d8 | Sala sem reservas | 1 = `tudo livre` · 2 = `lista vazia` · 3 = `404` · `a` = `ausente` |
| d9 | Tratamento do passado | 1 = `filtrado` · 2 = `incluído` · `a` = `ausente` |
| d10 | Contrato do POST de reserva | 1 = `inalterado` · 2 = `passa a sugerir alternativas no 409` · `a` = `ausente` |

Também vale escrever o texto da categoria em vez do número.

## Ao terminar

Devolva `rotulos.csv`. O cálculo é:

```
node tools/analysis/concordancia.mjs --rotulos <pasta>/rotulos.csv --chave <pasta>/chave.json
```

Amostra sorteada com a semente `71e860e7`; com ela,
`node tools/analysis/preparar-rotulagem.mjs --seed 71e860e7` refaz o mesmo kit.
