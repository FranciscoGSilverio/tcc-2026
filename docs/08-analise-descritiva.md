# Resumo descritivo da coleta

Gerado por `node tools/analysis/resumo.mjs` a partir de `resultados.csv`. Só linhas `status = valid`: 50 sessões (20 de T1, 30 de T2); 4 inválidas ficam fora. Análise descritiva, sem teste de significância (protocolo, seção 7).

## 1. Média e desvio-padrão por célula

Formato `média ± dp`. Com n = 2 (T1) ou 3 (T2), o desvio-padrão é indicativo.

### T1

| modelo | P | O | n | taxa_aceitacao | qualidade (0-6) | violacoes | regressoes | custo (US$) | turnos | duração (s) |
|---|---|---|---|---|---|---|---|---|---|---|
| haiku-4-5 | P0 | O1 | 2 | 0,750 ± 0,082 | 3,50 ± 0,71 | 0,50 ± 0,71 | 0,00 ± 0,00 | 0,18 ± 0,09 | 29,0 ± 9,9 | 164,5 ± 13,4 |
| haiku-4-5 | P2 | O2 | 2 | 1,000 ± 0,000 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,29 ± 0,03 | 41,0 ± 0,0 | 278,0 ± 8,5 |
| sonnet-5 | P0 | O1 | 2 | 0,750 ± 0,082 | 4,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,38 ± 0,06 | 29,0 ± 2,8 | 140,0 ± 21,2 |
| sonnet-5 | P0 | O2 | 2 | 0,750 ± 0,082 | 4,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,43 ± 0,05 | 33,0 ± 4,2 | 198,5 ± 74,2 |
| sonnet-5 | P1 | O1 | 2 | 1,000 ± 0,000 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,47 ± 0,02 | 28,5 ± 2,1 | 249,5 ± 6,4 |
| sonnet-5 | P1 | O2 | 2 | 1,000 ± 0,000 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,45 ± 0,04 | 31,5 ± 0,7 | 186,5 ± 10,6 |
| sonnet-5 | P2 | O1 | 2 | 1,000 ± 0,000 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,47 ± 0,05 | 29,5 ± 4,9 | 295,5 ± 154,9 |
| sonnet-5 | P2 | O2 | 2 | 1,000 ± 0,000 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,68 ± 0,09 | 42,0 ± 4,2 | 326,5 ± 62,9 |
| opus-5 | P0 | O1 | 2 | 0,865 ± 0,082 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 1,66 ± 0,31 | 25,0 ± 1,4 | 532,0 ± 5,7 |
| opus-5 | P2 | O2 | 2 | 1,000 ± 0,000 | 5,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 1,94 ± 0,20 | 34,0 ± 7,1 | 898,5 ± 519,7 |

### T2

| modelo | P | O | n | qualidade (0-6) | violacoes | regressoes | custo (US$) | turnos | duração (s) | convergência |
|---|---|---|---|---|---|---|---|---|---|---|
| haiku-4-5 | P0 | O1 | 3 | 3,33 ± 1,15 | 0,33 ± 0,58 | 0,00 ± 0,00 | 0,20 ± 0,04 | 33,0 ± 6,1 | 148,0 ± 59,9 | 0,10 |
| haiku-4-5 | P2 | O2 | 3 | 4,00 ± 0,00 | 0,33 ± 0,58 | 0,33 ± 0,58 | 0,29 ± 0,01 | 36,7 ± 3,2 | 390,3 ± 45,5 | 0,70 |
| sonnet-5 | P0 | O1 | 3 | 6,00 ± 0,00 | 0,33 ± 0,58 | 0,33 ± 0,58 | 0,67 ± 0,10 | 38,0 ± 4,6 | 406,3 ± 94,6 | 0,50 |
| sonnet-5 | P0 | O2 | 3 | 5,33 ± 0,58 | 0,67 ± 0,58 | 0,33 ± 0,58 | 0,93 ± 0,20 | 47,3 ± 14,6 | 524,3 ± 24,7 | 0,70 |
| sonnet-5 | P1 | O1 | 3 | 5,33 ± 0,58 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,71 ± 0,04 | 40,3 ± 4,7 | 355,0 ± 57,7 | 0,80 |
| sonnet-5 | P1 | O2 | 3 | 6,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,79 ± 0,15 | 44,0 ± 2,6 | 390,7 ± 48,0 | 0,80 |
| sonnet-5 | P2 | O1 | 3 | 5,33 ± 0,58 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,86 ± 0,22 | 50,3 ± 8,7 | 558,0 ± 251,7 | 0,80 |
| sonnet-5 | P2 | O2 | 3 | 5,67 ± 0,58 | 0,00 ± 0,00 | 0,00 ± 0,00 | 0,91 ± 0,08 | 47,3 ± 2,5 | 498,7 ± 128,0 | 0,70 |
| opus-5 | P0 | O1 | 3 | 6,00 ± 0,00 | 1,00 ± 0,00 | 0,00 ± 0,00 | 3,35 ± 0,60 | 47,0 ± 15,7 | 1031,7 ± 322,6 | 0,60 |
| opus-5 | P2 | O2 | 3 | 6,00 ± 0,00 | 0,00 ± 0,00 | 0,00 ± 0,00 | 2,39 ± 0,20 | 35,3 ± 1,2 | 842,7 ± 126,7 | 0,60 |

Sessões com `travou = true`: 0.

## 3. Efeito do modelo nas duas configurações extremas

| modelo | configuração | taxa_aceitacao (T1) | qualidade T1 | qualidade T2 | convergência (T2) | custo médio US$ |
|---|---|---|---|---|---|---|
| haiku-4-5 | P0-O1 | 0,750 | 3,50 | 3,33 | 0,10 | 0,19 |
| haiku-4-5 | P2-O2 | 1,000 | 5,00 | 4,00 | 0,70 | 0,29 |
| sonnet-5 | P0-O1 | 0,750 | 4,00 | 6,00 | 0,50 | 0,55 |
| sonnet-5 | P2-O2 | 1,000 | 5,00 | 5,67 | 0,70 | 0,82 |
| opus-5 | P0-O1 | 0,865 | 5,00 | 6,00 | 0,60 | 2,67 |
| opus-5 | P2-O2 | 1,000 | 5,00 | 6,00 | 0,60 | 2,21 |

## 4. Tamanho de efeito (delta de Cliff)

Delta positivo: o primeiro grupo tende a ser maior. Magnitude pelos limiares de Romano et al. (2006): < 0,147 desprezível, < 0,33 pequeno, < 0,474 médio, acima grande. Com 2 sessões contra 2, o delta só assume múltiplos de 0,25 — é uma descrição da sobreposição das amostras, não uma estimativa precisa. Convergência é um número por célula e por isso entra como diferença simples, sem delta.

### Efeito total do harness (Sonnet): P2-O2 contra P0-O1

| métrica | n (1º · 2º) | média 1º | média 2º | delta de Cliff | magnitude |
|---|---|---|---|---|---|
| taxa_aceitacao (T1) | 2 · 2 | 1,000 | 0,750 | +1,00 | grande |
| qualidade (T1) | 2 · 2 | 5,000 | 4,000 | +1,00 | grande |
| qualidade (T2) | 3 · 3 | 5,667 | 6,000 | -0,33 | médio |
| custo US$ (T1+T2) | 5 · 5 | 0,819 | 0,552 | +0,76 | grande |

Convergência (T2): 0,70 contra 0,50, diferença +0,20.

### PP3: Haiku com harness completo (P2-O2) contra Opus sem harness (P0-O1)

| métrica | n (1º · 2º) | média 1º | média 2º | delta de Cliff | magnitude |
|---|---|---|---|---|---|
| taxa_aceitacao (T1) | 2 · 2 | 1,000 | 0,865 | +1,00 | grande |
| qualidade (T1) | 2 · 2 | 5,000 | 5,000 | 0,00 | desprezível |
| qualidade (T2) | 3 · 3 | 4,000 | 6,000 | -1,00 | grande |
| custo US$ (T1+T2) | 5 · 5 | 0,287 | 2,673 | -1,00 | grande |

Convergência (T2): 0,70 contra 0,60, diferença +0,10.

### Sonnet, contexto: P1 contra P0 (O1 e O2 juntos) — exploratório, fora do plano da seção 7

| métrica | n (1º · 2º) | média 1º | média 2º | delta de Cliff | magnitude |
|---|---|---|---|---|---|
| taxa_aceitacao (T1) | 4 · 4 | 1,000 | 0,750 | +1,00 | grande |
| qualidade (T1) | 4 · 4 | 5,000 | 4,000 | +1,00 | grande |
| qualidade (T2) | 6 · 6 | 5,667 | 5,667 | 0,00 | desprezível |
| custo US$ (T1+T2) | 10 · 10 | 0,633 | 0,642 | +0,04 | desprezível |

### Sonnet, forma do contexto: P2 contra P1 (O1 e O2 juntos) — exploratório, fora do plano da seção 7

| métrica | n (1º · 2º) | média 1º | média 2º | delta de Cliff | magnitude |
|---|---|---|---|---|---|
| taxa_aceitacao (T1) | 4 · 4 | 1,000 | 1,000 | 0,00 | desprezível |
| qualidade (T1) | 4 · 4 | 5,000 | 5,000 | 0,00 | desprezível |
| qualidade (T2) | 6 · 6 | 5,500 | 5,667 | -0,17 | pequeno |
| custo US$ (T1+T2) | 10 · 10 | 0,761 | 0,633 | +0,36 | médio |

### Sonnet, ordem: O2 contra O1 (P0, P1 e P2 juntos) — exploratório, fora do plano da seção 7

| métrica | n (1º · 2º) | média 1º | média 2º | delta de Cliff | magnitude |
|---|---|---|---|---|---|
| taxa_aceitacao (T1) | 6 · 6 | 0,917 | 0,917 | 0,00 | desprezível |
| qualidade (T1) | 6 · 6 | 4,667 | 4,667 | 0,00 | desprezível |
| qualidade (T2) | 9 · 9 | 5,667 | 5,556 | +0,11 | desprezível |
| custo US$ (T1+T2) | 15 · 15 | 0,734 | 0,623 | +0,28 | pequeno |

## 5. Piso de ruído em T1

Amplitude de `taxa_aceitacao` entre as duas repetições da mesma célula. Nenhuma diferença entre células menor que isto deve ser lida como efeito.

| modelo | P | O | repetições | amplitude |
|---|---|---|---|---|
| haiku-4-5 | P0 | O1 | 0,692 · 0,808 | 0,115 |
| haiku-4-5 | P2 | O2 | 1,000 · 1,000 | 0,000 |
| sonnet-5 | P0 | O1 | 0,692 · 0,808 | 0,115 |
| sonnet-5 | P0 | O2 | 0,808 · 0,692 | 0,115 |
| sonnet-5 | P1 | O1 | 1,000 · 1,000 | 0,000 |
| sonnet-5 | P1 | O2 | 1,000 · 1,000 | 0,000 |
| sonnet-5 | P2 | O1 | 1,000 · 1,000 | 0,000 |
| sonnet-5 | P2 | O2 | 1,000 · 1,000 | 0,000 |
| opus-5 | P0 | O1 | 0,923 · 0,808 | 0,115 |
| opus-5 | P2 | O2 | 1,000 · 1,000 | 0,000 |

Amplitude máxima: **0,115** (média 0,046). Em `qualidade`, nas 20 células das duas tarefas: amplitude máxima 2, média 0,35 ponto(s).

## 6. Concordância do avaliador cego com humano

Fora deste script: `node tools/analysis/concordancia.mjs`, sobre a amostra rotulada à mão (ver `tools/analysis/README.md`).
