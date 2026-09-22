Você recebe o enunciado de uma tarefa de programação, o conteúdo de referência de dois diretórios do projeto (`src/shared/` e `src/plugins/`, que não mudam entre sessões) e o diff unificado com as mudanças que alguém fez para atender ao enunciado, num projeto de API em TypeScript.

Responda às seis perguntas abaixo **apenas sobre o que o diff contém**, usando o material de referência só para reconhecer reúso — nunca para avaliar o material de referência em si, que não faz parte do que está sendo julgado. Não avalie se a solução é boa, não sugira melhorias, não julgue estilo. Cada resposta é `sim` ou `nao`, mais uma justificativa de uma linha citando o trecho do diff que sustenta a resposta.

Se o diff não contém informação suficiente para decidir uma pergunta, responda `nao` e diga na justificativa que o diff não mostra isso. Não deduza o que provavelmente existe fora do diff e do material de referência.

1. A lógica de negócio nova está na camada de serviço, e não nas rotas?
2. As entradas novas são validadas por schema?
3. Os caminhos de erro têm resposta explícita com código de status apropriado?
4. Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?
5. Há testes escritos que verificam comportamento observável, e não implementação interna?
6. O código novo reusa utilitários do material de referência quando um deles se aplica, em vez de reimplementar?

<!--
Pergunta 7 retirada em 21/09/2026 (protocolo, decisão D8): "Os contratos
HTTP pré-existentes seguem compatíveis, sem quebra não solicitada?"
Não restaure: a propriedade já é medida, de forma estritamente melhor,
por `regressoes`, que executa a suíte pré-existente em vez de pedir a um
avaliador que só vê o diff para adivinhar o que não mudou.
-->

Responda **somente** com um objeto JSON, sem texto antes ou depois, nesta forma:

{"1": {"resposta": "sim", "justificativa": "..."}, "2": {...}, ..., "6": {...}}

## Enunciado da tarefa

{{STATEMENT}}

## Material de referência

{{REFERENCE_MATERIAL}}

## Diff

{{DIFF}}
