# Plugin ligado aos resultados — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundir a v2 do plugin na `main` como 2.0.0, separando o conhecimento entre o `CLAUDE.md` do repositório e uma referência do time injetada por hook, com `make verify` no fim da sessão. Depois, refazer o bloco do plugin no deck (4 slides, com fluxograma) e tirar Limitações.

**Architecture:** O plugin é um pacote do Claude Code: hooks em Node 22 (ESM, sem dependências) e skills em Markdown. Os testes são `node:test` e rodam os hooks como processos sobre um repositório git descartável. O deck é o artifact Slides do claude.ai: `deck.json` e um HTML por slide, publicado a partir do scratchpad e espelhado em `docs/apresentacao/project/`.

**Tech Stack:** Node 22 (`node --test`), git, `claude plugin validate` (CLI 2.1.331), HTML/CSS do deck (`deck.css`), XeLaTeX para o plano.

**Spec:** `docs/superpowers/specs/2026-11-25-plugin-ligado-aos-resultados-design.md`

## Global Constraints

- Nunca escrever, em texto novo, que o plugin não foi medido: slides, notas, plano de apresentação, README e logs novos.
- Não alterar `seed/` nem `contexts/`.
- O plugin muda numa branch criada da `main` atualizada (`git pull --ff-only` antes), com commits. O merge na `main` vem no fim, e o push só acontece com a confirmação do usuário.
- **Não commitar:**
  - os slides (`docs/apresentacao/`);
  - o plano de apresentação (`docs/10-plano-de-apresentacao.*`);
  - os specs e planos de `docs/superpowers/`;
  - as mudanças em `docs/00` e `docs/05`, que já estão pendentes desde a sessão anterior.
- `hooks/lib/diff-rules.mjs` continua cópia byte a byte de `tools/convention-check/diff-rules.mjs`.
- Todos os hooks continuam inertes fora de um projeto cujo `package.json` se chama `meeting-rooms-api`.
- Nenhum parágrafo aparece ao mesmo tempo em `hooks/referencia-do-time.md` e em `templates/CLAUDE.md`.
- Os slides cabem em 1920 × 1080, acima do rodapé (`bottom: 64px`), e usam só os componentes de `deck.css`.
- Números dos slides exatamente como no spec:
  - skills abertas em 14 de 20 sessões (Haiku 0/5, Sonnet 9/10, Opus 5/5);
  - 9 de 50 sessões com violação, 6 delas por teste removido;
  - T1 de 18–21 para 26 de 26.

## Review Focus

1. **`make verify` lento num projeto real.** O hook de fim tem `timeout: 300`. Ao rodar sobre uma cópia da semente, a verificação precisa terminar bem abaixo disso. Medido na Task 4, passo 6.
2. **`make verify` rodando em toda parada sem mudança.** O Stop dispara a cada fim de turno, e uma conversa sem edição não pode pagar a verificação. Teste na Task 4.
3. **Projeto sem `Makefile` ou sem o alvo `verify`.** O hook segue só com as convenções, sem erro e sem bloquear por isso. Teste na Task 4.
4. **Verificação que continua falhando.** Depois de 2 devoluções, o agente encerra. Teste na Task 4.
5. **Texto repetido entre a referência e o `CLAUDE.md`.** Repetir é o que encareceu a P2. Teste na Task 3.

---

### Task 1: Trazer a v2 para uma branch da `main`, por merge

**Files:**
- Merge: `origin/plugin-v2` em `plugin-2.0.0`, criada da `main`
- Conflitos esperados:
  - `plugin/test/fidelity.test.mjs`: apagado na `main`, mantém-se apagado.
  - `.claude-plugin/marketplace.json`: fica a versão da `main`, com uma entrada.
  - `plugin/README.md`: fica a versão da `main`.

**Interfaces:**
- Produces: a árvore da v2 em `plugin/meeting-rooms-conventions-v2/` e `plugin/test/v2.test.mjs` na branch, com a autoria da Bianca preservada no histórico.

- [ ] **Step 1:** `git fetch origin && git pull --ff-only` na `main`, depois `git switch -c plugin-2.0.0`. Confira que `git status` não mostra nada em `plugin/` nem em `.claude-plugin/`. As pendências de `docs/` seguem no working tree sem entrar em commit.
- [ ] **Step 2:** `git merge --no-ff --no-commit origin/plugin-v2` e resolva os três conflitos como listado acima (`git rm plugin/test/fidelity.test.mjs`, `git checkout --ours` nos outros dois).
- [ ] **Step 3:** Rode `node --test plugin/test/*.test.mjs`. Espera-se que passe: os 13 testes de `v2.test.mjs` e o do catálogo.
- [ ] **Step 4:** Commit: `merge: traz a v2 do plugin (Bianca Souza) para a main`.

### Task 2: Pacote único 2.0.0

**Files:**
- Move: `plugin/meeting-rooms-conventions-v2/hooks/` → `plugin/meeting-rooms-conventions/hooks/`
- Replace: `plugin/meeting-rooms-conventions/skills/` pelas quatro skills da v2
- Delete: `plugin/meeting-rooms-conventions-v2/` (o `README.md` e o `LICENSE` dela também; o pacote único já tem `LICENSE`)
- Rename: `plugin/test/v2.test.mjs` → `plugin/test/hooks.test.mjs`
- Modify:
  - `plugin/meeting-rooms-conventions/.claude-plugin/plugin.json`
  - `.claude-plugin/marketplace.json`
  - `hooks/lib/project.mjs` (nome do diretório de estado)

**Interfaces:**
- Consumes: a árvore da Task 1.
- Produces: `HOOKS = plugin/meeting-rooms-conventions/hooks`. Os nomes de hook `session-start.mjs`, `guard-edit.mjs`, `guard-bash.mjs` e `stop-check.mjs` e as funções de `lib/` ficam inalterados.

- [ ] **Step 1:** Em `hooks.test.mjs`, troque o caminho `V2` por `plugin/meeting-rooms-conventions` e o import de `guards.mjs` pelo novo caminho. Acrescente um teste:

```js
test('the package has the four skills and the hooks', () => {
  for (const s of ['convencoes-do-projeto', 'escrever-testes', 'estender-modulo', 'decidir-ambiguidades'])
    assert.doesNotThrow(() => readFileSync(join(PKG, 'skills', s, 'SKILL.md')), s);
  assert.doesNotThrow(() => readFileSync(join(PKG, 'hooks', 'hooks.json')));
});
```

- [ ] **Step 2:** Rode `node --test plugin/test/*.test.mjs`. Espera-se FALHA, porque os hooks ainda estão na pasta `-v2`.
- [ ] **Step 3:** Faça as mudanças com `git mv` e `git rm`:
  - `plugin.json`:
    - `version: "2.0.0"`;
    - `description: "Convenções do time para o projeto de salas de reunião: referência injetada no início da sessão, skills de procedimento e hooks que bloqueiam e verificam"`;
    - `"hooks"` entra em `keywords`.
  - Catálogo: `version: "2.0.0"`, e a `description` da entrada sem "idêntica à condição P2".
  - Em `project.mjs`, o diretório de estado passa de `meeting-rooms-conventions-v2` para `meeting-rooms-conventions`.
- [ ] **Step 4:** Rode `node --test plugin/test/*.test.mjs`, `claude plugin validate ./plugin/meeting-rooms-conventions` e `claude plugin validate .`. Espera-se que tudo passe, sem erro de validação.
- [ ] **Step 5:** Commit: `feat: plugin 2.0.0 num pacote só, com os hooks e as skills da v2`.

### Task 3: Referência do time no plugin, específico do repositório no `CLAUDE.md`

**Files:**
- Create: `plugin/meeting-rooms-conventions/hooks/referencia-do-time.md`
- Delete: `plugin/meeting-rooms-conventions/hooks/guia-do-projeto.md`
- Modify:
  - `hooks/session-start.mjs` (lê o novo arquivo);
  - `templates/CLAUDE.md`;
  - `plugin/test/hooks.test.mjs`.

**Interfaces:**
- Produces: o texto de `referencia-do-time.md`, citado no Stop da Task 4 ("o mesmo comando que o CI do repositório roda").

- [ ] **Step 1:** Escreva os testes. Troque o teste `session start injects the project guide` por estes dois:

```js
test('session start injects the team reference, not the repository guide', () => {
  // additionalContext must match: /Convenções do time/, /schema, constante e teste/,
  //   /make verify/, /CI do repositório/, /decidir-ambiguidades/
  // and must NOT match: /Regras de domínio — reservas/
});
test('the team reference and the CLAUDE.md template share no paragraph', () => {
  // split both on blank lines, trim, ignore headings and paragraphs < 40 chars;
  // intersection must be empty. The template must still match /Regras de domínio — reservas/
  // and /não é uma ordem para reorganizar/, and must match /convenções do time chegam pelo plugin/
});
```

- [ ] **Step 2:** Rode `node --test plugin/test/hooks.test.mjs`. Espera-se FALHA nos dois testes novos.
- [ ] **Step 3:** Escreva `referencia-do-time.md`, nesta ordem:
  1. `# Convenções do time`;
  2. a lista de 8 convenções copiada sem mudança das linhas 56–83 de `templates/CLAUDE.md`, sem o título original;
  3. `## Pedido que deixa comportamento em aberto`, com 3 linhas: decidir explicitamente e registrar cada decisão no schema (`description`), em constante nomeada e em teste; detalhe na skill `decidir-ambiguidades`;
  4. `## Verificação`: ao encerrar, o que mudou passa pelas 8 convenções e por `make verify`, e o agente volta para corrigir se algo falhar; o CI do repositório roda o mesmo `make verify` em todo PR;
  5. `## Procedimentos`: uma linha por skill.

  Corte essas linhas 56–83 do `templates/CLAUDE.md` e ponha no lugar `## Convenções` com uma frase: "As convenções do time chegam pelo plugin `meeting-rooms-conventions`, no início de cada sessão." Em `session-start.mjs`, troque o nome do arquivo lido.
- [ ] **Step 4:** Rode `node --test plugin/test/*.test.mjs`. Espera-se que tudo passe.
- [ ] **Step 5:** Commit: `feat: referência do time injetada pelo plugin; o CLAUDE.md fica com o que é do repositório`.

### Task 4: `make verify` no fim da sessão

**Files:**
- Create: `plugin/meeting-rooms-conventions/hooks/lib/verify.mjs`
- Modify:
  - `hooks/stop-check.mjs`;
  - `plugin/test/hooks.test.mjs`; o `makeProject` ganha a opção `makefile`.

**Interfaces:**
- Consumes: `checkProject(dir, base)` de `lib/conventions.mjs`, que devolve `{ skipped }` ou `{ violations, notes }`.
- Produces: `runVerify(dir: string): { ran: boolean, ok: boolean, tail: string }`, com `ran = false` quando não há `Makefile` com alvo `verify`.

- [ ] **Step 1:** Escreva estes testes. Lembre que no `Makefile` a receita precisa começar com tab:
  - **`the stop check runs make verify and sends the agent back when it fails`.**
    - Fixture com `makefile: 'verify:\n\t@echo FALHOU-VERIFY; exit 1\n'` e uma mudança com teste, que não viola nenhuma convenção.
    - O `reason` deve casar com `/make verify/`, `/FALHOU-VERIFY/`, `/mesmo comando que o CI do repositório/` e `/verificação 1 de 2/`.
    - Na terceira chamada, o `stdout` deve vir vazio.
  - **`the stop check lets the session end when make verify passes`.** O alvo é `verify:\n\t@true\n` e o `stdout` deve vir vazio.
  - **`the stop check does not run make verify when nothing changed`.**
    - O alvo é `verify:\n\t@touch rodou.txt\n`.
    - A sessão é iniciada e encerrada sem mudança.
    - `rodou.txt` não pode existir.
  - **Projeto sem `Makefile`:** os testes existentes já cobrem.
- [ ] **Step 2:** Rode `node --test plugin/test/hooks.test.mjs`. Espera-se FALHA nos dois primeiros testes; o terceiro já passa.
- [ ] **Step 3:** Implemente `runVerify` em `lib/verify.mjs`:
  - `make -n verify` com `cwd: dir`; se der erro, devolve `ran: false`.
  - Depois, `make verify` com `spawnSync`, `encoding: 'utf8'` e `maxBuffer` de 64 MB.
  - `tail` são as últimas 40 linhas de stdout + stderr.

  Em `stop-check.mjs`:
  - `result.skipped` continua encerrando sem bloquear.
  - Senão, junta as violações com `runVerify(dir)`.
  - Bloqueia se houver violação ou se `ran && !ok`.
  - A mensagem ganha a linha "`make verify` falhou (o mesmo comando que o CI do repositório roda em todo PR). Últimas linhas:" e o `tail`.
  - O mesmo contador `MAX_BLOCKS`.
- [ ] **Step 4:** Rode `node --test plugin/test/*.test.mjs`. Espera-se que tudo passe.
- [ ] **Step 5:** Teste de fumaça do evento de inicialização, a partir de um diretório temporário:

  ```
  claude -p "ok" --plugin-dir ./plugin/meeting-rooms-conventions --output-format stream-json --verbose --max-turns 1
  ```

  O `system/init` deve listar `meeting-rooms-conventions` e as 4 skills com o prefixo.
- [ ] **Step 6:** Meça o tempo:
  - Copie `seed/` para o scratchpad, `git init` e commit.
  - Rode `session-start.mjs`, altere `src/modules/rooms/service.ts` e um teste, e cronometre `stop-check.mjs`.
  - Espera-se que termine em menos de 300 s. Anote o tempo para o README.
- [ ] **Step 7:** Commit: `feat: o fim da sessão roda make verify, o mesmo comando do CI do repositório`.

### Task 5: READMEs e entrada na `main`

**Files:**
- Modify:
  - `plugin/meeting-rooms-conventions/README.md` (público);
  - `plugin/README.md` (de quem mantém).

- [ ] **Step 1: README público.**
  - Seções: o que o plugin faz e por quê (o achado das skills, em 2 frases); a divisão repositório × plugin (a tabela do spec); o que vem no pacote; instalar.
  - Instalar inclui: copiar `templates/CLAUDE.md` para a raiz; e, no repositório, marcar o workflow de CI que roda `make verify` como verificação obrigatória na proteção da branch.
  - Bloqueio na hora para as ferramentas de edição e verificação no fim para tudo.
  - "A tag `plugin-v1.0.0-p2` reproduz a condição P2 do estudo."
  - Requer Node 22 e git.
- [ ] **Step 2: README de quem mantém.**
  - Pacote único 2.0.0.
  - Caminho dos testes `hooks.test.mjs`.
  - A cópia byte a byte de `diff-rules.mjs`.
  - Na lista "O que falta", marcar a fusão da v2.
- [ ] **Step 3:** Verifique:
  - `grep -niE "medid|medi[rç]" plugin/meeting-rooms-conventions/README.md plugin/meeting-rooms-conventions/hooks/*.md` deve sair vazio.
  - Rode de novo `node --test plugin/test/*.test.mjs` e os dois `claude plugin validate`.
- [ ] **Step 4:** Commit: `docs: README do plugin 2.0.0`.
- [ ] **Step 5:** `git switch main && git merge --ff-only plugin-2.0.0`, depois rode os testes na `main`. **Pergunte ao usuário** antes de `git push`.

### Task 6: Bloco do plugin no deck

**Files:**
- No artifact (raiz `scratchpad/artifact-files/bdd84c6c-7fa2-4e82-89e0-aaff4061c966`), em `project/slides/`:
  - Create: `gancho.html`, `fluxo.html` e `mecanismos.html`.
  - Modify: `encerramento.html`.
  - Delete (publicar `null`): `escada.html`, `hooks.html`, `contrafactual.html` e `limitacoes.html`.
- Modify: `project/deck.json`.
- Espelho: `docs/apresentacao/project/`, via `rsync -a --delete`.

- [ ] **Step 1:** Leia o artifact `https://claude.ai/artifact/QSgnDrYou5sSKdU17J36vH` (`action: read`). Se a versão for maior que 21, puxe os arquivos alterados para o scratchpad antes de editar.
- [ ] **Step 2:** Escreva os três slides com o conteúdo e os tempos do spec, rodapé "Plugin" e `<aside>` começando por "tempo · Bianca":
  - `fluxo` usa três faixas rotuladas (Repositório, Plugin · na sessão, CI do repositório) e as etapas da esquerda para a direita.
  - O opcional tem `border-style: dashed`, e há uma legenda de uma linha.
  - As setas são SVG inline, com cores de `var(--…)`.
  - Em `encerramento`, saia o item "Medir o plugin v2 com uma tarefa ambígua nova".
- [ ] **Step 3:** Em `deck.json`:
  - o fim de `order` passa a ser `"gancho", "fluxo", "mecanismos", "encerramento"`;
  - `s4.start = "gancho"`;
  - descrição de `s4`: "Plugin e encerramento, Bianca (cerca de 6 min): o agente nem sempre usou o que dependia dele; o fluxograma do que o plugin e o CI garantem; cada mecanismo e o achado que o motiva."
- [ ] **Step 4:** Renderize cada slide novo:
  - Monte o wrapper com as primeiras 107 linhas de `scratchpad/preview/pipeline.html` seguidas do HTML do slide.
  - Rode o Chromium em `~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome` com `--headless --no-sandbox --disable-gpu --hide-scrollbars --proxy-server=127.0.0.1:9 --window-size=1920,1080 --screenshot`.
  - Olhe o PNG: nada pode passar da borda nem cobrir o rodapé.
- [ ] **Step 5:** Verifique: `grep -niE "medid|não sabemos|devolveria" project/slides/{gancho,fluxo,mecanismos,encerramento}.html` deve sair vazio.
- [ ] **Step 6:** Publique com `url` do deck e `root` do scratchpad:
  - `file_path`: o `deck.json`, com caminho absoluto;
  - `files`: os três novos, `encerramento.html` e `null` para os quatro removidos.

  Depois sincronize com `rsync -a --delete project/ docs/apresentacao/project/` e confira com `diff -r`. **Sem commit.**

### Task 7: Documentos da apresentação

**Files:**
- Modify:
  - `docs/10-plano-de-apresentacao.tex` e o PDF;
  - `docs/apresentacao/README.md`;
  - `docs/05-log-de-implementacao.md`;
  - `docs/00-log-sessao-planejamento.md`, rodada nova R14.

- [ ] **Step 1:** Em `docs/10`:
  - Na tabela do roteiro, o bloco 4 fica com os slides 14 a 17, cerca de 6 min, e o total com 1–17, cerca de 26 min.
  - A lista do bloco 4 fica com os 4 slides do spec.
  - Na arguição, as linhas que diziam "Limitações (17)" ganham a resposta por extenso, tirada das notas do antigo `limitacoes`. A linha "Perguntas sobre o plugin" aponta para Fluxograma (15) e Mecanismos (16).
  - Em "Antes da banca", sai o item de R12.6 e entra a pendência de push da branch.
  - Nenhuma menção a medição do plugin.
- [ ] **Step 2:** Compile com `xelatex -output-directory=<scratchpad>/tex docs/10-plano-de-apresentacao.tex`, duas vezes, e copie o PDF para `docs/`. Espera-se compilação sem erro e 4 páginas, mais ou menos.
- [ ] **Step 3:**
  - No README do deck, o bloco 4 com os novos ids.
  - Em `docs/05`, a linha Plugin passa a "2.0.0 na `main`".
  - Em `docs/00`, a rodada R14 registra: as decisões do usuário (CI é do repositório; a divisão do conhecimento; sem Limitações; sem frase sobre medição); o que foi feito no plugin; os tempos medidos na Task 4.
- [ ] **Step 4:** Verifique: `git status` não mostra nenhum dos arquivos desta task em commit, e `git log main -5` mostra só os commits do plugin.
