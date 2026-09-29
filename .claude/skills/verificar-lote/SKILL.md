---
name: verificar-lote
description: Use entre lotes da coleta de sessões, depois de rodar tools/collect/run-grid.mjs, para responder "all clear" ou "parar" sobre a integridade do que foi coletado.
---

# Verificar lote

Você é o procurador do orientando entre dois lotes da coleta. O trabalho é
responder **uma coisa**: o lote que acabou de rodar pode ser seguido de mais
um, ou a coleta precisa parar para conserto?

Quatro passos. Faça os quatro, na ordem, e responda.

## 1. Rode o auditor

```
node tools/collect/check-dataset.mjs
```

Se ele sair com código diferente de zero, **reporte qual verificação
reprovou e quais sessões ela nomeou, e pare por aqui.** Não tente
consertar, não tente interpretar, não recolete nada: a decisão de
re-executar é humana.

As notas da verificação 4 (sessões anteriores ao regime de imagem única)
não são reprovação. Repasse-as e siga.

## 2. Confira que o lote entregou o que prometeu

Esta é a única coisa aqui que o auditor **não consegue fazer**: ele só
enxerga o dataset, e sete sessões íntegras num lote de dez parecem, ali,
exatamente sete sessões íntegras.

Abra o registro mais recente em `sessions/lotes/` e compare:

- Se não existe registro para o lote que acabou de rodar, **pare**: o
  driver morreu antes de terminar de escrever, e ninguém sabe onde.
- Se `stopped` não é nulo, o driver parou e disse por quê. **Reporte a
  sessão e o motivo e pare.**
- Se `stopped` é nulo, `executed.length` tem que ser igual a
  `promised.length`. Se for menor, **pare** e diga quantas faltaram.

## 3. Leia um transcript do lote, inteiro e com atenção

Pegue a primeira sessão listada em `executed` no registro do lote e leia
`sessions/<id>/transcript.jsonl` do começo ao fim.

Você está procurando qualquer coisa que sugira que **a medição não
aconteceu como desenhada**: o enunciado chegando cortado ou duplicado,
uma etapa de O2 que claramente não recebeu o contexto da anterior, o
agente encontrando arquivos do estudo dentro da cópia de trabalho, erro
de ferramenta repetido que indique ambiente quebrado, sinal de que a
sessão rodou com outro contexto que não o rotulado.

Se nada disso aparecer, esse passo passou.

## 4. Responda

Uma de duas palavras, e o motivo em uma linha:

- `all clear` — os três passos passaram; pode rodar o próximo lote.
- `parar` — e qual passo falhou, com os nomes que ele deu.

---

## Proibição: não julgue resultado

`taxa_aceitacao` baixa, `qualidade` baixa, convergência baixa, diff muito
maior ou menor que os outros, custo fora do padrão do conjunto, célula que
não se comporta como a hipótese previa — **nada disso é problema a
reportar.** É dado. Medição fora do padrão é dado desde que a regra tenha
sido seguida.

Uma sessão em que o agente não fez nada **é dado, não defeito**:
`travou_sem_diff` existe para registrá-la e o protocolo manda preservá-la
com nota zero. Conferir se houve "trabalho de verdade" é julgar resultado
pela porta dos fundos, e não é o seu trabalho.

Esta proibição está escrita com estas palavras de propósito. Um agente
encarregado de "ver se está tudo bem" tem tendência natural a encontrar
alguma coisa, e o que ele encontraria primeiro seria justamente o
resultado desfavorável — empurrando a coleta na direção da hipótese, que é
o viés que o avaliador cego e a ordem randomizada existem para evitar.
