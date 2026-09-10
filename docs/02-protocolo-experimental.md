# Protocolo Experimental

Este é o documento técnico central do projeto. Ele define o que será construído, como as sessões serão executadas e o que será medido. Deve estar **congelado ao final do piloto (marco M3)**, e não antes: o piloto existe justamente para revelar problemas de metodologia, e congelar antes dele tornaria ilegítimas as correções que ele indicar. Depois do congelamento, mudanças invalidam os dados já coletados.

Se você está lendo isto sem contexto prévio, leia antes o glossário na seção 2 do `01-plano-de-projeto.md`.

---

## 1. A ideia do experimento em uma página

Queremos saber o quanto o resultado de um agente de IA muda conforme o "harness" — a configuração ao redor do modelo. Para medir isso, precisamos de uma situação repetível.

Construímos um projeto de software pequeno e funcional, o **repositório-semente**, e o congelamos em um commit. Escrevemos **duas tarefas**: enunciados de trabalho a ser feito nesse projeto. Depois montamos várias **configurações** do agente, variando três coisas: qual modelo usar, quanto contexto estático fornecer e em que sequência conduzir o trabalho. Cada configuração executa cada tarefa, mais de uma vez.

Cada execução é uma **sessão**: um script parte de uma cópia limpa do repositório-semente, aplica a configuração, deixa o agente trabalhar sozinho até terminar, e então mede o resultado. Cada sessão vira uma linha em uma planilha. No fim, comparamos as configurações.

**As duas tarefas medem coisas diferentes e por instrumentos diferentes.** Esta é a característica central do desenho:

- **T1 é bem especificada.** O enunciado diz exatamente qual comportamento é esperado. Medimos **acerto**, com uma suíte de testes ocultos que o agente nunca vê.
- **T2 é deliberadamente ambígua.** É um ticket de suporte que descreve um sintoma e não diz nada sobre a solução. Não existe resposta certa, então não há o que testar. Medimos **convergência**: o quanto execuções diferentes da mesma configuração chegam às mesmas decisões.

O racional da segunda é que o problema prático relatado por equipes que adotam agentes não é receber código errado em problemas bem definidos — é receber coisas **imprevisivelmente diferentes** quando o pedido é vago, que é como a maioria dos pedidos chega na prática. A hipótese que T2 testa é: *harness melhor não deixa o agente mais inteligente, deixa o agente mais previsível.*

## 2. Objeto experimental

### 2.1 Repositório-semente

Um projeto **funcional, pequeno e com convenções claras**. Funcional porque o estudo é sobre desenvolvimento em base existente, não sobre criar projeto do zero. Com convenções claras porque parte do que medimos é se o agente as respeita — sem padrão estabelecido, não há aderência a medir.

| Item | Definição |
|---|---|
| Stack | Node 22 · TypeScript · Fastify · Prisma com SQLite · Vitest · ESLint + Prettier |
| Domínio | API REST de reservas de salas |
| Estrutura canônica | `src/modules/<recurso>/` com as camadas `routes.ts`, `service.ts`, `repository.ts`, `schema.ts`, mais `src/shared/` e uma camada de plugins |
| Recursos implementados | `rooms`, `users` e `bookings` no padrão canônico, mais `amenities` deliberadamente fora dele |
| Testes existentes | Cobrem o CRUD dos quatro módulos, a paginação, os caminhos de erro e o único caso de conflito que a semente detecta |
| Congelamento | Tag git `seed-v1`. Nenhuma alteração após o congelamento |

**O módulo `bookings` entra na semente com validação parcial e incompleta**, não ausente. Ele detecta apenas um dos quatro casos de sobreposição, aquele em que o início da nova reserva cai dentro de uma reserva existente. Não valida conflito na atualização, não valida reserva no passado, não impõe duração mínima nem máxima, e responde 500 em vez de 404 para sala ou usuário inexistente.

**Regra do falso negativo.** Todo defeito da semente deixa passar o que não deveria; nenhum recusa o que deveria aceitar. A borda já é estrita e reservas canceladas já são ignoradas justamente para não haver falso positivo em lugar nenhum. Isso não é generosidade com o agente: é exigência estrutural. Se a semente recusasse indevidamente, o sintoma do ticket de T2 passaria a ser explicado por esse defeito, o agente encontraria o bug, corrigiria, e T2 colapsaria em T1, destruindo o instrumento de convergência.

É essa configuração que torna as duas tarefas possíveis a partir do mesmo commit. T1 completa o contrato de validação; T2 parte de um serviço onde os conflitos são reais e o problema é descobrir horários livres.

**Um módulo foge do padrão de propósito.** `amenities` tem dois arquivos em vez de quatro, devolve array puro em vez do envelope de paginação e responde erro por um auxiliar diferente. Nada no código declara qual padrão é o vigente. Isso é o que dá valor mensurável ao mapa que P1 fornece: num repositório de módulos idênticos, o padrão é auto-evidente e P0 adere tão bem quanto P1, atenuando o fator de contexto por artefato do instrumento. O domínio escolhido é distante de tempo e intervalos, para não empurrar as sessões de T2 para uma mesma forma de solução.

Os testes existentes têm função específica no experimento: detectar **regressão**. Se o agente quebra algo que já funcionava, esses testes acusam.

A escolha do domínio de reservas é deliberada. Regras de sobreposição de horário são inequívocas de testar por asserção HTTP, mas não triviais de acertar — há casos de borda genuínos que dão espaço para as condições se diferenciarem. E o domínio sustenta naturalmente uma tarefa ambígua sobre disponibilidade.

### 2.2 Tarefa T1 — bem especificada

**Completar o contrato de validação do módulo de reservas existente.**

O enunciado descreve o comportamento esperado em termos de **contrato HTTP** — rotas, formatos, códigos de status, regras de negócio — nunca em termos de implementação interna. As regras valem tanto para a criação quanto para a atualização, o que é onde a semente mais falha. Regras especificadas: reservas ativas não podem se sobrepor na mesma sala, em nenhuma forma de sobreposição; a sobreposição é estrita nas bordas, de modo que uma reserva terminando às 10h e outra começando às 10h convivem; reserva cancelada não ocupa horário; reservas no passado são rejeitadas; duração mínima de 30 minutos e máxima de 8 horas; o fim precisa ser posterior ao início; sala ou usuário inexistente retorna 404; os erros seguem o formato já usado pela API; nenhum comportamento existente e não citado muda.

O texto integral e versionado do enunciado está registrado em R4.12 do `00-log-sessao-planejamento.md`.

Instrumento de medida: **testes ocultos**.

### 2.3 Tarefa T2 — ambígua

Um ticket redigido como chegaria de um time de produto ou suporte. O texto abaixo é o enunciado, e é congelado.

> **RES-142 — Usuários esbarrando em conflito ao reservar**
> *Reportado por: Suporte · Prioridade: Alta*
>
> O suporte vem recebendo reclamações recorrentes de usuários que tentam criar uma reserva e recebem erro de conflito. Pelo relato, as pessoas ficam tentando horários diferentes até acertar um que esteja livre, e isso está gerando insatisfação — principalmente entre quem precisa organizar várias reservas de uma vez.
>
> Produto quer que a API resolva isso.

A propriedade que torna esse enunciado útil: ele é **específico sobre o sintoma e silencioso sobre a causa e a solução**. Não diz o que construir, qual o formato de retorno, qual o escopo, nem sequer se a mudança é em endpoint novo ou existente. Ao mesmo tempo, não é vago a ponto de as saídas ficarem incomparáveis — toda sessão vai construir alguma noção de disponibilidade, o que permite perguntar "qual escolha foi feita neste ponto" em todas elas.

Instrumento de medida: **convergência entre execuções**, medida sobre pontos de decisão.

> **Nota sobre escopo.** Tarefas de interface e experiência visual não são cobertas: a semente é uma API e adicionar frontend custaria mais do que o projeto comporta. T2 captura a ambiguidade de requisito, não a ambiguidade visual. Isso vai declarado nas ameaças à validade.

### 2.4 Pontos de decisão de T2

Escolhas que o enunciado força o agente a fazer sem determinar. Cada uma é classificada a partir do diff, em categorias fechadas.

| # | Ponto de decisão | Categorias |
|---|---|---|
| 1 | Forma da solução | endpoint novo · altera listagem existente · enriquece o erro 409 · combinação |
| 2 | Semântica do retorno | horários livres · horários ocupados · ambos |
| 3 | Granularidade dos intervalos | fixa · derivada das reservas · parametrizável |
| 4 | Janela temporal padrão | dia · semana · obrigatória no parâmetro |
| 5 | Limite de horário | comercial · 24 horas · configurável |
| 6 | Escopo de salas | uma sala · várias por parâmetro · todas |
| 7 | Fuso horário | UTC · local · explícito no contrato |
| 8 | Sala sem reservas | tudo livre · lista vazia · 404 |
| 9 | Tratamento do passado | filtrado · incluído |
| 10 | Contrato do POST de reserva | inalterado · passa a sugerir alternativas no 409 |

A lista é congelada junto com o enunciado, **antes** de qualquer sessão ser executada. Definir pontos de decisão depois de ver as saídas seria escolher os pontos onde a divergência já apareceu.

Se uma sessão não tomar posição sobre um ponto (por exemplo, não construiu nada relacionado a fuso), a categoria registrada é `ausente` — que conta como uma categoria própria na comparação.

### 2.5 Testes ocultos (T1)

Uma suíte que sobe a aplicação e a exercita por **HTTP real**, contra o servidor iniciado pelo runner, com uma asserção por regra do enunciado e por caso de borda. Nunca por importação de módulo do projeto: importar quebraria a suíte quando o agente renomeasse um arquivo, e a falha seria defeito do instrumento, não do agente.

Regras obrigatórias de construção:

1. **Ficam fora do repositório-semente.** São copiados para dentro do projeto apenas depois que a sessão termina, pelo runner.
2. **Testam apenas o contrato descrito no enunciado.** Nunca importam módulos internos, nunca dependem de nomes de função, classe ou arquivo. Se um teste falha porque o agente nomeou algo diferente, o teste está errado, não o agente.
3. **Cada asserção rastreia para uma frase do enunciado.** Teste que verifica comportamento não pedido deve ser removido, ou o enunciado está incompleto.
4. **São escritos antes do desenvolvimento do plugin**, para evitar calibração inconsciente ao comportamento que já sabemos que o plugin produz.
5. **São validados contra uma implementação de referência escrita por um humano da equipe**, para provar que é possível aprovar em 100%.

### 2.6 Script de convenções

Inspeciona o diff e conta violações de regras do projeto, de forma determinística. Cada item vale uma violação:

1. arquivo de código de produção criado fora de `src/modules/<recurso>/` ou `src/shared/`
2. dependência acrescentada ao `package.json`
3. arquivo de configuração do projeto alterado: `tsconfig`, ESLint, Prettier, Vitest, `Dockerfile`, `Makefile` ou scripts do `package.json`
4. uso de `any`, `as any`, `@ts-ignore`, `@ts-expect-error` ou asserção não-nula em código de produção
5. rota criada ou alterada sem schema de validação declarado
6. nenhum teste escrito pelo agente
7. teste pré-existente da semente alterado ou removido
8. chamada de `console.*` em código de produção, tendo o projeto um logger
9. teste marcado com `.skip`, `.only` ou `.todo`

A regra 1 admite `src/shared/` porque a redação anterior transformaria em violação qualquer utilitário compartilhado legítimo, penalizando exatamente o bom design que a pergunta 6 do checklist premia.

O conjunto foi ampliado de cinco para nove regras porque a métrica original variava entre zero e dois por sessão, e porque a regra 2 sozinha é fraca: nenhum dos dois enunciados leva naturalmente o agente a instalar uma biblioteca. Manteve-se a regra 2 assim mesmo, com duas providências. A semente não inclui nenhuma biblioteca de data, fazendo aritmética de tempo com `Date` puro, que é a única tentação honesta possível sem tocar no enunciado. E se a regra não disparar em nenhuma sessão, isso é reportado como resultado, não tratado como buraco.

Estas regras são as mesmas declaradas ao agente nos níveis P1 e P2. Em P0 o agente não é informado delas — o que é exatamente o ponto: mede-se quanto o comportamento default diverge do padrão do projeto.

### 2.7 Avaliador cego

Um modelo de linguagem usado para duas funções que não podem ser resolvidas por script: classificar os pontos de decisão de T2 e responder o checklist de qualidade. Ele **não julga se algo é bom em uma escala** — responde perguntas fechadas sobre o que o diff contém.

Essa distinção é o que torna o instrumento defensável. Pedir "nota de 1 a 5 para extensibilidade" produz números que variam entre execuções e não têm âncora; pedir "a lógica nova está na camada de serviço? sim ou não" produz resposta estável.

Regras obrigatórias:

- **Modelo fixo:** Sonnet 5, sempre, independentemente do modelo sob teste na sessão.
- **Cego:** recebe apenas o diff e o enunciado da tarefa. Nunca recebe o nível de P, o nível de O, o modelo usado, nem qualquer identificação da célula.
- **Votação por maioria:** cada pergunta é feita três vezes em chamadas independentes; vale a resposta majoritária. A taxa de desacordo entre as três chamadas é registrada e reportada no artigo como medida de confiabilidade do instrumento.
- **Prompts congelados** junto com o protocolo.

**Checklist de qualidade** — sete perguntas binárias sobre o diff:

1. A lógica de negócio nova está na camada de serviço, e não nas rotas?
2. As entradas novas são validadas por schema?
3. Os caminhos de erro têm resposta explícita com código de status apropriado?
4. Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?
5. Há testes escritos pelo agente que verificam comportamento observável, e não implementação interna?
6. Utilitários já existentes no projeto foram reusados, em vez de reimplementados?
7. Os contratos HTTP pré-existentes seguem compatíveis, sem quebra não solicitada?

## 3. Fatores e níveis

### 3.1 Fator M — Modelo

| Nível | Modelo |
|---|---|
| M1 | Claude Haiku 4.5 |
| M2 | Claude Sonnet 5 *(fixo na grade principal)* |
| M3 | Claude Opus 5 |

### 3.2 Fator P — Contexto estático

O que o agente **sabe** antes de começar.

| Nível | Definição operacional |
|---|---|
| **P0** | Repositório cru. Nenhum arquivo de contexto, nenhuma regra declarada. O agente recebe apenas o enunciado. |
| **P1** | Um `CLAUDE.md` de aproximadamente uma página: arquitetura em camadas, convenções de nomenclatura, comandos de build/test/lint, e as regras da seção 2.6 em linguagem natural. |
| **P2** | O plugin completo: o conteúdo de P1 mais *skills* (procedimentos passo a passo para estender um módulo e para escrever testes no padrão do projeto) e *rules* (as restrições da seção 2.6 em formato estruturado). |

### 3.3 Fator O — Ordem de execução

Como o trabalho é **segmentado**. O runner executa uma sequência fixa de chamadas; cada uma recebe o histórico da anterior.

**O1 — Instrução única.** Uma chamada com o enunciado. O agente decide sozinho se explora, se planeja, se testa.

**O2 — Pipeline segmentado.** Quatro chamadas encadeadas:

1. *Explore o repositório e descreva a arquitetura, as convenções e os arquivos relevantes para a tarefa a seguir. Não altere nenhum arquivo. Tarefa: [enunciado]*
2. *Com base na exploração, escreva um plano de implementação passo a passo. O plano vai na sua resposta, não em arquivo. Não altere nem crie nenhum arquivo.*
3. *Implemente o plano.*
4. *Execute os testes e a verificação de tipos. Corrija os problemas encontrados.*

O texto do enunciado é idêntico nos dois níveis. O que muda é a segmentação e a existência de checkpoints explícitos.

> **Por que o passo 2 proíbe gravar o plano em arquivo.** Se o agente gravasse, ele criaria arquivo fora da estrutura em toda sessão O2, disparando a regra 1 do script de convenções de forma sistemática. O fator ordem ficaria confundido com a métrica de violações.

> **Separação entre P e O.** O plugin (P2) inclui um comando de workflow para uso real, mas **no experimento a ordem é sempre imposta pelo runner**, uniformemente em todos os níveis de P. Sem essa separação, P2 e O2 estariam confundidos e nenhum efeito seria atribuível a um ou outro.

### 3.4 Constantes

Idênticos em toda sessão: commit-semente, texto do enunciado, limite de 40 turnos somados todos os passos, permissões de ferramenta, imagem de contêiner e versões de Node e dependências, versão do CLI do agente, e ausência de intervenção humana.

**O agente tem acesso irrestrito à internet durante a sessão.** Isto revoga a restrição prevista em versões anteriores deste protocolo. A justificativa é de validade ecológica: buscar informação quando falta é o que um agente faz em uso real, e proibir isso mediria um agente que não existe na prática. Duas consequências foram registradas. A violação "dependência acrescentada" passa a ser genuinamente alcançável, o que sem rede nunca seria o caso, já que a instalação falharia e o agente recuaria. E o repositório de artefatos permanece **privado até o encerramento da coleta em M6**, porque um agente com busca poderia encontrar os testes ocultos, os pontos de decisão ou este próprio protocolo, invalidando silenciosamente a verificação 5 do portão do piloto.

**Toda sessão do dataset roda em série e na mesma máquina.** Paralelizar contaminaria `duracao_s` por disputa de CPU, e essa é justamente a métrica usada para interpretar a assimetria entre O1 e O2.

**Frase de encerramento**, anexada ao enunciado das duas tarefas:

> *Não há canal para dúvidas nesta execução. Decida e implemente.*

Sem ela, o agente pode responder ao ticket ambíguo com perguntas de esclarecimento e encerrar sem produzir diff, o que registraria como sessão travada e viraria ruído. Ela é idêntica nas duas tarefas justamente para não virar diferença entre condições.

## 4. Desenho

### 4.1 Grade principal — 30 sessões

Modelo fixo em **Sonnet 5**. Fatorial completo P × O:

|  | O1 | O2 |
|---|---|---|
| **P0** | célula 1 | célula 2 |
| **P1** | célula 3 | célula 4 |
| **P2** | célula 5 | célula 6 |

Cada célula executa **T1 duas vezes e T2 três vezes**: 6 células × 5 sessões = **30 sessões**.

A assimetria é proposital. Em T1 as repetições servem só para estimar ruído, e duas bastam. Em T2 a repetição **é o instrumento**: com duas execuções só se sabe se concordaram ou não; com três há grau de convergência.

### 4.2 Células de modelo — 20 sessões

As duas configurações extremas da grade — **P0-O1** (harness mínimo) e **P2-O2** (harness completo) — executadas em Haiku 4.5 e Opus 5.

2 configurações × 2 modelos × 5 sessões = **20 sessões**.

Isto responde PP3 e permite a comparação central do artigo: o ganho de trocar o harness contra o ganho de trocar o modelo.

### 4.3 Controle de drift — 5 sessões

Se a coleta ocorrer em duas janelas separadas no tempo, re-executar a célula P1-O1 na segunda janela. Divergência material em relação à primeira janela indica mudança de versão do modelo e precisa ser reportada.

### 4.4 Total

**55 sessões.** As 30 da grade principal são coletadas antes da pré-defesa; as 25 restantes depois.

### 4.5 Ordem de execução

Randomizar a ordem em que as sessões rodam, em vez de executar célula por célula, para que variação temporal do serviço não se confunda com uma célula específica.

## 5. Métricas

### 5.1 Por sessão

| Métrica | Tipo | Aplicável | Como é obtida |
|---|---|---|---|
| `taxa_aceitacao` | 0–1 | só T1 | Testes ocultos aprovados ÷ total. **Variável-resposta principal de T1** |
| `regressoes` | inteiro | ambas | Testes pré-existentes que passavam na semente e falham após a sessão |
| `violacoes` | inteiro | ambas | Script de convenções (seção 2.6), determinístico |
| `qualidade` | 0–7 | ambas | Itens atendidos no checklist do avaliador cego (seção 2.7) |
| `custo_usd` | decimal | ambas | Custo das chamadas, a partir dos tokens retornados pela API |
| `duracao_s` | inteiro | ambas | Tempo de parede da sessão |
| `n_tool_calls` | inteiro | ambas | Contagem de invocações de ferramenta no transcript |
| `travou` | booleano | ambas | Excedeu o limite de turnos, **ou** terminou sem diff, **ou** build/typecheck falha ao final |
| `decisoes` | vetor | só T2 | Categoria escolhida em cada um dos 10 pontos de decisão, pelo avaliador cego |

`duracao_s` e `n_tool_calls` custam zero código adicional — já estão no transcript e na resposta da API. `n_tool_calls` é particularmente útil para interpretar a assimetria entre O1 e O2: ajuda a distinguir se O2 ganha por conduzir melhor ou apenas por gastar mais.

**Campos de identificação** gravados junto: id da sessão, modelo e versão exata, nível de P, nível de O, tarefa, número da execução, timestamps de início e fim, caminho do transcript arquivado.

### 5.2 Por célula (só T2)

`convergencia` = proporção dos 10 pontos de decisão em que as **três execuções da célula registraram a mesma categoria**.

Métrica secundária: número médio de categorias distintas por ponto de decisão, que mostra *quão* dispersas foram as escolhas quando não houve unanimidade.

Como depende das três execuções, é calculada na análise, não pelo runner.

### 5.3 Descartadas explicitamente

Rubrica de qualidade em escala numérica, complexidade ciclomática, linhas alteradas, arquivos tocados, número de turnos. Todas interessantes; nenhuma cabe no espaço do artigo. Como transcripts e diffs ficam arquivados, qualquer uma pode ser extraída depois se sobrar tempo.

## 6. O runner

O script que executa uma sessão de ponta a ponta, sem supervisão. **É o item de maior alavancagem do projeto**: com ele, 55 sessões são uma execução noturna; sem ele, são semanas de trabalho manual.

Entrada: identificação da célula (modelo, nível P, nível O), tarefa, número da execução.

1. **Preparar.** Subir um contêiner a partir da imagem de sessão, materializar a árvore da semente na tag `seed-v1`, inicializar um repositório git novo com um único commit de mensagem neutra, rodar a suíte existente e confirmar que tudo passa. Se não passar, abortar — o ambiente está corrompido.

   O agente executa **dentro do contêiner**, o que dá ambiente idêntico nas 55 sessões independentemente da máquina, torna `duracao_s` comparável, e contém o raio de dano, o que é o que permite conceder permissão total de ferramentas em sessões sem supervisão. O commit único de mensagem neutra elimina por construção o vazamento por histórico do git, que seria fatal e é fácil de esquecer.
2. **Aplicar o nível P.** P0: nada. P1: copiar o `CLAUDE.md`. P2: instalar o plugin.
3. **Executar o nível O.** Uma chamada (O1) ou quatro encadeadas (O2) ao agente em modo headless, com o modelo da célula e o limite de 40 turnos. Capturar transcript e uso de tokens.
4. **Verificar o estado.** Build, verificação de tipos e suíte pré-existente. Registrar resultados.

   Três garantias de isolamento valem daqui em diante, e protegem as medições de serem sabotadas pelo próprio agente. Os comandos de verificação vêm do Makefile **congelado**, nunca da cópia que o agente pode ter editado. Os arquivos de teste da semente são **restaurados a partir da versão congelada** antes de medir regressão, e separadamente registra-se se o agente os alterou, o que é a regra 7 do script de convenções. E o servidor é iniciado pelos comandos congelados, com o runner aguardando `GET /health` responder antes de aplicar a suíte oculta.
5. **Aplicar os testes ocultos** — só em T1, e só agora, nunca antes.
6. **Rodar o script de convenções** sobre o diff.
7. **Rodar o avaliador cego**: checklist de qualidade em ambas as tarefas, classificação dos pontos de decisão em T2. Três chamadas por pergunta, voto majoritário, sem qualquer informação sobre a condição.
8. **Registrar.** Escrever a linha em `resultados.csv` e arquivar em `sessoes/<id>/` o diff, o transcript bruto em JSON para reprocessamento programático, e uma transcrição legível em markdown com a sequência de prompts, respostas e chamadas de ferramenta. A segunda existe para permitir análise qualitativa do comportamento do agente depois que os dados quantitativos estiverem fechados, e custa quase nada, já que o transcript bruto vem da API de qualquer forma.
9. **Limpar.** Destruir o diretório de trabalho.

O runner deve ser idempotente e re-executável. Sessão que falha por erro de infraestrutura (rede, quota, timeout) é marcada inválida e re-executada, nunca aproveitada parcialmente.

**Critérios de descarte:** erro de infraestrutura, indisponibilidade da API, falha do próprio runner. Uma sessão em que o agente simplesmente foi mal **não é descartada** — é dado.

## 7. Plano de análise

Análise **descritiva e exploratória**. Com o número de observações por célula, testes de significância não sustentariam conclusão e dariam falsa autoridade ao n.

1. Média e desvio-padrão de cada métrica por célula.
2. Gráfico de barras agrupadas da `taxa_aceitacao` de T1 na grade principal, e outro da `convergencia` de T2. **Escala de cinza e hachuras** — o modelo do artigo proíbe elementos coloridos.
3. Tabela com o efeito do modelo nas duas configurações extremas.
4. Tamanho de efeito (Cliff's delta) em dois contrastes: **P0-O1 versus P2-O2** dentro do Sonnet (efeito total do harness) e **Haiku-P2O2 versus Opus-P0O1** (harness bom em modelo fraco contra harness ruim em modelo forte). O segundo responde PP3 e é provavelmente a frase mais citável do trabalho.
5. Dispersão entre execuções da mesma célula em T1, como piso de ruído. Nenhuma diferença menor que ela deve ser lida como efeito.
6. Taxa de desacordo do avaliador cego entre suas três chamadas, como medida de confiabilidade do instrumento.

**A comparação mais interessante do artigo** é entre o comportamento de T1 e o de T2. Se o harness pouco altera o acerto em T1 mas altera bastante a convergência em T2, a conclusão é que a engenharia de harness importa sobretudo onde o requisito é ambíguo — que é a maior parte do trabalho real.

## 8. Ameaças à validade

| Ameaça | Natureza | Tratamento |
|---|---|---|
| **Não-determinismo** | Interna | Repetições por célula; dispersão reportada como piso de interpretação |
| **Orçamento computacional desigual** | Interna | O2 recebe mais prompting que O1. O limite de turnos é comum, mas a assimetria persiste. Custo e `n_tool_calls` reportados como resultado conjunto; o ganho de O2 deve ser lido por unidade de custo |
| **Drift de versão do modelo** | Interna | Versão e data por sessão; célula de controle re-executada na segunda janela |
| **Viés de expectativa** | Interna | Testes ocultos e pontos de decisão congelados antes do desenvolvimento do plugin; avaliador cego à condição |
| **Auto-preferência do avaliador** | Interna | Um modelo Claude avalia saídas Claude. Mitigado pelo formato binário e pela cegueira, mas não eliminado. Declarado no artigo |
| **Convergência não é qualidade** | Construto | Uma configuração pode convergir para uma decisão ruim. Por isso `convergencia` é sempre lida junto com `qualidade` e `violacoes`, nunca isolada |
| **Contaminação de treino** | Construto | O domínio é comum em material público. Afeta o nível absoluto de acerto, não a comparação entre condições, já que se aplica igualmente a todas |
| **Testes ocultos como proxy de qualidade** | Construto | Aprovar testes não é produzir bom código. Declaramos medir correção funcional, aderência a convenções e convergência — não qualidade de design em sentido amplo |
| **Ambiguidade de requisito, não visual** | Externa | T2 captura requisito vago em backend. Tarefas de interface e experiência visual não foram cobertas |
| **Semente escrita por agente** | Interna | A semente é construída com assistência de um modelo da mesma família sob teste. Revisão humana da árvore inteira é critério de aceite; declarada no artigo; aplica-se igualmente a todas as condições |
| **Acesso à internet durante a sessão** | Interna | Escolha deliberada de validade ecológica. Introduz variação temporal do conteúdo consultável entre janelas de coleta, parcialmente coberta pela célula de controle de drift. Mitigada quanto a vazamento pelo repositório de artefatos privado até M6 |
| **Repositório pequeno atenua o fator contexto** | Construto | Num repositório de módulos idênticos o padrão é auto-evidente e P0 adere tão bem quanto P1. Tratada com ambiguidade estruturada e não com volume: um módulo desviante, uma camada de plugins e um auxiliar substituído. Bagunça aleatória foi recusada porque levantaria o piso de ruído em vez do sinal |
| **Generalização** | Externa | Uma stack, um domínio, duas tarefas, uma família de modelos. Nenhuma extrapolação é feita |

## 9. Congelamento

**O congelamento acontece no marco M3, imediatamente após o piloto ser aprovado.** Ver a seção 2 do `03-plano-de-execucao.md` para as doze verificações que compõem esse portão.

A ordem importa: o piloto é a última oportunidade de descobrir que uma tarefa tem efeito teto, que os pontos de decisão não se aplicam às saídas, que os testes ocultos falham por motivo irrelevante ou que o avaliador cego é instável. Todas essas correções são legítimas antes do congelamento e ilegítimas depois. Congelar cedo demais transformaria problemas corrigíveis em defeitos permanentes do dataset.

As sessões do piloto não integram o dataset, porque foram executadas sob uma versão do protocolo que ainda podia mudar.

Depois do congelamento, qualquer alteração exige registro com data e justificativa e descarte dos dados coletados sob a versão anterior. Correções de bug no runner que não alterem a definição das condições nem das métricas não contam como alteração de protocolo, mas devem ser registradas.

Itens congelados junto: enunciados das duas tarefas, lista de pontos de decisão e suas categorias, suíte de testes ocultos, regras do script de convenções, perguntas do checklist e prompts do avaliador cego.
