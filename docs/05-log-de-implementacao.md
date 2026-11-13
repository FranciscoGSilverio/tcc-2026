# Log de Implementação

**Atualizado em:** 12/11/2026 (sétima revisão)

## Para que serve este documento

Responde **onde o projeto está** e **o que vem a seguir**. É reescrito a cada sessão, não acumulado.

Ele é o complemento do `00-log-sessao-planejamento.md`, que responde outra pergunta: **por que** cada decisão foi tomada, com as alternativas rejeitadas. Aquele é append-only e nunca é reescrito. Este é descartável e sempre reflete o presente.

Se você está retomando o projeto, leia este primeiro para saber o estado. Para a coleta em detalhe — instrumento, execução, artefatos — o documento de referência é `07-handoff-da-coleta.html`. A revisão anterior deste log, de 23/09, está no histórico do git; o que ela registrava sobre T1, custo por sessão, `temperature` e teto de turnos está hoje no protocolo, no dicionário e no handoff.

---

## Estado por componente

| Componente | Estado | Onde vive | O que falta |
|---|---|---|---|
| Documentos de planejamento | Prontos | `docs/01` a `docs/04` | Nada |
| Repositório-semente | Construído, auditado, **inalterado desde 16/09** (`00496da`) | `seed/` | **Tag `seed-v1` nunca criada**, e a revisão humana da árvore não está registrada em lugar nenhum — ver "Itens em aberto" |
| Enunciados, testes ocultos, referência, pontos de decisão | Congelados em M3 | `tasks/`, `hidden-tests/`, `reference/`, `tools/blind-evaluator/lib/pontos.mjs` | Nada |
| Script de convenções, avaliador cego, runner | Congelados, usados na coleta inteira | `tools/convention-check/`, `tools/blind-evaluator/`, `runner/` | Nada |
| Contextos P1 e P2, sequência O2 | Congelados | `contexts/`, `orders/O2/` | Nada |
| **Coleta** | **Encerrada em 26/09.** 50 sessões válidas, 4 inválidas com substituta e motivo, 7 lotes. Auditor: 8 de 8 | `resultados.csv`, `sessions/` | Nada |
| **Análise descritiva** | **Feita em 10/11**, itens 1 a 5 da seção 7 do protocolo | `tools/analysis/resumo.mjs` → `docs/08-analise-descritiva.md` | Leitura e redação, no artigo |
| **Figuras do artigo** | **Geradas em 10/11**, escala de cinza com hachura, largura de coluna, PDF e PNG | `tools/analysis/figuras.py` → `docs/figuras/` | Legendas, no artigo |
| **Concordância avaliador × humano** (item 6 da seção 7) | **Medida em 12/11.** Checklist 98%, kappa 0,91; pontos de decisão 82%, kappa 0,81 | `rotulagem/rotulos-preenchidos.csv` → `docs/09-concordancia.md` | Redação no artigo. Rotulador: Vinícius Telles e Silva |
| **Plugin** | Empacotado em 01/10, validado e carregando. Autoria e licença MIT em 12/11. **Desde 13/11, entregável derivado dos resultados, livre para evoluir** (rodada 11); a versão 1.0.0, idêntica a `contexts/P2/`, está na tag `plugin-v1.0.0-p2` | `plugin/`, `.claude-plugin/marketplace.json`, `LICENSE` | Repositório **público desde 12/11**; falta a instalação por terceiro e decidir sobre o diretório da Anthropic |
| Artigo | Fora do repositório, escrito pela equipe | — | — |

**Resumo em uma linha:** a coleta está fechada e íntegra, e a análise descritiva e as figuras existem; a concordância do avaliador foi medida e é alta; o que separa o projeto da entrega é o repositório público com o plugin instalável por terceiro, e o artigo.

## Correção de 10/11: os CLIs não rodavam no Windows

Os seis scripts de linha de comando com guarda de módulo principal — `check-dataset.mjs`, `run-grid.mjs`, `evaluate.mjs`, `check.mjs`, `convergencia.mjs` e `aderencia-o2.mjs` — comparavam `process.argv[1]` com `new URL(import.meta.url).pathname`. No Windows o primeiro é `C:\...` e o segundo `/C:/...`, a comparação era sempre falsa, e **cada um deles saía com código 0 sem fazer nada**. O auditor, em particular, "passava" sem ter rodado. A guarda passou a comparar URLs de arquivo (`pathToFileURL`).

Não afeta a coleta: os sete registros de lote em `sessions/lotes/` e as colunas avaliadas provam que os scripts executaram onde ela rodou. Afeta quem for reproduzir no Windows, que é exatamente o terceiro que o critério de pronto do artigo pede. Conferido depois da correção: auditor 8 de 8, 140 testes das ferramentas passando.

## O que a análise mostrou, em uma página

Os números completos estão em `docs/08-analise-descritiva.md`; aqui só o que orienta a redação.

- **Efeito total do harness em Sonnet (P2-O2 contra P0-O1):** `taxa_aceitacao` 1,000 contra 0,750, delta de Cliff +1,00; convergência 0,70 contra 0,50. Em `qualidade` de T2 o sentido inverte (5,67 contra 6,00, delta −0,33).
- **PP3 (Haiku P2-O2 contra Opus P0-O1):** em T1 o Haiku com harness supera o Opus sem (1,000 contra 0,865, delta +1,00) a um nono do custo (US$ 0,29 contra 2,67); em `qualidade` de T2 perde inteiro (4,00 contra 6,00, delta −1,00). A frase citável tem duas metades e as duas precisam aparecer.
- **Piso de ruído de T1:** 0,115 — uma asserção de 26 é a maior amplitude entre repetições. Diferenças menores que isso não são efeito.
- **Sem efeito detectado** de P2 contra P1 nem de O2 contra O1 em acerto ou qualidade; O2 custa mais (delta +0,28 em custo), P2 também (+0,36).
- Os vazios, os tetos e os pisos estão listados no handoff, aba "Leituras possíveis", e na seção 8 do protocolo.

## Próximos passos, em ordem

1. ~~Rotular o kit de concordância~~ — feito em 12/11, resultado e leitura em `docs/09-concordancia.md`. Rotulador: Vinícius Telles e Silva. Para o artigo: os desacordos em d5, d7 e d9 têm direção única (humano lê comportamento implícito, avaliador exige posição explícita), então a convergência nesses pontos é de posições explícitas.
2. **Criar a tag `seed-v1`** em `00496da`, último commit que tocou `seed/`, com mensagem dizendo que foi criada depois da coleta e por que isso não muda nada (árvore inalterada, hash `4a5e8206…` registrado no dicionário). Registrar a revisão humana da semente — quem fez e quando — ou declarar no artigo que ela não foi feita.
3. **Plugin:** ~~autor e licença~~ feitos em 12/11; falta decidir sobre o diretório da Anthropic (exigiria um ícone).
4. **Tornar o repositório público** e pedir a alguém de fora que instale o plugin pelo marketplace (`/plugin marketplace add FranciscoGSilverio/tcc-2026`). É critério de pronto de M7 e do artigo.
5. **Artigo**, com a equipe: entrega em 14/11. Devolutiva do orientador recebida em 13/11 (41 notas). A nota sobre a Tabela III (combinações diferentes por modelo) foi respondida sem coleta nova: toda comparação entre modelos passa a usar só P0-O1 e P2-O2 — decisão e motivos na rodada 10 do `00-log-sessao-planejamento.md`. Na mesma data, o plugin deixou de ser tratado no artigo como a condição medida: P2 passa a ser descrito como o guia mais três skills, e o plugin aparece na Discussão como entregável (rodada 11).

## Itens em aberto

**De metodologia, a declarar no artigo:**
- Concordância do avaliador com humano — medida com um rotulador e 10 itens; alta, mas com critério divergente em d5, d7 e d9 (ver `docs/09-concordancia.md`).
- P0 é avaliado contra regras de domínio não informadas a ele (D3 da reavaliação de T1), e a decomposição que deveria isolar isso dependia de `violacoes`, que não tem resolução.
- A suíte oculta e a referência foram escritas pelo mesmo agente.
- O controle de deriva não foi executado; ausência de evidência de deriva não é a medida.
- A semente foi escrita com assistência de modelo da mesma família; a revisão humana é critério de aceite sem registro.

**Administrativos:**
- Revisão de literatura — feita fora do repositório, junto com o artigo.

## Custo

Sessões: **US$ 53,80** no total, dos quais US$ 47,17 nas 50 válidas e o resto nas quatro inválidas e na piloto. Avaliação cega: **US$ 2,83**. A rotulagem e a análise não gastam API.

## Situação de cronograma

| Marco | Data | Situação |
|---|---|---|
| M3 — piloto aprovado | 20/09 | Concluído, protocolo congelado |
| M4 / M6 — coleta | 27/09 · 11/10 | Concluída em 26/09, as 50 de uma vez; o controle de deriva foi cortado |
| M5 — pré-defesa | 03/10 | Data passada; o resultado não está registrado neste repositório |
| M7 — artigo e plugin prontos | 08/11 | **Atrasado.** Análise e figuras feitas em 10/11; faltam concordância, repositório público e plugin instalável por terceiro |
| M8 — entrega | 14/11 | Data fixa |
| M9 — apresentação | até 05/12 | — |
