# Spec — Runner mínimo

**Data:** 16/09/2026
**Componente:** `runner/`
**Objetivo:** executar uma sessão de T1 de ponta a ponta, sem supervisão, e gravar uma linha de dataset
**Pressupõe:** a spec da semente, a spec dos testes ocultos, e as rodadas R4.4, R4.5, R4.6, R8.1 a R8.5 do log de planejamento

---

## 1. O que este componente é, e o que ele não é

O runner é o que transforma o experimento em algo executável. Sem ele, cinquenta e cinco sessões são semanas de trabalho manual; com ele, são uma execução noturna.

**Esta spec cobre a versão mínima**, cujo propósito é único: chegar à primeira sessão crua de ponta a ponta, que é o dado mais importante desta fase do projeto. Ela informa se a coleta está correta e se existe algo na semente ou nos instrumentos que trave a execução.

**Dentro do escopo:** tarefa T1, nível de contexto P0, nível de ordem O1. Uma chamada ao agente, sem arquivo de contexto.

**Fora do escopo, e por quê:** T2 não tem instrumento ainda, porque o classificador dos pontos de decisão não existe. Os níveis P1 e P2 são cópia de arquivo e instalação de configuração, pequenos e acrescentáveis depois. A ordem O2 é um laço sobre quatro prompts encadeados. O script de convenções e o avaliador cego não existem. Nenhum deles esconde risco de projeto; todos são acréscimos a um ciclo que já funcione.

O critério para decidir o que entra: **a primeira sessão existe para encontrar defeitos no runner e nos instrumentos.** Tudo que aumenta a superfície sem aumentar a chance de encontrar esses defeitos fica de fora.

## 2. Decisões que governam esta spec

| # | Decisão | Racional | Origem |
|---|---|---|---|
| 1 | O agente é o Claude Code em modo headless, nunca um laço próprio sobre a API | O estudo mede efeito de arquivo de contexto, skills e rules, que são conceitos do Claude Code. Um laço próprio não os leria e mediria outra coisa | Construto do estudo |
| 2 | Runner em Node, sem dependências | Mesma linguagem da semente e da suíte oculta. Uma linguagem só no projeto inteiro | Esta sessão |
| 3 | Escopo mínimo: T1, P0, O1 | Caminho mais curto até descobrir defeitos, que é o propósito da primeira sessão | Esta sessão |
| 4 | A fronteira entre infraestrutura e dado é **temporal**, não de sintoma | Descartar sessão ruim removeria as piores execuções e enviesaria todas as condições para cima | Esta sessão |
| 5 | A suíte oculta roda do host, por HTTP, e nunca entra no contêiner | Remove a classe de risco que a verificação 5 do portão do piloto vigia, em vez de mitigá-la | R8.2 |
| 6 | A chamada ao agente é substituível por ações enlatadas | Três testes de resposta conhecida sobre o pipeline inteiro, sem gastar orçamento de API | Esta sessão |

## 3. Fronteira do contêiner

A imagem de sessão deriva da imagem da semente, que já contém a aplicação instalada e construída em `/app`, e acrescenta o CLI do agente.

**O runner não copia a semente a cada sessão.** Ele sobe um contêiner a partir dessa imagem e inicializa ali um repositório git novo com um commit de mensagem neutra. O digest da imagem é a âncora de reprodutibilidade e é gravado por sessão, junto com a versão do CLI.

**Uma única montagem, de saída.** O contêiner enxerga `/out`, onde grava diff e transcrições. Nada do repositório de artefatos é montado, em momento nenhum.

**A chave de API entra por variável de ambiente.** Nunca por arquivo dentro da cópia de trabalho, senão ela apareceria no diff da sessão.

**O enunciado chega como prompt.** Nunca como arquivo. Um arquivo revelaria ao agente que existe mais de uma tarefa.

## 4. O ciclo de uma sessão

### 4.1 Preparar

1. Gerar identificador da sessão e criar o diretório de saída no host.
2. Subir o contêiner a partir da imagem de sessão, com a montagem de saída e a chave de API no ambiente.
3. Inicializar o repositório git da cópia de trabalho: um commit, mensagem neutra.
4. **Verificar o que o agente vai ver.** Rodar a checagem de vazamento por dentro do contêiner, contra a cópia materializada, e não contra `seed/`. Hoje o projeto verifica o que acha que entrega; isto verifica o que de fato entregou.
5. **Provar que a aplicação funciona antes da entrega.** Subir o servidor, esperar a saúde responder, derrubar.

Os passos 4 e 5 parecem redundantes com a auditoria da semente e não são. O passo 4 fecha a única via de vazamento que nasce com o runner, que é montar o diretório errado. O passo 5 é o que torna implementável a regra da seção 5.

### 4.2 Executar

6. Chamar o Claude Code por `docker exec`, em modo de impressão, com formato de saída estruturado, limite de quarenta turnos, modelo da célula e permissões liberadas, já que o raio de dano é o contêiner. Diretório de trabalho `/app`. O prompt é o texto integral do enunciado.
7. Gravar a saída estruturada e marcar o tempo de parede do início ao fim desta fase, e só dela.

### 4.3 Medir

8. **Capturar o diff primeiro.** É dele que sai a informação de se o agente escreveu teste, e restaurar arquivos antes disso destruiria essa informação.
9. Restaurar os arquivos de teste congelados da semente.
10. **Medir regressões rodando os testes da semente por caminho explícito**, arquivo por arquivo, e não a suíte inteira. Isso mede o que a métrica promete, que é teste pré-existente que passava e passou a falhar, sem contaminar com testes escritos pelo agente e sem quebrar caso ele tenha acrescentado algo em volta.
11. Rodar build e checagem de tipos, que alimentam a condição de sessão travada.
12. Subir o servidor com porta publicada e esperar a saúde responder. **Se não responder, o agente quebrou a aplicação**, e isso é dado, não falha de infraestrutura.
13. Rodar a suíte oculta **a partir do host**, contra a porta publicada.
14. Derrubar o servidor.

### 4.4 Registrar

15. Extrair do transcript o uso de tokens e a contagem de chamadas de ferramenta.
16. Gravar no diretório da sessão: o diff, o transcript bruto para reprocessamento, e uma transcrição legível em markdown com a sequência de prompts, respostas e chamadas de ferramenta.
17. Acrescentar a linha ao CSV.

### 4.5 Limpar

18. Remover o contêiner. **Garantido em todos os caminhos de saída**, inclusive quando algo falha no meio.

## 5. A regra de invalidação

Esta é a seção que mais importa para a integridade do dataset.

Sem o teste de prontidão do passo 5, "o servidor não sobe" é ambíguo: pode ser o agente, pode ser o ambiente. Com ele, a ambiguidade desaparece, porque sabemos que a aplicação funcionava no instante em que foi entregue.

**A fronteira é temporal, não de sintoma.**

| Falha de infraestrutura: sessão descartada e reexecutada | Dado: sessão registrada |
|---|---|
| Contêiner não sobe | Agente estourou o limite de turnos |
| Checagem de vazamento falha | Agente terminou sem diff |
| Servidor não responde **antes** da sessão | Build ou checagem de tipos quebrados ao final |
| CLI do agente não inicia | Servidor não sobe **depois** da sessão |
| API indisponível ou com limite atingido | Qualquer pontuação na suíte oculta, inclusive zero |
| Erro do próprio runner | Qualquer número de regressões |
| Teto de tempo de parede atingido | |

**Sobre o teto de tempo de parede.** É coisa diferente do limite de turnos e existe para a execução noturna não ficar presa numa chamada pendurada. Bater nele é falha de infraestrutura, porque indica processo travado e não trabalho lento: um agente que consome muitos turnos bate no limite de turnos, que é dado, muito antes de bater no teto de tempo.

**Por que a assimetria importa.** Descartar sessão ruim removeria justamente as piores execuções do dataset. Isso empurraria todas as condições para cima e é o viés mais difícil de detectar depois, porque o dataset resultante parece limpo. O protocolo já diz que uma sessão em que o agente foi mal não é descartada, é dado; esta seção é o que torna essa regra operacional.

**Conflito resolvido.** A spec dos testes ocultos define que a suíte sai com código diferente de zero quando não alcança o servidor, e chama isso de falha de infraestrutura. Essa leitura estava incompleta: o código de saída da suíte informa apenas que ela não mediu, e **quem decide o que isso significa é o runner**, pela fronteira temporal acima.

## 6. Métricas e esquema do dataset

O runner mínimo preenche seis das nove métricas. As três restantes dependem de artefatos que ainda não existem.

| Métrica | Origem | Estado |
|---|---|---|
| `taxa_aceitacao` | JSON da suíte oculta | Preenchida |
| `regressoes` | Testes da semente restaurados, rodados por caminho explícito | Preenchida |
| `duracao_s` | Tempo de parede apenas da fase de execução do agente | Preenchida |
| `custo_usd` | Tokens do transcript, mais tabela de preços versionada | Preenchida |
| `n_tool_calls` | Contagem de invocações de ferramenta no transcript | Preenchida |
| `travou` | Turnos excedidos, ou sem diff, ou build quebrado, ou servidor não sobe | Preenchida, com as causas separadas na seção 6.3 |
| `violacoes` | Script de convenções | Vazia, o script não existe |
| `qualidade` | Checklist do avaliador cego | Vazia, os prompts não existem |
| `decisoes` | Classificador de pontos de decisão | Vazia, é exclusiva de T2 |

### 6.1 O dataset é um arquivo só

**CSV e dataset são a mesma coisa:** `resultados.csv`, uma linha por sessão. Identidade, reprodutibilidade, situação, métricas, tokens brutos e caminhos ficam todos na mesma linha. Os grupos abaixo são uma forma de descrever as colunas, não arquivos separados.

- **Identidade:** id da sessão, tarefa, modelo, versão exata do modelo, nível de contexto, nível de ordem, número da execução, início, fim.
- **Reprodutibilidade:** digest da imagem de sessão, versão do CLI do agente.
- **Situação:** válida ou inválida, e o motivo quando inválida.
- **Métricas:** as da tabela acima, com `decisoes` desdobrada em dez colunas.
- **Diagnóstico:** contagem de turnos, e as três causas de `travou` separadas.
- **Custo em bruto:** tokens de entrada, de saída, de leitura de cache e de escrita de cache, separados, mais a versão da tabela de preços.
- **Artefatos:** caminho do diff, caminho do transcript.

**O CSV nasce com o esquema completo, com as colunas vazias**, para que o trabalho seguinte preencha colunas em vez de reformatar o arquivo, o que obrigaria a reprocessar sessões já coletadas.

**Por que os tokens brutos e não só o valor.** Preço muda. Um dataset que guarda apenas o valor final não permite recalcular; com as contagens brutas e a versão da tabela, sim. Custa quatro colunas.

**Por que `decisoes` vira dez colunas.** Ela é um vetor de dez posições, uma por ponto de decisão de T2. Vetor em célula de CSV vira string que a análise depois precisa desmontar, e desmontar string é onde se perde dado em silêncio.

### 6.2 O que não achata, e por isso não vai para o CSV

Duas coisas não cabem numa linha e ficam no diretório da sessão, em um arquivo de resultado:

- **O resultado asserção por asserção** da suíte oculta, que é o que permite reler uma sessão sem reexecutá-la.
- **As respostas individuais das três chamadas do avaliador cego** por pergunta. A métrica de confiabilidade do protocolo é a taxa de desacordo entre essas três chamadas, e ela não existe se só o voto majoritário for guardado.

A divisão é: **o CSV guarda o agregado que a análise consome, e o diretório da sessão guarda o detalhe que a sustenta.**

### 6.3 Diagnóstico de sessão travada

`travou` é a soma de três condições distintas: limite de turnos estourado, ausência de diff, e build ou checagem de tipos quebrados ao final. O protocolo congelou a métrica composta, que permanece.

Mas composta ela não serve para diagnóstico: vindo verdadeira, não se sabe qual das três ocorreu. Por isso o CSV guarda **também as três causas em colunas próprias**, mais a contagem de turnos consumidos.

**Isto existe por causa do limite de quarenta turnos.** O número é arbitrário e vai continuar arbitrário até haver dado. O risco que ele carrega não é rejeitar sessão, porque estourar o limite é dado registrado, e sim **truncar trabalho de forma desigual entre condições**: a ordem segmentada gasta quatro chamadas encadeadas contra uma da instrução única, então um teto comum morde mais um lado. O protocolo já declara essa assimetria como ameaça à validade, e nunca a mediu.

Com a contagem de turnos gravada, o portão do piloto ganha uma verificação: **nenhuma sessão do piloto pode ter batido no limite.** Se alguma bater, o número sobe antes do congelamento, com evidência em vez de palpite.

## 7. Como o runner é testado sem gastar orçamento

**A chamada ao agente é substituível.** Uma variável de ambiente troca a invocação do Claude Code por uma ação enlatada, e todo o resto do ciclo roda idêntico. Três substitutos dão três testes de resposta conhecida sobre o pipeline inteiro, sem uma única chamada de API.

| Substituto | O que faz | Resultado esperado |
|---|---|---|
| `noop` | Nada | Taxa de 13 sobre 26, zero regressões, travou verdadeiro por ausência de diff, sessão **válida** |
| `reference` | Aplica o patch da implementação de referência | Taxa de 26 sobre 26, zero regressões, travou falso, sessão **válida** |
| `break` | Apaga um arquivo de origem da aplicação | Servidor não sobe depois da sessão, taxa zero, travou verdadeiro, sessão **válida e registrada como dado** |

**O terceiro é o mais importante.** Ele é o único jeito de provar que a regra de invalidação funciona antes de ela ser exercitada com dinheiro real. É também a parte do runner que, se estiver errada, remove silenciosamente as piores sessões do dataset. Descobrir isso durante a coleta custaria refazer a coleta inteira.

Os três ficam como testes de regressão do próprio runner, executáveis a qualquer momento e sem custo.

## 8. Estrutura de arquivos

```
runner/
  run-session.mjs        orquestração das cinco fases
  lib/container.mjs      subir, executar dentro, derrubar, garantir limpeza
  lib/transcript.mjs     ler a saída estruturada: tokens, chamadas de ferramenta, markdown
  lib/dataset.mjs        esquema do CSV e acréscimo de linha
  lib/prices.mjs         tabela de preços versionada
  Dockerfile.session     imagem derivada, acrescenta o CLI do agente
  README.md              como executar, e os três substitutos
sessions/<id>/           saída por sessão: diff, transcript, markdown, resultado
resultados.csv           o dataset
```

## 9. Riscos declarados

| Risco | Tratamento |
|---|---|
| **A regra de invalidação estar errada** e remover silenciosamente as piores sessões | O substituto `break` prova a regra antes de qualquer gasto |
| **Vazamento por montagem**, a única via que nasce com o runner | Verificação por dentro do contêiner, contra a cópia materializada |
| **Chave de API no diff da sessão** | Entra apenas por variável de ambiente |
| **Formato da saída estruturada do CLI mudar entre versões** | A versão do CLI é gravada por sessão; a leitura do transcript falha de forma ruidosa e não silenciosa quando não reconhece o formato |
| **Custo por sessão desconhecido** | A primeira sessão real fornece o número, que é pré-requisito de viabilidade do portão do piloto |

## 10. O que este componente destrava

A primeira sessão crua de ponta a ponta. Ela responde três coisas que nada mais responde antes do piloto: se o enunciado sozinho basta para uma implementação aprovada, se as métricas fazem sentido extraídas de uma sessão real, e qual o custo por sessão.
