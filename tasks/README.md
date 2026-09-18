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
- **T1 descreve apenas a necessidade de negócio.** Nada de contrato HTTP, código de status, semântica de borda, limite de duração ou operação de atualização. Essa política de domínio agora vive no arquivo de contexto de P1 e P2 (`contexts/P1/CLAUDE.md` e o plugin de P2), e não no enunciado — é o que dá ao fator de contexto um canal mensurável na taxa de aceitação. O contrato medido pela suíte oculta não mudou: continuam as mesmas 26 asserções, a mesma linha de base de 13/26 contra a semente intocada e a mesma referência de 26/26.
- **T2 descreve apenas o sintoma.** Silencioso sobre causa e solução. O equilíbrio a preservar: ambíguo o bastante para as saídas divergirem, específico o bastante para serem comparáveis.
- **Nenhum dos dois pode ser escrito olhando para uma implementação.** Os testes ocultos de T1 saem do enunciado, e a implementação de referência sai do enunciado sem ver os testes.

**A versão anterior do enunciado de T1**, que trazia a política de domínio por completo, numerada regra a regra, foi usada em uma única sessão: `T1-P0-O1-mu4t4rvp`, executada em 16/09/2026. Essa sessão saturou a variável-resposta principal (`taxa_aceitacao` = 1.0) porque o enunciado era informacionalmente autossuficiente, e por isso não é comparável com as sessões coletadas depois da reavaliação de 17/09/2026. Ela não foi descartada — passou para `resultados-piloto.csv`. O racional completo está em `docs/superpowers/specs/2026-09-17-reavaliacao-de-t1-design.md`.

O racional completo está no `docs/00-log-sessao-planejamento.md`, itens R2.3, R4.12 e R4.13.
