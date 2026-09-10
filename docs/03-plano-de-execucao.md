# Plano de Execução

Pressupõe a leitura do `01-plano-de-projeto.md` e do `02-protocolo-experimental.md`.

---

## 1. Como este plano funciona

O projeto é dirigido por **marcos e portões**, não por cerimônias. Não há reunião marcada, não há atribuição fixa de pessoas a frentes. O que orienta o trabalho é a lista de entregas de cada marco e o portão que separa um marco do seguinte.

**Regra única:** não se avança para o marco seguinte enquanto o portão do marco atual não estiver satisfeito. Portão não é checklist de boas intenções — é condição binária verificável.

Dois princípios estruturam a ordem dos marcos.

**A infraestrutura de pesquisa é o produto do primeiro bloco.** Repositório-semente, runner, enunciados e instrumentos de medida. Tudo o mais é consequência: coletar dados, escrever o artigo e publicar o plugin são trabalho mecânico depois que a infraestrutura existe e foi validada. Se o esforço da equipe tem que se concentrar em algum lugar, é aqui.

**O piloto é o portão mais importante do projeto.** Ele tem seção própria abaixo, antes dos marcos, porque é ele que dirige tudo o que vem antes e libera tudo o que vem depois.

## 2. O piloto — M3

### Por que ele é o item mais crítico

Depois do piloto, o runner roda 50 sessões sem ninguém olhando. Se houver qualquer defeito no runner, no repositório-semente ou na metodologia, ele será replicado em todas elas silenciosamente, e só vai aparecer na análise — quando não houver mais tempo nem orçamento para refazer.

O piloto é a única oportunidade de descobrir esses problemas enquanto eles ainda são baratos. Ele é o que dá segurança para rodar sem supervisão, previsibilidade de custo e confiança de que os dados que chegam ao CSV são os dados certos.

**Consequência prática: tudo antes de M3 existe para viabilizar o piloto, e nada depois de M3 começa antes de ele passar.** Se o piloto atrasar, o cronograma inteiro desloca junto — nunca se pula o piloto para recuperar tempo.

### Composição

Seis sessões, executadas exatamente como as sessões reais:

- **Cinco sessões na célula P2-O2** (2 de T1, 3 de T2). Escolhida por exercitar o caminho mais complexo: instalação do plugin, pipeline de quatro chamadas encadeadas e as duas tarefas. Se esse caminho funciona, P0, P1 e O1 são estritamente mais simples.
- **Uma sessão de fumaça em P0-O1**, para exercitar o extremo oposto: nenhum arquivo de contexto e chamada única.

Adicionalmente, **uma sessão interrompida de propósito** no meio da execução, para confirmar que o runner a marca como inválida e permite re-execução limpa.

**As sessões do piloto não integram o dataset.** O protocolo ainda pode mudar em função delas, então usá-las como dado misturaria versões diferentes do protocolo.

### Portão de M3 — as doze verificações

O piloto está aprovado quando **todas** forem verdadeiras. Qualquer uma falsa bloqueia o avanço.

**Instrumentação**

1. As seis sessões rodaram de ponta a ponta sem intervenção humana.
2. Todas as colunas do CSV estão preenchidas e com valores plausíveis, em todas as linhas.
3. Diff e transcript de cada sessão foram arquivados e são legíveis.
4. A sessão interrompida foi marcada como inválida e re-executada com sucesso.
5. **Nenhuma sessão teve contato com os testes ocultos.** Verificado inspecionando o transcript e o diretório de trabalho durante a execução. Esta é a verificação mais fácil de esquecer e a que invalidaria o experimento inteiro.

**Metodologia**

6. Não há efeito teto em T1: a taxa de aceitação não é 100% em todas as sessões.
7. Os testes ocultos não falharam por motivo irrelevante (nome interno diferente, detalhe de implementação). Falhas devem corresponder a comportamento realmente ausente.
8. Os dez pontos de decisão de T2 são classificáveis nas saídas produzidas — nenhum ficou `ausente` nas três execuções.
9. As três execuções de T2 não foram nem idênticas nem incomparáveis. Se foram idênticas, o ticket é específico demais; se não há o que comparar, é ambíguo demais.
10. O avaliador cego tem taxa de desacordo aceitável entre suas três chamadas. Perguntas com desacordo alto são reescritas antes do congelamento.
11. A sessão de fumaça em P0 e as sessões em P2 **não produzem a mesma contagem de violações de convenção**. Se produzirem, o padrão da semente ficou auto-evidente demais e o fator de contexto está sendo medido atenuado. Ainda há tempo de corrigir antes do congelamento; depois, não.

**Viabilidade**

12. O custo médio por sessão é conhecido, e a extrapolação para as 55 sessões cabe no orçamento de API.

### Depois do portão

Passando M3, **o protocolo é congelado**. Correções identificadas pelo piloto são aplicadas antes do congelamento — é para isso que ele existe. Depois dele, qualquer alteração exige descarte dos dados coletados sob a versão anterior.

## 3. Marcos

### M1 — Protocolo aplicável · **06/09**

*Entregas:* protocolo revisado com o orientador · enunciados de T1 e T2 escritos · lista dos dez pontos de decisão de T2 com categorias fechadas · repositório-semente iniciado.

*Portão:* os enunciados descrevem apenas contrato HTTP e sintoma, nunca implementação · cada ponto de decisão tem categorias mutuamente exclusivas e nenhum é respondido pelo enunciado.

### M2 — Primeira sessão de ponta a ponta · **13/09**

O marco mais pesado do projeto em horas de trabalho.

*Entregas:* repositório-semente completo (`rooms`, `users`, `bookings` com validação parcial, e `amenities` fora do padrão), testado e congelado na tag `seed-v1` · suíte de testes ocultos de T1 · runner v1 · uma sessão executada do início ao fim gravando uma linha no CSV.

*Portão:* a semente roda com um comando e todos os testes passam · a suíte oculta foi validada contra implementação de referência humana, provando que 100% é alcançável · o runner completou uma sessão sem intervenção.

Não precisa estar bonito nem completo em métricas. Precisa fechar o ciclo.

### M3 — Piloto aprovado · **20/09** — *portão crítico*

*Entregas:* script de convenções · prompts do avaliador cego (checklist e classificador) com voto majoritário · runner completo com todas as métricas · `CLAUDE.md` de P1 · configuração P2 funcional · seis sessões de piloto · **protocolo congelado**.

*Portão:* as doze verificações da seção 2.

> **Sobre a configuração P2.** Ela precisa existir aqui como conjunto funcional de arquivos — CLAUDE.md, skills e rules instaláveis no repositório de trabalho. Não precisa ser um plugin empacotado, publicado ou documentado. Sem P2 funcional, duas das seis células da grade não podem rodar; sem plugin publicado, nada trava.

### M4 — Grade coletada · **27/09**

*Entregas:* 30 sessões da grade principal executadas em ordem randomizada · dataset consolidado.

*Portão:* todas as sessões presentes ou com invalidação justificada · nenhuma executada sob versão diferente do protocolo · transcripts arquivados.

### M5 — Pré-defesa · **03/10**

*Entregas:* análise da grade · gráficos de `taxa_aceitacao` (T1) e `convergencia` (T2) em escala de cinza · slides.

*Portão:* há resultado apresentável a partir de dados reais, não de plano de trabalho.

### M6 — Coleta completa · **11/10**

*Entregas:* 20 sessões das células de modelo · 5 de controle de drift · dataset final.

*Portão:* dataset fechado, incluindo comparação da célula de controle entre as duas janelas.

### M7 — Artigo e plugin prontos · **08/11**

*Entregas:* análise consolidada com tamanhos de efeito · figuras finais sem cor · artigo escrito e formatado no modelo INATEL, com resumo e abstract de no máximo 150 palavras · plugin empacotado, documentado e publicado no marketplace · repositório de artefatos público.

*Portão:* o plugin é instalável por terceiro a partir do marketplace · o artigo referencia artefatos publicamente acessíveis · ameaças à validade presentes.

### M8 — Entrega · **14/11**

*Entregas:* revisão final do orientador aplicada · artigo entregue.

### M9 — Apresentação · **até 05/12**

*Entregas:* slides finais e ensaio.

## 4. Escopo da pré-defesa de 03/10

O que a banca precisa ver é que **a estrutura de pesquisa está pronta e produzindo dados**. Essa é a parte difícil do projeto, e é ela que dá segurança de que o restante será entregue.

**Precisa estar pronto:** protocolo congelado · repositório-semente, runner, enunciados e instrumentos de medida funcionando · as 30 sessões da grade coletadas · análise da grade com as figuras principais.

**Não precisa estar pronto:** plugin empacotado, publicado ou documentado (basta a configuração P2 funcional que a coleta já usou) · células de modelo · qualquer parte do artigo escrita.

**Seria um plus, não um requisito:** plugin já publicado no marketplace.

Depois de M5 sobram seis semanas para 25 sessões desassistidas, uma análise e um artigo curto. É trabalho fácil com folga confortável — desde que a infraestrutura tenha sido fechada antes.

## 5. Critérios de pronto por artefato

**Repositório-semente:** os critérios de aceite completos estão em `superpowers/specs/2026-09-09-repositorio-semente-design.md`, seção 11, em oito grupos. Os que não podem faltar: roda com um comando a partir de clone limpo · verificação passa dentro da imagem Docker · três módulos canônicos e um deliberadamente desviante · **regra do falso negativo verificada caso a caso**, nenhum comportamento da semente recusa pedido que o contrato de T1 aceitaria · nenhum teste da semente afirma comportamento que T1 corrige · nenhum arquivo dirigido a agente e nenhum termo do estudo em toda a árvore · lastro inerte comprovadamente inerte · revisão humana da árvore inteira · tag `seed-v1`.

**Enunciado de tarefa:** T1 descreve apenas contrato HTTP e regras verificáveis · T2 descreve sintoma sem indicar causa nem solução · ambos terminam com a frase de encerramento padrão · texto congelado em arquivo versionado.

**Testes ocultos (T1):** uma asserção por regra do enunciado e por caso de borda · exercitam a aplicação por HTTP real contra o servidor iniciado pelo runner · nenhuma importa módulo interno · cada asserção rastreia para uma frase do enunciado · validados contra implementação de referência humana · armazenados fora do repositório-semente.

**Pontos de decisão (T2):** dez pontos com categorias fechadas mais `ausente` · nenhum respondido pelo enunciado · lista congelada antes de qualquer sessão do dataset.

**Avaliador cego:** recebe apenas diff e enunciado · modelo fixo, independente do modelo sob teste · três chamadas por pergunta com voto majoritário · taxa de desacordo registrada · prompts congelados.

**Runner:** executa uma sessão sem intervenção, com o agente dentro do contêiner · usa os comandos de verificação vindos do Makefile congelado, nunca da cópia que o agente pode ter editado · restaura os testes da semente antes de medir regressão · aplica os testes ocultos apenas após o término · invoca o avaliador cego · grava linha completa no CSV · arquiva diff, transcript bruto em JSON e transcrição legível em markdown · limpa o contêiner · marca falhas de infraestrutura como inválidas e permite re-execução.

**Artigo:** modelo INATEL · figuras sem cor · resumo e abstract com no máximo 150 palavras · ameaças à validade presentes · artefatos referenciados e acessíveis.

**Plugin:** instalável por terceiro a partir do marketplace · corresponde à condição P2 usada na coleta · README explicando origem e resultado.

## 6. Contingências

| Situação | Ação |
|---|---|
| Efeito teto em T1 no piloto | Endurecer os critérios de aceitação antes do congelamento. Decisão em M3, nunca depois |
| T2 produz saídas idênticas no piloto | O ticket está específico demais. Remover a pista que estreitou o espaço |
| T2 produz saídas incomparáveis no piloto | Acrescentar ao ticket uma restrição de escopo que estreite sem revelar a solução |
| Avaliador cego com desacordo alto | Reescrever as perguntas problemáticas; se persistir, reduzir o checklist aos itens estáveis |
| Custo por sessão acima do orçamento | Reduzir as células de modelo de dois modelos para um. A grade principal nunca é reduzida |
| M2 ou M3 atrasam | Deslocar todo o cronograma. **Nunca pular ou abreviar o piloto para recuperar tempo** |
| Atraso que ameace a pré-defesa | Apresentar a grade com T1 apenas (12 sessões) e retomar T2 depois. T2 é o resultado mais interessante, T1 é o mais rápido de fechar |
| Falha de API durante a coleta | Sessões marcadas inválidas e re-executadas. O runner é idempotente por construção |

## 7. Registro

Todo artefato vive em um único repositório versionado — código, documentos, dataset, transcripts. É esse repositório que o artigo referencia e que sustenta a reprodutibilidade.

Qualquer decisão que altere o protocolo depois de M3 é registrada por escrito, com data e justificativa, junto com o descarte dos dados afetados.
