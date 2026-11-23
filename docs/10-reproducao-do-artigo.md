# Reprodução dos números do artigo final

Escrito em 23/11/2026, depois da entrega do artigo (`TCC_2026_FINAL.pdf`).
Liga cada afirmação quantitativa do artigo ao comando que a reproduz a
partir dos artefatos publicados, e registra onde os dados não dão o número
impresso.

**Por que este documento existe.** O artigo avaliou as sessões por seis
critérios (seção III-F), e só parte deles estava no protocolo. C2
(requisitos), a complexidade ciclomática de C3, C4 (segurança), a
convergência substantiva de C5 e o esforço de C6 foram definidos depois da
coleta, e seus números não tinham script nem dado no repositório. Os
scripts listados aqui foram escritos a partir das definições do artigo e
aplicados aos diffs, transcripts e resultados arquivados. São
**reconstruções**: quando um número diverge, não se sabe se o artigo usou
outro critério ou errou a conta, e o que este documento afirma é só o que
os dados dão sob a regra escrita no script.

Nada aqui altera o dataset (`resultados.csv`), as sessões arquivadas ou o
artigo.

## Divergências

| Afirmação do artigo | Onde | Artigo | Dados | Comando | Leitura |
|---|---|---|---|---|---|
| Reserva duplicada por acesso simultâneo | Tabela VI, IV-E | 46 de 50 | **43 de 50** | `seguranca.mjs` | Sete sessões válidas põem a checagem de conflito e a gravação dentro do mesmo `$transaction` interativo do Prisma: `T1-P0-O1-mu69pgsx`, `T1-P0-O1-mugau3vr`, `T1-P0-O1-mugcrfmz`, `T1-P2-O2-mugdovul`, `T2-P0-O1-muhb0kux`, `T2-P0-O2-muhdv05x`, `T2-P0-O1-muifs0lb`. O critério é estrutural: nenhum instrumento do estudo testou se a transação de fato impede duas requisições simultâneas no SQLite. |
| "Nenhuma configuração corrigiu / tratou a condição de corrida" | Resumo, abstract, V, VII | nenhuma | 7 sessões, entre elas uma Sonnet P2-O2 (`mugdovul`) | `seguranca.mjs` | Nenhuma configuração tratou de forma **consistente**; sessões isoladas trataram. |
| O mais barato "igualou o mais caro em correção a um oitavo do custo" | Resumo, abstract | 1/8 | 1/8 contra Opus **P0-O1**; ~1/7 contra Opus P2-O2 | `resumo.mjs` | O 1/8 (US$ 0,02 contra 0,18 por teste ganho) é Haiku P2-O2 contra Opus P0-O1, e nesse par o Haiku **superou** (1,00 contra 0,87) em vez de igualar. A seção IV-C está correta; o resumo junta os dois recortes. |
| Sonnet sem guia criou consulta de horários livres | IV-D | 4 de 6 | **6 de 6** | `seguranca.mjs` (`consulta_horarios`) | O 4 parece contar só `decisao_1 = endpoint novo`; as outras duas sessões (`mudcyv6z`, `mugc9fcy`) criaram a rota e também mudaram o 409. A contagem de 25 consultas da seção IV-E já inclui as duas. |
| Haiku atendeu o requisito explícito de T2 | IV-D | 3 de 6 | **2 de 6** | `requisitos-t2.mjs` | Diferença de julgamento numa sessão: `T2-P2-O2-muhczm73` devolve no 409 só o horário da reserva que conflitou, que é ocupado, não livre. O script a classifica como não atendendo, por exceção declarada. |
| Funções do sistema original | Fig. 4 | n = 99 | **n = 100** | `complexidade.mjs` | Nenhuma acima de 10 nos dois casos. Não foi possível identificar qual função o artigo deixou de fora. |
| Execuções de teste por sessão | IV-E | 6,6 | **6,38** (verificações) ou 4,14 (só a suíte) | `esforco.mjs` | O artigo parece contar typecheck, lint e build junto com os testes. O script conta uma chamada de shell como uma execução mesmo quando ela encadeia várias; contando cada comando encadeado, daria cerca de 7,2. |
| Taxa de aceitação sem guia | IV-A | 0,75 | 0,75 só Sonnet; 0,78 os três modelos | `resumo.mjs` | O parágrafo usa n = 8 e n = 12 (todos os modelos), mas a taxa citada é a do Sonnet. |

Nenhuma divergência muda uma conclusão do artigo. A da condição de
corrida é a única que muda uma frase do resumo.

## Afirmações que se reproduzem

| Afirmação | Artigo | Dados | Comando |
|---|---|---|---|
| Requisitos implícitos atendidos, sem e com guia | 48% → 100% | 23/48 → 72/72 | `requisitos-t1.mjs` |
| Fig. 2: explícito, inferível, domínio, sem guia | 100%, 69%, 6% | 8/8, 22/32, 1/16 | `requisitos-t1.mjs` |
| Falhas sem guia que envolviam regras só do guia | 80% | 37 de 46 asserções | `result.json` (`failures`) |
| Tabela V: aceitação, qualidade, custo, T1 e T2 | todas as células | todas, após arredondamento | `resumo.mjs` |
| Tabela V: convergência substantiva | todas as células | todas | `convergencia.mjs` |
| Fig. 5: Haiku P2-O2, oficial contra substantiva | 0,70 e 0 | 0,70 e 0,00 | `convergencia.mjs` |
| Convergência substantiva do Sonnet, sem e com guia | 0,35 → 0,63 | 0,35 → 0,625 | `convergencia.mjs` |
| O1 contra O2: convergência, qualidade T2, custo | 0,53/0,53; 5,6/5,7; US$ 0,62 → 0,73 | iguais | `convergencia.mjs`, `resumo.mjs` |
| Leituras antes da primeira edição, O1 contra O2 | 20 contra 21 | 19,3 contra 20,9 | `esforco.mjs` |
| Passo de testes de O2 não alterou arquivo | 0 de 25 | 0 de 25 | `esforco.mjs`, `aderencia-o2.mjs` |
| Skills consultadas; nenhuma no Haiku | 14 de 20 | 14 de 20; Haiku 0 de 5 | `esforco.mjs` |
| Custo por teste ganho, Haiku P2-O2 contra Opus P0-O1 | US$ 0,02 contra 0,18 | 0,022 contra 0,175 | `resumo.mjs`, `result.json` |
| Custo médio por sessão, Haiku, Sonnet, Opus | 0,24 / 0,69 / 2,44 | 0,239 / 0,685 / 2,441 | `resumo.mjs` |
| Complexidade acima de 10, Haiku, Sonnet, Opus | 15% / 11% / 5% | 6/41, 9/81, 9/199 | `complexidade.mjs` |
| Funções acima de 10 nas 50 sessões; quantas são `updateBooking` | 41; 39 | 41; 39 | `complexidade.mjs` |
| Requisito explícito de T2, Sonnet e Opus | 6 de 6 | 6 de 6 | `requisitos-t2.mjs` |
| Várias reservas de uma vez: Sonnet com e sem guia; P0-O1 por modelo | 0/12, 2/6; 0/0/3 | iguais | `requisitos-t2.mjs` |
| SQL cru, segredo no código, rota sem validação | 0 de 50 | 0 de 50 | `seguranca.mjs` |
| Consulta de horários sem limite de período | 19 de 25 | 19 de 25 | `seguranca.mjs` |
| Limite de período: Opus, Sonnet, Haiku | 5, 1 e 0 | 5 de 6, 1 de 6, 0 de 1 | `seguranca.mjs` |
| Duração sem limite em T1 sem guia | 8 de 8 | 8 de 8 | `seguranca.mjs` |
| Sessões que corrigiram uma falha antes de entregar | 32 de 50 | 32 de 50 | `esforco.mjs` |
| Sessões que quebraram teste existente | 3 | 3 | `resultados.csv` (`regressoes`) |
| Nenhuma sessão deixou o sistema sem funcionar | 0 | 0 | `resultados.csv` (`travou`) |

## Fora do escopo deste documento

Os pontos que não são de número, e sim de texto, ficam registrados aqui só
para não se perderem:

- A seção VI diz que as respostas do avaliador automático "ainda precisam
  ser comparadas com as de avaliadores humanos". Essa comparação foi feita
  em 12/11/2026: κ = 0,91 no checklist de qualidade e κ = 0,81 nos pontos
  de decisão (`docs/09-concordancia.md`).
- O protocolo (seção 7) e o plano de execução (M7) previam tamanhos de
  efeito (delta de Cliff) e desvio-padrão. Estão calculados em
  `docs/08-analise-descritiva.md`; o artigo traz só médias.
- A tag `seed-v1` foi criada em 23/11/2026, depois da coleta, no commit
  `00496da`, que é o último a tocar `seed/`. A árvore é a mesma que todas
  as sessões usaram (`4a5e8206…`). A revisão humana da semente continua
  sem registro.
