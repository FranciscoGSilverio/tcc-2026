# Enunciados

Cada arquivo `T*.md` contém **exatamente o texto que o agente recebe**, e nada mais. Sem metadados, sem comentários, sem notas de versão. O runner lê o arquivo e envia o conteúdo.

Por isso qualquer informação sobre o experimento fica aqui neste README, nunca dentro dos enunciados.

## Estado

| Arquivo | Tarefa | Instrumento de medida | Congelado |
|---|---|---|---|
| `T1-validacao-de-reservas.md` | Bem especificada | Testes ocultos | Não, congela em M3 |
| `T2-res-142.md` | Ambígua | Convergência sobre dez pontos de decisão | Não, congela em M3 |

Ambos terminam com a frase de encerramento padrão, que é constante do protocolo e idêntica nas duas tarefas justamente para não virar diferença entre condições.

## Regras que valem para estes textos

- **Congelam em M3**, junto com o protocolo, e não antes. O piloto existe para revelar efeito teto em T1 e erro de calibragem de ambiguidade em T2, e congelar antes tornaria ilegítimas exatamente essas correções.
- **T1 descreve apenas contrato HTTP.** Rotas, formatos, códigos de status e regras de negócio. Nunca implementação interna.
- **T2 descreve apenas o sintoma.** Silencioso sobre causa e solução. O equilíbrio a preservar: ambíguo o bastante para as saídas divergirem, específico o bastante para serem comparáveis.
- **Nenhum dos dois pode ser escrito olhando para uma implementação.** Os testes ocultos de T1 saem do enunciado, e a implementação de referência sai do enunciado sem ver os testes.

O racional completo está no `docs/00-log-sessao-planejamento.md`, itens R2.3, R4.12 e R4.13.
