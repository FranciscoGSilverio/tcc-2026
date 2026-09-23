# Log de Implementação

**Atualizado em:** 22/09/2026 (quarta revisão)

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
| Pontos de decisão de T2 | **Validados contra três saídas reais em 22/09.** Oito dos dez são vivos; os pontos 5 (limite de horário) e 7 (fuso) voltaram `ausente` nas três | `docs/02`, seção 2.4 | Decisão sobre como reportar os dois pontos inertes — proposta é relato duplo, sem cortá-los |
| Testes ocultos de T1 | **Prontos, sem alteração.** 26 asserções, linha de base 13/26 | `hidden-tests/T1/run.mjs` | Nada |
| Implementação de referência de T1 | **Pronta, sem alteração.** 26/26, zero regressões | `reference/T1/` | Nada |
| **Script de convenções** | **Construído.** Oito regras da seção 2.6; zero violações contra a referência, dispara nas cinco regras esperadas contra uma cópia deliberadamente violadora | `tools/convention-check/` | Nada |
| **Avaliador cego** | **Construído e rodado contra as cinco sessões coletadas.** Checklist (6 perguntas) e pontos de decisão (10), uma passagem por instrumento, cego à condição | `tools/blind-evaluator/` | Conjunto rotulado à mão para medir concordância com humano (D3) — os diffs de T2 agora existem, então deixou de estar bloqueado |
| Runner mínimo | **Construído e provado em cinco sessões reais** (duas de T1, três de T2). Aplica contexto, grava `violacoes`, e recusa combinação de tarefa/contexto/ordem que não implemente | `runner/` | Sequência O2 |
| Runner completo | Não existe, sem spec | — | Fica para depois das sessões P0/P1 de T1 |
| **Configuração P1** | **Construída.** Política de domínio de reservas + as oito regras de convenção em linguagem natural + arquitetura, nomenclatura e comandos | `contexts/P1/CLAUDE.md` | Nada para esta rodada |
| Configuração P2 | Não existe | — | **Próximo item.** Obrigatória antes da coleta que compara P0/P1/P2 |
| Sequência O2 | Não existe; o runner recusa `--o O2` em vez de simular | `runner/lib/capabilities.mjs` | **Próximo item.** Quatro chamadas encadeadas, prompts já escritos na seção 3.3 |

**Resumo em uma linha:** semente, instrumentos de T1 e T2, script de convenções, contexto de P1, runner e avaliador cego prontos e provados em cinco sessões reais — duas de T1 (P0 e P1) e uma célula completa de T2 com três execuções; falta o plugin de P2 e a sequência O2, que juntos destravam as seis células da grade.

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

## Custo por sessão, medido para as duas tarefas

Cinco sessões reais coletadas dão, pela primeira vez, custo por tarefa em vez de um número único:

| | Sessões | Custo médio | Turnos |
|---|---|---|---|
| T1 | 2 (P0, P1) | **US$ 0,44** | 30, 31 |
| T2 | 3 (P0, mesma célula) | **US$ 0,67** | 34, 43, 37 |

T2 custa cerca de **52% mais** que T1, confirmando a previsão de que uma tarefa sem suíte de testes como critério de parada consome mais turnos. Qualquer extrapolação de orçamento precisa usar os dois números separadamente, não a média dos cinco.

Acumulado até 22/09: **US$ 2,88** em sessões, **US$ 0,22** em avaliação cega, **US$ 0,06** na sonda de turnos.

O orçamento deixou de ser teto rígido por decisão do orientando em 22/09 — vinte dólares é referência de custo-efetividade, e mais crédito é comprado se o protocolo justificar. O que continua em aberto é a projeção completa, que agora depende de quantas células de modelo e quantas réplicas a grade final terá.

## Descoberta: `temperature` é rejeitada por Sonnet 5

Registrada em 21/09/2026, ao planejar o avaliador cego. Uma chamada real à API `POST /v1/messages` com `claude-sonnet-5` devolve **erro 400** para `temperature`, `top_p` e `top_k` — mensagem de erro no formato "`<parâmetro>` is deprecated for this model", reconfirmada empiricamente em 22/09/2026 antes de escrever `tools/blind-evaluator/lib/client.mjs`. A spec do avaliador cego previa originalmente `temperature: 0` como a peça que tornaria a reexecução do instrumento estável (decisão D2); isso foi descartado, e a justificativa de não usar votação por maioria (D1) passou a repousar inteiramente em D3 — confiabilidade medida contra classificação humana, não contra si mesmo. Não existe hoje alavanca de determinismo de amostragem disponível via API para este modelo.

## Descoberta: o limite de turnos nunca foi um teto efetivo

Registrada em 22/09/2026, ao planejar O2. `--max-turns N` **não limita `num_turns` a N** — as duas grandezas não contam a mesma unidade. Sonda direta: `--max-turns 3` devolveu `num_turns = 6`, `stop_reason = end_turn`, `subtype = success`, ou seja terminou sozinha sem ser cortada. Nas cinco sessões reais coletadas sob `--max-turns 40`, os turnos foram 30, 31, 34, 37 e 43 — uma delas acima do suposto teto, nenhuma interrompida.

`num_turns` conta idas e voltas da conversa: em todas as sessões conferidas ele bate com o número de mensagens de usuário mais um, e cada resultado de ferramenta volta como mensagem de usuário.

A decisão, tomada pelo orientando na mesma data: **o limite sempre foi rede de segurança contra laço infinito, nunca medida de qualidade ou de esforço do agente.** Corrigiu-se a redação do protocolo em quatro lugares — seção 3.4 (o limite sai da lista de constantes), seção 5.1 (`travou`), passo 3 da seção 6, e a linha de orçamento computacional desigual da seção 8. Nada no desenho mudou: `n_turns` já era dado observado e a comparação de esforço entre O1 e O2 já estava ancorada em custo.

Em O2, cada uma das quatro chamadas recebe a mesma rede de 40 e `n_turns` da sessão é a soma das quatro.

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
9. ~~**Rodar uma sessão P0 e uma sessão P1 de T1 sob o enunciado novo**~~, para confirmar que o gradiente declarado na spec de reavaliação aparece de fato. Rodado em 18/09 (`T1-P0-O1-mu69pgsx`, `T1-P1-O1-mu69tn5j`), registrado em `resultados.csv`.
10. ~~**Duas soluções de sondagem para T2**, deliberadamente diferentes, para testar se os dez pontos de decisão são classificáveis.~~ **Substituído por três sessões reais de T2** em 22/09, por decisão registrada: sondagens escritas conhecendo as dez categorias as contemplariam por construção, e o buraco que existe — pontos 5 e 7 inertes — ficaria invisível. Resultado em `docs/superpowers/2026-09-22-execucao-t2-piloto.md`: convergência 5/10 sobre os pontos congelados e 3/8 sobre os vivos; verificação 9 do portão passa, verificação 8 falha por dois pontos.
11. ~~**Prompts do avaliador cego**, checklist e classificador.~~ Feito em 22/09: `tools/blind-evaluator/`, checklist de seis perguntas e os dez pontos de decisão, chamada direta à API sem parâmetro de amostragem.
12. **Configuração P2** (plugin), com o mesmo conteúdo de domínio de P1.
13. **Sequência O2** (pipeline segmentado de quatro chamadas).
14. **Conjunto rotulado à mão** sobre diffs reais de T2, para medir a concordância entre o avaliador cego e uma classificação humana (spec do avaliador cego, decisão D3). Depende do item 10 — precisa de diffs reais de T2 para existir.
15. **Decisão sobre o orçamento**, à luz do custo por sessão medido.
16. **Revisão humana da árvore e tag `seed-v1`.** Fora do caminho crítico, mas continua obrigatória antes da coleta.
17. **Piloto (M3).**

## Itens em aberto

**De metodologia:**
- Os dez pontos de decisão de T2 nunca foram testados contra nenhuma saída. O item 10 acima é o que resolve.
- ~~As sete perguntas do checklist do avaliador cego foram escritas antes de a semente existir, e nunca foram reconferidas contra ela.~~ Resolvido em 21-22/09: a pergunta 7 foi retirada por ser redundante com `regressoes` (decisão D8), o checklist passou a ter seis perguntas, e a pergunta 6 passou a receber o conteúdo congelado de `src/shared/` e `src/plugins/` como material de referência (decisão D9), lido diretamente do commit da semente. O que continua em aberto é a validação empírica do prompt contra diffs reais de T2 — o conjunto rotulado do item 14 acima.
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
| M3 — piloto aprovado | 20/09 | **Em risco, data já passada.** Sessões P0/P1 de T1 e avaliador cego prontos; depende ainda do plugin de P2, da sequência O2 e da decisão de orçamento |
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
- **18/09** — Primeiras sessões reais de T1 sob o enunciado novo coletadas: `T1-P0-O1-mu69pgsx` e `T1-P1-O1-mu69tn5j`, registradas em `resultados.csv`.
- **21-22/09** — Avaliador cego construído: `capabilities.mjs` ganhou `decisionPoints` por tarefa; `dataset.mjs` ganhou `readRows`/`updateRow` para gravar em linhas já existentes; os dez pontos de decisão e o material de referência de `src/shared/`/`src/plugins/` viraram dado testável; os prompts do checklist (seis perguntas, a sétima retirada por decisão D8) e dos pontos de decisão foram congelados; a resposta do modelo é validada sem aproximação, categoria fora da lista fechada aborta a avaliação (D7); o cliente HTTP confirma empiricamente que `temperature`/`top_p`/`top_k` são rejeitados com erro 400 por `claude-sonnet-5` e nunca os envia; o CLI `evaluate.mjs` orquestra tudo, com `--dry-run` para inspecionar o prompt sem gastar.
