# Reavaliação de T1 — design

**Data:** 2026-09-17
**Motivo:** a primeira sessão real de ponta a ponta saturou a variável-resposta principal de T1.
**Protocolo afetado:** `docs/02-protocolo-experimental.md`, seções 2.2, 3.2, 5.1 e 8.

---

## 1. O que a sessão piloto mediu

Sessão `T1-P0-O1-mu4t4rvp`, executada em 16/09/2026, primeira execução real do runner de ponta a ponta.

| Campo | Valor |
|---|---|
| Condição | T1, P0, O1, Sonnet 5 |
| `taxa_aceitacao` | **1.0** — 26 de 26 asserções |
| `regressoes` | 0 |
| `travou` | falso nas três causas |
| `n_turns` | 30, de um limite de 40 |
| `n_tool_calls` | 29 |
| `custo_usd` | 0,4209743 |
| `duracao_s` | 164 |
| Diff | 247 linhas |

Ambiente de execução: repositório privado `github.com/FranciscoGSilverio/tcc-2026`; chave de API em `.env` na raiz, fora do versionamento; vinte dólares em créditos; CLI do agente na versão 2.1.272; contêiner da imagem de sessão, agente sem privilégio de root.

**Um defeito de instrumentação foi encontrado nesta sessão e ainda não está corrigido.** A coluna `model_version` registrou `claude-haiku-4-5-20251001`, mas quem executou a sessão foi Sonnet 5. O leitor de transcript toma a primeira chave do mapa de uso por modelo, e o CLI reporta também um modelo auxiliar. A conferência pelos tokens não deixa dúvida: Sonnet produziu 14.813 tokens de saída e 0,4196 do custo; o auxiliar produziu 17 tokens e 0,0013. Como o modelo é fator do experimento, isso é defeito de integridade de dado e precisa ser corrigido antes de qualquer sessão nova.

---

## 2. Diagnóstico

A sessão foi executada na célula mais pobre da grade — nenhum arquivo de contexto, chamada única — e tirou nota máxima. Quatro causas foram levantadas e verificadas contra a evidência.

**O enunciado era informacionalmente autossuficiente, e esta é a causa principal.** As regras numeradas do enunciado de T1 mapeavam uma a uma nos prefixos das asserções da suíte oculta: a regra 1 do texto correspondia às checagens 1.x, a regra 4 às 4.x, e assim por diante. O enunciado era o plano de teste transcrito. Ele entregava ainda as duas únicas decisões reais: a semântica de borda, que é exatamente o que as checagens 1.5 e 1.6 medem, e os códigos de status 400, 404 e 409, que são decisão de projeto e estavam dados. A consequência é estrutural: tudo que um `CLAUDE.md` ou um plugin poderiam acrescentar já estava dentro do prompt, logo P0, P1 e P2 recebiam a mesma informação por construção. O fator de contexto não tinha por onde se expressar, e isso valeria mesmo que a tarefa fosse muito mais difícil.

**A variável medida era cega ao fator, e esta causa é co-principal.** A seção 2.1 do protocolo declara, a respeito do módulo desviante `amenities`, que "nada no código declara qual padrão é o vigente. Isso é o que dá valor mensurável ao mapa que P1 fornece". O canal previsto para o efeito de contexto sempre foi a **aderência**, e P1 é definido na seção 3.2 como arquitetura em camadas, convenções de nomenclatura, comandos e as regras da seção 2.6 — engenharia, sem uma linha de regra de negócio. A seção 5.1 declara três variáveis-resposta aplicáveis a T1: `taxa_aceitacao`, `violacoes` e `qualidade`. Construiu-se apenas a primeira, que é a única cega ao fator P.

**A faixa útil era menor do que a escala sugeria.** Das 26 asserções, 13 já passavam na semente intocada. Das 13 restantes, o relatório da referência registra que a regra 2 já era verdadeira por construção e a regra 7 saía de graça. Restavam cinco mudanças independentes de código — fórmula de sobreposição, duração, ordem, passado e existência. O instrumento reportava com duas casas decimais uma grandeza de cinco bits.

**A operação é canônica, e isto não é corrigível.** Detecção de sobreposição de intervalos é um dos problemas mais representados em dado de treino; a fórmula é recall, não raciocínio. Trocar o domínio por algo exótico compraria dificuldade ao custo da validade ecológica que o trabalho precisa. Fica registrado como limitação, não como defeito a consertar.

**Hipótese descartada: volume da semente.** A semente tem 942 linhas de código de produção e o agente leu treze arquivos sem esforço. Mas a implementação de referência toca três arquivos, todos dentro de `src/modules/bookings/`, sem nenhum acoplamento novo entre módulos. Acrescentar módulos não mudaria isso: a tarefa continuaria confinada. Volume só vira dificuldade quando a tarefa obriga o agente a encontrar algo distante; acrescentar volume sem acrescentar descoberta obrigatória faz o agente ler mais e pontuar igual.

**Consequência sobre o fator M.** A sessão executou trinta turnos numa mudança de quatro arquivos, sem retrocesso e sem hipótese descartada. Uma tarefa em que um modelo mais forte não pontua melhor não tem folga para o fator modelo se expressar. O enunciado antigo, portanto, comprometia dois dos três fatores, e não apenas o contexto. Isso põe em risco o contraste da seção 4.2 entre Haiku com harness completo e Opus sem harness, que a seção 6.4 identifica como a comparação central do artigo.

---

## 3. Decisões

**D1. A política de domínio sai do enunciado e passa a viver em P1 e P2.** O enunciado de T1 guarda a necessidade de negócio; os detalhes de política que ninguém adivinha — semântica de borda, limites de duração, efeito do cancelamento, proibição de passado, exigência de existência, alcance sobre operações de alteração — passam a ser conteúdo de contexto. É esta lacuna de informação que dá ao fator P um canal na taxa de aceitação.

**D2. A política de domínio entra em P1 e P2 igualmente, não só no nível mais alto.** Se P1 recebesse apenas estrutura e P2 recebesse estrutura mais negócio, os dois níveis passariam a diferir em duas dimensões ao mesmo tempo e nenhum resultado seria atribuível a uma delas. Mantida nos dois, a comparação P0 contra P1 mede o harness como um todo, e P1 contra P2 isola o que os procedimentos passo a passo acrescentam, que é a pergunta que a seção 3.2 já pretendia fazer.

**D3. O agente em P0 é medido contra regras que não lhe foram informadas.** Decisão explícita do orientando, tomada em 17/09/2026, com ciência de que é o ponto mais atacável do desenho. A justificativa é que isto **é** o tratamento: mede-se o desenvolvedor que cai num projeto sem documentação, que é a situação que o harness existe para remediar. A alternativa — informar todos os níveis igualmente — reproduz o enunciado autossuficiente e devolve o efeito teto. Fica registrada aqui para ser defendida, não descoberta.

**D4. O script de convenções da seção 2.6 é construído e passa a rodar também em T1.** Não é instrumento novo: `violacoes` já é métrica declarada para as duas tarefas na seção 5.1, e as colunas já existem no dataset. É dívida de implementação, não ampliação de escopo.

**D5. A tarefa continua incremental. Reconstruir o módulo do zero fica recusado por ora.** É a direção metodologicamente certa para o fator M e colide com duas restrições declaradas. O limite de quarenta turnos da seção 3.4 não comporta a construção de um módulo inteiro, e o custo por sessão subiria de quarenta e dois centavos para cerca de um dólar e meio, levando as 55 sessões para além de setenta dólares contra vinte comprados. Some o risco de sessões invalidadas por estouro de turno, que custam dinheiro e não produzem dado.

**D6. O tamanho de T1 e a folga do fator M ficam como questão aberta com data.** A seção 4.4 coleta as vinte sessões de células de modelo depois da pré-defesa; as trinta da grade principal não dependem delas. A decisão é revisitada quando as células de modelo forem devidas, com os dados das primeiras sessões em mãos.

**D8. Nada que seja disciplina de engenharia entra no enunciado.** Instruções do tipo "não quebre o que já funciona", "escreva testes" ou "siga o padrão do projeto" são precisamente o conteúdo que distingue os níveis de P. Postas no enunciado, são entregues igualmente a todos e suprimem a variação que os instrumentos existem para capturar. O enunciado carrega necessidade de negócio e nada mais.

**D7. A semente não é alterada.** Ela é compartilhada pelas duas tarefas, já foi auditada, tem linha de base medida e tem o defeito parcial de que T2 depende. Nenhuma das decisões acima exige tocá-la.

---

## 4. T1 versão 2 — enunciado

Texto exato que o agente recebe, substituindo integralmente o conteúdo de `tasks/T1-validacao-de-reservas.md`:

> **T1 — Regras de validação de reservas**
>
> A API de reservas está aceitando pedidos que não deveria aceitar. A reclamação concreta é que duas pessoas conseguem reservar a mesma sala no mesmo horário. Há suspeita de que outros pedidos inválidos também estejam passando.
>
> Faça a API de reservas recusar os pedidos inválidos.
>
> Não há canal para dúvidas nesta execução. Decida e implemente.

**O que saiu, e por quê.** Saíram os códigos de status, porque estão em `src/shared/errors.ts` nos auxiliares `validationFailed`, `notFound` e `bookingConflict`, que os outros módulos já usam — quem procura acha, quem não procura inventa um envelope próprio e falha as checagens 6.x e 7.x. Saiu a semântica de borda, que passa a ser política de domínio. Saíram os limites de duração, o efeito do cancelamento, a proibição de passado e a exigência de existência, todos pela mesma razão. Saiu a frase que declarava que as regras valem também para a atualização, e disso dependem seis asserções — 1.8, 1.9, 1.10, 2.2, 3.2 e 6.3 — quase metade da faixa útil; o agente sem contexto precisa perceber sozinho que o endpoint de alteração existe e que a regra alcança ele. Saiu a estrutura numerada que espelhava os grupos de checagem.

**O que ficou.** A necessidade concreta, para que o agente sem contexto tenha trabalho definido, e a suspeita de que há mais coisa errada, que é o que abre espaço para o zelo do agente se expressar sem que nada lhe seja entregue.

**Uma frase foi cortada depois de escrita, e o motivo importa.** A versão anterior desta spec trazia ainda "não altere comportamento fora do escopo de reservas", herdada da regra 8 do enunciado antigo, justificada como o que daria sentido à medida de regressão. A justificativa estava invertida. `regressoes` mede testes que passavam na semente e falham depois da sessão, e funciona tendo o agente sido avisado ou não — avisar **suprime justamente o comportamento que a métrica existe para capturar**. Permanecer no escopo sem que mandem é disciplina profissional, que é uma das coisas que o harness deve ensinar; posta no enunciado, ela é entregue de graça e em igual medida aos três níveis de P, que é o defeito diagnosticado na seção 2 sobrevivendo num lugar onde não se olhou. A frase era além disso redundante, porque o assunto do enunciado já delimita o escopo, e desalinhava T1 de T2, que não tem cláusula de escopo alguma. O que ela supostamente protegia continua coberto por instrumento: `regressoes` acusa a quebra e a regra 1 do script de convenções acusa arquivo de produção criado fora da estrutura. Medir é preferível a avisar.

**Propriedade preservada, e é importante: o contrato não mudou, só o enunciado parou de entregá-lo.** As 26 asserções da suíte oculta continuam idênticas. A linha de base contra a semente intocada continua 13/26. A implementação de referência continua marcando 26/26 sem alteração. Nenhuma revalidação de instrumento é necessária.

---

## 5. Política de domínio em P1 e P2

Seção acrescentada ao `CLAUDE.md` de P1 e replicada no plugin de P2, redigida como documentação de projeto e não como instrução de tarefa:

> ## Regras de domínio — reservas
>
> Uma reserva ocupa o intervalo entre o início e o fim, incluindo o início e excluindo o fim. Uma sala liberada às 10:00 pode ser reservada a partir das 10:00.
>
> Só reservas ativas ocupam horário. Cancelar uma reserva libera o intervalo imediatamente.
>
> Duas reservas ativas da mesma sala nunca podem ocupar qualquer parte do mesmo intervalo.
>
> Reservas são sempre futuras: o início não pode estar no passado.
>
> A duração vai de 30 minutos a 8 horas, ambos permitidos, e o fim é sempre posterior ao início.
>
> Sala e usuário precisam existir. Pedido que referencie recurso inexistente é tratado como recurso não encontrado, não como erro interno.
>
> Estas regras valem para qualquer operação que crie ou altere a sala ou o horário de uma reserva, não apenas para a criação.

Esta seção é a única fonte, em qualquer nível de contexto, das informações que as checagens 1.5, 1.6, 4.2, 4.4 e as do grupo 6 exigem.

**Restrição de redação, consequência de D8.** O arquivo de contexto descreve a convenção vigente para código novo e **não encomenda faxina no repositório**. A razão é concreta: o módulo `amenities` é desviante de propósito, e um texto que declare a estrutura de quatro camadas como norma universal pode induzir o agente a normalizá-lo, quebrando os testes daquele módulo e fazendo P1 pontuar pior que P0 em regressão. Se isso ocorrer ainda assim, é resultado legítimo e deve ser reportado; o que não pode é ser causado pela redação, porque aí mede-se o texto e não o efeito do contexto.

**Gradiente esperado, declarado antes da coleta para não ser racionalizado depois.** P1 e P2 dispõem de tudo que as 26 asserções exigem e devem tender ao topo. P0 é informado apenas da sobreposição: deve acertar o grosso da regra 1, herdar a regra 2 ao filtrar por reserva ativa, e ganhar de graça as checagens de aceitação 4.1 e 4.3 e a 3.3. Deve falhar 4.2 e 4.4, cujos limites não são deriváveis de lugar nenhum, e fica entregue ao próprio zelo nas checagens de passado, de existência e em todo o caminho de alteração. A expectativa é um resultado na faixa central da escala, contra o topo em P1 e P2. **A diferença esperada é moderada, não dramática**, e parte dela vem de constantes não adivinháveis — razão pela qual `violacoes` e `qualidade` importam tanto quanto a taxa de aceitação neste desenho.

---

## 6. Script de convenções

Implementa a seção 2.6 do protocolo, sem acrescentar nem remover regra. Zero dependências, no mesmo estilo de `hidden-tests/T1/run.mjs`.

**Correção a uma afirmação anterior desta spec.** Uma versão anterior deste documento dizia que o script roda inteiramente no host, "nunca dentro do contêiner". Isso não é implementável para duas das oito regras. As regras 4 e 7 são detectadas rodando o ESLint da semente, e o ESLint precisa do `node_modules` da semente, que existe dentro da imagem e não no host. Seis regras — 1, 2, 3, 5, 6 e 8 — são análise de texto sobre o diff e rodam no host. As regras 4 e 7 rodam o ESLint **dentro do contêiner, com a configuração congelada copiada para dentro**, exatamente como `runner/lib/measure.mjs` já faz com o vitest para contar regressões e com os arquivos de teste congelados. Não há risco de contaminação: o script roda depois de a sessão terminar, quando o agente já não executa.

As oito regras são as da seção 2.6, verbatim. As regras 4 e 7 são detectadas rodando o ESLint da semente com a **configuração congelada**, não com a cópia que o agente pode ter editado, sobre os arquivos que ele alterou — conforme a seção 2.6 já determina. A regra 6 compara contra a cópia congelada dos testes da semente. O reúso do auxiliar `DateString` de `src/shared/schema.ts` não conta como violação da regra 4.

Saída: contagem de violações para a coluna `violacoes`, mais o detalhamento regra a regra, no mesmo formato que a suíte oculta usa para o detalhamento por regra. O detalhamento é o que permite dizer *qual* convenção o contexto ensinou, e sem ele a métrica é um número sem interpretação.

Aplica-se às duas tarefas, como a seção 5.1 já determina.

---

## 7. Consequências para os dados já coletados

A sessão piloto mediu o enunciado antigo e **não é comparável** com o que vier depois. Ela não é descartada — nenhuma sessão é, por princípio declarado no protocolo — mas sai do dataset de coleta e passa a `resultados-piloto.csv`, com registro do motivo. O dataset de coleta recomeça vazio, com o mesmo cabeçalho de 41 colunas, que não muda.

Nenhuma coluna é acrescentada. `violacoes` e `qualidade` já existem e estavam vazias.

---

## 8. Emendas ao protocolo

**Seção 2.2** passa a descrever T1 como tarefa cuja política de domínio reside no contexto, não no enunciado, com o texto novo e a justificativa da decisão D3.

**Seção 3.2** passa a incluir a política de domínio na definição de P1 e de P2, com a justificativa da decisão D2. A descrição de P1 como "aproximadamente uma página" é ajustada.

**Seção 5.1** ganha nota de que `violacoes` e `qualidade` não são secundárias em T1: com a política de domínio no contexto, `taxa_aceitacao` responde ao conteúdo de negócio e `violacoes` ao conteúdo de engenharia, e as duas juntas decompõem o efeito do harness em vez de medi-lo duas vezes.

**Seção 8** recebe as ameaças da seção 9 deste documento.

---

## 9. Ameaças à validade acrescentadas

**O agente em P0 é avaliado contra regras não informadas.** Parte do efeito de contexto medido em T1 é, por construção, transferência de informação, e não melhora de processo. Isto precisa ser dito no artigo com essas palavras. A mitigação é a decomposição: `violacoes` mede aderência a convenções que o agente poderia inferir do próprio código, e portanto não sofre da mesma objeção; um efeito que apareça nas duas métricas é mais forte do que um que apareça só na taxa de aceitação.

**Parte do gradiente vem de constantes não adivinháveis.** As checagens 4.2 e 4.4 dependem de limites que não existem em lugar nenhum do código. São duas asserções de vinte e seis, e a proporção precisa ser reportada para que o leitor pondere.

**O efeito teto foi observado e tratado com o instrumento já construído.** A mudança de enunciado ocorreu depois de a suíte oculta e a referência estarem prontas e validadas. Como o contrato medido não mudou, a linha de base e a referência permanecem válidas sem remedição — mas o fato de o enunciado ter sido reescrito à luz de um resultado precisa ser declarado, sob pena de parecer ajuste posterior a dados.

**O texto de contexto pode induzir dano.** P1 e P2 descrevem a estrutura canônica, e o repositório contém um módulo deliberadamente desviante. Um agente que leia a descrição como ordem de padronização quebra aquele módulo e é penalizado em regressão por seguir o contexto. A redação mitiga, mas não elimina, e o resultado precisa ser lido com isso em vista.

**A folga do fator modelo não foi verificada.** Nenhuma sessão comparou modelos até aqui. Se a tarefa continuar saturando para modelos fortes, o contraste da seção 4.2 perde poder, e isso só será sabido quando as células de modelo forem coletadas.

---

## 10. Critérios de aceite

O trabalho está pronto quando, verificável por comando:

- `model_version` do dataset registra o modelo que executou a sessão, conferido contra um transcript com mais de um modelo no mapa de uso, e há teste de regressão que falha se a primeira chave voltar a ser tomada.
- `tasks/T1-validacao-de-reservas.md` contém o texto da seção 4 deste documento e nenhuma referência a código de status, limite de duração, semântica de borda ou operação de alteração.
- A suíte oculta continua marcando 13/26 contra uma cópia limpa da semente e 26/26 contra a implementação de referência, sem alteração na suíte.
- O script de convenções reporta as oito regras da seção 2.6 individualmente, acusa violação numa cópia deliberadamente violadora e não acusa nenhuma contra a implementação de referência.
- O `CLAUDE.md` de P1 contém a seção de domínio da seção 5 deste documento e as regras da seção 2.6 em linguagem natural.
- Uma sessão P0 e uma sessão P1 de T1 rodam de ponta a ponta e gravam linhas completas, com `taxa_aceitacao` e `violacoes` preenchidas nas duas.

---

## 11. Explicitamente fora do escopo deste documento

**O avaliador cego da seção 2.7 não é construído aqui.** A coluna `qualidade` continua vazia. Ele é citado na seção 8 porque a interpretação conjunta das três métricas muda, mas o instrumento em si depende de escrever o checklist e a rotina de voto majoritário de três chamadas, e não é pré-requisito para observar o efeito de contexto na taxa de aceitação e nas violações.

**O plugin de P2 não é construído aqui.** A decisão D2 determina o que ele conterá quando existir. As sessões desta rodada comparam P0 contra P1.

**A semente não é tocada,** pela decisão D7.

**O tamanho de T1 e a folga do fator M não são resolvidos aqui,** pela decisão D6, e têm data de revisão na coleta das células de modelo.
