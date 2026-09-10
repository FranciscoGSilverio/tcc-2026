# Aceite do repositório-semente

Referência: `docs/superpowers/specs/2026-09-09-repositorio-semente-design.md`, seção 11.

## A. Contrato funcional
- [ ] Todas as rotas da seção 4.2 respondem com os códigos listados — `cd seed && make verify`
- [ ] O envelope de erro é idêntico em todos os caminhos, inclusive no módulo desviante
- [ ] Listagens canônicas usam o auxiliar de paginação; a do desviante devolve array puro
- [ ] `GET /health` responde 200
- [ ] O cancelamento é idempotente

## B. Regra do falso negativo
- [ ] As oito lacunas esperadas estão presentes — `node tools/seed-audit/false-negatives.mjs`
- [ ] **Fecho, revisão humana:** lendo o contrato de T1 contra o código, não existe nenhum caminho que recuse um pedido que T1 aceitaria

## C. Estrutura e convenções
- [ ] Contagens de arquivos e ausência de marcações — `./tools/seed-audit/check-structure.sh`
- [ ] O serviço de usuários carrega exatamente as duas imperfeições nomeadas, e nenhuma outra
- [ ] A regra de negócio nunca está nas rotas dos módulos canônicos

## D. Ausência de vazamento
- [ ] Termos, arquivos dirigidos a agente e README — `./tools/seed-audit/check-no-leak.sh`
- [ ] Nenhum teste oculto, enunciado, ponto de decisão ou implementação de referência na árvore ou no histórico
- [ ] O runner materializa a cópia com um único commit de mensagem neutra

## E. Testes da semente
- [ ] Nenhuma data absoluta — `grep -rnE '[12][0-9]{3}-[01][0-9]-[0-3][0-9]' seed/tests`
- [ ] **Revisão humana:** nenhuma das seis afirmações proibidas da spec seção 8 aparece
- [ ] A suíte passa em execuções repetidas — rodar `make test` três vezes

## F. Inércia do lastro
- [ ] `./tools/seed-audit/check-ballast-inert.sh`
- [ ] Nenhum alvo do Makefile e nenhuma etapa do Dockerfile dependem do lastro

## G. Reprodutibilidade e operação
- [ ] De um clone limpo, `make verify` passa
- [ ] Versões exatas e lockfile versionado
- [ ] `docker run --rm meeting-rooms-api:1.0.0 make verify` passa
- [ ] Tempo de verificação medido e registrado aqui: `7.7s`

## H. Revisão humana
- [ ] Integrante que revisou a árvore inteira: `______`  Data: `______`
