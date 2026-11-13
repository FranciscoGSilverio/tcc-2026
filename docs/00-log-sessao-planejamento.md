# Log da sessão de planejamento

**Data:** 29/08/2026
**Propósito deste arquivo:** contexto para agentes em sessões futuras. Registra as decisões tomadas, o racional por trás delas, as alternativas rejeitadas e o que continua em aberto. Destinado a leitura por máquina — é verboso de propósito.

**Documentos produzidos nesta sessão:** `01-plano-de-projeto.md`, `02-protocolo-experimental.md`, `03-plano-de-execucao.md`.

---

## 1. Situação

TCC de Engenharia de Software no INATEL. Grupo de 4 pessoas com disponibilidade limitada e explícita preferência por um projeto pequeno e executável.

**Título (fixo):** "Engenharia de harness para agentes de IA: um estudo comparativo do impacto de modelo, prompt e ordem de execução na geração de software."

**Datas fixas:** pré-defesa 03/10/2026 · entrega do artigo 14/11/2026 · banca até 05/12/2026.

**Recursos:** plano Claude Pro e orçamento de API disponível. Sem GPT ou Gemini — decisão do grupo de manter foco no Claude.

**Formato do artigo:** modelo INATEL/Revista Telecomunicações (PDF fornecido pelo usuário). Coluna dupla, Times New Roman, sem limite formal de páginas mas com expectativa explícita de artigo curto. **Figuras não podem ter elementos coloridos.** Resumo e abstract com máximo de 150 palavras cada. Citações em colchetes numéricos. Seções numeradas em algarismos romanos.

## 2. Contexto de origem

O grupo propôs ao orientador testar diferentes fluxos de trabalho com Claude Code e escrever um artigo com os resultados, tendo como artefato um plugin publicado no marketplace com skills, rules e um fluxo de trabalho para desenvolvimento com o agente como protagonista.

**Devolutiva do orientador:** o plugin funciona bem como artefato de apresentação. Não é necessário criar um app demonstrativo. Um app pode ser usado, mas para colaborar com a metodologia de pesquisa, não como produto final.

Essa devolutiva é o que justifica o desenho adotado: o repositório-semente é um app, mas existe como instrumento experimental, não como entregável.

## 3. Decisões tomadas, com racional

### 3.1 Separação conceitual entre "prompt" e "ordem de execução"

**Problema:** o título lista prompt e ordem como fatores distintos, mas um plugin naturalmente empacota os dois. Sem separação clara, os fatores ficam confundidos e nenhum efeito é atribuível.

**Decisão:** prompt = **contexto estático** (o que o agente sabe antes de começar: arquitetura, convenções, skills, rules). Ordem = **processo** (a segmentação da tarefa em etapas e checkpoints).

**Consequência crítica:** no experimento, a ordem é sempre imposta pelo runner, uniformemente em todos os níveis de contexto. O plugin inclui um comando de workflow para uso real, mas esse comando **não** é usado como mecanismo da variável O. Sem isso, P2 e O2 estariam confundidos.

### 3.2 Sessões 100% autônomas

**Alternativas consideradas:** intervenção humana permitida e contada como métrica; sessões totalmente autônomas.

**Decisão:** totalmente autônomas.

**Racional:** com 4 pessoas rodando sessões, a intervenção humana seria uma quarta variável não controlada com 4 estilos distintos, abafando os efeitos em estudo. A necessidade de resgate humano é capturada como métrica de saída (`travou`), não como tratamento.

**Objeção resolvida:** a ordem O2 parece exigir um humano nos checkpoints. Não exige — os checkpoints são scriptados. Cada nível de ordem é um pipeline fixo de prompts encadeados, idêntico em toda rodada.

### 3.3 API em vez do plano Pro para a coleta

**Racional:** a API devolve contagem exata de tokens por chamada (o que dá a métrica de custo de graça), não impõe limite de uso que interrompa execução em andamento, e mantém o dataset homogêneo. Misturar Pro e API obrigaria a explicar no artigo por que metade das linhas não tem custo confiável. O Pro fica para desenvolvimento e exploração.

### 3.4 Simplificações aplicadas (a pedido explícito do usuário)

O usuário pediu simplificação da metodologia com dois objetivos: reduzir esforço e antecipar a coleta principal para antes da pré-defesa. Cortes aplicados a partir de um desenho inicial mais amplo:

| Item | De | Para | Racional |
|---|---|---|---|
| Tarefas | 3 | 2 | Escrever suítes de testes ocultos é o item mais caro em horas humanas. Cortar uma tarefa corta ~33% do esforço mais pesado |
| Níveis de ordem | 3 | 2 | Mantidos apenas os extremos. O nível intermediário complicaria a figura sem acrescentar contraste |
| Níveis de contexto | 3 | 3 | **Não cortado.** Os três níveis são o que responde a pergunta que interessa: o plugin ganha de um CLAUDE.md simples? Se P2 empatar com P1, isso também é resultado |
| Métricas | 12 | 5 | Cada métrica é código de extração mais espaço no artigo. Num paper curto em coluna dupla não cabem doze |
| Análise | Testes inferenciais | Descritiva + tamanho de efeito | Com n=4 por célula, testes de significância dariam falsa autoridade |
| Rubrica humana de qualidade | Prevista | Removida | Exigiria avaliação cega com dois avaliadores e reporte de concordância. Custo alto, espaço inexistente no artigo |

**Insight que reorientou o dimensionamento:** o número de sessões **não é o gargalo da equipe**. Depois que o runner existe, 44 sessões são um script rodando de madrugada — custam orçamento de API e tempo de parede, não horas de ninguém. Cortar células economiza dinheiro, não esforço. O esforço humano está em escrever testes ocultos, construir o runner e em cada métrica adicional. As simplificações foram direcionadas a esses três alvos, não à contagem de sessões.

### 3.5 Fator modelo — questionado e mantido

O usuário questionou a necessidade da variação de modelo, originalmente apresentada como uma "Fase 2".

**Erro de apresentação reconhecido:** chamar aquilo de "fase" fez parecer um segundo experimento. Não é. São 4 células extras rodadas no mesmo pipeline.

**Argumento para manter:** (a) o título promete três fatores e a banca vai cobrar; (b) a conclusão mais citável do trabalho depende disso — comparar o ganho de trocar o harness com o ganho de trocar de modelo. Sem essa comparação o resultado vira "configurar melhor o agente ajuda", que é morno.

**Decisão do usuário:** manter o fator modelo.

**Consequência:** se algum dia for cortado, o título precisa mudar para refletir apenas prompt e ordem. Registrar isso.

### 3.6 Testes ocultos escritos antes do plugin

Se os testes fossem escritos depois do plugin, haveria risco de calibração inconsciente ao comportamento que a equipe já sabe que o plugin produz. A ordem inversa elimina esse viés e está refletida no cronograma: testes nas semanas 2 e 3, plugin v0 no fim da semana 3.

### 3.7 Domínio do repositório-semente

**Proposta:** API REST de reservas de salas em Node/TypeScript com Fastify, Prisma/SQLite e Vitest.

**Racional:** regras de sobreposição de horário são inequívocas de testar por asserção HTTP, mas não triviais de acertar — há casos de borda genuínos que dão espaço para as condições se diferenciarem. Evita UI, cuja validação automática sem humano seria um projeto por si só.

**Status:** proposto por Claude, não objetado pelo usuário, mas **não confirmado explicitamente**. Ver seção 5.

## 4. Desenho final (resumo executável)

- **Fator P (contexto):** P0 repo cru · P1 CLAUDE.md de uma página · P2 plugin completo com skills e rules
- **Fator O (ordem):** O1 instrução única · O2 pipeline de 4 chamadas (explorar → planejar → implementar → validar)
- **Fator M (modelo):** Haiku 4.5 · Sonnet 5 (fixo na grade) · Opus 5
- **Grade principal:** 3 P × 2 O = 6 células, modelo fixo em Sonnet, × 2 tarefas × 2 execuções = **24 sessões**
- **Células de modelo:** configurações extremas P0-O1 e P2-O2 × Haiku e Opus × 2 tarefas × 2 execuções = **16 sessões**
- **Controle de drift:** célula P1-O1 re-executada na segunda janela = **4 sessões**
- **Total: 44 sessões**
- **Métricas:** `taxa_aceitacao`, `regressoes`, `custo_usd`, `violacoes`, `travou`
- **Tarefas:** T1 reservas com detecção de conflito · T2 paginação e filtros transversais (T2 opera só sobre recursos da semente, para não depender de T1)
- **Constantes:** commit-semente, texto do enunciado, limite de 40 turnos por sessão, permissões, versões, sem internet, sem humano
- **Ordem de execução das sessões:** randomizada, para não confundir variação temporal com célula

## 5. Em aberto

1. **Confirmação do domínio de reservas.** Proposto e não objetado, mas não confirmado. Decisão da semana 1. Se mudar, T1, T2 e as suítes ocultas mudam junto; o restante do protocolo permanece.
2. **Marketplace de destino do plugin** e se já existe algum esboço. Não perguntado nesta sessão.
3. **Nomes dos integrantes e alocação por frente.** As frentes estão definidas; a atribuição de pessoas não.
4. **Trabalhos relacionados.** Nenhuma revisão de literatura foi feita. O artigo precisa de uma seção; alguém deve levantar referências sobre avaliação de agentes de código (SWE-bench e similares) e sobre engenharia de contexto/prompt.
5. **Orçamento de API em valor.** Não informado. O piloto da semana 3 fornece o custo real por sessão para extrapolação antes de comprometer o orçamento.

## 6. Restrições e princípios a preservar

Coisas que sessões futuras devem respeitar ao continuar este trabalho:

- **Simplicidade é requisito, não preferência.** O usuário afirmou repetidamente que a natureza simples e executável deve ser mantida em todas as etapas. Rejeitar propostas que aumentem escopo, mesmo que metodologicamente atraentes.
- **Os documentos devem ser explicativos.** A equipe não tem contexto além do título. Todo documento precisa definir seus termos e permitir que uma pessoa pegue o projeto e execute.
- **Protocolo congela ao fim da semana 3.** Alterações posteriores exigem descarte dos dados coletados sob a versão anterior.
- **A grade principal tem prioridade absoluta** sobre as células de modelo em qualquer cenário de atraso.
- **Figuras sem cor.** Restrição do modelo do artigo, fácil de esquecer e cara de corrigir na véspera.
- **O plugin é a condição P2**, não um entregável paralelo. Essa amarração é o que satisfaz a devolutiva do orientador e o que dá coerência ao trabalho.

## 7. Riscos que merecem atenção contínua

- **Efeito teto** é o risco de maior impacto: se todas as condições aprovarem quase 100% dos testes ocultos, não há variância e o estudo não produz resultado. Detectável no piloto da semana 3, corrigível endurecendo os critérios de aceitação de T1. Depois da coleta, não é corrigível sem refazer tudo.
- **Assimetria de orçamento computacional entre O1 e O2** é uma limitação estrutural do desenho: O2 recebe mais prompting. O limite comum de turnos mitiga parcialmente. Tratamento adotado: reportar custo como resultado conjunto e ler o ganho de O2 por unidade de custo. Deve constar nas ameaças à validade do artigo.

---

# Rodada 2 — 29/08/2026

Continuação da mesma sessão de planejamento. **Este log é cumulativo:** o conteúdo acima permanece válido como registro histórico, exceto onde explicitamente revisto abaixo. Sessões futuras devem acrescentar novas rodadas ao final, nunca reescrever as anteriores.

## R2.1 Crítica do usuário ao desenho da rodada 1

Duas ressalvas, ambas procedentes.

**Sobre as tarefas.** T1 (detecção de conflito) e T2 (paginação) são problemas conhecidos de engenharia, e agentes lidam bem com implementação técnica bem definida. O problema real em ambiente empresarial começa quando há abstração no meio da implementação — implementar uma tela, construir uma experiência, melhorar o retorno de uma operação. Esses pedidos são passados a agentes sem triagem prévia do time, e é isso que gera imprevisibilidade nas saídas. O usuário levantou corretamente que isso traz uma complexidade de medição não resolvida: como testar? Teste de componente? Golden standard? Avaliador implementado no runner?

**Sobre as métricas.** As cinco métricas contam parte da história. O usuário pediu para considerar tempo total, número de execuções de ferramenta e avaliação de qualidade (código extensível, boas práticas, aderência ao padrão de projeto), reconhecendo que talvez exigissem um avaliador não-determinístico, e instruindo a cortar se o escopo crescesse muito — capacidade do time é inegociável.

## R2.2 Diagnóstico: a tarefa abstrata não cabe no paradigma de testes ocultos

Resposta ao problema de medição levantado pelo usuário, e insight central desta rodada.

**Não é possível escrever testes ocultos para uma tarefa abstrata.** Se você consegue escrever asserções que definem o certo, a tarefa não era abstrata — escrever o teste é especificá-la. Teste de componente cai na mesma armadilha: assertar a presença de um indicador de status é decidir que deve haver um.

**A saída é mudar a variável-resposta, não o instrumento.** O problema prático da tarefa abstrata não é código ruim; é saída **imprevisivelmente diferente** a cada execução. Isso é dispersão, não qualidade. Dispersão é muito mais barata de medir, porque não exige julgar se uma saída é boa — só se duas saídas são iguais.

**Instrumento adotado:** ao escrever o enunciado ambíguo, listar explicitamente os pontos de decisão que ele deixa em aberto. Após cada sessão, um classificador lê o diff e registra qual escolha foi feita em cada ponto. A métrica é a taxa de unanimidade entre as execuções da mesma célula.

**Hipótese resultante, que passa a ser a hipótese central do trabalho:** *harness melhor não deixa o agente mais inteligente, deixa o agente mais previsível.*

Alternativas rejeitadas: golden standard (pressupõe resposta certa, que não existe); teste de componente (re-especifica a tarefa); nota de qualidade por LLM (frágil, ver R2.4).

## R2.3 Substituição de T2 e iterações do enunciado

Decidido substituir T2 em vez de acrescentar uma terceira tarefa. T2 (paginação) era a mais dispensável: também é problema conhecido, e o que ela testava (navegação da base de código) a tarefa ambígua testa igualmente bem. Trocar uma suíte de testes ocultos por uma lista de pontos de decisão é esforço comparável ou menor.

**Três versões do enunciado foram consideradas.**

*Versão 1 (rejeitada):* "o retorno da listagem de reservas não está bom para um cliente que precisa montar uma agenda semanal — melhore". O usuário rejeitou por não se parecer com o que é passado a agentes em ambiente empresarial real.

*Versão 2 (sugerida pelo usuário, também rejeitada após análise):* "a experiência de montagem de agenda semanal é precária, é necessário um ajuste X". Dois problemas: "ajuste" sinaliza mudança pequena e empurraria todas as sessões para a edição mínima, **reduzindo** a divergência que queremos medir; e "agenda semanal" pressupõe funcionalidade inexistente na API, então a ambiguidade viria de adivinhar o que é essa agenda, não de decisão de engenharia real.

*Versão 3 (aprovada):* ticket RES-142, reproduzido integralmente no protocolo. O princípio que o guia: **específico sobre o sintoma, silencioso sobre a causa e a solução.** Alguém reclamou de algo concreto, ninguém sabe o porquê, e cabe a quem pega o ticket decidir tudo.

Propriedade importante do enunciado aprovado: as saídas serão **comparáveis**. Toda sessão construirá alguma noção de disponibilidade, o que permite classificar os mesmos pontos em todas. Um enunciado ambíguo demais produziria saídas incomparáveis e destruiria o instrumento. Este é o equilíbrio a preservar se o enunciado precisar ser mexido.

## R2.4 Métricas: juiz rejeitado, classificador aceito

Distinção que orientou a decisão: avaliador não-determinístico como **juiz** é frágil; como **classificador** é confiável.

"Nota de 1 a 5 para extensibilidade" produz números que variam entre execuções, derivam com o prompt e não têm âncora — exigiria validação contra avaliação humana cega, que custa horas indisponíveis. "Este diff separa as responsabilidades entre as camadas? sim/não" produz resposta estável.

**Adotado:** checklist de 7 perguntas binárias, com três salvaguardas baratas — modelo avaliador fixo (independente do modelo sob teste), cegueira quanto à condição, e voto majoritário de três chamadas com a taxa de desacordo reportada como confiabilidade do instrumento.

**Adotado sem discussão:** `duracao_s` e `n_tool_calls`, que custam zero código novo (já estão no transcript e na resposta da API). `n_tool_calls` ajuda a interpretar a assimetria entre O1 e O2.

**Cortado:** extensibilidade, por ser o mais subjetivo dos três atributos pedidos e o que menos sobrevive a uma pergunta binária. "Segue o padrão de projeto" já é coberto de forma determinística pelo script de convenções; o checklist cobre boas práticas gerais.

## R2.5 Consequência estrutural no repositório-semente

T2 precisa que reservas existam, mas cada sessão roda uma tarefa só a partir do commit-semente. Portanto **o módulo `bookings` passa a integrar a semente**, em versão ingênua: CRUD funcional, sem validação de conflito nem regras de duração.

Isso reescreve T1 como *adicionar detecção de conflito e validações ao módulo existente*, e continua verificável por testes ocultos exatamente como antes.

Efeito colateral positivo: as duas tarefas passam a ser modificação de código existente, que é o que o estudo afirma investigar e o que domina o trabalho real. Perde-se o teste de "criar módulo novo seguindo o padrão", mas a aderência a convenções segue medida.

## R2.6 Frase de encerramento como constante

Em sessões headless, o agente pode responder ao ticket ambíguo com perguntas de esclarecimento e encerrar sem diff, registrando como sessão travada e virando ruído.

Correção: anexar aos dois enunciados a frase *"Não há canal para dúvidas nesta execução. Decida e implemente."* É idêntica nas duas tarefas justamente para não virar diferença entre condições, e está registrada como constante do protocolo.

## R2.7 Novo dimensionamento

Três execuções em T2 (decisão do usuário) e duas em T1. A assimetria é proposital: em T1 a repetição só estima ruído; em T2 a repetição **é o instrumento**, e com duas execuções só se sabe se concordaram ou não, sem grau.

| Bloco | Cálculo | Sessões |
|---|---|---|
| Grade principal (Sonnet) | 6 células × (2 de T1 + 3 de T2) | 30 |
| Células de modelo | 2 configs × 2 modelos × 5 | 20 |
| Controle de drift | 1 célula × 5 | 5 |
| **Total** | | **55** |

Anteriormente 44. O acréscimo custa orçamento de API, não esforço da equipe, e não altera o cronograma. Custo humano estimado da rodada 2: dois a três dias distribuídos nas semanas 2 e 3 (meio dia para os pontos de decisão, um dia para calibrar os prompts do avaliador, uma hora para as duas métricas gratuitas).

## R2.8 Nova pergunta de pesquisa

Acrescentada **PP4:** o efeito do harness é diferente conforme o requisito seja bem especificado ou ambíguo?

Isso torna a comparação entre o comportamento de T1 e o de T2 o resultado central do artigo. Se o harness pouco altera o acerto em T1 mas altera bastante a convergência em T2, a conclusão é que engenharia de harness importa sobretudo onde o requisito é vago — que é a maior parte do trabalho real, e é a mensagem mais valiosa do trabalho para o mercado.

## R2.9 Novas ameaças à validade

- **Convergência não é qualidade.** Uma configuração pode convergir para uma decisão ruim. `convergencia` deve ser sempre lida junto com `qualidade` e `violacoes`, nunca isolada.
- **Auto-preferência do avaliador.** Um modelo Claude avalia saídas Claude. Mitigado pelo formato binário e pela cegueira, não eliminado.
- **Ambiguidade de requisito, não visual.** O usuário mencionou telas e experiência de usuário; a semente é uma API e adicionar frontend custaria mais do que o projeto comporta. T2 captura ambiguidade de requisito em backend. Declarado como limitação.

## R2.10 Novos riscos

- **T2 ambígua demais**, com saídas tão distintas que os pontos de decisão não se aplicam. Detectável no piloto; corrigível acrescentando ao ticket uma restrição de escopo que estreite sem revelar a solução.
- **Avaliador cego instável** entre suas próprias chamadas. Taxa de desacordo medida no piloto; perguntas problemáticas reescritas antes do congelamento.

Note que o efeito teto, principal risco da rodada 1, agora afeta apenas T1. T2 mede dispersão e não tem teto.

## R2.11 Itens que continuam em aberto

Da rodada 1, permanecem: marketplace de destino do plugin e existência de esboço prévio; nomes dos integrantes e alocação por frente; revisão de literatura para trabalhos relacionados (nenhuma feita até aqui); valor do orçamento de API.

**Resolvido nesta rodada:** o domínio de reservas, que estava proposto mas não confirmado, agora está firmado — o ticket RES-142 depende dele.

**Novo item aberto:** os prompts exatos do avaliador cego (checklist e classificador) precisam ser escritos e calibrados na semana 3, antes do congelamento.

---

# Rodada 3 — 29/08/2026

Terceira rodada da mesma sessão. Reorientação do plano de execução. As decisões das rodadas 1 e 2 permanecem válidas; o que muda aqui é como o trabalho é dirigido e o que é exigido em cada momento.

## R3.1 Plano dirigido por marcos, não por cerimônias

**Instrução do usuário:** descartar a reunião semanal e a distribuição de atribuições. O foco deve ser cronograma e entregas. O time deve ter claro o que precisa ser entregue em cada marco — é isso que dirige a implementação, não cerimônias com data marcada.

**Aplicado:** removidas do plano de execução a tabela de alocação por frente e a seção de rotina. O plano passa a ser uma sequência de marcos (M1 a M9), cada um com entregas e um **portão** — condição binária verificável que impede o avanço enquanto não satisfeita.

No `01-plano-de-projeto.md`, a seção "Papéis" foi substituída por "Prioridade de esforço", que descreve o que vem antes de quê em vez de quem faz o quê. As quatro frentes de trabalho continuam descritas nos entregáveis, mas sem atribuição de pessoas.

**Princípio a preservar em sessões futuras:** não reintroduzir alocação de pessoas nem cerimônias com data. Se algo precisa ser coordenado, expressar como portão de marco.

## R3.2 O piloto elevado a portão central

**Instrução do usuário:** o piloto é a parte mais importante do início do projeto e é fácil de perder de vista. Qualquer problema com runner, repositório ou metodologia tem que ser identificado ali. É o que dá segurança para rodar sem supervisão, prever custo e confiar que os resultados estão sendo coletados.

**Aplicado:** o piloto ganhou seção própria no plano de execução, posicionada **antes** da lista de marcos, com a justificativa de que dirige tudo o que vem antes e libera tudo o que vem depois.

Composição revista: seis sessões em vez de cinco. Cinco na célula **P2-O2** (caminho mais complexo: instalação da configuração, pipeline de quatro chamadas, ambas as tarefas — se funciona, P0/P1/O1 são estritamente mais simples) e uma sessão de fumaça em **P0-O1** (extremo oposto). Mais uma sessão interrompida de propósito, para validar que o runner marca como inválida e permite re-execução.

**Portão de M3 formalizado em onze verificações**, agrupadas em instrumentação (1–5), metodologia (6–10) e viabilidade (11). Registrar aqui as três que mais facilmente se perdem:

- **Verificação 5 — nenhuma sessão teve contato com os testes ocultos.** Verificada por inspeção do transcript e do diretório de trabalho durante a execução. É a mais fácil de esquecer e a única que invalidaria o experimento inteiro se falhasse silenciosamente.
- **Verificação 7 — os testes ocultos não falharam por motivo irrelevante.** Falha por nome interno diferente é defeito do teste, não do agente.
- **Verificação 9 — as três execuções de T2 não foram nem idênticas nem incomparáveis.** É o teste de calibração do ticket ambíguo: idênticas significa específico demais, incomparáveis significa ambíguo demais.

## R3.3 Congelamento movido para depois do piloto

**Correção de um erro das rodadas 1 e 2.** Ambas colocavam o congelamento do protocolo "ao fim da semana 3", em paralelo ao piloto. Isso está errado.

O piloto existe para revelar problemas de metodologia — efeito teto, pontos de decisão inaplicáveis, testes ocultos frágeis, avaliador instável. Congelar antes dele tornaria ilegítimas exatamente as correções que ele indica, transformando problemas corrigíveis em defeitos permanentes do dataset.

**Regra corrigida:** o congelamento acontece **em M3, imediatamente após o piloto ser aprovado**. As sessões do piloto não integram o dataset, porque foram executadas sob uma versão do protocolo que ainda podia mudar. Aplicado em `02-protocolo-experimental.md`, seções 1 e 9.

## R3.4 Plugin fora do escopo obrigatório de outubro

**Instrução do usuário:** não é necessário entregar o plugin na pré-defesa. Seria um plus. A estrutura de pesquisa é o principal — repositório-semente, runner, enunciados e setup. Se isso estiver pronto antes de 03/10, o restante é trabalho fácil com tempo de sobra.

**Distinção introduzida, e ela é crítica:** o plugin tem dois papéis distintos e só um deles é urgente.

- **Configuração P2 funcional** — CLAUDE.md, skills e rules instaláveis no repositório de trabalho. **Obrigatória em M3**, porque P2 é um nível do fator experimental: sem ela, duas das seis células da grade não podem rodar e a coleta de M4 fica pela metade.
- **Plugin publicado** — empacotado, documentado, listado no marketplace. **Trabalho de novembro (M7).** Nada trava sem ele.

Perder essa distinção quebraria a coleta. Uma leitura apressada de "o plugin não é necessário em outubro" levaria a não construir P2 a tempo.

**Escopo da pré-defesa formalizado** em seção própria do plano de execução, com três listas: o que precisa estar pronto (protocolo congelado, infraestrutura funcionando, 30 sessões coletadas, análise da grade), o que não precisa (plugin empacotado, células de modelo, artigo escrito) e o que seria um plus (plugin já publicado).

## R3.5 Cronograma redesenhado

M2 foi antecipado para exigir **uma sessão de ponta a ponta rodando já em 13/09**, e não apenas "runner v1". Isso deixa a semana de 14 a 20/09 inteiramente disponível para o piloto e suas correções, em vez de espremer as duas coisas.

| Marco | Data | Conteúdo |
|---|---|---|
| M1 | 06/09 | Protocolo aplicável: enunciados e pontos de decisão escritos |
| M2 | 13/09 | Primeira sessão de ponta a ponta; semente congelada em `seed-v1` |
| M3 | 20/09 | **Piloto aprovado; protocolo congelado** — portão crítico |
| M4 | 27/09 | Grade coletada (30 sessões) |
| M5 | 03/10 | Pré-defesa |
| M6 | 11/10 | Coleta completa (mais 25 sessões) |
| M7 | 08/11 | Artigo escrito e plugin publicado |
| M8 | 14/11 | Entrega do artigo |
| M9 | até 05/12 | Apresentação |

**Contingência acrescentada e destacada:** se M2 ou M3 atrasarem, todo o cronograma desloca junto. Nunca se pula ou abrevia o piloto para recuperar tempo. Esta é a regra que sessões futuras devem defender com mais firmeza, porque é a que estará sob maior pressão quando houver atraso.

---

# Rodada 4 — 09/09/2026

Sessão dedicada a especificar o **repositório-semente**, primeiro componente a ser construído por haver dependência de todos os demais em relação a ele. O log continua cumulativo: nada acima foi reescrito. Esta rodada revisa pontos das rodadas 1 a 3 onde indicado explicitamente.

**Contexto de abertura:** M1 estava previsto para 06/09 e a sessão ocorre em 09/09, três dias após. Nenhum artefato de código existia ainda; o repositório continha apenas os quatro documentos de planejamento.

## R4.1 Contradição entre o ticket de T2 e a semente ingênua — corrigida

**Problema encontrado na revisão.** A seção 2.1 do protocolo manda a semente ter `bookings` "sem nenhuma validação de conflito de horário". A seção 2.3 traz o ticket RES-142, cujo sintoma é que os usuários "tentam criar uma reserva e recebem erro de conflito". O ponto de decisão 10 fala em "enriquecer o erro 409". Os dois textos são incompatíveis: numa semente sem checagem de conflito não existe 409 algum.

**Consequência se não corrigido.** O agente de T2 explora o código, não encontra detecção de conflito, conclui que o ticket pede detecção de conflito e implementa T1. T2 colapsaria em T1 e o instrumento de convergência seria destruído.

**Alternativas consideradas:** (a) semente com checagem parcial; (b) reescrever o ticket para não pressupor 409; (c) manter os dois como estão.

**Decisão do usuário: (a).** A semente passa a conter uma detecção de conflito **parcial e incompleta**. T1 deixa de ser "adicionar detecção de conflito" e passa a ser "completar o contrato de validação de reservas".

**Benefício colateral:** corrigir comportamento existente é mais difícil que acrescentar comportamento do zero, o que ataca diretamente o efeito teto em T1 — o risco de maior impacto do projeto desde a rodada 1.

**Efeito no protocolo:** a seção 2.1 do `02-protocolo-experimental.md` precisa ser reescrita, e o título de T1 na seção 2.2 também.

## R4.2 Regra do falso negativo — todos os defeitos da semente deixam passar, nenhum recusa

**Problema de segunda ordem descoberto logo após R4.1.** Se o defeito da semente for um **falso positivo** — recusar reserva que deveria aceitar — então o ticket RES-142 passa a ser *explicado* por esse defeito. O agente de T2 encontra o bug, corrige, e T2 volta a colapsar em T1 por outro caminho. Isso vale para qualquer bug de borda inclusiva ou de contagem de reservas canceladas como ocupadas, que eram as duas calibragens inicialmente propostas.

**Decisão do usuário:** regra de projeto para a semente — **todo defeito da versão ingênua é falso negativo**. A semente deixa passar o que não deveria, e nunca recusa o que deveria aceitar. Quem recebe 409 está batendo em conflito verdadeiro, e o ticket vira um problema de descoberta de horários livres, que é o que se quer medir.

**Comportamento ingênuo resultante, congelado como especificação da semente:**

- A checagem de conflito no `POST` detecta **apenas um dos quatro casos de sobreposição**: aquele em que o início da nova reserva cai dentro de uma reserva existente. Deixa passar o fim caindo dentro de outra e a nova reserva que engole uma existente.
- Comparação de borda já é estrita, para não gerar falso positivo.
- Reservas canceladas já são corretamente ignoradas, pelo mesmo motivo.
- A atualização (`PATCH`) não faz nenhuma validação de conflito.
- Não há validação de reserva no passado.
- Não há regra de duração mínima nem máxima.
- Sala ou usuário inexistente resulta em erro 500, não em 404.

**Benefício:** raciocinar sobre os quatro casos de intervalo é genuinamente sutil, o que combate o efeito teto melhor que as calibragens antes cogitadas.

## R4.3 Camada de dados — Prisma com SQLite mantido, com duas exigências

**Questionamento do usuário:** depender de um recurso que aumenta a complexidade do setup aumenta a complexidade do runner; ponderar impacto no runner, na metodologia e na precisão e no tempo das medições.

**Análise registrada:**

- *Runner.* Com imagem Docker construída uma vez, contendo dependências instaladas e cliente do Prisma já gerado, o runner nunca sabe que o Prisma existe: ele chama alvos do Makefile. A complexidade é paga uma vez na semente, não por sessão.
- *Única fraqueza estrutural do Prisma.* O cliente gerado vive em `node_modules` e fica velho se o agente editar o schema. Resolvido fazendo o alvo de verificação regenerar o cliente quando o hash do schema mudar. Como nem T1 nem T2 exigem mudança de schema, o caso é raro por construção.
- *Metodologia.* O argumento decisivo inverteu a inclinação inicial por SQL escrito à mão. O plano de análise usa a dispersão entre execuções da mesma célula como piso de ruído, e declara que diferença menor que esse piso não pode ser lida como efeito. Variância vinda de brigar com SQL é ruído sem relação com o construto: levanta o piso e esconde os efeitos de harness. **A dificuldade de T1 deve vir do conjunto de regras do enunciado, que a equipe controla, e não da tecnologia da camada de dados.**
- *Tempo e precisão.* Prisma acrescenta de 5 a 15 s por verificação e cerca de 250 MB à imagem, contra zero e 70 MB da alternativa. Irrelevante diante de uma sessão dominada pelos turnos do agente.

**Decisão do usuário:** manter **Prisma com SQLite**, com duas exigências que entram como critério de aceite da semente: imagem com tudo pré-instalado, e alvo de verificação auto-curativo que regenera o cliente quando necessário.

## R4.4 Ambiente de execução — agente dentro do container, com internet liberada

**Decisão do usuário, parte 1:** o agente executa **dentro do container**. A semente entrega a imagem base da aplicação; o runner estende essa imagem com o CLI do agente. Motivos: ambiente idêntico nas 55 sessões independentemente da máquina, `duracao_s` comparável entre sessões, e raio de dano contido, o que torna confortável conceder permissão total de ferramentas em sessões cem por cento autônomas.

**Decisão do usuário, parte 2 — revisão de decisão anterior:** **não há restrição de acesso à internet durante a sessão.** Racional do usuário: "se o agente decidir que precisa de mais informação, que busque; isso é o que um agente faz na vida real". É uma escolha de validade ecológica.

**Isto revoga a constante correspondente da seção 3.4 do protocolo**, que listava "ausência de acesso à internet durante a sessão" entre os itens idênticos em toda sessão. A seção precisa ser reescrita, e a escolha declarada nas ameaças à validade.

**Efeito colateral positivo:** com rede, a violação "adicionou dependência nova" passa a ser genuinamente alcançável. Sem rede, a instalação falharia e o agente recuaria, de modo que essa regra do script de convenções nunca mediria nada.

**Risco novo e mitigação obrigatória:** com internet liberada, um agente pode encontrar por busca os testes ocultos, os pontos de decisão e o próprio protocolo, o que invalidaria silenciosamente a verificação 5 do portão do piloto. Mitigação decidida: **o repositório de artefatos permanece privado até o encerramento da coleta em M6**, e nada dentro da semente menciona o estudo, o TCC ou o INATEL.

## R4.5 Execução em série e máquina única

Decidido junto com R4.4. As sessões do dataset rodam **em série e na mesma máquina**. Paralelizar contaminaria `duracao_s` por disputa de CPU, e essa é justamente a métrica usada para interpretar a assimetria entre O1 e O2. Em série, as 55 sessões cabem em uma madrugada.

## R4.6 Transcrição legível por sessão

**Pedido do usuário:** além do resultado final, guardar um markdown por sessão mostrando como o agente se comportou, para análise futura depois de os dados serem coletados.

**Decidido:** o runner grava **dois arquivos por sessão** — o transcript bruto em JSON, para reprocessamento programático, e um markdown legível com a sequência de prompts, respostas e chamadas de ferramenta. Custo próximo de zero, já que o transcript bruto vem da API de qualquer forma. Pertence à spec do runner; registrado aqui para não se perder.

## R4.7 Script de convenções ampliado de cinco para nove regras

**Crítica do usuário:** nenhum dos dois enunciados leva o agente a instalar uma biblioteca nova, então a regra "dependência acrescentada ao package.json" não mede nada.

**Análise:** a crítica procede. Das cinco regras originais, quatro têm sinal real — arquivo fora da estrutura e endpoint sem schema disparam em T2, que cria endpoint novo; ausência de testes escritos pelo agente é a que mais separa P0 de P1; `any` é moderada. Só a de dependência é fraca.

**Alternativa rejeitada:** criar um ímã de biblioteca no enunciado. Os únicos ímãs fortes são conversão de fuso horário e regras de recorrência. Fuso traz risco de teste oculto instável, que é a verificação 7 do portão do piloto; recorrência dobra o tamanho de T1. Pelo critério do próprio usuário — aumento de escopo só se justifica se a ausência invalidar a pesquisa — nenhum dos dois se justifica, porque a métrica de violações sobrevive nas outras quatro regras.

**Decisão do usuário:** ampliar o script para **nove regras determinísticas**, cada uma um grep no diff, com custo próximo de zero e nenhum acréscimo de tempo de sessão:

1. Arquivo de produção criado fora de `src/modules/<recurso>/` ou `src/shared/`
2. Dependência acrescentada ao `package.json`
3. Arquivo de configuração do projeto alterado (`tsconfig`, ESLint, Prettier, Vitest, `Dockerfile`, `Makefile`, scripts do `package.json`)
4. Uso de `any`, `as any`, `@ts-ignore`, `@ts-expect-error` ou asserção não-nula em código de produção
5. Rota criada ou alterada sem schema de validação declarado
6. Nenhum teste escrito pelo agente
7. Teste pré-existente da semente alterado ou removido
8. Chamada de `console.*` em código de produção, tendo o projeto um logger
9. Teste marcado com `.skip`, `.only` ou `.todo`

**Nota sobre a regra 1:** a redação original do protocolo dizia apenas "fora de `src/modules/<recurso>/`", o que transformaria em violação qualquer utilitário compartilhado legítimo — penalizando exatamente o bom design que o checklist do avaliador premia. A regra passa a admitir `src/shared/`.

**Decidido junto:** a semente **não inclui nenhuma biblioteca de data**, e faz aritmética de tempo com `Date` puro mais um auxiliar local. É a tentação máxima que se pode criar para a regra 2 sem tocar no enunciado. Se a regra nunca disparar nas 55 sessões, isso é reportado como resultado, não tratado como buraco.

**Todas as nove regras devem ser declaradas ao agente em P1 e P2**, e nenhuma em P0, mantendo a definição operacional do fator de contexto.

## R4.8 Confusão entre o fator ordem e a regra de arquivos — descoberta e corrigida

O passo 2 do pipeline O2 pede ao agente que escreva um plano de implementação. Se ele gravar esse plano em arquivo, viola a regra de estrutura em **toda** sessão O2, confundindo o fator ordem com a métrica de violações.

**Correção:** o prompt do passo 2 de O2 deve dizer explicitamente que o plano vai na resposta, não em arquivo. Aplicar na seção 3.3 do protocolo.

## R4.9 ESLint com `no-explicit-any` como erro

**Decisão do usuário.** A semente é um projeto realista e reprova `any` no lint. Se o agente roda a verificação, ele corrige; se não roda, a violação é contada pelo script. **Rodar ou não rodar a verificação passa a ser parte do efeito de harness medido**, o que é legítimo e defensável na banca.

## R4.10 Idioma

**Decisão do usuário:** código, identificadores, mensagens de erro, comentários, README e histórico de commits da semente em **inglês**, que é o padrão de uma base Node e o que torna o artefato publicado legível por terceiros. Os **enunciados de T1 e T2 permanecem em português**, refletindo o cenário real de um time brasileiro. A mistura vai declarada no artigo.

## R4.11 README mínimo

**Decisão do usuário, com racional textual:** "dar informação ao agente é parte do harness; se quisermos medir o impacto real de uma execução sem contexto, o readme não pode dar informações demais. O padrão de projeto e estrutura vai vir conforme o fator prompt for alterado entre sessões."

**Aplicado:** o README da semente contém uma linha sobre o que a API faz e os comandos para instalar, rodar e testar. Sem arquitetura, sem convenções, sem explicação de camadas. É o que preserva o contraste entre P0 e P1.

Pela mesma lógica, a semente **não contém** `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.github/`, nem qualquer outro arquivo de orientação a agente ou a contribuidor.

## R4.12 Enunciado de T1 — texto candidato

Escrito nesta sessão, cumprindo a entrega de M1. Reflete R4.1 e R4.2.

> **T1 — Regras de validação de reservas**
>
> A API de reservas aceita hoje pedidos que não deveria aceitar. Ajuste o comportamento para que o contrato abaixo seja verdadeiro. As regras valem tanto para a criação quanto para a atualização de uma reserva.
>
> 1. Duas reservas ativas na mesma sala não podem ocupar o mesmo intervalo de tempo, em nenhuma forma de sobreposição. A comparação é estrita nas bordas: uma reserva que termina às 10:00 e outra que começa às 10:00 convivem. Pedido que viole a regra responde 409. Ao atualizar, a comparação considera as demais reservas ativas da sala.
> 2. Reserva cancelada não ocupa horário. Cancelar uma reserva libera o intervalo.
> 3. Reserva cujo início já passou é rejeitada com 400.
> 4. A duração mínima é de 30 minutos e a máxima de 8 horas, ambas permitidas. Fora desse intervalo, 400.
> 5. O fim precisa ser posterior ao início. Caso contrário, 400.
> 6. Pedido que referencia sala ou usuário inexistente responde 404.
> 7. Os erros seguem o formato já usado pela API.
> 8. Nenhum comportamento existente e não citado acima deve mudar.
>
> Não há canal para dúvidas nesta execução. Decida e implemente.

Escolhas de redação registradas: a expressão "em nenhuma forma de sobreposição" especifica os quatro casos sem enumerá-los, mantendo T1 completa sem entregar a resposta. A frase "a comparação considera as demais reservas ativas da sala" cobre o caso clássico da reserva que conflita consigo mesma ao ser atualizada, sem chamar atenção para ele.

**T2 permanece com o texto da seção 2.3 do protocolo**, acrescido da frase de encerramento. A cláusula sobre quem organiza várias reservas de uma vez é preservada: é a única do ticket que abre caminho para recorrência ou operação em lote, onde uma biblioteca externa seria plausível.

## R4.13 Congelamento dos enunciados continua em M3

O usuário levantou a possibilidade de congelar os enunciados nesta sessão. **Mantido em M3.** Congelar antes do piloto retiraria do projeto as duas contingências que mais importam — efeito teto em T1 e calibragem de ambiguidade de T2 — que só o piloto pode revelar. Os textos ficam definitivos e versionados agora, e M3 segue sendo o único ponto onde ainda podem mudar. Isso é consistente com R3.3.

## R4.14 Medição de regressões com testes da semente restaurados

**Problema:** o agente pode alterar ou apagar testes pré-existentes para fazê-los passar, o que corromperia a métrica `regressoes`.

**Decidido:** antes de medir regressões, o runner **restaura os arquivos de teste da semente a partir da versão congelada**. Separadamente, registra se o agente os alterou, o que passa a ser a regra 7 do script de convenções (R4.7).

**Decidido junto:** nenhum teste da semente pode afirmar como esperado um comportamento que T1 corrige. Se um teste existente afirmasse que duas reservas sobrepostas retornam 201, a solução correta de T1 quebraria um teste pré-existente e toda sessão de T1 registraria regressão falsa. Isso entra como critério de aceite da semente.

## R4.15 Itens em aberto após esta rodada

Permanecem da rodada 1 e 2: marketplace de destino do plugin; nomes dos integrantes; revisão de literatura para trabalhos relacionados; valor do orçamento de API; prompts exatos do avaliador cego.

**Novos:** atualizar `02-protocolo-experimental.md` nas seções 2.1, 2.2, 2.6, 3.3 e 3.4 para refletir R4.1, R4.2, R4.4, R4.7 e R4.8; escrever a spec do runner; escrever a spec dos testes ocultos.

## R4.16 Onde vive a verificação dos falsos negativos

Descoberto ao escrever o plano de implementação, e não é óbvio.

A regra do falso negativo (R4.2) precisa ser verificada antes do congelamento: alguém tem que provar que a semente realmente aceita uma reserva que engole outra, uma reserva no passado, uma reserva de dez horas. Mas **essas são exatamente as afirmações proibidas na suíte da semente**, porque T1 as torna falsas e elas produziriam regressão falsa em toda sessão de T1.

**Decidido:** a verificação vive em `tools/seed-audit/false-negatives.mjs`, na raiz do repositório de artefatos, fora da árvore da semente, e roda por HTTP contra o servidor antes do congelamento. Nunca é copiada para dentro de uma sessão.

O mesmo diretório abriga os demais roteiros de aceite: ausência de vazamento, contagens de estrutura e prova de inércia do lastro. Manter a semente inocente e a auditoria do lado de fora é o que torna os dois verificáveis sem se contaminarem.

## R4.17 Escolhas técnicas fixadas no plano de implementação

Registradas por serem irreversíveis depois do congelamento: validação de schema por TypeBox, evitando dependência de biblioteca de formatos; módulo desviante chamado `amenities`, escolhido por ser distante de tempo e intervalos; auxiliar alternativo chamado `http-reply.ts`, sem qualquer marcação de obsoleto no nome ou em comentário; e as duas imperfeições do serviço de usuários construídas de forma **redundante com o schema**, de modo que nenhuma delas jamais recusa um pedido sozinha, preservando a regra do falso negativo.

**Documentos produzidos nesta rodada:** `superpowers/specs/2026-09-09-repositorio-semente-design.md` e `superpowers/plans/2026-09-09-repositorio-semente.md`.

---

# Rodada 5 — 10/09/2026

Sessão de construção do **repositório-semente**, executada a partir do plano de implementação por doze subagentes, um por tarefa, cada um seguido de revisão independente. Registro do que foi construído, dos defeitos que o plano tinha e das decisões tomadas durante a execução sem consulta ao usuário.

## R5.1 Resultado

A semente vive em `seed/`, na branch `seed-repo`. Dezesseis commits, cinquenta e nove testes passando, verificação completa a frio em 7,8 segundos, imagem de contêiner construindo e passando a verificação inteira por dentro.

Quatro módulos. `rooms`, `users` e `bookings` no padrão canônico de quatro camadas; `amenities` deliberadamente fora dele, em dois arquivos, devolvendo array puro em vez do envelope de paginação, respondendo erro por um auxiliar diferente e registrado sem prefixo de rota. Nada no código declara qual dos dois padrões é o vigente.

Os roteiros de aceite vivem em `tools/seed-audit/`, fora da árvore da semente, conforme R4.16. São quatro: verificação dos falsos negativos por HTTP, checagem de vazamento, checagem de estrutura e prova de inércia do lastro. Todos os três roteiros de shell foram provados falhando quando deveriam falhar, duas vezes cada, com violações diferentes escolhidas pelo implementador e pelo revisor.

**Pendente e deliberadamente não executado por agente:** a revisão humana da árvore inteira e a criação da tag `seed-v1`. A primeira existe porque a base foi escrita com assistência de agente, e um agente executá-la anularia seu propósito. A segunda depende da primeira. O checklist está em `tools/seed-audit/CHECKLIST.md` com os campos automáticos preenchidos.

## R5.2 Defeitos do plano descobertos na execução

Cinco, todos encontrados pelos implementadores e confirmados de forma independente pelos revisores. Registrados porque revelam armadilhas do ambiente que valem para o runner também.

1. **`prisma db push` sem a variável de conexão.** O plano encadeava comandos com ponto e vírgula terminando num `echo`, então a falha era mascarada e o carimbo de cache era gravado mesmo sem banco criado.
2. **Caminho relativo do SQLite.** O Prisma resolve o caminho do banco a partir do diretório do `schema.prisma`, não do diretório de trabalho. O plano colocaria o banco em `prisma/data/`, quebrando o alvo de limpeza e fazendo um banco de desenvolvimento entrar na imagem Docker, já que o arquivo de exclusão do contexto é resolvido a partir da raiz.
3. **Encapsulamento do Fastify.** Registrar os plugins transversais com `register` os isola num contexto próprio, de modo que o tratador de erro global não valeria para as rotas dos módulos, que são registradas em contextos irmãos. O envelope de erro do projeto simplesmente não se aplicaria onde mais importa.
4. **Campos de data no schema de resposta.** Declarados como texto, reprovam na checagem de tipos contra o `Date` que o Prisma devolve. Resolvido com um auxiliar compartilhado que mantém o schema emitido como texto e o tipo estático como data.
5. **`make start` sem a variável de conexão.** O servidor subia e a saúde respondia, mas o primeiro pedido que tocava o banco devolvia erro interno. Como é esse o comando do contrato com o runner, seria uma falha silenciosa em todas as sessões.

## R5.3 Decisões tomadas durante a execução

Tomadas sem consulta, para não parar a execução. Todas foram julgadas sólidas pela revisão final.

| Decisão | Racional | Custo se errada |
|---|---|---|
| Banco em `seed/data/`, com URL relativa ao diretório do schema | Alternativa era manter em `prisma/data/` e remendar limpeza e contexto do Docker em separado, deixando dois diretórios de mesmo nome e um `mkdir` morto | Quatro linhas de configuração |
| Auxiliar de data extraído para `src/shared/schema.ts` | Antes que dois módulos o replicassem; `bookings` sozinho precisa dele em quatro campos. Acrescenta alvo legítimo de reuso, que é o que a pergunta 6 do checklist do avaliador mede | Mover uma linha de volta |
| `make start` funciona sem variável de ambiente, por export no topo do Makefile | É o comando do contrato com o runner. Risco descartado por prova: a suíte não cai no banco da aplicação, porque a configuração do Vitest sobrepõe o valor herdado | Voltar para atribuição por alvo |
| Teste "contida" sai de trinta minutos exatos para duração folgada | Estava encostado numa fronteira que T1 vai definir, e era a única afirmação da suíte que dependia de convenção externa | Dois números num teste |
| Pacotes de sistema da imagem sem versão fixada | Fixar versões de apt em Debian slim quebra o build quando o espelho remove a versão antiga, trocando divergência por falha total. A reprodutibilidade vem de construir a imagem uma vez e reusar | Uma nota nas ameaças à validade |
| `engines` continua em Node 22 | O ambiente autoritativo é o contêiner, que fixa a base por digest | Um aviso no desenvolvimento local |
| Execução em série, sem paralelizar tarefas | Três tarefas colidem no mesmo arquivo de registro de rotas, e a única independente copia a árvore e roda a verificação nela | Tempo de parede |
| Verificação da metade "usuário inexistente" acrescentada ao verificador | O roteiro estava mais estreito que a regra que promete guardar, que cobre sala **ou** usuário | Oito linhas num script fora da semente |

## R5.4 Limitações conhecidas do instrumento

- **As checagens de estrutura são textuais, não semânticas.** Contam arquivos e procuram palavras fixas, então uma violação escrita com outro nome escaparia. Limitação inerente a auditoria por busca; a rede de segurança é o item de revisão humana do checklist.
- **A verificação de tipos não cobre os testes** nem o carregador de dados de demonstração, porque o `tsconfig` inclui apenas `src`. Falhas de tipo em teste aparecem como falha de teste.
- **O auxiliar de paginação não é testado nas bordas** de limite zero, negativo ou deslocamento fracionário.

## R5.5 Próximos passos

Revisão humana da árvore e tag `seed-v1`. Depois disso, a semente destrava os quatro artefatos que dependem dela: testes ocultos de T1, runner, script de convenções e as configurações de contexto P1 e P2.

---

# Rodada 6 — 15/09/2026

Sessão curta de planejamento, ocorrida logo após a construção da semente. Decide como validar a semente e o que vem a seguir. Só decisões; o estado corrente do projeto passa a viver em `05-log-de-implementacao.md`.

## R6.1 Golden standard: sim para T1, não para T2

**Proposta do usuário:** definir uma implementação de referência para cada enunciado, como "o mínimo aceitável de uma solução sem erros", e a partir dela validar se as métricas fazem sentido.

**Para T1, aceito, e já era obrigatório.** O critério de pronto dos testes ocultos exige validação contra implementação de referência humana, provando que cem por cento é alcançável.

**Para T2, recusado.** R2.2 já havia rejeitado golden standard com esta justificativa: pressupõe resposta certa, que não existe. T2 mede convergência precisamente porque não há resposta certa. Definir agora a solução correta de T2 quebraria duas coisas: contradiria uma decisão registrada, e faria quem escrever o classificador dos pontos de decisão calibrar contra aquela solução, que é o viés de expectativa que o protocolo tenta evitar.

**Substituto adotado, que atende à necessidade real por trás do pedido:** escrever **duas soluções de sondagem para T2, deliberadamente diferentes entre si**. Não são a resposta certa. Servem para testar se o classificador consegue distinguir as escolhas nos dez pontos de decisão, e para calibrar o prompt do avaliador cego, que precisa de diffs de exemplo e hoje não tem nenhum. É a verificação 9 do portão do piloto, antecipada e barata.

## R6.2 Testes ocultos antes da implementação de referência, e referência escrita às cegas

**Correção de ordem.** A proposta do usuário era referência primeiro, depois métricas, depois testes. A ordem correta é a inversa.

Se a referência vem primeiro, os testes tendem a ser escritos para casar com as escolhas dela, passando a depender de detalhes de implementação em vez do contrato do enunciado — o que a regra 2 da seção 2.5 do protocolo proíbe explicitamente.

Com os testes primeiro, a referência vira o que ela deve ser: **um teste de falsificação do enunciado e da suíte**. Se alguém competente, lendo apenas o enunciado e a semente, produz algo que os testes reprovam, então ou o enunciado está incompleto ou os testes especificam demais. Isso é a verificação 7 do portão do piloto, antecipada.

**Condição obrigatória:** quem escreve a referência não pode ter visto os testes ocultos. Sem isso o instrumento não vale nada.

## R6.3 Sonda de efeito teto com agente cru

Além da referência humana, rodar **uma sessão de agente sem contexto nenhum em T1** e medir. As duas respondem perguntas diferentes: a referência humana prova que a suíte é justa, e o agente cru mede quanto do resultado já vem de graça.

Se um agente sem harness passa em quase tudo, o efeito teto é real e T1 precisa endurecer. O valor está no momento: isso é sabível na semana 2, e não na semana 4, quando corrigir custaria refazer.

O efeito teto é o risco de maior impacto do projeto desde a rodada 1, e até aqui não tinha nenhuma sonda antes do piloto.

## R6.4 Regra 1 do script de convenções corrigida de novo

R4.7 já havia ampliado a regra para admitir `src/shared/`. Com a semente construída, ficou claro que ainda estava estreita: existem sete arquivos de produção legítimos fora de módulos e compartilhados, na camada de plugins, no acesso ao banco e na raiz de `src`.

**Corrigido para admitir também `src/plugins/`.** Sem isso, um agente que acrescentasse um plugin legítimo levaria violação, e P1 estaria declarando ao agente uma regra falsa sobre o próprio projeto, que ele poderia verificar lendo o código.

Lição registrada para as regras restantes: **elas foram escritas antes da semente existir e precisam ser reconferidas contra a estrutura real** antes de virarem o texto de P1.

## R6.5 Separação entre log de decisões e log de estado

**Observação do usuário:** este arquivo virou um quebra-galho geral demais para ser usado.

**Aplicado:** criado `docs/05-log-de-implementacao.md`, curto e reescrito a cada sessão, respondendo onde o projeto está e o que vem a seguir. Este arquivo continua append-only e responde por que cada decisão foi tomada, com as alternativas rejeitadas.

**Regra para sessões futuras:** decisão com racional entra aqui, como nova rodada. Estado, progresso e próximos passos entram no log de implementação, sobrescrevendo o que estava lá.

## R6.6 Enunciados versionados

T1 e T2 saíram do log e do protocolo e passaram a viver em `tasks/`, cada um contendo exatamente o texto que o agente recebe e nada mais. Metadados ficam no README daquele diretório, nunca dentro do enunciado. O texto de T2 foi conferido caractere a caractere contra a seção 2.3 do protocolo.

**Novo item em aberto:** o cabeçalho de T1 traz o rótulo `T1`, enquanto T2 traz um identificador realista de ticket. Decidir antes de M3 se T1 recebe um identificador realista também, para que os dois pareçam itens de backlog em vez de itens de um experimento. Não foi alterado agora porque R4.13 declara os textos definitivos até M3.

---

# Rodada 7 — 15/09/2026

Decisões do usuário sobre os itens em aberto após a validação da semente, e a reconferência das nove regras de convenção contra a semente construída.

## R7.1 Rótulo de T1 mantido, de propósito

O enunciado de T1 começa com o rótulo `T1`, enquanto T2 chega como `RES-142`. Foi levantado que os dois deveriam parecer itens de backlog e não itens de um experimento.

**Decisão do usuário: manter como está.** "Isso é proposital, vamos manter dessa forma pra ver como o agente se sai com esses marcadores."

Passa a ser objeto de observação, não defeito. Se o comportamento do agente diferir de forma perceptível entre os dois enunciados por causa do rótulo, isso é achado a reportar, não ruído a corrigir.

## R7.2 Sonda de efeito teto roda depois dos testes ocultos, e mede mais que teto

**Decisão do usuário:** a sessão de agente cru só é rodada quando os testes ocultos estiverem prontos. O objetivo é mais amplo do que eu havia proposto: além do efeito teto, validar **se as métricas que o experimento coleta fazem sentido** numa sessão real.

Isso muda a ordem: testes ocultos, depois implementação de referência, depois a sessão crua. E torna a sessão crua um ensaio do instrumento inteiro, não só uma sonda de um risco.

## R7.3 Implementação de referência escrita por agente

**Decisão do usuário:** a referência será escrita por um agente, não por uma pessoa. Esse agente não faz parte da avaliação, sabe exatamente o que está fazendo, e produz a resposta mínima aceitável. O usuário verifica o resultado, mas a implementação é inteiramente decidida pelo agente.

**Isto revisa R6.2 e a seção 2.5 do protocolo**, que exigiam autoria humana. A consequência precisa ser declarada no artigo: a prova de que cem por cento é alcançável passa a vir de um agente da mesma família sob teste, o que é uma evidência mais fraca do que autoria humana independente.

**Premissa que eu assumi e que precisa ser desmentida se estiver errada:** o agente de referência vê o enunciado e a semente, e **nunca os testes ocultos**. Se ele vir os testes, a referência deixa de provar que o enunciado é suficiente e passa a provar apenas que os testes são satisfazíveis, que é uma afirmação quase vazia. Toda a força do instrumento está nessa cegueira.

## R7.4 Prioridade: chegar a uma sessão crua de ponta a ponta antes de qualquer cerimônia

**Instrução do usuário, e ela reorienta o plano:** o objetivo é ter a semente e os testes prontos para validação e então rodar uma sessão crua de ponta a ponta. Essa sessão é o dado mais importante, mais que qualquer revisão de relatório. Ela informa se a coleta de dados está correta e se existe algo na semente ou nos testes que trave a execução.

**Consequência:** a tag de congelamento, a revisão formal da árvore e o restante da cerimônia deixam de ser pré-requisito do trabalho seguinte. Isso não os cancela, apenas os tira do caminho crítico. E revoga minha recomendação anterior de escrever a spec completa do runner antes dos testes: o caminho mais curto até a primeira sessão passa por um **runner mínimo**, capaz de preparar a cópia de trabalho, executar o agente com o enunciado e aplicar os testes ocultos, e não pelo runner completo com todas as métricas.

Isso também realinha o projeto com a definição original de M2, que sempre foi "uma sessão executada do início ao fim", e não "runner completo".

## R7.5 Reconferência das nove regras de convenção contra a semente construída

As regras foram escritas antes de a semente existir. Confrontadas com a estrutura real, quatro estavam mal calibradas.

| Regra | Situação | Correção |
|---|---|---|
| 1, estrutura de arquivos | Estreita demais pela segunda vez | Passa a admitir `src/plugins/`, além de módulos e compartilhados. Sete arquivos de produção legítimos vivem fora dos dois primeiros |
| 3, configuração alterada | Faltavam arquivos, incluindo o mais grave | Passa a enumerar também `prisma/schema.prisma`, `docker-compose.yml`, `.dockerignore`, `.prettierrc`, `.editorconfig` e `.gitignore`. Alterar o modelo de dados era um ato de grande impacto e não contava nada |
| 4, escapes de tipo | Ambígua sobre um uso legítimo | Escopo fixado em `src/`. E registrado que reusar o auxiliar `DateString`, que usa `Type.Unsafe`, **não é violação**: contá-lo penalizaria o reuso que o checklist do avaliador premia |
| 8, `console` em produção | Escopo indefinido | Fixado em `src/`. O carregador de dados de demonstração é script de desenvolvimento, não produção |
| 2, 5, 6, 7, 9 | Passaram sem ajuste | Regra 5 verificada por contagem: 21 rotas, 21 schemas |

**Decisão de implementação registrada:** as regras 4 e 8 são detectadas rodando o ESLint da semente com a **configuração congelada**, e não por expressão regular sobre o diff. Detectar asserção não-nula por busca textual é frágil, e a configuração da semente já reprova exatamente essas duas coisas. O congelamento da configuração é necessário porque alterá-la é, ela mesma, uma violação da regra 3.

**Lição que vale para os instrumentos restantes:** tudo que foi escrito antes de a semente existir precisa ser reconferido contra ela antes de virar texto de P1 ou código de medição. Isso inclui os dez pontos de decisão de T2, que até agora nunca foram confrontados com nenhuma saída real.

## R7.6 Regra de "rota sem schema" removida do script de convenções

**Contexto.** Ao revisar a sobreposição entre os instrumentos, apontei três pares em que o script determinístico e o checklist do avaliador cego mediriam a mesma coisa. Sob exame, só um dos três era duplicação de fato; os outros dois eram sobreposição parcial. Minha afirmação inicial de "três instrumentos medem a mesma coisa" foi mais forte do que a evidência sustentava, e o corte de três perguntas do checklist que eu havia recomendado era largo demais.

**Decisão do usuário:** nenhuma pergunta do checklist é cortada. Corta-se do **script de convenções** a regra "rota criada ou alterada sem schema de validação declarado", deixando essa verificação apenas com o avaliador cego, para reduzir a complexidade do script.

**Racional, que vale mais que a redução de duplicação.** Era a única regra do conjunto que não é uma verificação barata. As outras oito são comparação de caminho, diferença entre listas de chaves, comparação contra a cópia congelada, execução do linter ou busca textual. Essa exigiria localizar cada declaração de rota no diff e verificar se aquela declaração traz um schema, o que é análise de sintaxe. Uma expressão regular erraria em declaração de múltiplas linhas, em schema referenciado por nome, e no módulo `amenities`, que declara schemas dentro do arquivo de rotas — e erraria de forma silenciosa e sistemática, sempre na mesma direção.

**O script passa de nove para oito regras**, renumeradas. Referências cruzadas corrigidas no protocolo e na spec da semente, onde a regra de "teste pré-existente alterado" passou de 7 para 6.

**Registrado junto, para não virar omissão:** o laço entre a regra 5, que pergunta apenas se existe teste escrito pelo agente, e a pergunta 5 do checklist, que avalia se os testes existentes olham comportamento observável. As duas são mantidas por medirem coisas diferentes, mas `violacoes` e `qualidade` nunca podem ser citadas no artigo como evidências independentes do mesmo efeito.

**Também registrado:** a pergunta 1 do checklist, sobre lógica nova na camada de serviço, mede **aderência ao padrão canônico** e não qualidade em sentido amplo, já que a semente tem um módulo que deliberadamente não possui camada de serviço. Precisa ser rotulada assim no artigo.

---

# Rodada 8 — 16/09/2026

Planejamento do ambiente de execução, feito antes de especificar o runner.

## R8.1 O que falta não é separar repositórios, é um contrato de materialização

**Pergunta do usuário:** com tudo num repositório só, é preciso algum setup para separar os testes ocultos da semente antes de o runner rodar?

**Análise.** Existem quatro vias pelas quais os artefatos do estudo poderiam chegar ao agente. Três já estão fechadas: o sistema de arquivos, porque só `seed/` é materializado; o histórico do git, porque a cópia de trabalho nasce como repositório novo com um commit de mensagem neutra; e a rede, porque o repositório de artefatos fica privado até o fim da coleta.

A quarta é a única que nasce junto com o runner: **montar o diretório errado dentro do contêiner**. E separar repositórios não a fecha, porque as duas árvores estariam na mesma máquina de qualquer forma. O que fecha é o runner montar exatamente um diretório e verificar o que montou.

## R8.2 A suíte oculta roda do host, e nunca entra no contêiner

**Decisão do usuário.** O runner sobe o servidor dentro do contêiner, publica a porta e executa a suíte a partir do host, por HTTP.

**Isto revoga o passo 5 da seção 6 do protocolo**, que mandava copiar os testes ocultos para dentro da cópia de trabalho depois do fim da sessão.

**Por que importa mais do que parece.** A mudança não acrescenta uma mitigação: ela **remove** a classe de risco que a verificação 5 do portão do piloto existe para vigiar. Não há ordem a garantir nem vestígio a limpar quando o artefato nunca chega ao sistema de arquivos que o agente enxerga. Isso só é possível porque a suíte foi construída como script sem dependências que fala HTTP, decisão tomada na spec dos testes ocultos por outro motivo, o de ficar imune ao tooling que o agente possa ter quebrado.

O mesmo raciocínio vale para o enunciado, que chega como prompt e nunca como arquivo.

## R8.3 Separação dos repositórios adiada

**Decisão do usuário:** manter uma árvore só por enquanto.

**Racional.** A separação é trabalho de empacotamento para publicação, não de isolamento, e o contrato de materialização é idêntico com uma ou duas árvores. Fazê-la agora acrescentaria sincronização entre árvores justamente na fase em que o runner mais vai mudar, e não antecipa nada, porque o repositório de artefatos segue privado até o fim da coleta de qualquer maneira.

## R8.4 O que passa a ser exigência do runner

Registrado aqui para entrar na spec:

1. **Imagem de sessão** derivada da imagem da semente, acrescentando o CLI do agente.
2. **Materialização codificada**: extrair apenas `seed/`, iniciar repositório novo, um commit de mensagem neutra.
3. **Verificar o que o agente vai ver**, e não o que achamos que entregamos: rodar a checagem de vazamento **contra a cópia materializada**, não contra `seed/`.
4. **Segredo fora da árvore**: a chave de API entra por variável de ambiente e nunca por arquivo na cópia de trabalho, senão aparece no diff da sessão.
5. **Uma única montagem**, de saída, onde o runner grava diff e transcrições.
6. **Derrubada garantida** de contêiner e servidor mesmo quando a sessão falha.

## R8.5 A primeira sessão roda só com T1

**Decisão do usuário, na mesma conversa.** T2 não tem testes por construção, conforme R2.2, e o que falta para ela é o classificador dos pontos de decisão mais duas soluções de sondagem. Como o instrumento de T1 está inteiro e o de T2 não, a primeira sessão de ponta a ponta exercita o runner com o instrumento mais simples, descobrindo os defeitos do runner antes de exercitar o mais delicado.

---

# Rodada 9 — 17/09/2026

Reavaliação de T1 depois da primeira sessão real de ponta a ponta. Registrado aqui, e em detalhe técnico em `docs/superpowers/specs/2026-09-17-reavaliacao-de-t1-design.md`, que é a fonte primária deste resumo.

## R9.1 O que a sessão piloto mediu

Sessão `T1-P0-O1-mu4t4rvp`, executada em 16/09/2026, primeira execução real do runner de ponta a ponta, condição T1/P0/O1/Sonnet 5.

`taxa_aceitacao` saturou em **1.0** — 26 de 26 asserções da suíte oculta —, com `regressoes` zero, nenhuma das três causas de trava disparada, 30 de 40 turnos usados, 29 chamadas de ferramenta, custo de US$ 0,4209743, duração de 164 segundos e diff de 247 linhas.

**Defeito de instrumentação encontrado na mesma sessão.** A coluna `model_version` registrou `claude-haiku-4-5-20251001` numa sessão que rodou em Sonnet 5. O leitor de transcript tomava a primeira chave do mapa de uso por modelo, e o CLI reporta também um modelo auxiliar que usa para trabalho interno próprio. A conferência pelos tokens de saída não deixa dúvida: Sonnet produziu 14.813 tokens de saída e 0,4196 do custo; o auxiliar produziu 17 tokens e 0,0013. Corrigido na Tarefa 1 do plano de implementação: o modelo passa a ser identificado por quem produziu mais tokens de saída, não pela ordem das chaves.

## R9.2 Diagnóstico: por que a variável saturou

Quatro causas foram levantadas e verificadas contra a evidência.

**Causa principal: o enunciado era informacionalmente autossuficiente.** As regras numeradas do enunciado de T1 mapeavam uma a uma nos prefixos das asserções da suíte oculta — a regra 1 correspondia às checagens 1.x, a regra 4 às 4.x, e assim por diante. O enunciado entregava as duas únicas decisões reais: a semântica de borda (exatamente o que as checagens 1.5 e 1.6 medem) e os códigos de status 400/404/409, que já estavam dados. Consequência estrutural: tudo que um `CLAUDE.md` ou um plugin poderiam acrescentar já estava dentro do prompt, então P0, P1 e P2 recebiam a mesma informação por construção — o fator de contexto não tinha por onde se expressar.

**Causa co-principal: a variável medida era cega ao fator.** O canal previsto para o efeito de contexto sempre foi a aderência, e P1 é definido como arquitetura em camadas, convenções de nomenclatura, comandos e as regras da seção 2.6 — engenharia, sem regra de negócio. Das três variáveis-resposta declaradas para T1 (`taxa_aceitacao`, `violacoes`, `qualidade`), só a primeira estava construída, e é a única cega ao fator P.

**A faixa útil era menor do que a escala sugeria.** Das 26 asserções, 13 já passavam na semente intocada. Das 13 restantes, a regra 2 já era verdadeira por construção e a regra 7 saía de graça, sobrando cinco mudanças independentes de código. O instrumento reportava com duas casas decimais uma grandeza de cinco bits.

**A operação é canônica, e isto não é corrigível.** Detecção de sobreposição de intervalos é um dos problemas mais representados em dado de treino. Trocar o domínio compraria dificuldade ao custo da validade ecológica. Fica registrado como limitação, não como defeito a consertar.

**Hipótese levantada e descartada: volume da semente.** A semente tem 942 linhas de código de produção e o agente leu treze arquivos sem esforço, mas a implementação de referência toca só três arquivos, todos em `src/modules/bookings/`, sem acoplamento novo entre módulos. Acrescentar módulos não mudaria isso: a tarefa continuaria confinada. Volume só vira dificuldade quando a tarefa obriga o agente a encontrar algo distante; acrescentar volume sem acrescentar descoberta obrigatória faz o agente ler mais e pontuar igual. Descartada com essa evidência, não por suposição.

**Consequência sobre o fator M.** A sessão executou trinta turnos numa mudança de quatro arquivos, sem retrocesso e sem hipótese descartada pelo agente. Uma tarefa em que um modelo mais forte não teria como pontuar melhor não deixa folga para o fator modelo se expressar — o enunciado antigo comprometia dois dos três fatores do desenho, não só o contexto.

## R9.3 Decisões D1 a D8

**D1.** A política de domínio sai do enunciado e passa a viver em P1 e P2. O enunciado guarda a necessidade de negócio; os detalhes que ninguém adivinha — semântica de borda, limites de duração, efeito do cancelamento, proibição de passado, exigência de existência, alcance sobre operações de alteração — passam a ser conteúdo de contexto, dando ao fator P um canal na taxa de aceitação.

**D2.** A política de domínio entra em P1 e P2 igualmente, não só no nível mais alto. Se P1 recebesse só estrutura e P2 recebesse estrutura mais negócio, os dois níveis diferiam em duas dimensões ao mesmo tempo e nenhum resultado seria atribuível a uma delas. Mantida nos dois, P0 vs. P1 mede o harness como um todo, e P1 vs. P2 isola o que os procedimentos passo a passo acrescentam.

**D3.** O agente em P0 é medido contra regras que não lhe foram informadas. Decisão explícita do orientando, tomada em 17/09/2026, com ciência de que é o ponto mais atacável do desenho. Justificativa: isto **é** o tratamento — mede-se o desenvolvedor que cai num projeto sem documentação, situação que o harness existe para remediar. A alternativa, informar todos os níveis igualmente, reproduz o enunciado autossuficiente e devolve o efeito teto.

**D4.** O script de convenções da seção 2.6 é construído e passa a rodar também em T1. Não é instrumento novo: `violacoes` já era coluna declarada para as duas tarefas; é dívida de implementação, não ampliação de escopo.

**D5.** A tarefa continua incremental; reconstruir o módulo do zero fica recusado por ora. É a direção metodologicamente certa para o fator M, mas colide com o limite de quarenta turnos da seção 3.4 e levaria o custo por sessão de US$ 0,42 a cerca de US$ 1,50, estourando os 55 sessões planejadas para além dos US$ 20 comprados, além do risco de sessões invalidadas por estouro de turno.

**D6.** O tamanho de T1 e a folga do fator M ficam como questão aberta com data de revisão: quando as vinte sessões de células de modelo da seção 4.4 forem coletadas, depois da pré-defesa.

**D7.** A semente não é alterada. É compartilhada pelas duas tarefas, já foi auditada, tem linha de base medida e tem o defeito parcial de que T2 depende. Nenhuma das decisões acima exige tocá-la.

**D8.** Nada que seja disciplina de engenharia entra no enunciado. Instruções como "não quebre o que já funciona", "escreva testes" ou "siga o padrão do projeto" são precisamente o conteúdo que distingue os níveis de P; postas no enunciado, são entregues igualmente a todos e suprimem a variação que os instrumentos existem para capturar.

## R9.4 Consequência sobre os dados já coletados

A sessão piloto mediu o enunciado antigo e não é comparável com o que vier depois. Não é descartada — nenhuma sessão é, por princípio já declarado nesta rodada 5 do log —, mas sai do dataset de coleta e passa a `resultados-piloto.csv`, com este registro do motivo. O dataset de coleta (`resultados.csv`) recomeça vazio, com o mesmo cabeçalho de 41 colunas, que não muda. Nenhuma coluna foi acrescentada ou removida: `violacoes` e `qualidade` já existiam e estavam vazias.

A suíte oculta e a implementação de referência não foram tocadas: as 26 asserções continuam idênticas, a linha de base contra a semente intocada continua 13/26 e a referência continua 26/26. Só o enunciado mudou, depois de a suíte e a referência já estarem prontas e validadas — o que precisa ser declarado no artigo como reescrita à luz de um resultado, não como ajuste anterior aos dados.

---

# Rodada 10 — 13/11/2026

Devolutiva do orientador sobre a primeira versão revisada do artigo (`TCC_2026_revisado`, 41 notas). Esta rodada registra a decisão sobre uma delas, a que questiona o desenho; as demais são de redação e formatação e não mudam o desenho.

## R10.1 A nota

Sobre a Tabela III (sessões por modelo: Sonnet 5 em 6 combinações, 30 sessões; Haiku 4.5 e Opus 5 em 2 combinações, 10 sessões cada): *"Por que o teste com combinações diferentes? Isso invalida a comparação final pois a torna injusta."*

## R10.2 Diagnóstico: onde a nota procede e onde não

**Não procede contra o desenho.** As células de modelo não são uma redução feita durante a coleta: estão no desenho desde a rodada 1 (seção 4 deste log; protocolo, seção 4.2). A grade completa P × O roda no Sonnet para isolar contexto e ordem (PP1, PP2). Haiku e Opus existem só para PP3, que compara o ganho de trocar o harness com o ganho de trocar o modelo, e para isso os três modelos rodam nas mesmas duas configurações (P0-O1 e P2-O2), com o mesmo número de sessões por configuração. Nessa comparação nenhum modelo é favorecido.

**Procede contra o texto.** Vários trechos dos resultados comparam modelos somando todas as sessões do Sonnet, das seis configurações, contra as duas configurações extremas dos outros dois: custo médio por modelo, complexidade por modelo (Fig. 4), consulta de horários sem limite (1 de 18 do Sonnet contra 5 de 6 do Opus), requisito de quem organiza várias reservas sem guia, e requisito explícito de T2. São grupos de composição diferente, e é aí que a crítica se sustenta.

## R10.3 Decisão: recusado coletar as células que faltam; o texto é corrigido

**Decisão do usuário, 13/11/2026.** Não se coletam Haiku e Opus nas quatro configurações intermediárias. A resposta ao orientador defende o desenho, e o artigo é corrigido para que toda comparação entre modelos use apenas as sessões P0-O1 e P2-O2 dos três (10 sessões por modelo).

**Por que a coleta foi recusada:**

1. **Não responde à crítica que procede.** A parte da nota que se sustenta é sobre como o texto agrega as sessões, e se corrige recalculando sobre dados que já existem.
2. **Compraria uma pergunta nova, não validade para as atuais.** Completar a grade permitiria estudar a interação entre modelo e contexto ou ordem, o que nenhuma PP pergunta. Com duas ou três repetições por célula e análise descritiva, oito células novas somariam sobretudo ruído. A ausência delas não invalida a PP3, então a regra de que o escopo só cresce quando a falta invalida a pesquisa não é atendida.
3. **Pioraria a comparação em vez de melhorá-la.** `model_version` registra o apelido (`claude-opus-5`), não uma versão datada, e o controle de deriva não foi executado (protocolo, seção 8). Células coletadas sete semanas depois das de setembro misturariam o efeito de configuração com o efeito do tempo, sem como separá-los, a menos que se recoletassem também células de controle.
4. **Custo.** Opus nas quatro configurações: cerca de US$ 49 (4 × [2 × 1,80 + 3 × 2,87], médias observadas por sessão em T1 e T2). Só o Opus não basta: o Haiku viraria o modelo incompleto e a mesma crítica valeria para ele (mais cerca de US$ 5). Com avaliação cega, cerca de US$ 56 no total, mais do que tudo o que a coleta e a avaliação custaram até aqui (US$ 53,80 + 2,83). A isso se somam a reauditoria, a reanálise, o refazimento das Tabelas III e V e das Figs. 3 a 5 e a reescrita de Resultados e Discussão, com a entrega em 14/11.

**O que fica no artigo:** a limitação já declarada (em Haiku e Opus não se separa contexto de ordem) permanece, e testar esses modelos nas configurações intermediárias passa a constar como trabalho futuro.

## R10.4 Consequência

Nenhuma alteração em dados, ferramentas ou protocolo. A lista dos trechos e figuras do artigo a corrigir, com o texto atual e as mudanças necessárias, é o próximo passo da redação.

---

# Rodada 11 — 13/11/2026

## R11.1 Decisão: o plugin deixa de ser a condição P2 e passa a ser derivado dos resultados

**Decisão do usuário, 13/11/2026.** O artigo não depende do plugin. O que foi medido em P2 passa a ser descrito pelo que o agente recebeu: o guia (`CLAUDE.md`, idêntico ao de P1) e um conjunto de três skills. O plugin aparece no artigo como entregável, mencionado na Discussão, construído a partir dos resultados e com uma ideia de toolkit para trabalhar com agentes de programação. A dependência vai num sentido só: o plugin depende do estudo, o estudo não depende do plugin.

**Motivo:** o plugin não está pronto e pode evoluir até a apresentação (M9). Enquanto ele fosse a própria condição P2, qualquer mudança nele o afastaria do que foi medido, e o artigo estaria citando um artefato diferente do que descreve.

**Isto reverte uma restrição desta sessão de planejamento.** A seção 6 da rodada 1 dizia "O plugin é a condição P2, não um entregável paralelo", e o plano de projeto (seção 6) descrevia o plugin como "a materialização do achado — é o que permite a qualquer pessoa reproduzir a configuração de melhor resultado". Os dados já tinham enfraquecido essa segunda frase: P2 não diferiu de P1 em nada que foi medido e custou mais, e a própria Discussão do artigo recomenda pôr as regras no arquivo de instruções em vez de depender de skills opcionais. A devolutiva original do orientador (o plugin "funciona bem como artefato de apresentação", seção 1) continua atendida.

## R11.2 O que isso não muda

- **Nada nos dados, no protocolo ou em `contexts/P2/`.** A condição que rodou continua congelada e continua sendo o que o artigo descreve. Tecnicamente, as skills de P2 foram carregadas como um pacote local de plugin (`contexts/P2/plugin/`, via `--plugin-dir`). Isso é detalhe de implementação, registrado no repositório. O artigo descreve o conteúdo que o agente recebeu, e não nega o mecanismo.
- **Os resultados sobre P2 continuam no artigo**, atribuídos às skills: sem diferença contra P1, consulta em 14 das 20 sessões em que estavam disponíveis, nenhuma no Haiku.

## R11.3 Consequências pendentes no repositório

Ficam registradas aqui para não serem esquecidas; nenhuma foi executada nesta rodada:

1. `plugin/README.md` ("O pacote é uma cópia de `contexts/P2/`, nunca uma versão nova dela") e `plugin/test/fidelity.test.mjs`, que reprova qualquer divergência byte a byte com `contexts/P2/`. Essa guarda impede justamente a evolução decidida aqui. Antes de mudá-la, marcar com uma tag o estado atual do pacote (1.0.0, idêntico a P2), para que a versão equivalente à condição medida continue recuperável.
2. `plugin/meeting-rooms-conventions/README.md` apresenta o plugin como "o tratamento P2" e reporta o resultado do estudo sobre ele. Quando o plugin mudar, isso deixa de ser verdade.
3. `docs/03-plano-de-execucao.md`, seção 5: o critério de pronto "corresponde à condição P2 usada na coleta" sai. `docs/01-plano-de-projeto.md`, seção 6: a descrição do entregável muda.

## R11.4 Execução das consequências, na mesma data

**Decisão do usuário:** executar as três, começando pela tag.

1. **Tag `plugin-v1.0.0-p2`**, anotada, no commit `e7e7392`. Antes de criá-la, a guarda de fidelidade passou (4 de 4) e o pacote estava limpo contra o HEAD. É o ponto em que o plugin publicado ainda equivale à condição medida.
2. **Guarda de fidelidade retirada.** `plugin/test/fidelity.test.mjs` virou `plugin/test/marketplace.test.mjs`. Ficou só a verificação de que o catálogo aponta para o pacote e tem a mesma versão do manifesto, que continua valendo enquanto o plugin evolui. As três verificações byte a byte contra `contexts/P2/` saíram; elas existem no histórico e valem para a tag.
3. **READMEs.** O de manutenção (`plugin/README.md`) troca "o pacote é uma cópia de `contexts/P2/`" pela regra nova e manda subir a versão a cada mudança de conteúdo. O público diz que a 1.0.0 é idêntica a P2, separa "como instalar" de "como reproduzir P2" (pela tag ou por `contexts/P2/`, nunca pelo `main`) e declara que os resultados do estudo valem para a condição P2, não para versões posteriores. O catálogo deixa de chamar o plugin de "a condição P2 do estudo, empacotada sem alteração".
4. **Planos.** Critério de pronto do plugin (plano de execução, seção 5) e descrição do entregável (plano de projeto, seção 6) revisados, com a data e a referência a esta rodada.

`contexts/P2/` e o runner não foram tocados.

