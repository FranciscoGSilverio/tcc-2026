# Spec — Testes ocultos de T1 e implementação de referência

**Data:** 15/09/2026
**Componentes:** `hidden-tests/T1/` e `reference/T1/`
**Congelamento:** em M3, junto com o protocolo e os enunciados
**Pressupõe:** `tasks/T1-validacao-de-reservas.md`, `docs/02-protocolo-experimental.md` seções 2.2 e 2.5, e a spec da semente

---

## 1. O que estes dois artefatos são

A suíte oculta produz `taxa_aceitacao`, a variável-resposta principal de T1. A referência prova que cem por cento é alcançável e fixa o piso do aceitável.

São o mesmo instrumento visto de dois lados, e por isso vivem numa spec só. A suíte sem a referência é uma régua que ninguém verificou; a referência sem a suíte é código sem critério.

**Fronteira.** Ambos vivem fora de `seed/` e nunca são copiados para dentro de uma sessão antes do fim dela. A suíte é aplicada pelo runner depois que o agente termina; a referência nunca entra em sessão nenhuma.

## 2. Decisões que governam esta spec

| # | Decisão | Racional | Origem |
|---|---|---|---|
| 1 | A suíte é um script Node sem dependências, executado de fora da cópia de trabalho | Fica imune ao que o agente fez com o tooling: se ele remover o Vitest ou quebrar a configuração, a suíte continua rodando. O verificador de falsos negativos já provou o padrão | Esta sessão |
| 2 | `taxa_aceitacao` é por asserção, com quebra por regra no dataset | Resolução fina importa porque T1 tem apenas duas execuções por célula. A taxa por regra sai de graça | Esta sessão |
| 3 | A regra 8 do enunciado não entra na suíte | Ela é medida por `regressoes`. Duplicar amarraria duas métricas, que é o problema corrigido em R7.6 | Esta sessão |
| 4 | A referência é guardada como patch mais roteiro de verificação | Re-aplicável, revisável numa leitura, e impossível de vazar para dentro da semente por descuido | Esta sessão |
| 5 | A referência é escrita por agente, com acesso à suíte | Revisa a exigência de autoria humana. A consequência vai declarada no artigo | R7.3 |
| 6 | A pergunta "o enunciado sozinho basta?" não é respondida pela referência | É respondida pela sessão de agente cru, que é cega à suíte por construção | R7.3 |

## 3. As asserções

Vinte e seis asserções cobrindo as regras 1 a 7 do enunciado.

### 3.1 Regra 1 — sobreposição

Dez asserções. Contra uma reserva ativa existente das 10h às 11h numa sala:

| # | Caso | Esperado |
|---|---|---|
| 1.1 | Novo início cai dentro da existente | 409 |
| 1.2 | Novo fim cai dentro da existente, início antes dela | 409 |
| 1.3 | Nova engole a existente | 409 |
| 1.4 | Nova inteiramente contida na existente | 409 |
| 1.5 | Nova começa exatamente quando a existente termina | 201 |
| 1.6 | Nova termina exatamente quando a existente começa | 201 |
| 1.7 | Mesmo horário, sala diferente | 201 |
| 1.8 | Atualização move uma reserva para cima de outra | 409 |
| 1.9 | Atualização que não mexe nos horários | 200, a reserva não conflita consigo mesma |
| 1.10 | Atualização move para intervalo livre | 200 |

**A regra 1 concentra dez das vinte e seis asserções, e isso é deliberado.** Ela é o núcleo da tarefa; as outras seis são verificações mecânicas depois que se lê o enunciado. A consequência precisa ser lida junto com a taxa: as sete regras não pesam igual, e a taxa é dominada pela regra 1.

### 3.2 Regras 2 a 7

| Regra | # | Caso | Esperado |
|---|---|---|---|
| 2, cancelada libera | 2.1 | Criar sobre o intervalo de uma reserva cancelada | 201 |
| | 2.2 | Atualizar para o intervalo de uma cancelada | 200 |
| 3, passado | 3.1 | Criar com início no passado | 400 |
| | 3.2 | Atualizar movendo o início para o passado | 400 |
| | 3.3 | Criar com início no futuro | 201 |
| 4, duração | 4.1 | Exatamente 30 minutos | 201 |
| | 4.2 | 29 minutos | 400 |
| | 4.3 | Exatamente 8 horas | 201 |
| | 4.4 | 8 horas e 1 minuto | 400 |
| 5, ordem | 5.1 | Fim anterior ao início | 400 |
| | 5.2 | Fim igual ao início | 400 |
| 6, referências | 6.1 | Criar com sala inexistente | 404 |
| | 6.2 | Criar com usuário inexistente | 404 |
| | 6.3 | Atualizar para sala inexistente | 404 |
| 7, formato do erro | 7.1 | Envelope de um 409 da regra 1 | Objeto `error` com `code`, `message` e `details` |
| | 7.2 | Envelope de um 400 da regra 3 ou 4 | Mesma forma |

As asserções 1.5, 1.6, 1.7, 2.1, 2.2, 3.3, 4.1 e 4.3 existem para detectar **falso positivo**: uma implementação que rejeita demais falha nelas. Sem elas, um agente que rejeitasse toda criação de reserva tiraria nota alta.

## 4. Regras de construção da suíte

Cinco, e a terceira é a que mais protege a validade.

1. **Só HTTP, contra o servidor em execução.** Nunca importa módulo do projeto. Importar quebraria a suíte quando o agente renomeasse um arquivo, e a falha seria defeito do instrumento, não do agente — exatamente o que a verificação 7 do portão de M3 proíbe.

2. **Cria os próprios dados pela API**, com nomes aleatórios, e nunca pressupõe estado do banco. O runner reseta o banco antes, mas a suíte não depende disso.

3. **Afirma código de status e forma do envelope; quase nunca a string do código de erro.** A única exceção é `BOOKING_CONFLICT` no 409 da regra 1, porque a semente já produz exatamente esse código exatamente nessa situação, o que o torna contrato existente e não invenção do agente.

   Para tudo que a semente ainda não produz, afirmar uma string seria injusto. Um agente que criar um código próprio para reserva no passado pode estar tomando a decisão melhor, e o instrumento não pode puni-lo por isso. Vale inclusive para o 404 da regra 6: afirma-se o status, não o código.

4. **Todo instante vem do relógio**, nunca do calendário. Uma data fixa faria a suíte congelada apodrecer.

5. **Cada asserção declara a qual regra pertence**, o que produz a quebra por regra sem trabalho adicional.

## 5. Contrato de saída

A suíte escreve um objeto JSON na saída padrão:

```json
{
  "task": "T1",
  "total": 26,
  "passed": 17,
  "rate": 0.6538,
  "byRule": { "1": { "passed": 6, "total": 10 }, "2": { "passed": 2, "total": 2 } },
  "failures": [
    { "id": "1.2", "rule": 1, "name": "new end falls inside an existing booking", "expected": 409, "actual": 201 }
  ]
}
```

**O código de saída não reflete o resultado da medição.** É zero sempre que a suíte conseguiu rodar, inclusive quando a sessão tirou zero. É diferente de zero apenas quando a suíte não conseguiu falar com o servidor.

A distinção é load-bearing para o runner: sessão que foi mal é **dado**; suíte que não rodou é **falha de infraestrutura**, e o protocolo manda registrar a primeira e invalidar a segunda.

## 6. A implementação de referência

Responde uma pergunta só, e é importante não pedir mais dela: os testes são satisfazíveis, e este é o piso do aceitável.

### 6.1 O que "mínimo" significa

Quatro condições operacionais, para que "mínimo" não vire gosto:

- Implementa as regras 1 a 7 e nada além.
- Não refatora código que não precisa tocar.
- Não cria endpoint novo nem dependência nova.
- Segue o padrão canônico da semente, **incluindo escrever testes para o comportamento novo**. Não por perfeccionismo: não escrever teste é violação de convenção declarada em P1 e P2, e uma referência que viola as convenções do próprio projeto é um artefato confuso.

### 6.2 Critério de aceite

Triplo e inteiramente determinístico:

| Instrumento | Exigido |
|---|---|
| Suíte oculta | 100% das 26 asserções |
| Testes da semente restaurados | Zero regressões |
| Script de convenções | Zero violações |

Quando o script de convenções existir, a referência passa a ser também o primeiro caso de teste dele.

### 6.3 Forma

`reference/T1/reference.patch` mais `reference/T1/verify.sh`. O roteiro aplica o patch numa cópia limpa da semente, sobe o servidor, roda a suíte e confere os três números.

Isso a torna re-verificável a qualquer momento, o que importa porque ela precisa continuar valendo depois de qualquer mexida no enunciado ou na suíte.

## 7. Linha de base

**Rodar a suíte contra a semente intocada e registrar o resultado.** Custa um comando e muda a leitura de todos os outros números.

A semente já detecta um dos quatro casos de sobreposição, já ignora reservas canceladas, já aceita adjacência e já aceita durações de trinta minutos e de oito horas. Ela deve passar em parte substancial das vinte e seis asserções sem ninguém fazer nada.

Se a linha de base for, por hipótese, metade, então a faixa real de `taxa_aceitacao` não é de zero a um: é de meio a um, e uma sessão que tire meio não fez nada. Sem esse número, meio ponto de diferença entre células parece relevante quando pode estar dentro de uma faixa que nunca existiu.

A linha de base e a referência delimitam a amplitude disponível para medição, e tornam o efeito teto visível antes do piloto.

**Registro:** o número vai para `docs/05-log-de-implementacao.md` e é re-medido sempre que a suíte mudar.

**Escolha de análise deixada em aberto de propósito:** reportar a taxa crua ou normalizada pela faixa. A crua é mais simples de explicar; a normalizada é mais honesta sobre quanto do trabalho o agente realmente fez. O meio-termo barato é reportar a crua e declarar a linha de base junto. Decisão para a fase de análise, não para agora.

## 8. Colocação e proteção

```
hidden-tests/
  README.md          regras de construção, estado de congelamento
  T1/run.mjs         a suíte
reference/
  T1/reference.patch
  T1/verify.sh
```

Ambos na raiz do repositório de artefatos e **jamais dentro de `seed/`**. São artefatos de pesquisa citados no protocolo, não ferramentas de manutenção, por isso não ficam junto da auditoria da semente.

**Proteção:** uma verificação a mais no roteiro de vazamento que já existe. Nada sob esses dois diretórios pode aparecer dentro da semente, e nenhum arquivo da semente pode referenciar esses caminhos.

**Congelamento:** em M3, junto com o protocolo e os enunciados.

## 9. Riscos declarados

| Risco | Tratamento |
|---|---|
| **Efeito chão.** A suíte pode ser dura demais e achatar todas as condições perto do mínimo | A linha de base e a referência delimitam a faixa e revelam isso antes do piloto |
| **A suíte medindo a si mesma.** Ela é a única coisa entre o enunciado e o número; se afirmar mais do que o enunciado pede, mede o próprio texto | As cinco regras de construção são a defesa; a sessão de agente cru é o teste de falsificação |
| **Peso desigual entre regras.** A regra 1 concentra dez das vinte e seis asserções | Deliberado e declarado. O dataset carrega a quebra por regra, então a análise pode ponderar de outro jeito se quiser |
| **Referência escrita por agente** | Evidência mais fraca que autoria humana independente. Declarado no artigo, conforme R7.3 |

## 10. O que estes artefatos destravam

O runner mínimo, que precisa da suíte para fechar o ciclo de uma sessão, e a primeira sessão crua de ponta a ponta, que é o dado mais importante desta fase do projeto.
