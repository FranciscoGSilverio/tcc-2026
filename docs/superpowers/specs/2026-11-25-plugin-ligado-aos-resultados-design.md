# Plugin ligado aos resultados — design

25/11/2026. Substitui o bloco 4 do roteiro de `2026-11-24-apresentacao-enxuta-design.md` e as mudanças pendentes de R12.6 (`docs/00`).

## Intenção

O grupo recebeu o retorno de que a parte do plugin está desconectada do resto da apresentação: fala de v1 e v2 e entra em detalhe técnico. O plugin passa a ser apresentado como consequência de um achado do estudo: **o que dependia de o agente escolher usar nem sempre foi usado**. As skills estavam disponíveis na P2 e não foram abertas em 6 de 20 sessões; o Haiku não abriu nenhuma nas 5 sessões dele, embora elas aparecessem na lista. O que funcionou foi o que estava sempre presente, o `CLAUDE.md` da P1. O plugin, então, põe no contexto o que importa e transforma em verificação feita por código o que não pode depender do agente. Nos slides, isso aparece como um fluxograma.

## Metas, não metas e anti-metas

- **Meta:** o plugin no repositório contém de verdade os mecanismos que os slides mostram, caso alguém confira.
- **Meta:** o bloco da Bianca tem 4 slides, em cerca de 6 min. O deck fica com 17 slides, cerca de 26 min.
- **Não meta:** mudança grande no plugin. Ela é mínima, pontual e quase toda aditiva sobre a v2 que já existe.
- **Não meta:** CI dentro do plugin. O CI é do repositório do projeto, que já roda `make verify` (`seed/.github/workflows/ci.yml`).
- **Anti-meta:** escrever em qualquer lugar que o plugin não foi medido: slides, notas, plano de apresentação ou README.
- **Anti-meta:** alterar a semente (`seed/`) ou `contexts/`. São a referência da medição.

## Os fatos que os slides usam

Todos saem de scripts versionados:

- **Skills consultadas na P2:** 14 de 20 sessões, sendo Haiku 0 de 5, Sonnet 9 de 10 e Opus 5 de 5. Fonte: `node tools/analysis/esforco.mjs`. Consulta conta invocar a skill ou ler o arquivo dela.
- **Violações:** 9 de 50 sessões terminaram com uma convenção violada, 8 em P0 e uma do Haiku com as skills disponíveis (`T2-P2-O2-muhczm73`). Seis delas foram linha de teste removida (convenção 6). Fonte: `resultados.csv` (`violacoes`) e R12.3.
- **T1 com o `CLAUDE.md`:** de 18–21 para 26 de 26 testes ocultos. Fonte: `docs/08`.
- **CI da semente:** em todo push na `main` e em todo PR, roda `make verify`, que é setup, typecheck, lint, build e test.

## Abordagens

1. **Fundir a v2 na `main` como pacote único 2.0.0 e dividir o conhecimento entre o repositório e o plugin.** Escolhida. Reaproveita os hooks da Bianca, resolve o conflito com a `main` (R12.2) e dá ao slide a divisão "específico do repositório × do time".
2. **Manter a v2 como segundo pacote e só trocar os slides.** Rejeitada. O catálogo da `main` proíbe uma segunda entrada, e quem conferisse acharia na `main` um plugin sem os mecanismos mostrados.
3. **Pôr um workflow de CI no plugin.** Rejeitada pelo usuário. O CI que importa é o do repositório onde o agente trabalha. O plugin se liga a ele rodando o mesmo comando no fim da sessão.

## O plugin

### Divisão do conhecimento (decisão do usuário)

| Onde | Conteúdo | Como chega ao agente |
|---|---|---|
| `CLAUDE.md` do repositório (modelo em `templates/CLAUDE.md`) | Específico deste repositório: arquitetura, nomenclatura e erros, comandos, regras de domínio de reservas e a ressalva sobre `amenities` | O Claude Code lê sempre |
| Referência do time (`hooks/referencia-do-time.md`) | Geral, distribuída ao time: as 8 convenções, a regra para pedido que deixa comportamento em aberto, como a verificação funciona (fim da sessão e CI) e quando usar cada skill | O hook de início de sessão injeta sempre |

**Condição para a ideia valer:** a referência entra no contexto pelo hook, nunca como arquivo que o agente pode escolher ler; se não, repete o problema das skills. Ela deve ser curta, e nenhum texto aparece nos dois lugares.

### Mudanças

1. **Fundir `origin/plugin-v2` numa branch criada da `main` atualizada, por merge**, para manter os commits e a autoria da Bianca. O conteúdo de `meeting-rooms-conventions-v2/` passa para `meeting-rooms-conventions/`: hooks e skills da v2. A pasta `-v2` sai, e o catálogo continua com uma entrada só. A versão vai para `2.0.0` no `plugin.json` e no catálogo.
2. **O guia injetado vira a referência do time.**
   - `hooks/guia-do-projeto.md` dá lugar a `hooks/referencia-do-time.md`.
   - Na referência entram, sem reescrever, a seção "Convenções observadas nesta base" do modelo `CLAUDE.md`, a regra geral de `decidir-ambiguidades` em três linhas (decidir explicitamente e registrar em schema, constante e teste) e um parágrafo de verificação. O parágrafo diz que o fim da sessão confere as convenções e roda `make verify`, e que o CI do repositório roda `make verify` em todo PR.
   - Também entra a lista de skills, com uma linha para cada.
3. **`templates/CLAUDE.md` fica só com o que é do repositório.** Sai a seção das 8 convenções, que passa a viver na referência, e entra no lugar uma linha dizendo que as convenções do time chegam pelo plugin. A ressalva sobre `amenities` já está nesse arquivo e fica onde está.
4. **O hook de fim de sessão roda `make verify`.**
   - Roda quando a sessão alterou algo e o projeto tem `Makefile` com o alvo `verify`.
   - Se falhar, o hook bloqueia o encerramento e devolve ao agente as últimas linhas da saída, junto com as violações de convenção, se houver.
   - Ele usa o mesmo contador de no máximo 2 devoluções por sessão.
   - A mensagem diz que é o mesmo comando que o CI do repositório roda.
5. **READMEs.**
   - O README público descreve a 2.0.0: a divisão repositório × plugin, os hooks, as skills e a instalação. Diz que a tag `plugin-v1.0.0-p2` é a versão que reproduz a condição P2 do estudo.
   - O README público recomenda marcar o workflow de CI do repositório como verificação obrigatória na proteção da branch.
   - Sobre edições feitas pelo terminal, o README diz que o bloqueio na hora vale para as ferramentas de edição e que a verificação no fim da sessão vale para tudo.
   - Nenhuma frase sobre medição.
   - `plugin/README.md`, o de quem mantém o pacote, é atualizado para o pacote único.

### O que não muda

- `guard-edit`, `guard-bash`, a checagem das 8 convenções e `diff-rules.mjs`, que continua cópia byte a byte de `tools/convention-check/`.
- As quatro skills da v2, incluindo `decidir-ambiguidades` com a lista de perguntas. É decisão minha, para manter a mudança mínima; o usuário pode reverter.
- A trava por projeto: todos os hooks continuam agindo só onde `package.json` se chama `meeting-rooms-api`.

## Os slides

Bloco 4, Bianca. Saem `escada`, `hooks`, `contrafactual` e `limitacoes`, e entram:

| # | id | Conteúdo | Tempo |
|---|---|---|---|
| 14 | `gancho` | "O agente tinha as skills e nem sempre as abriu." Abertas em 14 de 20 sessões; Haiku 0 de 5, com as skills listadas. Ao lado: o `CLAUDE.md`, sempre presente, levou a T1 de 18–21 para 26 de 26. Frase-chave: o que funcionou não dependia de o agente escolher usar | 1:30 |
| 15 | `fluxo` | Fluxograma em tela cheia, descrito abaixo | 2:00 |
| 16 | `mecanismos` | Cada mecanismo responde a um achado, tabela abaixo | 1:30 |
| 17 | `encerramento` | O mesmo de hoje, sem o item "Medir o plugin v2" no trabalho futuro | 1:00 |

**Fluxograma (`fluxo`).** As etapas da esquerda para a direita são início da sessão → trabalho → fim da sessão → PR → CI → merge. Há três faixas, com rótulo de quem é dono de cada uma:

- **Repositório:** `CLAUDE.md`, lido sempre.
- **Plugin, durante a sessão:**
  - a referência do time, injetada no início;
  - as skills, que o agente decide se abre;
  - o bloqueio de edição de configuração, de manifesto e de teste original;
  - no fim, as 8 convenções e `make verify`, que devolvem ao agente até 2 vezes.
- **CI do repositório:** `make verify` em todo PR, e merge só com o CI verde.

Borda cheia marca o que sempre acontece; borda tracejada marca o que o agente decide (só as skills). A legenda diz isso em uma linha. O fluxograma é feito com componentes de `deck.css` e um SVG simples para as setas, dentro de 1920 × 1080 e acima do rodapé.

**Tabela de `mecanismos`:**

| Achado do estudo | Mecanismo | Quem decide |
|---|---|---|
| Sem contexto, a T1 errou regras de domínio (18–21 de 26) | `CLAUDE.md` do repositório | Sempre presente |
| Skills abertas em 14 de 20 sessões; Haiku 0 de 5 | Referência do time injetada no início | Hook |
| 9 de 50 sessões terminaram violando uma convenção, 6 por teste removido | Bloqueio na edição e checagem no fim, que devolve ao agente | Hook |
| No pedido vago, as decisões ficaram implícitas (T2) | Regra na referência: decisão registrada em schema, constante e teste | Hook (sempre presente) |
| Testes, typecheck, lint e build | `make verify` no fim da sessão e no CI | Hook e CI |

**Notas do apresentador:** contêm tempo, nome da Bianca e frase-chave, e respondem a "isso não é o O2 de novo?": no O2 as etapas eram prompts e o modelo decidia; aqui quem decide é o código. Nenhuma fala sobre medição.

**Sem o slide de Limitações:** as respostas que estavam nele, incluindo a ressalva de P0 e "Claude avalia Claude", passam para a tabela de arguição de `docs/10-plano-de-apresentacao.tex`, escritas como resposta e não mais como "ver slide 17".

## Documentos que acompanham

- `docs/10-plano-de-apresentacao.tex` e o PDF: bloco 4 com 4 slides (14 a 17), total de 17 slides, arguição atualizada, e "Antes da banca" sem o item de R12.6.
- `docs/apresentacao/README.md`: ids do bloco 4.
- `docs/05`: a linha Plugin v2 vira Plugin 2.0.0 na `main`.
- `docs/00`: uma rodada nova, R14, com as decisões desta sessão.
- Nada dessa frase de medição em texto novo. As rodadas antigas de `docs/00` não são reescritas.

## Restrições de execução

- Trabalhar a partir da `main` atualizada. O plugin vai numa branch própria, com commits, e é fundido na `main` depois dos testes. Push só com a confirmação do usuário.
- **Não commitar o plano de apresentação nem os slides** (pedido anterior do usuário, ainda valendo); este design e o plano de implementação também ficam fora do commit.
- O deck publicado é lido antes de editar, porque outras pessoas publicam nele, e a cópia em `docs/apresentacao/project/` fica idêntica ao publicado.

## Fica para quem executar

- O layout exato do fluxograma e da tabela, dentro de `deck.css`.
- O texto do README público, dentro das regras acima.
