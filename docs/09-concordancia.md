# Concordância avaliador cego × humano — resultado

Gerado em 12/11/2026 por:

```
node tools/analysis/concordancia.mjs --rotulos rotulagem/rotulos-preenchidos.csv --chave rotulagem/chave.json
```

Rótulos de Vinícius Telles e Silva, às cegas, seguindo `rotulagem/LEIA-ME.md` (semente `71e860e7`). Saída do script, só com os títulos rebaixados um nível:

---

## Concordância avaliador cego × humano

### Checklist (qualidade)

Agregado: concordância **98%** em 60 julgamentos, kappa de Cohen **0,91** (quase perfeita).

| | pergunta | n | concordância | kappa |
|---|---|---|---|---|
| c1 | A lógica de negócio nova está na camada de serviço, e não nas rotas? | 10 | 100% | — |
| c2 | As entradas novas são validadas por schema? | 10 | 100% | 1,00 |
| c3 | Os caminhos de erro têm resposta explícita com código de status apropriado? | 10 | 100% | — |
| c4 | Valores fixos (durações, limites, janelas) estão nomeados, em vez de literais espalhados? | 10 | 100% | 1,00 |
| c5 | Há testes escritos que verificam comportamento observável, e não implementação interna? | 10 | 100% | — |
| c6 | O código novo reusa utilitários do material de referência quando um deles se aplica, em vez de reimplementar? | 10 | 90% | 0,00 |

Desacordos:

- **item-02 c6** (T2-P0-O2-mugc9fcy): humano `nao`, avaliador `sim` — O service reusa `parseInstant` e `MINUTE_IN_MS` de `shared/time.ts` e `notFound`/`validationFailed`/`bookingConflict` de `shared/errors.ts` em vez de reimplementar essas funções.

### Pontos de decisão (convergência)

Agregado: concordância **82%** em 100 julgamentos, kappa de Cohen **0,81** (quase perfeita).

| | pergunta | n | concordância | kappa |
|---|---|---|---|---|
| d1 | Forma da solução | 10 | 100% | 1,00 |
| d2 | Semântica do retorno | 10 | 100% | 1,00 |
| d3 | Granularidade dos intervalos | 10 | 90% | 0,81 |
| d4 | Janela temporal padrão | 10 | 100% | 1,00 |
| d5 | Limite de horário | 10 | 40% | 0,12 |
| d6 | Escopo de salas | 10 | 100% | 1,00 |
| d7 | Fuso horário | 10 | 40% | 0,12 |
| d8 | Sala sem reservas | 10 | 100% | 1,00 |
| d9 | Tratamento do passado | 10 | 50% | 0,34 |
| d10 | Contrato do POST de reserva | 10 | 100% | 1,00 |

Desacordos:

- **item-02 d3** (T2-P0-O2-mugc9fcy): humano `derivada das reservas`, avaliador `parametrizável` — `AvailabilityQuery` inclui `durationMinutes` como `Type.Optional(Type.Integer(...))`, com fallback para `DEFAULT_SLOT_DURATION_MINUTES` (30) quando não informado.
- **item-02 d5** (T2-P0-O2-mugc9fcy): humano `24 horas`, avaliador `ausente` — Não há restrição de horário comercial nem limite de 24h aplicado à janela `from`/`to` do endpoint de disponibilidade; a janela de 24h (`SUGGESTION_WINDOW_MS`) é usada apenas internamente para sugestões de conflito, não como limite exposto no contrato.
- **item-04 d5** (T2-P2-O2-muh3mfug): humano `24 horas`, avaliador `ausente` — Não há restrição a horário comercial nem limite fixo de 24h; a janela é inteiramente definida por from/to informados pelo cliente, sem lógica de corte por horário do dia.
- **item-05 d5** (T2-P2-O1-muhego67): humano `24 horas`, avaliador `ausente` — Não há nenhuma validação ou schema limitando o intervalo a horário comercial, 24 horas fixas, ou algo configurável; o serviço aceita qualquer from/to válido onde to > from.
- **item-06 d5** (T2-P0-O1-muddre1p): humano `24 horas`, avaliador `ausente` — Não há nenhuma restrição a horário comercial nem configuração de limite de horas; o cálculo cobre todo o intervalo from-to fornecido, sem limitar por horário do dia.
- **item-07 d5** (T2-P2-O2-muh5udw3): humano `24 horas`, avaliador `ausente` — Não há nenhuma restrição a horário comercial nem a 24 horas, nem parâmetro de configuração de limite de horário no endpoint de disponibilidade; o intervalo é apenas o que o cliente informar em from/to.
- **item-08 d5** (T2-P0-O1-muifs0lb): humano `24 horas`, avaliador `ausente` — O diff só limita a largura da janela a 90 dias (`MAX_AVAILABILITY_WINDOW_DAYS`), mas não restringe o horário do dia consultado nem oferece configuração de horário comercial; qualquer hora dentro da janela é aceita.
- **item-02 d7** (T2-P0-O2-mugc9fcy): humano `UTC`, avaliador `ausente` — O diff não introduz nenhum campo ou documentação de fuso horário no contrato; usa `DateString`/`parseInstant` já existentes sem especificar UTC ou local explicitamente.
- **item-03 d7** (T2-P1-O2-muh2v1yp): humano `UTC`, avaliador `ausente` — O diff usa parseInstant/DateString já existentes, sem introduzir nenhum parâmetro ou documentação explícita sobre fuso horário no contrato da nova rota.
- **item-05 d7** (T2-P2-O1-muhego67): humano `UTC`, avaliador `ausente` — O diff não altera nem introduz tratamento explícito de fuso horário; usa parseInstant/DateString já existentes sem qualquer menção a UTC ou local no contrato novo.
- **item-06 d7** (T2-P0-O1-muddre1p): humano `UTC`, avaliador `ausente` — O diff usa parseInstant e Date puros, sem qualquer menção a fuso horário explícito no contrato (schema) ou tratamento de UTC/local nas funções envolvidas.
- **item-07 d7** (T2-P2-O2-muh5udw3): humano `UTC`, avaliador `ausente` — O diff não introduz nenhuma indicação explícita de fuso horário no contrato (usa DateString/parseInstant já existentes), sem menção a UTC, local ou especificação explícita no schema novo.
- **item-10 d7** (T2-P1-O1-muh3dinh): humano `UTC`, avaliador `ausente` — O diff não introduz nenhuma indicação explícita de fuso horário no contrato (schema usa DateString genérico e reaproveita parseInstant existente), sem menção a UTC/local.
- **item-02 d9** (T2-P0-O2-mugc9fcy): humano `incluído`, avaliador `ausente` — Não há nenhuma lógica no diff que filtre ou trate especialmente horários passados; a janela `from`/`to` é aceita e processada como fornecida, sem checagem contra o momento atual.
- **item-05 d9** (T2-P2-O1-muhego67): humano `incluído`, avaliador `ausente` — Não há nenhuma lógica ou teste que filtre ou trate especificamente intervalos no passado; o cálculo de freeSlots opera igualmente sobre qualquer from/to fornecido.
- **item-06 d9** (T2-P0-O1-muddre1p): humano `incluído`, avaliador `ausente` — Não há nenhuma lógica no service ou teste que filtre ou trate especificamente horários já passados; o cálculo usa apenas from/to fornecidos sem comparação com o momento atual.
- **item-07 d9** (T2-P2-O2-muh5udw3): humano `incluído`, avaliador `ausente` — Não há lógica no getAvailability que filtre ou trate especialmente horários passados dentro do intervalo from/to; o cálculo dos gaps ocorre igualmente independente de estarem no passado ou futuro.
- **item-08 d9** (T2-P0-O1-muifs0lb): humano `incluído`, avaliador `ausente` — Nenhum trecho do diff filtra ou trata de forma diferenciada janelas/reservas no passado; `parseInterval`/`getRoomAvailability` aceitam qualquer `from`/`to` sem checagem relativa ao momento atual.

Kappa lido pelos limiares de Landis e Koch (1977). Com 10 itens por pergunta, o kappa individual é instável; o número a reportar é o agregado.

---

## Leitura

- **Checklist (`qualidade`): 98%, kappa 0,91.** Um único desacordo em 60 julgamentos (item-02, c6, reúso). O instrumento de `qualidade` é confiável no sentido que o protocolo pede.
- **Pontos de decisão (convergência): 82%, kappa 0,81.** Sete dos dez pontos têm 90–100%. Os desacordos se concentram em três pontos — d5 (limite de horário, 40%), d7 (fuso, 40%) e d9 (passado, 50%) — e têm **uma direção só**: em 17 dos 18 casos o humano atribuiu a categoria que o código *implica* (`24 horas`, `UTC`, `incluído`) e o avaliador respondeu `ausente`, porque o diff não toma posição *explícita*. É uma diferença de critério sobre o que conta como "tomar posição", não ruído. O único desacordo fora desse padrão é item-02 d3 (`derivada das reservas` × `parametrizável`).
- **Consequência para a convergência:** o avaliador é sistematicamente mais conservador nesses três pontos. Como o critério é o mesmo para todas as sessões, ele não favorece uma condição; mas a convergência medida nesses pontos é convergência de *posições explícitas*, e o artigo deve dizer isso. Um rótulo humano baseado em comportamento implícito daria mais concordância entre sessões em d5, d7 e d9 (todas cairiam em `24 horas`, `UTC`, `incluído`).
- Com 10 itens por pergunta o kappa individual é instável; os números a reportar são os dois agregados.
