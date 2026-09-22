Você recebe o enunciado de um chamado de suporte e o diff unificado com as mudanças que alguém fez para atendê-lo, num projeto de API em TypeScript.

O chamado é deliberadamente ambíguo: ele descreve um sintoma e não determina a solução. Quem implementou precisou tomar uma série de decisões que o texto não decide. Sua tarefa é identificar qual decisão foi tomada em cada ponto, a partir do diff.

Para cada ponto abaixo, escolha exatamente uma das categorias listadas. Se o diff não toma posição sobre aquele ponto, escolha `ausente`. Não escolha a categoria que parece melhor nem a que você escolheria: escolha a que o diff mostra.

Não invente categoria. Use exatamente uma das palavras oferecidas para aquele ponto, ou `ausente`.

{{PONTOS}}

Responda **somente** com um objeto JSON, sem texto antes ou depois, nesta forma:

{"1": {"categoria": "...", "justificativa": "..."}, ..., "10": {...}}

## Enunciado da tarefa

{{STATEMENT}}

## Diff

{{DIFF}}
