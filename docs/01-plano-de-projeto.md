# Plano de Projeto

**Título:** Engenharia de harness para agentes de IA: um estudo comparativo do impacto de modelo, prompt e ordem de execução na geração de software

**Curso:** Engenharia de Software — INATEL
**Equipe:** 4 integrantes
**Marcos:** pré-defesa 03/10/2026 · entrega do artigo 14/11/2026 · banca até 05/12/2026
**Formato do artigo:** modelo INATEL/Revista Telecomunicações — coluna dupla, Times New Roman, **figuras sem cor**, resumo e abstract de no máximo 150 palavras.

---

## 1. Para que serve este documento

Documento de entrada do projeto: explica o problema, o que vamos entregar e como o trabalho está dividido. Quem for executar precisa ler também:

- **`02-protocolo-experimental.md`** — a definição técnica completa do experimento. Descreve exatamente o que será construído e medido.
- **`03-plano-de-execucao.md`** — cronograma, divisão de tarefas e critérios de pronto.

## 2. Glossário

Estes termos têm significado preciso em todos os documentos.

| Termo | Significado neste projeto |
|---|---|
| **Agente de IA** | Um modelo de linguagem operando em modo autônomo, com permissão para ler e escrever arquivos e executar comandos no terminal. No nosso caso, o Claude Code. |
| **Harness** | Tudo que envolve o modelo e condiciona seu comportamento sem alterar o modelo em si: instruções recebidas, arquivos de contexto visíveis, regras a seguir e a sequência de etapas em que o trabalho é conduzido. É o objeto de estudo deste trabalho. |
| **Sessão** | Uma execução completa e isolada: parte-se de uma cópia limpa do repositório, o agente recebe uma tarefa sob uma configuração específica, trabalha até terminar, e o resultado é medido. É a unidade de dado — cada sessão vira uma linha na planilha de resultados. |
| **Repositório-semente** | Um projeto de software pequeno e funcional, construído por nós, congelado em um commit fixo. Toda sessão começa a partir dele, exatamente no mesmo estado. |
| **Testes ocultos** | Suíte de testes automatizados que verifica objetivamente se a funcionalidade pedida ficou correta. O agente **nunca** os vê; são aplicados só depois que a sessão termina. Usados apenas na tarefa bem especificada. |
| **Ponto de decisão** | Uma escolha que um enunciado ambíguo força o agente a fazer sem determinar qual é a certa (por exemplo: retornar horários livres ou ocupados). Usados para medir convergência na tarefa ambígua. |
| **Convergência** | O quanto execuções diferentes da mesma configuração chegam às mesmas decisões. É a variável-resposta da tarefa ambígua. |
| **Avaliador cego** | Um modelo de linguagem que classifica os diffs produzidos, respondendo perguntas fechadas. Recebe apenas o diff e o enunciado — nunca sabe qual configuração produziu aquele resultado. |
| **Runner** | O script que automatiza tudo: prepara o repositório, roda o agente, aplica os instrumentos de medida, coleta as métricas e grava o resultado. Sem ele o experimento não é viável. |
| **Célula** | Uma combinação específica dos fatores em estudo (por exemplo: Sonnet + contexto P1 + ordem O2). Cada célula é executada várias vezes. |

## 3. Contexto e problema

Empresas estão adotando agentes de IA para desenvolvimento de software em ritmo acelerado, mas a configuração do harness vem sendo definida por tentativa e erro. Cada equipe descobre por conta própria quanto contexto fornecer, como estruturar instruções e em que sequência conduzir o trabalho. Esse processo empírico consome tempo e orçamento de API, e produz configurações que raramente são comparadas de forma controlada.

Agrava o problema o fato de que a discussão pública sobre desempenho de agentes se concentra quase inteiramente na escolha do modelo, tratando o harness como detalhe de implementação. Não existe evidência sistemática sobre a magnitude relativa desses fatores — se vale mais investir em um modelo melhor ou em uma configuração melhor.

Há ainda um segundo aspecto, menos discutido e mais próximo da dor real das equipes. Problemas bem definidos costumam ser resolvidos bem por qualquer configuração. O que gera retrabalho é o pedido vago — a demanda que chega sem triagem, descrevendo um sintoma e não uma solução. Nesses casos o agente não erra exatamente: ele produz coisas **diferentes** a cada execução, e a equipe não consegue prever o que vai receber. É essa imprevisibilidade, mais do que a incorreção, que este trabalho se propõe a medir.

## 4. Objetivo geral

Medir, sob condições controladas, como a escolha do modelo, o contexto estático fornecido ao agente e a ordem de execução afetam tanto a **correção** em tarefas bem especificadas quanto a **previsibilidade** em tarefas ambíguas.

## 5. Perguntas de pesquisa

- **PP1.** Qual o efeito do contexto estático fornecido ao agente sobre correção, convergência, custo e aderência a convenções?
- **PP2.** Qual o efeito da ordem de execução — instrução única versus segmentação em etapas com checkpoints — sobre as mesmas variáveis?
- **PP3.** Os efeitos de harness se mantêm ao variar a capacidade do modelo? Um modelo mais capaz compensa um harness pior?
- **PP4.** O efeito do harness é diferente conforme o requisito seja bem especificado ou ambíguo?

PP3 e PP4 são as que dão relevância prática. PP3 espelha a decisão de investimento que as equipes enfrentam. PP4 testa a hipótese central do trabalho: *harness melhor não deixa o agente mais inteligente, deixa o agente mais previsível* — e portanto importa sobretudo onde o requisito é vago, que é a maior parte do trabalho real.

## 6. Entregáveis

**Avaliados pela banca:**

| Entregável | Descrição |
|---|---|
| **Artigo** | Paper curto no modelo INATEL, reportando desenho, resultados principais e limitações |
| **Plugin** | Publicado no marketplace, contendo as skills e rules da configuração de melhor desempenho |

**De apoio, publicados no repositório e citados no artigo:** repositório-semente congelado, enunciados das tarefas, lista de pontos de decisão, suíte de testes ocultos, prompts do avaliador cego, runner, dataset completo em CSV e dicionário de dados.

**O plugin não é um produto paralelo.** Ele é o tratamento experimental de maior nível de contexto (a condição P2 do protocolo). O estudo funciona como sua validação empírica, e ele funciona como a materialização do achado — é o que permite a qualquer pessoa reproduzir a configuração de melhor resultado.

## 7. Escopo

**Dentro:** modelos da família Claude via API; uma stack (Node/TypeScript); um domínio de aplicação; desenvolvimento sobre base de código existente; uma tarefa bem especificada e uma tarefa ambígua; sessões 100% automatizadas.

**Fora:** outros fornecedores de modelo; múltiplas linguagens ou stacks; tarefas de interface e experiência visual; correção de bugs e refatoração como categorias próprias; sessões com humano no circuito; aplicação demonstrativa como produto final; avaliação econômica em produção.

## 8. Decisões estruturantes já tomadas

Fechadas. Não devem ser reabertas sem discussão com o orientador. O racional completo de cada uma está no log da sessão de planejamento.

1. **Sessões 100% autônomas.** Com quatro pessoas rodando sessões, a intervenção humana viraria uma variável não controlada com quatro estilos diferentes, abafando os efeitos em estudo. A necessidade de resgate é capturada como métrica de saída, não como tratamento.
2. **Coleta oficial exclusivamente via API**, não pelo plano Pro. Contagem exata de tokens, sem limite de uso interrompendo execução, dataset homogêneo. O Pro fica para desenvolvimento.
3. **Ordem de execução imposta pelo runner, nunca por um humano.** Cada nível é um pipeline fixo de prompts encadeados, idêntico em toda rodada.
4. **Duas tarefas de naturezas deliberadamente distintas**, medidas por instrumentos distintos: a bem especificada por testes ocultos, a ambígua por convergência entre execuções. A comparação entre as duas é o resultado central do trabalho.
5. **Não existe teste para a tarefa ambígua, e isso é proposital.** Se fosse possível escrever asserções que definem o certo, a tarefa não seria ambígua — escrever o teste seria especificá-la. Por isso a variável-resposta muda de acerto para dispersão.
6. **Avaliação por modelo apenas em formato binário e cego à condição.** Notas em escala numérica foram rejeitadas: variam entre execuções e não têm âncora. Perguntas de sim/não, sem qualquer informação sobre a condição da sessão, são estáveis e defensáveis. A confiabilidade do instrumento é medida por concordância com uma amostra classificada por humano — revisão de 21/09/2026, que substituiu o voto majoritário de três chamadas previsto originalmente.
7. **Testes ocultos e pontos de decisão congelados antes do desenvolvimento do plugin**, para evitar calibração inconsciente ao comportamento que já sabemos que ele produz.
8. **Estudo exploratório e descritivo.** Reportamos médias, dispersão e tamanho de efeito. Testes de significância não sustentariam conclusão com este número de observações.

## 9. Prioridade de esforço

O projeto é dirigido por marcos e portões, definidos no `03-plano-de-execucao.md`. Não há atribuição fixa de pessoas nem cerimônias com data marcada; o que orienta o trabalho é o que precisa existir em cada marco.

Uma única prioridade vale acima das demais: **a infraestrutura de pesquisa vem antes de tudo.** Repositório-semente, runner, enunciados e instrumentos de medida. Coletar dados, escrever o artigo e publicar o plugin são trabalho mecânico depois que ela existe e foi validada pelo piloto.

Disso decorrem duas consequências que a equipe deve ter claras:

- **O piloto é o portão mais importante do projeto.** Depois dele o runner executa 50 sessões sem supervisão. Qualquer defeito no runner, na semente ou na metodologia será replicado silenciosamente em todas elas e só aparecerá na análise, quando não houver mais tempo de refazer. Nunca se abrevia o piloto para recuperar cronograma.
- **O plugin publicado não é pré-requisito da pré-defesa.** A condição P2 precisa existir como conjunto funcional de arquivos antes da coleta, senão duas das seis células da grade não rodam. Mas empacotar, documentar e publicar no marketplace é trabalho de novembro.

## 10. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Efeito teto em T1**: todas as condições aprovam quase 100% dos testes | Alto | Calibrar no piloto da semana 3; endurecer critérios de aceitação antes da coleta. Note que T2 não sofre desse risco, já que mede dispersão |
| **T2 ambígua demais**: saídas tão distintas que nem os pontos de decisão se aplicam | Alto | Validar no piloto; se ocorrer, acrescentar ao ticket uma restrição de escopo que estreite sem revelar a solução |
| **Avaliador cego instável** entre suas próprias chamadas | Médio | Voto majoritário de três; taxa de desacordo medida no piloto e reportada. Perguntas com desacordo alto são reescritas antes do congelamento |
| Custo de API acima do previsto | Médio | O piloto mede o custo real por sessão; as células de modelo podem ser reduzidas a um modelo |
| Instrumentação quebra durante a coleta | Alto | Piloto com portão de doze verificações antes de qualquer coleta; protocolo congelado logo após |
| Versão do modelo muda entre janelas | Médio | Versão e data por sessão; célula de controle re-executada |
| Indisponibilidade de integrante | Médio | Coleta desassistida; folga preservada nas semanas 9 e 10 |

## 11. Critérios de sucesso

1. Dataset completo com as 55 sessões planejadas, ou justificativa registrada para as ausentes.
2. Ao menos um efeito de harness reportado com tamanho de efeito, distinguível do ruído entre execuções repetidas.
3. Comparação explícita entre o ganho atribuível ao harness e o atribuível ao modelo.
4. Comparação explícita entre o comportamento do harness na tarefa bem especificada e na tarefa ambígua.
5. Plugin publicado e instalável a partir do marketplace.
6. Artigo entregue em 14/11 e experimento reproduzível por terceiros a partir dos artefatos publicados.
