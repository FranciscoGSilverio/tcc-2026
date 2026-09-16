# Suíte oculta de T1

## Para que serve

Este diretório contém `T1/run.mjs`, a suíte que produz `taxa_aceitacao`, a variável-resposta principal do experimento T1 (`tasks/T1-validacao-de-reservas.md`). Ela roda contra o servidor da API já em execução, por HTTP, e nunca importa código do projeto: uma sessão de agente pode renomear ou reescrever qualquer arquivo da semente que a suíte continua funcionando, porque ela não sabe nada sobre a estrutura interna do projeto.

A suíte é aplicada pelo runner **depois** que a sessão do agente termina. Ela nunca é copiada para dentro de uma sessão, e o mesmo vale para `reference/T1/`, que fica fora deste diretório e nunca entra em sessão nenhuma.

## As cinco regras de construção

Vêm da seção 4 da spec (`docs/superpowers/specs/2026-09-15-testes-ocultos-e-referencia-design.md`) e protegem a validade do instrumento.

1. **Só HTTP, contra o servidor em execução.** Nunca importa módulo do projeto. Importar quebraria a suíte quando o agente renomeasse um arquivo, e a falha seria defeito do instrumento, não do agente.
2. **Cria os próprios dados pela API**, com nomes aleatórios (`unique()`), e nunca pressupõe estado do banco. O runner reseta o banco antes de cada sessão, mas a suíte não depende disso: rodar duas vezes seguidas sem resetar produz o mesmo resultado.
3. **Afirma código de status e forma do envelope; quase nunca a string do código de erro.** A única exceção é `BOOKING_CONFLICT`, no 409 da regra 1, porque a semente já produz exatamente esse código exatamente nessa situação — é contrato existente, não invenção do agente. Para tudo que a semente ainda não produz (incluindo o 404 da regra 6), afirmar uma string seria injusto: um agente que criar um código de erro próprio para reserva no passado, por exemplo, pode estar tomando a decisão melhor, e o instrumento não pode puni-lo por isso.
4. **Todo instante vem do relógio**, nunca do calendário. `hours(h)` e `minutes(m)` deslocam a partir de `Date.now()`. Uma data fixa faria a suíte congelada apodrecer. (Os testes 1.5 e 1.6, que exigem que duas reservas compartilhem exatamente a mesma fronteira de tempo, usam `hoursFrom(anchor, h)` com um único `Date.now()` capturado uma vez, para não correr contra a latência real de duas chamadas HTTP separadas.)
5. **Cada asserção declara a qual regra pertence**, o que produz a quebra por regra em `byRule` sem trabalho adicional.

## Contrato de saída

A suíte escreve um único objeto JSON em stdout:

```json
{
  "task": "T1",
  "total": 26,
  "passed": 13,
  "rate": 0.5,
  "byRule": { "1": { "passed": 7, "total": 10 }, "2": { "passed": 2, "total": 2 } },
  "failures": [
    { "id": "1.2", "rule": 1, "name": "...", "expected": 409, "actual": 201 }
  ]
}
```

**O código de saída não reflete o resultado da medição, e essa é a distinção mais importante deste documento.** É `0` sempre que a suíte conseguiu rodar — inclusive quando a sessão tirou zero acertos, porque isso é **dado**, não falha. É diferente de zero (`2`) apenas quando a suíte não conseguiu falar com o servidor, porque isso é **falha de infraestrutura**, e o protocolo manda invalidar a sessão nesse caso, não registrar nota zero.

## Como executar

Suba o servidor da semente esperando pela saúde, nunca com `sleep` fixo, e nunca na porta 3000 (pode estar ocupada):

```bash
cd seed && make db-reset && make build
PORT=3310 make start &
for i in $(seq 1 40); do curl -fsS http://localhost:3310/health >/dev/null 2>&1 && break; sleep 0.25; done
curl -fsS http://localhost:3310/health   # deve devolver {"status":"ok"}
```

Depois rode a suíte:

```bash
BASE_URL=http://localhost:3310 node hidden-tests/T1/run.mjs
```

Ao terminar, derrube o servidor e confirme que a porta ficou livre.

## Linha de base

Medida contra a semente intocada em 15/09/2026: **13 aprovadas de 26**, exatamente metade. A faixa real de `taxa_aceitacao` não é de zero a um: é de meio a um. Uma sessão que tire meio ponto não fez nada. O detalhe por regra está em `docs/05-log-de-implementacao.md` e em `docs/superpowers/2026-09-15-execucao-testes-ocultos.md`, e é remedido sempre que a suíte muda.

## Estado de congelamento

Congelada em M3, junto com o protocolo experimental e os enunciados das tarefas. Mudanças depois disso exigem remedir a linha de base e reverificar a referência.
