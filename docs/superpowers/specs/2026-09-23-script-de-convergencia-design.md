# Script de convergência — design

**Data:** 2026-09-23
**Protocolo relevante:** seções 2.4 (pontos de decisão e categorias), 5.2 (definição de `convergencia`), 7 item 2 (o que a análise faz com ela).
**Motivo:** `convergencia` é a variável-resposta principal de T2 e **não existe no dataset** — ela sai de aplicar uma regra sobre três linhas de uma mesma célula. Documentar a regra em prosa deixa espaço para quem analisa implementar diferente do que foi implementado aqui.

---

## 1. O que o script é, e o que ele não é

É **o cálculo**, com uma implementação só, rodado na hora da análise. Lê `resultados.csv`, imprime números, e não escreve nada.

Não é arquivo derivado armazenado. Um CSV com convergência já calculada envelheceria em silêncio no instante em que uma sessão fosse recoletada, e ninguém notaria. O dado cru fica no dataset; o derivado se recalcula quando é preciso.

Não substitui o dicionário de dados: o dicionário explica a regra para quem lê, o script garante que a regra executada seja uma só.

## 2. A regra, exatamente

**Célula** é a tripla tarefa, nível de P, nível de O. `convergencia` só existe para T2, então são seis células: P0-O1, P0-O2, P1-O1, P1-O2, P2-O1, P2-O2.

**Sessões que entram.** Só as de `status = valid`. Sessão inválida é falha de infraestrutura, é re-executada, e não é ponto de dado. Note que `travou = true` **não** exclui: uma sessão cuja aplicação não sobe continua tendo diff classificável, e o protocolo manda registrá-la como dado em vez de descartá-la.

**`ausente` é categoria.** A seção 2.4 é explícita, e isso é o que dá sentido ao número: três execuções que não construíram nada sobre fuso horário **concordaram** em não construir. Isso é convergência de verdade, não buraco.

**Primeiro recorte — `convergencia` sobre os dez pontos congelados.** Para cada um dos dez, as três execuções registraram a mesma categoria? Conta quantos sim, divide por dez. É a definição literal da seção 5.2 e é o número que o artigo reporta como métrica principal.

**Segundo recorte — sobre os pontos vivos.** Um ponto é **inerte** quando vem `ausente` em **todas** as sessões válidas e classificadas de T2 do dataset — não em uma célula, no dataset inteiro. Um ponto inerte jamais pôde divergir em lugar nenhum: ele infla todas as células por igual e o segundo recorte existe para mostrar o número sem ele.

**Ausência numa célula não é inércia.** Se o ponto 7 fica ausente nas três execuções de P0-O1 mas alguma sessão de P2-O2 constrói algo sobre fuso, o ponto está vivo, entra no denominador de todas as células, e a concordância em P0-O1 é achado legítimo. Tratar ausência local como inércia daria denominadores diferentes por célula, e células com denominadores diferentes deixam de ser comparáveis entre si — que é exatamente a comparação que a grade existe para fazer.

**Métrica secundária da seção 5.2.** Média, sobre os pontos do recorte, do número de categorias distintas entre as três execuções — um, dois ou três por ponto. Mostra o quanto as escolhas se espalharam quando não houve unanimidade. Reportada junto de cada recorte, com o denominador daquele recorte.

## 3. As três guardas

Cada uma existe porque produz, sem ela, um número plausível e errado.

**Célula incompleta é recusada, não estimada.** A seção 4.1 manda três execuções de T2 por célula; a seção 5.2 define a métrica sobre as três. Com duas você sabe se concordaram, não o grau. O script exige **exatamente três** sessões válidas e classificadas por célula. Mais que três também é recusa: escolher quais três usar é decisão humana, não do script, e escolher em silêncio seria o mesmo defeito que este projeto já corrigiu três vezes.

**Sessão não classificada é distinguida de sessão sem convergência.** Uma linha válida cujas colunas `decisao_*` estejam vazias ainda não passou pelo avaliador. Isso é "não está pronto", não "não convergiu". O script nomeia a sessão e diz que falta avaliá-la.

**O segundo recorte é recusado enquanto a coleta de T2 não fechar.** Com o dataset parcial não há como saber quais pontos são globalmente inertes, e calcular assim dá um número que parece certo. Este é o erro que motivou a spec: em 22/09 reportei "convergência sobre os oito pontos vivos, 3/8" a partir de uma única célula, tratando ausência local como inércia. Enquanto as seis células de T2 não tiverem suas três sessões válidas e classificadas, o script imprime o primeiro recorte, imprime quais pontos estão **provisoriamente** sem posição, e diz com todas as letras que o segundo recorte ainda não pode ser calculado.

## 4. Saída

Texto puro em stdout, no estilo das outras ferramentas do projeto. O escopo vem impresso primeiro, para que nenhum número fique ambíguo sobre o que o produziu:

```
escopo: 18 sessões de T2, válidas e classificadas, em 6 células

célula    convergência(10)   categorias distintas/ponto
P0-O1            5/10 = 0,50                       1,50
P0-O2            ...

pontos inertes no dataset (ausentes em todas as 18): 5, 7
célula    convergência(8 vivos)   categorias distintas/ponto
P0-O1            3/8 = 0,38                        1,62
```

Quando a coleta não fechou, a segunda metade é substituída por uma linha dizendo que o segundo recorte depende do dataset completo, e listando o que falta.

## 5. Interface

```
node tools/analysis/convergencia.mjs [--dataset <caminho>]
```

`--dataset` segue o padrão do runner, com `RUNNER_DATASET_PATH` e `resultados.csv` como padrão — assim os testes nunca leem o dataset real.

## 6. Explicitamente fora do escopo

Não escreve nem altera nada, em arquivo nenhum. Não lê `evaluation.json`: as categorias vêm do CSV, que é a fonte, e o JSON guarda as justificativas para leitura humana. Não confere se as duas fontes concordam — elas só divergiriam por edição manual do CSV, e uma guarda para isso custaria mais do que o risco vale. Não calcula nada de T1, que não tem convergência.

## 7. Critérios de aceite

- Sobre um CSV de fixture com uma célula de três sessões que concordam em seis dos dez pontos, imprime `6/10`.
- `ausente` nas três execuções de um ponto **conta como convergência** naquele ponto.
- Uma célula com duas sessões válidas é recusada, nomeando a célula e quantas tem.
- Uma célula com quatro sessões válidas é recusada, sem escolher três.
- Uma sessão válida com `decisao_*` vazias é reportada como pendente de avaliação, e a célula dela não é calculada.
- Uma sessão com `status = invalid` é ignorada na contagem da célula; uma célula com três válidas mais uma inválida é calculada normalmente.
- Com o dataset incompleto, o segundo recorte **não** é impresso, e a saída diz o que falta.
- Com as seis células completas numa fixture, o segundo recorte é impresso e os pontos inertes são os que estão ausentes em todas as dezoito sessões — não os ausentes em alguma célula.
- Rodar o script não modifica `resultados.csv`: `git status` continua limpo depois.
