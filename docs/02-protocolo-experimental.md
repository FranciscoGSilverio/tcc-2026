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

**Revisado em 17/09/2026, depois da sessão piloto `T1-P0-O1-mu4t4rvp`.** A versão original do enunciado descrevia o contrato HTTP por completo — rotas, formatos, códigos de status, regras de negócio, numeradas regra a regra — e mapeava quase uma a uma nas asserções da suíte oculta. A sessão piloto, rodada sem nenhum contexto (P0), saturou `taxa_aceitacao` em 1.0 com essa versão: o enunciado já entregava tudo que o fator de contexto poderia acrescentar, e P0, P1 e P2 receberiam por construção a mesma informação. O enunciado agora descreve **apenas a necessidade de negócio** — a API aceita reservas conflitantes e precisa parar de aceitar — e nada de código de status, semântica de borda, limite de duração ou alcance sobre a operação de atualização. Essa política de domínio passou a viver no contexto de P1 e P2 (seção 3.2), que é o único lugar de onde ela pode ser obtida.

**D3, decisão explícita do orientando, tomada em 17/09/2026.** O agente em P0 é avaliado contra regras de domínio que não lhe foram informadas, e isto **é o tratamento**, não um descuido: mede-se o desenvolvedor que cai num projeto sem documentação, situação que o harness existe para remediar. A alternativa — informar a política de domínio em todos os níveis igualmente — reproduziria o enunciado autossuficiente e devolveria o efeito teto observado na sessão piloto. Fica registrada aqui para ser defendida no artigo, não para ser descoberta pelo leitor. O detalhe completo do diagnóstico e das decisões relacionadas (D1 a D8) está em `docs/superpowers/specs/2026-09-17-reavaliacao-de-t1-design.md` e na rodada 9 de `00-log-sessao-planejamento.md`.

O texto exato e versionado do enunciado atual está em `tasks/T1-validacao-de-reservas.md`; o texto anterior, usado só na sessão piloto (que por isso não é comparável com as sessões seguintes e foi movida para `resultados-piloto.csv`), está registrado em R4.12 do `00-log-sessao-planejamento.md`.

Instrumento de medida: **testes ocultos**. O contrato que os testes ocultos verificam não mudou com a revisão do enunciado — as mesmas 26 asserções, a mesma linha de base de 13/26 contra a semente intocada e a mesma implementação de referência marcando 26/26.

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
5. **São validados contra uma implementação de referência**, para provar que é possível aprovar em 100%.

> **Autoria da referência.** Versões anteriores deste protocolo exigiam que a referência fosse escrita por um humano da equipe. Ela passa a ser escrita por um agente, que não integra a avaliação, sabe exatamente o papel que cumpre e pode consultar os testes ocultos. O agente decide a implementação; a equipe verifica o resultado.
>
> A consequência precisa ser declarada no artigo: a prova de que cem por cento é alcançável passa a vir de um agente da mesma família sob teste, evidência mais fraca do que autoria humana independente.
>
> Ela também responde uma pergunta mais estreita. Com acesso aos testes, a referência prova que **os testes são satisfazíveis** e fixa o mínimo aceitável. Ela não prova que **o enunciado sozinho basta** para alguém passar neles. Essa segunda pergunta é respondida por outro artefato, a sessão de agente cru descrita abaixo, que é cega aos testes por construção.

> **Sessão de agente cru como ensaio do instrumento.** Antes do piloto, uma sessão é executada em T1 sem nenhum contexto, com os testes ocultos aplicados ao final. Ela responde duas coisas que nada mais responde antes de M3: se o enunciado sozinho leva a uma implementação aprovada, e se as métricas que o experimento coleta fazem sentido quando extraídas de uma sessão real. Serve também como sonda antecipada de efeito teto, que é o risco de maior impacto do projeto e até aqui não tinha nenhuma verificação antes do piloto.

### 2.6 Script de convenções

Inspeciona o diff e conta violações de regras do projeto, de forma determinística. Cada item vale uma violação:

1. arquivo de código de produção criado fora de `src/modules/<recurso>/`, `src/shared/` ou `src/plugins/`
2. dependência acrescentada ao `package.json`
3. arquivo de configuração do projeto alterado: `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, `Makefile`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.editorconfig`, `.gitignore`, `prisma/schema.prisma`, ou a seção de scripts do `package.json`
4. uso de `any`, `as any`, `@ts-ignore`, `@ts-expect-error` ou asserção não-nula em código de produção sob `src/`
5. nenhum teste escrito pelo agente
6. teste pré-existente da semente alterado ou removido
7. chamada de `console.*` em código de produção sob `src/`, tendo o projeto um logger
8. teste marcado com `.skip`, `.only` ou `.todo`

A regra 1 admite `src/shared/` e `src/plugins/` porque a redação anterior transformaria em violação qualquer utilitário compartilhado legítimo, penalizando exatamente o bom design que a pergunta 6 do checklist premia. A inclusão de `src/plugins/` foi acrescentada depois de a semente existir: ela tem sete arquivos de produção legítimos fora de módulos e compartilhados, na camada de plugins, no acesso ao banco e na raiz de `src`. Sem esse ajuste, um agente que acrescentasse um plugin legítimo levaria violação, e o arquivo de contexto de P1 estaria afirmando ao agente algo falso sobre o próprio projeto.

O conjunto foi ampliado de cinco para nove regras, e depois reduzido a oito pelo corte descrito abaixo, porque a métrica original variava entre zero e dois por sessão, e porque a regra 2 sozinha é fraca: nenhum dos dois enunciados leva naturalmente o agente a instalar uma biblioteca. Manteve-se a regra 2 assim mesmo, com duas providências. A semente não inclui nenhuma biblioteca de data, fazendo aritmética de tempo com `Date` puro, que é a única tentação honesta possível sem tocar no enunciado. E se a regra não disparar em nenhuma sessão, isso é reportado como resultado, não tratado como buraco.

**Por que não existe uma regra determinística de "rota sem schema de validação".** Ela existiu e foi removida, e o motivo precisa ficar registrado para que ninguém a restaure por parecer lacuna.

Era a única regra do conjunto que não é uma verificação barata. As outras oito são comparação de caminho contra uma lista, diferença entre listas de chaves do manifesto, comparação contra a cópia congelada, execução do linter, ou busca textual. Essa exigiria localizar cada declaração de rota no diff e verificar se aquela declaração específica traz um schema, o que é análise de sintaxe, não busca textual. Uma expressão regular erraria em declaração de múltiplas linhas, em schema definido fora e referenciado por nome, e no módulo `amenities`, que declara os schemas dentro do próprio arquivo de rotas. E erraria de forma silenciosa e sistemática, sempre na mesma direção, que é o pior tipo de defeito num instrumento de medida.

A verificação não se perdeu: ela é a **pergunta 2 do checklist do avaliador cego**, concreta, visível no diff e binária, exatamente o formato que a seção R2.4 do log de planejamento classificou como estável. Trocou-se um script frágil por uma pergunta estável, respondida numa única passagem (seção 2.7).

**Laço declarado entre a regra 5 e a pergunta 5 do checklist.** A regra determinística pergunta apenas **se existe** teste escrito pelo agente. A pergunta 5 do avaliador avalia se os testes existentes verificam comportamento observável em vez de implementação interna. São perguntas distintas, mas a segunda só responde sim quando a primeira não disparou, de modo que os dois números ficam amarrados na maior parte dos casos. As duas são mantidas, porque medem coisas diferentes, mas **`violacoes` e `qualidade` nunca podem ser citadas no artigo como evidências independentes do mesmo efeito.**

**Como as regras 4 e 7 são detectadas.** Não por expressão regular sobre o diff, e sim rodando o ESLint da semente, com a **configuração congelada** e não com a cópia que o agente pode ter editado, sobre os arquivos que ele alterou. Detectar asserção não-nula por busca textual é frágil, e a configuração da semente já reprova exatamente essas duas coisas. Usar o próprio linter elimina a fragilidade e mantém o critério idêntico ao que o projeto declara.

**O que a regra 4 não conta.** A semente usa `Type.Unsafe` em `src/shared/schema.ts`, no auxiliar `DateString`, para conciliar o tipo que o Prisma devolve com o schema emitido. Reusar esse auxiliar **não é violação**. Contá-lo penalizaria o agente por reusar um utilitário existente, que é justamente o comportamento que a pergunta 6 do checklist do avaliador premia.

**Reconferência contra a semente construída.** As regras foram escritas antes de a semente existir. Depois de construída, todas foram confrontadas com a estrutura real. Quatro estavam mais estreitas ou mais largas do que a propriedade que pretendem guardar e foram corrigidas: a de estrutura de arquivos, a de configuração alterada, a de escapes de tipo e a de `console`. Uma foi removida, a de rota sem schema, pelo motivo acima. As demais passaram sem ajuste.

Estas regras são as mesmas declaradas ao agente nos níveis P1 e P2. Em P0 o agente não é informado delas — o que é exatamente o ponto: mede-se quanto o comportamento default diverge do padrão do projeto.

### 2.7 Avaliador cego

Um modelo de linguagem usado para duas funções que não podem ser resolvidas por script: classificar os pontos de decisão de T2 e responder o checklist de qualidade. Ele **não julga se algo é bom em uma escala** — responde perguntas fechadas sobre o que o diff contém.

Essa distinção é o que torna o instrumento defensável. Pedir "nota de 1 a 5 para extensibilidade" produz números que variam entre execuções e não têm âncora; pedir "a lógica nova está na camada de serviço? sim ou não" produz resposta estável.

Regras obrigatórias:

- **Modelo fixo:** Sonnet 5, sempre, independentemente do modelo sob teste na sessão.
- **Cego à condição:** recebe apenas o diff, o enunciado da tarefa e, no checklist, material de referência constante (ver pergunta 6 abaixo). Nunca recebe o nível de P, o nível de O, o modelo usado, nem qualquer identificação da célula. Cego ao restante do código do projeto o instrumento **não é** — isso nunca foi requisito de validade, só um jeito de escrever o prompt (spec do avaliador cego, seção 1 e seção 3).
- **Uma passagem por instrumento, sem votação por maioria.** Revogada a redação anterior, que previa três chamadas independentes e resposta majoritária. O que sempre importou não é se o avaliador concorda consigo mesmo, e sim se concorda com um humano; rodar três vezes e votar reduziria variância em torno de uma resposta que pode estar sistematicamente enviesada, sem corrigir o viés (spec, decisão D1). Isto não depende de controle de temperatura — a API rejeita `temperature`, `top_p` e `top_k` para Sonnet 5 com erro 400, verificado empiricamente em 21/09/2026 (spec, decisão D2); não existe hoje alavanca de determinismo via API para este modelo.
- **Confiabilidade medida contra classificação humana.** Em vez da taxa de desacordo entre chamadas, a confiabilidade do instrumento passa a ser a concordância entre o avaliador e uma amostra classificada por humano sobre diffs reais de T2 (spec, decisão D3). Este conjunto rotulado depende de sessões de T2 ainda não coletadas e fica para depois da primeira coleta.
- **Prompts congelados** junto com o protocolo, em `tools/blind-evaluator/prompts/`.

**Checklist de qualidade** — seis perguntas binárias sobre o diff:

1. A lógica de negócio nova está na camada de serviço, e não nas rotas?
2. As entradas novas são validadas por schema?
3. Os caminhos de erro têm resposta explícita com código de status apropriado?
4. Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados?
5. Há testes escritos pelo agente que verificam comportamento observável, e não implementação interna?
6. O código novo reusa utilitários já existentes no projeto, em vez de reimplementar? Respondida com o conteúdo congelado de `src/shared/` e `src/plugins/` como material de referência — idêntico em toda sessão, de todo P, todo O, todo modelo, porque vem do commit congelado da semente, nunca do contêiner da sessão. Isto não fere a cegueira à condição: o material não varia com P, O ou modelo, só dá ao avaliador o mesmo inventário de utilitários que toda sessão teve disponível (spec, decisão D9).

**Pergunta 7 retirada em 21/09/2026 (spec, decisão D8).** A antiga sétima pergunta — "os contratos HTTP pré-existentes seguem compatíveis, sem quebra não solicitada?" — foi cortada por ser redundante com `regressoes`, que **executa** a suíte pré-existente e vê se algo quebrou, em vez de pedir a um avaliador que só tem o diff para adivinhar o que não mudou. O texto retirado e a justificativa completa ficam preservados em `docs/superpowers/specs/2026-09-21-avaliador-cego-design.md`, seção 4.1, para que ninguém a restaure por parecer lacuna.

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
| **P1** | Um `CLAUDE.md` de um pouco mais de uma página: arquitetura em camadas, convenções de nomenclatura, comandos de build/test/lint, as regras da seção 2.6 em linguagem natural, **e a política de domínio da tarefa** (para T1: semântica de borda, limites de duração, efeito do cancelamento, proibição de passado, exigência de existência, alcance sobre a operação de atualização). |
| **P2** | O conteúdo de P1 — política de domínio incluída, `CLAUDE.md` herdado sem alteração, idêntico byte a byte — **mais** um plugin, carregado por `--plugin-dir` a partir de fora da cópia de trabalho (`/opt/plugin`, nunca `/app`): três *skills*, procedimentos passo a passo para estender um módulo, para escrever testes no padrão do projeto, e as oito regras da seção 2.6 em forma procedimental. |

**D2, adicionada em 17/09/2026 (spec de reavaliação de T1).** A política de domínio entra em P1 e P2 igualmente, não só no nível mais alto. Se P1 recebesse apenas estrutura e P2 recebesse estrutura mais negócio, os dois níveis diferiam em duas dimensões ao mesmo tempo e nenhum resultado seria atribuível a uma delas isoladamente. Mantida nos dois, a comparação P0 contra P1 mede o harness como um todo (estrutura mais negócio contra nada), e P1 contra P2 isola o que o plugin acrescenta por cima da mesma base de conhecimento — que é a pergunta que esta seção já pretendia fazer. Consequência: a descrição de P1 como "aproximadamente uma página" deixou de valer à risca assim que a política de domínio entrou; o arquivo de T1 (`contexts/P1/CLAUDE.md`) passou de uma página para pouco mais de uma.

**Correção de 22/09/2026 (spec do plugin P2 e da ordem segmentada O2).** A redação anterior descrevia o plugin de P2 como composto por *skills* e *rules*, citando as restrições da seção 2.6 como *rules* "em formato estruturado". *rules* não é primitiva de um plugin real — um plugin tem `skills`, `hooks`, `scripts`, `agents`, `assets` e `docs`, conferido em 22/09/2026 contra um plugin efetivamente instalado. As oito regras da seção 2.6 entram como skill própria, `convencoes-do-projeto`, procedimental por natureza, e continuam também em linguagem natural no `CLAUDE.md` que P2 herda de P1 sem uma palavra de diferença — se os dois arquivos divergissem, P1 e P2 passariam a diferir em conteúdo declarativo além do plugin, e o contraste entre eles deixaria de isolar o que o plugin acrescenta. O nome do plugin (`meeting-rooms-conventions`) e das três skills (`estender-modulo`, `escrever-testes`, `convencoes-do-projeto`) descreve o projeto, nunca a pesquisa, porque o agente sob teste os enxerga.

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

**Emenda de 22/09/2026 (spec do plugin P2 e da ordem segmentada O2).** O encadeamento das quatro chamadas usa identificador de sessão explícito, não `--continue`: a primeira chamada recebe `--session-id <uuid>` gerado pelo runner, e as três seguintes recebem `--resume <uuid>`. `--continue` retoma "a conversa mais recente" — estado implícito do mesmo tipo que já produziu três defeitos neste projeto (`modelUsage[0]`, `content[0]`, e uma opção de linha de comando registrada mas não honrada) — enquanto o identificador explícito não tem essa ambiguidade. Uma sonda de 22/09/2026 confirmou que o histórico atravessa chamadas headless por esse mecanismo: uma segunda chamada com `--resume` respondeu corretamente a uma pergunta só respondível com o conteúdo da primeira.

**Achado de 25/09/2026 — a fronteira entre os passos é instrução, não trava, e a análise precisa saber disso.** Os passos 1 e 2 dizem ao agente para não alterar arquivo. Nada impede que ele altere, e impedir transformaria a condição em outro experimento: a pergunta de O2 é o que o agente faz quando a ordem é segmentada, não o que ele faz quando o harness o obriga. Numa sessão de haiku (`T1-P2-O2-muhckhv4`) o agente implementou durante o passo de exploração — seis edições — e os passos 2 e 3 vieram vazios. **Essa sessão está rotulada O2 e, na prática, executou algo mais próximo de O1**, e qualquer leitura do fator O que a trate como O2 pleno está errada quanto a ela.

A aderência é medida, não presumida: `tools/analysis/aderencia-o2.mjs` conta, por passo, as alterações de arquivo de cada sessão O2 e nomeia as que alteraram onde o passo proíbe. A contagem é heurística e os padrões estão listados no próprio arquivo, porque duas famílias de escrita existem e nenhuma das duas pode ser ignorada: as ferramentas de edição, que são inequívocas, e comandos de shell, que não são — o Opus edita com `cat > arquivo <<'EOF'` e nunca toca numa ferramenta de edição, então contar só ferramentas devolveria zero para todas as sessões de Opus e a medida estaria silenciosamente errada em exatamente uma condição. A medida exclui escrita fora da cópia de trabalho (arquivo de rascunho em `/tmp`) e ignora o corpo de heredoc (mensagem de commit que contenha `>` não é redirecionamento).

Na coleta, **1 de 23 sessões O2** alterou arquivo nos passos 1 ou 2. O número é recalculável a qualquer momento pelo comando acima, e deve ser recalculado sobre o dataset final.

Os quatro textos acima estão congelados em arquivo, um por passo, em `orders/O2/1-explorar.md` a `orders/O2/4-verificar.md` — a sequência executada e a sequência publicada neste protocolo saem da mesma fonte. Cada uma das quatro chamadas leva a mesma rede de segurança de `--max-turns 40` da seção 3.4, e os totais da sessão — `n_turns`, `custo_usd`, `n_tool_calls` e os quatro contadores de token — são a **soma** dos quatro passos; `stop_reason` e a marca de erro (`is_error`) vêm do **último** passo, que é o que determina como a sessão terminou.

### 3.4 Constantes

Idênticos em toda sessão: commit-semente, texto do enunciado, permissões de ferramenta, imagem de contêiner e versões de Node e dependências, versão do CLI do agente, e ausência de intervenção humana.

**O limite de turnos não está nesta lista, e a redação anterior o incluía por engano.** `--max-turns` é **rede de segurança contra laço infinito**, não medida de esforço nem constante que equalize condições. Uma sonda de 22/09/2026 mediu o comportamento real: `--max-turns 3` produziu `num_turns = 6`, com `stop_reason = end_turn` e `subtype = success` — a sessão terminou sozinha, não foi cortada. As duas grandezas não contam a mesma unidade, e em cinco sessões reais sob `--max-turns 40` os turnos registrados foram 30, 31, 34, 37 e 43, nenhuma interrompida pelo limite.

**O teto subiu de 40 para 100 em 25/09/2026, e esta é a única alteração de constante depois do congelamento.** A 40 ele deixou de ser inócuo: duas das três sessões da célula T2-P0-O1 em Opus foram cortadas (`subtype = error_max_turns`), contra zero em 25 sessões de Sonnet e Haiku. Sessão cortada tem `n_turns`, `custo_usd`, `duracao_s` e `n_tool_calls` **censurados à direita** — medem o teto, não o agente — e a análise lê essas colunas como dado de processo. O viés resultante puxa para baixo exatamente o modelo que se espera gastar mais, o que inverteria a leitura. **O teto não é visível ao agente** (conferido em todos os transcripts arquivados: aparece só no evento de encerramento do próprio CLI), portanto sessão que terminou sozinha teria terminado igual sob o teto novo, e só as duas censuradas foram recoletadas. Que nenhuma sessão retida tenha sido censurada é **verificável por comando**: a verificação 8 de `tools/collect/check-dataset.mjs` reprova qualquer `error_max_turns` que uma coluna não registre.

A consequência é de redação, não de desenho: `n_turns` continua sendo **dado observado e reportado**, nunca alvo nem teto efetivo, e a comparação de esforço entre O1 e O2 permanece ancorada em custo, como a seção 8 já determina. Em O2 cada uma das quatro chamadas recebe a mesma rede, e `n_turns` da sessão é a soma das quatro — ou seja, O1 dispõe de um teto por sessão e O2 de quatro, assimetria que é propriedade do desenho e precisa ser lida junto de qualquer comparação de processo entre ordens.

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
| `qualidade` | 0–6 | ambas | Itens atendidos no checklist do avaliador cego (seção 2.7) |
| `custo_usd` | decimal | ambas | Custo das chamadas, a partir dos tokens retornados pela API |
| `duracao_s` | inteiro | ambas | Tempo de parede da sessão |
| `n_tool_calls` | inteiro | ambas | Contagem de invocações de ferramenta no transcript |
| `travou` | booleano | ambas | Foi interrompido pela rede de segurança de turnos (laço infinito), **ou** terminou sem diff, **ou** build/typecheck falha ao final. A primeira causa disparou pela primeira vez em 25/09/2026, em duas sessões de Opus sob o teto de 40; as duas foram invalidadas e recoletadas sob o teto de 100 — ver seção 3.4. |
| `decisoes` | vetor | só T2 | Categoria escolhida em cada um dos 10 pontos de decisão, pelo avaliador cego |

`duracao_s` e `n_tool_calls` custam zero código adicional — já estão no transcript e na resposta da API. `n_tool_calls` é particularmente útil para interpretar a assimetria entre O1 e O2: ajuda a distinguir se O2 ganha por conduzir melhor ou apenas por gastar mais.

**Nota adicionada em 17/09/2026, spec de reavaliação de T1.** Depois da revisão do enunciado (seção 2.2) que tirou a política de domínio de T1 e a moveu para o contexto, `taxa_aceitacao` e `violacoes` deixam de ser principal-e-secundária em T1 e passam a decompor o efeito do harness em duas fontes distintas: `taxa_aceitacao` responde a conteúdo de negócio (a política de domínio que só P1 e P2 recebem), e `violacoes` responde a conteúdo de engenharia (as oito regras da seção 2.6, que um agente atento poderia em princípio inferir do próprio código-base, sem depender do contexto). As duas juntas decompõem o efeito de contexto em vez de medi-lo duas vezes: um efeito que apareça nas duas métricas é evidência mais forte do que um que apareça só em `taxa_aceitacao`, que sozinha carrega a objeção de que parte do que mede é transferência de informação, não melhora de processo (seção 8).

**Campos de identificação** gravados junto: id da sessão, modelo e versão exata, nível de P, nível de O, tarefa, número da execução, timestamps de início e fim, caminho do transcript arquivado.

### 5.2 Por célula (só T2)

`convergencia` = proporção dos 10 pontos de decisão em que as **três execuções da célula registraram a mesma categoria**.

**Célula aqui é a tripla modelo, contexto e ordem** — não o par contexto e ordem. A seção 4.2 trata as configurações de modelo como células e elas carregam T2 três vezes cada, exatamente como as da grade principal; são elas que tornam a comparação central do artigo disponível também em T2. São portanto **dez células** de três execuções: seis em Sonnet e quatro de modelo. `tools/analysis/convergencia.mjs` agrupava por contexto e ordem apenas, o que foi inócuo enquanto T2 só existia em Sonnet e passou a bloquear quando as células de modelo entraram — P0-O1 e P2-O2 ficaram com nove sessões cada, de três modelos misturados, e o script as recusou. Corrigido em 26/09/2026; **nenhuma sessão precisou ser recoletada**, porque as dez células já tinham exatamente três execuções classificadas cada.

Métrica secundária: número médio de categorias distintas por ponto de decisão, que mostra *quão* dispersas foram as escolhas quando não houve unanimidade.

Como depende das três execuções, é calculada na análise, não pelo runner.

### 5.3 Descartadas explicitamente

Rubrica de qualidade em escala numérica, complexidade ciclomática, linhas alteradas, arquivos tocados, número de turnos. Todas interessantes; nenhuma cabe no espaço do artigo. Como transcripts e diffs ficam arquivados, qualquer uma pode ser extraída depois se sobrar tempo.

## 6. O runner

O script que executa uma sessão de ponta a ponta, sem supervisão. **É o item de maior alavancagem do projeto**: com ele, 55 sessões são uma execução noturna; sem ele, são semanas de trabalho manual.

Entrada: identificação da célula (modelo, nível P, nível O), tarefa, número da execução.

**O runner nunca substitui em silêncio: ou executa exatamente o que o rótulo diz, ou recusa executar.** O princípio foi acrescentado em 21/09/2026 depois de a mesma falha aparecer em três lugares. As opções de linha de comando eram usadas para duas coisas — rotular a sessão, indo para o nome do diretório e para colunas do dataset, e mudar o comportamento dentro do contêiner — e nos três casos a primeira parte funcionava e a segunda não. `--task T2` gravava `task: T2` e entregava o enunciado de T1; `--o O2` gravava `o_level: O2` e executava uma chamada única; `--p P1` gravava `p_level: P1` e rodava sem contexto. A causa era comum: rótulo e comportamento saíam de fontes diferentes, então podiam divergir sem sintoma.

O que torna esse defeito grave não é a frequência, é o formato. Nada falha: a sessão roda, o agente produz código, os instrumentos medem e a linha entra completa no dataset. O sintoma só apareceria na análise, como ausência de efeito, que se lê como resultado e não como defeito de instrumento.

A correção é estrutural, não caso a caso. Uma tabela única declara, para cada tarefa, qual arquivo de enunciado é entregue e se ela tem suíte oculta, e quais níveis de contexto e de ordem existem de fato; o comportamento passa a ser lido dessa mesma tabela, de modo que não exista um segundo lugar de onde ele possa vir. Combinação não declarada **aborta antes de criar diretório de sessão e antes de gastar qualquer chamada paga**, nomeando o que falta. Enquanto o plugin de P2 e a sequência O2 não existirem, pedi-los é recusado — que é o comportamento correto, já que ambos hoje não funcionam, apenas em silêncio.

1. **Preparar.** Subir um contêiner a partir da imagem de sessão, materializar a árvore da semente na tag `seed-v1`, inicializar um repositório git novo com um único commit de mensagem neutra, rodar a suíte existente e confirmar que tudo passa. Se não passar, abortar — o ambiente está corrompido.

   O agente executa **dentro do contêiner**, o que dá ambiente idêntico nas 55 sessões independentemente da máquina, torna `duracao_s` comparável, e contém o raio de dano, o que é o que permite conceder permissão total de ferramentas em sessões sem supervisão. O commit único de mensagem neutra elimina por construção o vazamento por histórico do git, que seria fatal e é fácil de esquecer.
2. **Aplicar o nível P.** P0: nada. P1: copiar o `CLAUDE.md`. P2: instalar o plugin.
3. **Executar o nível O.** Uma chamada (O1) ou quatro encadeadas (O2) ao agente em modo headless, com o modelo da célula e a rede de segurança de 40 turnos por chamada (seção 3.4). Capturar transcript e uso de tokens.
4. **Verificar o estado.** Build, verificação de tipos e suíte pré-existente. Registrar resultados.

   Três garantias de isolamento valem daqui em diante, e protegem as medições de serem sabotadas pelo próprio agente. Os comandos de verificação vêm do Makefile **congelado**, nunca da cópia que o agente pode ter editado. Os arquivos de teste da semente são **restaurados a partir da versão congelada** antes de medir regressão, e separadamente registra-se se o agente os alterou, o que é a regra 6 do script de convenções. E o servidor é iniciado pelos comandos congelados, com o runner aguardando `GET /health` responder antes de aplicar a suíte oculta.
5. **Aplicar os testes ocultos** — só em T1, e **de fora do contêiner**.

   O runner sobe o servidor dentro do contêiner, publica a porta e executa a suíte a partir do host, por HTTP. **Os testes ocultos nunca entram na cópia de trabalho**, em momento nenhum, porque a suíte é um script sem dependências que fala HTTP e não precisa estar lá.

   Isto revoga a redação anterior, que mandava copiá-los para dentro depois do fim da sessão. A mudança não é uma mitigação a mais: ela **remove** a classe de risco que a verificação 5 do portão do piloto existe para vigiar. Não há ordem a garantir nem vestígio a limpar quando o artefato nunca chega ao sistema de arquivos que o agente enxerga.

   Efeito colateral: a medição fica imune ao que o agente fez com o tooling do projeto. Se ele remover o Vitest ou quebrar a configuração de teste, a suíte oculta continua rodando.
6. **Rodar o script de convenções** sobre o diff.
7. **Registrar.** Escrever a linha em `resultados.csv` e arquivar em `sessoes/<id>/` o diff, o transcript bruto em JSON para reprocessamento programático, e uma transcrição legível em markdown com a sequência de prompts, respostas e chamadas de ferramenta. A segunda existe para permitir análise qualitativa do comportamento do agente depois que os dados quantitativos estiverem fechados, e custa quase nada, já que o transcript bruto vem da API de qualquer forma.
8. **Limpar.** Destruir o diretório de trabalho.

**O avaliador cego não é um passo do runner.** Ele roda depois, em `tools/blind-evaluator/`, sobre o diff já arquivado — uma passagem por instrumento, sem votação por maioria (seção 2.7), sem qualquer informação sobre a condição. Rodar fora da sessão permite reexecutar quando um prompt mudar sem recoletar nada, avaliar retroativamente sessões já coletadas, e não acrescenta modo de falha a uma sessão que já custou dinheiro para produzir (spec do avaliador cego, decisão D4). A redação anterior desta seção o listava como passo 7 do runner; isso está corrigido.

O runner deve ser idempotente e re-executável. Sessão que falha por erro de infraestrutura (rede, quota, timeout) é marcada inválida e re-executada, nunca aproveitada parcialmente.

**Critérios de descarte:** erro de infraestrutura, indisponibilidade da API, falha do próprio runner. Uma sessão em que o agente simplesmente foi mal **não é descartada** — é dado.

## 7. Plano de análise

Análise **descritiva e exploratória**. Com o número de observações por célula, testes de significância não sustentariam conclusão e dariam falsa autoridade ao n.

1. Média e desvio-padrão de cada métrica por célula.
2. Gráfico de barras agrupadas da `taxa_aceitacao` de T1 na grade principal, e outro da `convergencia` de T2. **Escala de cinza e hachuras** — o modelo do artigo proíbe elementos coloridos.
3. Tabela com o efeito do modelo nas duas configurações extremas.
4. Tamanho de efeito (Cliff's delta) em dois contrastes: **P0-O1 versus P2-O2** dentro do Sonnet (efeito total do harness) e **Haiku-P2O2 versus Opus-P0O1** (harness bom em modelo fraco contra harness ruim em modelo forte). O segundo responde PP3 e é provavelmente a frase mais citável do trabalho.
5. Dispersão entre execuções da mesma célula em T1, como piso de ruído. Nenhuma diferença menor que ela deve ser lida como efeito.
6. Concordância entre o avaliador cego e a amostra classificada por humano, como medida de confiabilidade do instrumento.

**A comparação mais interessante do artigo** é entre o comportamento de T1 e o de T2. Se o harness pouco altera o acerto em T1 mas altera bastante a convergência em T2, a conclusão é que a engenharia de harness importa sobretudo onde o requisito é ambíguo — que é a maior parte do trabalho real.

## 8. Ameaças à validade

| Ameaça | Natureza | Tratamento |
|---|---|---|
| **Não-determinismo** | Interna | Repetições por célula; dispersão reportada como piso de interpretação |
| **Orçamento computacional desigual** | Interna | O2 recebe mais prompting que O1, e a assimetria persiste. A rede de segurança de turnos é comum às duas ordens mas **não equaliza esforço** — ela não prende na prática (seção 3.4). Custo e `n_tool_calls` reportados como resultado conjunto; o ganho de O2 deve ser lido por unidade de custo, que é a única base de comparação justa aqui |
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
| **P0 avaliado contra regras não informadas (T1)** | Construto | Adicionada em 17/09/2026. Parte do efeito de contexto medido em T1 é, por construção, transferência de informação de domínio, não melhora de processo — precisa ser dito no artigo com essas palavras (decisão D3, seção 2.2). Mitigada pela decomposição: `violacoes` mede aderência a convenções de engenharia que o agente poderia em princípio inferir do próprio código, e não sofre da mesma objeção; um efeito presente nas duas métricas é mais forte do que um presente só em `taxa_aceitacao` |
| **Gradiente parcialmente ancorado em constantes não adivinháveis (T1)** | Construto | Adicionada em 17/09/2026. As checagens de limite de duração (regra 4 do domínio) dependem de valores que não existem em nenhum outro lugar do código-base — só o contexto os declara. São duas de vinte e seis asserções da suíte oculta; a proporção precisa ser reportada para que o leitor pondere quanto do gradiente é "adivinhação impossível" versus "processo melhor" |
| **Enunciado de T1 reescrito depois de um resultado (efeito teto)** | Interna | Adicionada em 17/09/2026. A reescrita do enunciado de T1 (seção 2.2) ocorreu depois de a suíte oculta e a implementação de referência já estarem prontas e validadas contra o enunciado antigo, motivada pelo resultado da sessão piloto. Como o contrato medido pelos testes ocultos não mudou, a linha de base (13/26) e a referência (26/26) permanecem válidas sem remedição — mas o fato de o enunciado ter sido reescrito à luz de um resultado precisa ser declarado no artigo, sob pena de parecer ajuste posterior aos dados |
| **Texto de contexto pode induzir dano (T1)** | Construto | Adicionada em 17/09/2026. `contexts/P1/CLAUDE.md` descreve a arquitetura canônica, e a semente contém um módulo (`amenities`) deliberadamente desviante dela. Um agente que leia a descrição como ordem de padronização do repositório inteiro, em vez de convenção para código novo, pode quebrar aquele módulo e ser penalizado em `regressoes` por seguir o contexto. A redação do arquivo mitiga (descreve convenção para código novo, não encomenda faxina), mas não elimina o risco, e o resultado precisa ser lido com isso em vista |

## 9. Congelamento

**O congelamento acontece no marco M3, imediatamente após o piloto ser aprovado.** Ver a seção 2 do `03-plano-de-execucao.md` para as doze verificações que compõem esse portão.

A ordem importa: o piloto é a última oportunidade de descobrir que uma tarefa tem efeito teto, que os pontos de decisão não se aplicam às saídas, que os testes ocultos falham por motivo irrelevante ou que o avaliador cego é instável. Todas essas correções são legítimas antes do congelamento e ilegítimas depois. Congelar cedo demais transformaria problemas corrigíveis em defeitos permanentes do dataset.

As sessões do piloto não integram o dataset, porque foram executadas sob uma versão do protocolo que ainda podia mudar.

Depois do congelamento, qualquer alteração exige registro com data e justificativa e descarte dos dados coletados sob a versão anterior. Correções de bug no runner que não alterem a definição das condições nem das métricas não contam como alteração de protocolo, mas devem ser registradas.

Itens congelados junto: enunciados das duas tarefas, lista de pontos de decisão e suas categorias, suíte de testes ocultos, regras do script de convenções, perguntas do checklist e prompts do avaliador cego.
