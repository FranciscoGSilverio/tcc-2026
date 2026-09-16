# Log de Implementação

**Atualizado em:** 15/09/2026 (segunda revisão do dia)

## Para que serve este documento

Responde **onde o projeto está** e **o que vem a seguir**. É reescrito a cada sessão, não acumulado.

Ele é o complemento do `00-log-sessao-planejamento.md`, que responde outra pergunta: **por que** cada decisão foi tomada, com as alternativas rejeitadas. Aquele é append-only e nunca é reescrito. Este é descartável e sempre reflete o presente.

Se você está retomando o projeto, leia este primeiro para saber o estado, e consulte o log de planejamento quando precisar entender o racional de algo que já está decidido.

---

## Estado por componente

| Componente | Estado | Onde vive | O que falta |
|---|---|---|---|
| Documentos de planejamento | Pronto | `docs/01` a `docs/04` | Nada |
| **Repositório-semente** | **Construído, não congelado** | `seed/`, branch `seed-repo` | Revisão humana da árvore e tag `seed-v1` |
| Auditoria da semente | Pronta | `tools/seed-audit/` | Nada |
| Enunciados T1 e T2 | Versionados | `tasks/` | Congelamento em M3 |
| Pontos de decisão de T2 | Escritos, nunca testados | `docs/02`, seção 2.4 | Validar contra saídas reais |
| Testes ocultos de T1 | Não existem | — | Tudo |
| Implementação de referência de T1 | Não existe | — | Tudo. Escrita por agente, com acesso aos testes |
| Script de convenções | Não existe | — | Tudo |
| Prompts do avaliador cego | Não existem | — | Tudo |
| Runner mínimo | Não existe | — | O suficiente para executar uma sessão de ponta a ponta |
| Runner completo | Não existe, sem spec | — | Fica para depois da primeira sessão crua |
| Configuração P1 | Não existe | — | Pode ser escrita já |
| Configuração P2 | Não existe | — | Obrigatória antes da coleta |

**Resumo em uma linha:** a semente está pronta e auditada; nenhum instrumento de medida existe ainda.

## Próximos passos, em ordem

A ordem não é arbitrária. Cada item depende do anterior ou reduz risco de retrabalho.

1. **Spec conjunta dos testes ocultos e da implementação de referência.** Os dois são o mesmo instrumento visto de dois lados e não fazem sentido separados.
2. **Escrever os testes ocultos de T1**, a partir do enunciado apenas.
3. **Escrever a implementação de referência de T1**, por agente, com acesso aos testes. Prova que a suíte é satisfazível e fixa o mínimo aceitável.
4. **Runner mínimo:** preparar a cópia de trabalho, executar o agente com o enunciado, aplicar os testes ocultos. Só isso.
5. **Primeira sessão crua de ponta a ponta em T1**, sem contexto nenhum. É o dado mais importante desta fase. Responde se o enunciado sozinho basta, se as métricas fazem sentido extraídas de uma sessão real, e se há efeito teto.
6. **Corrigir o que a sessão crua revelar**, seja no enunciado, nos testes, na semente ou no runner.
7. **Script de convenções**, oito regras, sobre o diff.
8. **Duas soluções de sondagem para T2**, deliberadamente diferentes, para testar se os dez pontos de decisão são classificáveis e calibrar o prompt do classificador.
9. **Prompts do avaliador cego**, checklist e classificador.
10. **Configurações P1 e P2.**
11. **Runner completo**, com todas as métricas.
12. **Revisão humana da árvore e tag `seed-v1`.** Saiu do caminho crítico, mas continua obrigatória antes da coleta.
13. **Piloto (M3).**

O item 10 pode ser antecipado a qualquer momento: as convenções já existem no código, então escrever P1 é trabalho mecânico.

**O que mudou nesta ordem e por quê.** A prioridade passou a ser chegar a uma sessão crua de ponta a ponta antes de qualquer cerimônia. Essa sessão é o dado mais importante desta fase, porque informa se a coleta está correta e se há algo na semente ou nos testes que trave a execução. Isso tira o congelamento do caminho crítico e substitui "spec completa do runner" por "runner mínimo", realinhando o projeto com a definição original de M2, que sempre foi uma sessão executada do início ao fim.

## Itens em aberto

**De metodologia:**
- Os dez pontos de decisão de T2 nunca foram testados contra nenhuma saída. O item 8 acima é o que resolve.
- As sete perguntas do checklist do avaliador cego foram escritas antes de a semente existir, e nunca foram reconferidas contra ela. As regras de convenção passaram por essa reconferência e quatro das nove estavam mal calibradas. As perguntas precisam do mesmo tratamento antes de virarem prompt.
- A pergunta 1 do checklist mede aderência ao padrão canônico, não qualidade em sentido amplo, porque a semente tem um módulo que deliberadamente não possui camada de serviço. Precisa ser rotulada assim no artigo.

**Administrativos, abertos desde a rodada 1 do planejamento:**
- Valor do orçamento de API, e custo por sessão.
- Marketplace de destino do plugin.
- Revisão de literatura para trabalhos relacionados. Nenhuma foi feita.
- Nomes dos integrantes e quem faz a revisão humana da árvore.

## Situação de cronograma

| Marco | Data | Situação |
|---|---|---|
| M1 — protocolo aplicável | 06/09 | Concluído com atraso |
| M2 — primeira sessão de ponta a ponta | 13/09 | **Atrasado.** Semente pronta; testes ocultos e runner não existem |
| M3 — piloto aprovado | 20/09 | Em risco |
| M5 — pré-defesa | 03/10 | Data fixa, não negociável |

O gargalo deixou de ser horas da equipe e passou a ser tempo de sessão e orçamento de API. A semente inteira foi construída em uma sessão dirigida por agente. O runner é maior, mas o mesmo método se aplica.

A regra do plano de execução continua valendo e é a que estará sob mais pressão: **se M3 atrasar, tudo desloca junto, e o piloto nunca é abreviado.**

## Marcos pequenos concluídos

Lista curta, só para dar noção de ritmo.

- **09/09** — Spec e plano de implementação do repositório-semente escritos. Protocolo corrigido em cinco seções.
- **10/09** — Semente construída: doze tarefas, dezoito commits, cinquenta e nove testes, imagem de contêiner verificada por dentro. Quatro roteiros de auditoria, todos provados falhando quando devem falhar.
- **15/09** — Enunciados movidos para arquivos versionados. Regra 1 do script de convenções corrigida contra a estrutura real da semente.
- **15/09** — Semente validada por auditoria: vinte itens verificados por comando, serviço saudável de ponta a ponta, sessenta e três testes. Regras de convenção reconferidas contra a semente real; quatro estavam mal calibradas e uma foi removida por exigir análise de sintaxe.
