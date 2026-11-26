---
name: decidir-ambiguidades
description: Use quando o pedido deixa em aberto como uma funcionalidade nova deve se comportar — principalmente consultas sobre horários, janelas de tempo, limites e casos vazios — antes de escrever código.
---

# Decidir o que o pedido deixou em aberto

Um pedido curto quase sempre deixa decisões de comportamento sem dono. Se
o código não toma posição, quem consome a API descobre o comportamento
por tentativa. Aqui, toda decisão em aberto é tomada **explicitamente** e
fica registrada no código.

## 1. Liste as perguntas antes de codificar

Para uma funcionalidade que envolve tempo ou listagem, percorra:

- **Forma:** rota nova ou parâmetro numa rota existente?
- **Retorno:** o que a resposta descreve (por exemplo, o que está livre ou
  o que está ocupado), e em que formato?
- **Granularidade:** intervalos contínuos, ou fatias de tamanho fixo? Se
  fixo, qual tamanho, e o cliente pode escolher?
- **Janela padrão:** o que acontece quando o cliente não informa o
  período?
- **Limites:** há tamanho máximo de janela? Há restrição de horário do dia
  (comercial, 24 horas)?
- **Fuso horário:** em que fuso os instantes entram e saem?
- **Caso vazio:** recurso sem dados devolve lista vazia, o intervalo
  inteiro, ou erro?
- **Passado:** períodos já passados entram no resultado, são cortados, ou
  são recusados?
- **Escopo:** um recurso por vez, ou vários?

## 2. Decida

Prefira, nesta ordem: o que o código existente já faz em caso parecido; o
que menos surpreende quem consome a API; o mais simples de explicar. Não
pergunte ao usuário o que dá para decidir com esse critério.

## 3. Registre cada decisão no código

Uma decisão só existe se estiver visível:

- **No schema:** o parâmetro ou campo com `description` dizendo o
  comportamento (por exemplo, "instantes ISO 8601 em UTC").
- **Em constante nomeada:** limites e padrões (`MAX_WINDOW_DAYS`,
  `DEFAULT_WINDOW_HOURS`), nunca literal solto.
- **Em teste:** um caso que fixa o comportamento decidido (janela sem
  reservas, período no passado, parâmetro omitido).

Uma decisão "por omissão" — o código simplesmente não trata o caso —
também é decisão: se for a escolhida, escreva o teste que a fixa e diga no
schema.

## 4. Relate

Na resposta final, liste as decisões tomadas, uma linha cada.
