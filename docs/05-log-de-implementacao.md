# Log de Implementação

**Atualizado em:** 17/09/2026 (terceira revisão)

## Para que serve este documento

Responde **onde o projeto está** e **o que vem a seguir**. É reescrito a cada sessão, não acumulado.

Ele é o complemento do `00-log-sessao-planejamento.md`, que responde outra pergunta: **por que** cada decisão foi tomada, com as alternativas rejeitadas. Aquele é append-only e nunca é reescrito. Este é descartável e sempre reflete o presente.

Se você está retomando o projeto, leia este primeiro para saber o estado, e consulte o log de planejamento quando precisar entender o racional de algo que já está decidido.

---

## Estado por componente

| Componente | Estado | Onde vive | O que falta |
|---|---|---|---|
| Documentos de planejamento | Pronto | `docs/01` a `docs/04` | Nada |
| **Repositório-semente** | **Construído, auditado, não congelado** | `seed/`, branch `seed-repo` | Revisão humana da árvore e tag `seed-v1` |
| Auditoria da semente | Pronta | `tools/seed-audit/` | Nada |
| Enunciado de T1 | **Reescrito em 17/09** (versão 2, seção 4 da spec de reavaliação) | `tasks/T1-validacao-de-reservas.md` | Congelamento em M3 |
| Enunciado de T2 | Versionado, inalterado | `tasks/T2-res-142.md` | Congelamento em M3 |
| Pontos de decisão de T2 | Escritos, nunca testados | `docs/02`, seção 2.4 | Validar contra saídas reais |
| Testes ocultos de T1 | **Prontos, sem alteração.** 26 asserções, linha de base 13/26 | `hidden-tests/T1/run.mjs` | Nada |
| Implementação de referência de T1 | **Pronta, sem alteração.** 26/26, zero regressões | `reference/T1/` | Nada |
| **Script de convenções** | **Construído.** Oito regras da seção 2.6; zero violações contra a referência, dispara nas cinco regras esperadas contra uma cópia deliberadamente violadora | `tools/convention-check/` | Nada |
| Prompts do avaliador cego | Não existem | — | Tudo |
| Runner mínimo | **Construído, provado por sessões falsas e por uma sessão real (P0).** Agora também aplica contexto (`applyContext`) e grava `violacoes` | `runner/` | Rodar a primeira sessão P1 real (Tarefa 8, fora do escopo desta rodada) |
| Runner completo | Não existe, sem spec | — | Fica para depois das sessões P0/P1 de T1 |
| **Configuração P1** | **Construída.** Política de domínio de reservas + as oito regras de convenção em linguagem natural + arquitetura, nomenclatura e comandos | `contexts/P1/CLAUDE.md` | Nada para esta rodada |
| Configuração P2 | Não existe | — | Obrigatória antes da coleta que compara P0/P1/P2 |

**Resumo em uma linha:** semente, instrumento de T1, script de convenções, contexto de P1 e runner completo até a coluna `violacoes` prontos e provados; enunciado de T1 reescrito para dar ao fator de contexto um canal mensurável; falta rodar as sessões P0 e P1 de T1 sob o enunciado novo (Tarefa 8, deliberadamente fora do escopo desta rodada de implementação por gastar orçamento real).

## Por que o enunciado de T1 mudou

A primeira sessão real de ponta a ponta (`T1-P0-O1-mu4t4rvp`, 16/09) saturou `taxa_aceitacao` em 1.0 mesmo sem nenhum contexto. O enunciado antigo era informacionalmente autossuficiente: mapeava regra a regra nas asserções da suíte oculta, então P0, P1 e P2 recebiam a mesma informação por construção e o fator de contexto não tinha canal para se expressar. O enunciado foi reduzido à necessidade de negócio; a política de domínio (semântica de borda, limites de duração, proibição de passado, exigência de existência, alcance sobre a atualização) migrou para `contexts/P1/CLAUDE.md`, e o mesmo conteúdo vai para o plugin de P2 quando ele existir. O contrato medido pela suíte oculta não mudou — 26 asserções, linha de base 13/26, referência 26/26 — só o enunciado parou de entregá-lo de graça. Detalhe completo em `docs/superpowers/specs/2026-09-17-reavaliacao-de-t1-design.md` e na rodada 9 de `docs/00-log-sessao-planejamento.md`.

A sessão piloto, por ter medido o enunciado antigo, não é comparável com as sessões seguintes: saiu de `resultados.csv` e passou para `resultados-piloto.csv`, sem ser descartada.

## Ambiente de execução (registrado a partir da sessão piloto)

- Repositório de artefatos: `github.com/FranciscoGSilverio/tcc-2026`, **privado** até o fim da coleta.
- Chave de API: em `.env` na raiz, **fora do versionamento**.
- Orçamento: vinte dólares em créditos comprados.
- CLI do agente: versão 2.1.272, fixada na imagem de sessão (`runner/Dockerfile.session`).
- Execução: contêiner da imagem de sessão, agente sem privilégio de root (usuário `node`).

**Sobre a coluna `model_version`:** ela guarda exatamente o que o CLI do agente reporta no evento `system/init`, sem transformação. Para modelos identificados por um apelido como `claude-sonnet-5`, o CLI não expõe a versão datada correspondente (do tipo `claude-sonnet-5-20260115`) em nenhum campo do transcript — isso é limitação da fonte de dados, não campo mal preenchido pelo runner. A coluna separada `model` guarda o apelido pedido na chamada, que é sempre conhecido.

## Custo por sessão, e por que precisa de decisão

A única medição real disponível é a sessão piloto: US$ 0,4209743 para uma sessão T1/P0. Extrapolado para as 55 sessões da grade principal (seção 4.2 do protocolo) ao mesmo custo por sessão, o total fica em torno de **US$ 23,15** contra **US$ 20** comprados — já insuficiente sem contar as vinte sessões adicionais de células de modelo da seção 4.4, nem T2, cujo custo por sessão ainda não foi medido (mais turnos esperados por não ter testes automáticos como critério de parada). Este ponto já estava em aberto antes desta rodada e continua em aberto: precisa de decisão sobre reforço de orçamento, redução de réplicas ou algum outro corte, antes de a coleta da grade principal começar.

## Próximos passos, em ordem

A ordem não é arbitrária. Cada item depende do anterior ou reduz risco de retrabalho.

1. ~~**Spec conjunta dos testes ocultos e da implementação de referência.**~~ Escrita em 15/09.
2. ~~**Escrever os testes ocultos de T1.**~~ Feito em 15/09. Linha de base medida em 13 de 26.
3. ~~**Escrever a implementação de referência de T1.**~~ Feita em 15/09. Marca 26 de 26, zero regressões.
4. ~~**Runner mínimo.**~~ Feito em 16/09. Provado por três sessões falsas, sem gastar orçamento.
5. ~~**Primeira sessão crua de ponta a ponta em T1**, sem contexto nenhum.~~ Rodada em 16/09 (`T1-P0-O1-mu4t4rvp`). Revelou efeito teto e o defeito de `model_version`.
6. ~~**Corrigir o que a sessão crua revelou.**~~ Feito em 17/09: `model_version` corrigido (Tarefa 1), enunciado de T1 reduzido à necessidade de negócio (Tarefa 2).
7. ~~**Script de convenções**, oito regras, sobre o diff.~~ Feito em 17/09.
8. ~~**Configuração P1.**~~ Feita em 17/09, com a política de domínio e as oito regras em linguagem natural.
9. **Rodar uma sessão P0 e uma sessão P1 de T1 sob o enunciado novo**, para confirmar que o gradiente declarado na spec de reavaliação aparece de fato. Gasta orçamento real; deliberadamente adiado desta rodada de implementação para revisão humana antes de rodar.
10. **Duas soluções de sondagem para T2**, deliberadamente diferentes, para testar se os dez pontos de decisão são classificáveis e calibrar o prompt do classificador.
11. **Prompts do avaliador cego**, checklist e classificador.
12. **Configuração P2** (plugin), com o mesmo conteúdo de domínio de P1.
13. **Runner completo**, com a métrica `qualidade` do avaliador cego.
14. **Decisão sobre o orçamento**, à luz do custo por sessão medido.
15. **Revisão humana da árvore e tag `seed-v1`.** Fora do caminho crítico, mas continua obrigatória antes da coleta.
16. **Piloto (M3).**

## Itens em aberto

**De metodologia:**
- Os dez pontos de decisão de T2 nunca foram testados contra nenhuma saída. O item 10 acima é o que resolve.
- As sete perguntas do checklist do avaliador cego foram escritas antes de a semente existir, e nunca foram reconferidas contra ela. As regras de convenção já passaram por essa reconferência duas vezes — contra a estrutura da semente e, nesta rodada, contra o formato real do diff de sessão e da referência. As perguntas do avaliador precisam do mesmo tratamento antes de virarem prompt.
- **A suíte oculta e a implementação de referência foram escritas pelo mesmo agente.** A referência prova consistência interna, não que um leitor independente consegue satisfazer a suíte. A sessão de agente cru sob o enunciado antigo era a compensação prevista para isso e saturou — a compensação real passa a ser a comparação P0/P1 sob o enunciado novo, que ainda não foi coletada.
- A pergunta 1 do checklist do avaliador cego mede aderência ao padrão canônico, não qualidade em sentido amplo, porque a semente tem um módulo (`amenities`) que deliberadamente não possui camada de serviço. Precisa ser rotulada assim no artigo.
- **O agente em P0 é avaliado contra regras de domínio não informadas a ele**, por decisão D3 da spec de reavaliação — é o tratamento, não um descuido, mas é o ponto mais atacável do desenho e precisa ser declarado como tal no artigo.
- **A folga do fator modelo não foi verificada.** Nenhuma sessão comparou modelos até aqui; só é sabido quando as células de modelo da seção 4.4 forem coletadas.

**Administrativos, abertos desde a rodada 1 do planejamento:**
- Valor do orçamento de API frente ao custo medido por sessão — ver seção "Custo por sessão" acima, que quantifica o problema pela primeira vez.
- Marketplace de destino do plugin.
- Revisão de literatura para trabalhos relacionados. Nenhuma foi feita.
- Nomes dos integrantes e quem faz a revisão humana da árvore.

## Situação de cronograma

| Marco | Data | Situação |
|---|---|---|
| M1 — protocolo aplicável | 06/09 | Concluído com atraso |
| M2 — primeira sessão de ponta a ponta | 13/09 | Concluído com atraso em 16/09, e revelou efeito teto — a reavaliação desta rodada é a correção |
| M3 — piloto aprovado | 20/09 | **Em risco.** Depende ainda das sessões P0/P1 de T1 (item 9), do plugin de P2, do avaliador cego e da decisão de orçamento |
| M5 — pré-defesa | 03/10 | Data fixa, não negociável |

O gargalo continua sendo tempo de sessão e orçamento de API, não horas da equipe. A semente inteira e o script de convenções foram construídos em sessões dirigidas por agente.

A regra do plano de execução continua valendo e é a que estará sob mais pressão: **se M3 atrasar, tudo desloca junto, e o piloto nunca é abreviado.**

## Marcos pequenos concluídos

Lista curta, só para dar noção de ritmo.

- **09/09** — Spec e plano de implementação do repositório-semente escritos. Protocolo corrigido em cinco seções.
- **10/09** — Semente construída: doze tarefas, dezoito commits, cinquenta e nove testes, imagem de contêiner verificada por dentro. Quatro roteiros de auditoria, todos provados falhando quando devem falhar.
- **15/09** — Enunciados movidos para arquivos versionados. Regra 1 do script de convenções corrigida contra a estrutura real da semente.
- **15/09** — Semente validada por auditoria: vinte itens verificados por comando, serviço saudável de ponta a ponta, sessenta e três testes. Regras de convenção reconferidas contra a semente real; quatro estavam mal calibradas e uma foi removida por exigir análise de sintaxe.
- **15/09** — Suíte oculta de T1 escrita e medida contra a semente intocada: vinte e seis asserções, **treze aprovadas**, exatamente metade, confirmando a previsão do plano regra por regra. Isso importa porque a faixa real de `taxa_aceitacao` começa nesse valor e não em zero: uma sessão que pontue a linha de base não fez nada.
- **15/09** — Suíte oculta de T1 pronta: 26 asserções, linha de base de 13 contra a semente intocada, batendo com a previsão do plano regra por regra. Implementação de referência marcando 26 de 26 com zero regressões, verificável do zero por roteiro próprio.
- **16/09** — Corrigido um defeito não enumerado da semente: o tratador de erro descartava o status que o Fastify já definia, devolvendo erro interno onde cabia 400. Os cinco defeitos deliberados sobreviveram e a linha de base não se moveu.
- **16/09** — Runner mínimo construído e provado por três sessões falsas, sem gastar orçamento: uma que não faz nada pontua a linha de base, uma que aplica a referência pontua o máximo, e uma que quebra a aplicação é **registrada como dado com nota zero** em vez de descartada, que era a propriedade mais cara de errar.
- **16/09** — Primeira sessão real de ponta a ponta rodada (`T1-P0-O1-mu4t4rvp`, T1/P0). `taxa_aceitacao` saturou em 1.0, revelando efeito teto e um defeito de instrumentação em `model_version`.
- **17/09** — Reavaliação de T1: `model_version` corrigido para identificar o modelo por volume de tokens de saída; enunciado de T1 reduzido à necessidade de negócio; script de convenções das oito regras da seção 2.6 construído e ligado ao runner (coluna `violacoes`); `contexts/P1/CLAUDE.md` escrito com a política de domínio e as oito regras em linguagem natural, aplicado à cópia de trabalho antes do commit inicial da sessão; sessão piloto arquivada em `resultados-piloto.csv`, `resultados.csv` reiniciado vazio com o mesmo cabeçalho de 41 colunas.
