# Runner mínimo

Executa uma sessão de T1 de ponta a ponta, sem supervisão, e grava uma linha em `resultados.csv`.

Implementa a spec em `docs/superpowers/specs/2026-09-16-runner-minimo-design.md`. Escopo: tarefa T1, nível de contexto P0, nível de ordem O1. Uma chamada ao agente, sem arquivo de contexto.

## Construir a imagem de sessão

```bash
cd seed && make image && cd ..
docker build -f runner/Dockerfile.session -t meeting-rooms-session:1.0.0 runner
```

A imagem de sessão deriva de `meeting-rooms-api:1.0.0` (a imagem da semente) e acrescenta: o CLI do Claude Code, fixado na versão `2.1.272`; e `psmisc` e `patch`, que a imagem da semente não traz e que o runner precisa para derrubar o servidor de forma confiável (veja "Sobre `fuser` e `patch`" abaixo) e para o substituto `reference` aplicar o patch.

## Rodar uma sessão real

```bash
ANTHROPIC_API_KEY=sk-... node runner/run-session.mjs --task T1 --p P0 --o O1 --model claude-sonnet-5 --run 1
```

**A chave de API entra só por variável de ambiente.** Nunca por arquivo dentro da cópia de trabalho: um arquivo apareceria no diff da sessão, que é justamente o que o agente produz e que a análise depois lê.

O enunciado (`tasks/T1-validacao-de-reservas.md`) chega ao agente como **prompt**, via `claude -p`, nunca como arquivo dentro de `/app`. Um arquivo revelaria ao agente que existe mais de uma tarefa no repositório de artefatos.

Ao terminar, a sessão grava em `sessions/<id>/`: o diff (`session.diff`), o transcript bruto (`transcript.jsonl`), uma transcrição legível (`transcript.md`) e o resultado agregado (`result.json`, que inclui o detalhe asserção por asserção da suíte oculta). Uma linha é acrescentada a `resultados.csv`.

Flags aceitas: `--task`, `--p`, `--o`, `--model`, `--run`, `--fake`.

## Os três substitutos

A chamada ao agente é substituível por uma ação enlatada via `--fake`, o que permite testar o pipeline inteiro sem gastar orçamento de API.

| Substituto | O que faz | Resultado esperado |
|---|---|---|
| `noop` | Nada | Taxa de 13/26 (0.5), zero regressões, `travou_sem_diff` verdadeiro, `travou` verdadeiro, sessão **válida** |
| `reference` | Aplica `reference/T1/reference.patch` | Taxa de 26/26 (1.0), zero regressões, `travou` falso, sessão **válida** |
| `break` | Apaga `src/modules/bookings/service.ts` | Build quebra, servidor não sobe depois da sessão, taxa zero, `travou_build` e `travou` verdadeiros, sessão **válida e registrada como dado** |

```bash
node runner/run-session.mjs --fake noop
node runner/run-session.mjs --fake reference
node runner/run-session.mjs --fake break
```

**O terceiro é o mais importante do runner inteiro.** Ele prova que quebrar a aplicação produz uma sessão registrada com nota zero, `status: valid`, e não uma sessão descartada como `invalid`. Se esse substituto alguma vez voltar `invalid`, o runner está removendo silenciosamente as piores sessões do dataset — o viés mais caro de descobrir depois da coleta, porque empurra todas as condições para cima e o dataset resultante parece limpo. Os três substitutos ficam como testes de regressão do próprio runner (`runner/test/end-to-end.test.mjs`), executáveis a qualquer momento e sem custo de API.

## A regra de invalidação

A fronteira entre infraestrutura e dado é **temporal**, não de sintoma: o runner prova que a aplicação respondia à saúde **antes** de entregá-la ao agente, e a partir daí qualquer falha do servidor é atribuível ao agente.

| Falha de infraestrutura: sessão descartada e reexecutada | Dado: sessão registrada (`status: valid`) |
|---|---|
| Contêiner não sobe | Agente estourou o limite de turnos |
| Checagem de vazamento falha | Agente terminou sem diff |
| Servidor não responde **antes** da sessão (preflight) | Build ou checagem de tipos quebrados ao final |
| CLI do agente não inicia | Servidor não sobe **depois** da sessão |
| API indisponível ou com limite atingido (`rate_limit_event`) | Qualquer pontuação na suíte oculta, inclusive zero |
| Erro do próprio runner | Qualquer número de regressões |
| Teto de tempo de parede atingido (30 minutos) | |

Descartar uma sessão ruim removeria justamente as piores execuções do dataset e empurraria todas as condições para cima — o viés mais difícil de detectar depois, porque o dataset resultante parece limpo.

## Estrutura

```
runner/
  run-session.mjs        orquestração: preparar, entregar o enunciado, executar, medir, registrar, limpar
  lib/container.mjs      subir, executar dentro, copiar para dentro, derrubar
  lib/prepare.mjs        inicializa a cópia de trabalho e prova que ela serve antes da entrega
  lib/measure.mjs        mede diff, regressões, build e a suíte oculta, de fora do contêiner
  lib/transcript.mjs     lê a saída estruturada do CLI: tokens, custo, turnos, chamadas de ferramenta
  lib/dataset.mjs        esquema do CSV e acréscimo de linha
  lib/fakes.mjs          os três substitutos da chamada ao agente
  Dockerfile.session     imagem derivada da imagem da semente, acrescenta o CLI e utilitários de sistema
  test/*.test.mjs        testes do próprio runner, com `node --test`
sessions/<id>/           saída por sessão: diff, transcript, markdown, resultado
resultados.csv           o dataset, uma linha por sessão
```

## Rodar os testes do runner

```bash
node --test runner/test/
```

Os testes de `container.test.mjs`, `prepare.test.mjs`, `measure.test.mjs` e `end-to-end.test.mjs` tocam Docker de verdade e são lentos — o que precisa ser verificado ali é integração, não montagem de linha de comando. Nenhum deles gasta orçamento de API.

## Sobre `fuser` e `patch`

A imagem da semente (`meeting-rooms-api:1.0.0`) não traz `pkill` nem `fuser`. Um `pkill -f "node dist/server.js" || true` falha silenciosamente (comando não encontrado, engolido pelo `|| true`) e deixa o servidor antigo preso na porta para a fase seguinte — o mesmo problema que `reference/T1/verify.sh` já documenta ter encontrado com kill por controle de job. O runner instala `psmisc` na imagem de sessão e derruba o servidor com `fuser -k` contra a porta, como o `verify.sh` já faz. `patch` também não vem na imagem da semente e é instalado para o substituto `reference`.

## Zero dependências

Só a biblioteca padrão do Node, incluindo `node:test`. Não há `package.json` em `runner/`.
