# Log de Implementação

**Atualizado em:** 15/09/2026

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
| Implementação de referência de T1 | Não existe | — | Tudo |
| Script de convenções | Não existe | — | Tudo |
| Prompts do avaliador cego | Não existem | — | Tudo |
| Runner | Não existe, sem spec | — | Tudo, inclusive a spec |
| Configuração P1 | Não existe | — | Pode ser escrita já |
| Configuração P2 | Não existe | — | Obrigatória antes da coleta |

**Resumo em uma linha:** a semente está pronta e auditada; nenhum instrumento de medida existe ainda.

## Próximos passos, em ordem

A ordem não é arbitrária. Cada item depende do anterior ou reduz risco de retrabalho.

1. **Validar a semente pelo checklist**, executado por agente e com comandos, nunca por leitura de código. `tools/seed-audit/CHECKLIST.md`. Inclui subir o serviço e exercitar as rotas.
2. **Revisão humana da árvore e tag `seed-v1`.** É o único item que não pode ser feito por agente, e trava todo o resto.
3. **Escrever os testes ocultos de T1**, a partir do enunciado apenas, sem olhar para nenhuma implementação.
4. **Escrever a implementação de referência de T1**, por quem não viu os testes ocultos. Serve para falsificar o enunciado e a suíte, não para definir a resposta certa.
5. **Rodar uma sessão de agente cru em T1**, sem contexto nenhum, como sonda de efeito teto. Se um agente sem harness já passa em quase tudo, T1 precisa endurecer antes do piloto.
6. **Escrever duas soluções de sondagem para T2**, deliberadamente diferentes entre si, para testar se os dez pontos de decisão são classificáveis e para calibrar o prompt do classificador.
7. **Script de convenções**, nove regras, sobre o diff.
8. **Prompts do avaliador cego**, checklist e classificador, calibrados com os diffs dos itens 4, 5 e 6.
9. **Spec do runner**, depois plano, depois construção. É o maior risco de cronograma do projeto.
10. **Configurações P1 e P2.**
11. **Piloto (M3).**

O item 10 pode ser antecipado a qualquer momento: as convenções já existem no código, então escrever P1 é trabalho mecânico.

## Itens em aberto

**De metodologia:**
- O cabeçalho do enunciado de T1 traz o rótulo `T1`, enquanto o de T2 traz um identificador realista de ticket. Decidir antes de M3 se T1 também recebe um identificador realista, para que os dois pareçam itens de backlog e não itens de um experimento.
- Os dez pontos de decisão de T2 nunca foram testados contra nenhuma saída. O item 6 acima é o que resolve.

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
