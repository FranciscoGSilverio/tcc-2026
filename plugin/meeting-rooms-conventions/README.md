# meeting-rooms-conventions

Plugin do Claude Code para trabalhar numa API HTTP de salas de reunião em
TypeScript, Fastify e Prisma. Ele põe as convenções do time no contexto do
agente em toda sessão, oferece skills de procedimento e confere, por código,
o que não pode depender de o agente lembrar.

É um entregável de um estudo experimental sobre engenharia de harness para
agentes de IA (TCC de Engenharia de Software do INATEL, 2026). O projeto-alvo
é o repositório-semente do estudo, publicado no mesmo repositório em `seed/`.

## Por que ele é assim

No estudo, o que funcionou foi o que estava sempre presente: com o `CLAUDE.md`
do projeto no contexto, a tarefa bem especificada passou de 18–21 para 26 de
26 testes ocultos. Já as skills, que o agente precisava escolher abrir, ficaram
fechadas em 6 de 20 sessões; o Haiku não abriu nenhuma nas 5 sessões dele,
embora elas estivessem listadas. Por isso este pacote:

- **põe no contexto, sempre**, o que o time quer que valha em toda sessão;
- **verifica por código** o que não pode depender de escolha do agente;
- deixa como skill só o procedimento detalhado, consultado quando preciso.

## Onde fica cada conhecimento

| Onde | O que contém | Como chega ao agente |
|---|---|---|
| `CLAUDE.md` do repositório (modelo em `templates/CLAUDE.md`) | O que é específico do repositório: arquitetura, nomenclatura e erros, comandos, regras de domínio de reservas | O Claude Code lê sempre |
| Referência do time (`hooks/referencia-do-time.md`) | O que o time compartilha: as oito convenções, como registrar decisões que o pedido deixou em aberto, como o trabalho é verificado | O hook de início de sessão injeta sempre |
| Skills (`skills/`) | Procedimentos: estender um módulo, escrever testes, decidir ambiguidades, checklist de convenções | O agente abre quando precisa |

Nenhum texto aparece em dois lugares, para o agente não pagar duas vezes pelo
mesmo conteúdo.

## O caminho de uma mudança

1. **Início da sessão:** o hook injeta a referência do time.
2. **Durante a sessão:** editar arquivo de configuração ou o `package.json`,
   instalar pacote e remover linha de um teste que já existia são bloqueados
   na hora. O bloqueio vale para as ferramentas de edição; o que for alterado
   pelo terminal é pego no passo seguinte.
3. **Fim da sessão:** tudo o que mudou desde o início passa pelas oito
   convenções e por `make verify` (typecheck, lint, build e testes). Se algo
   falhar, o agente volta para corrigir, no máximo duas vezes. Numa cópia da
   semente, a verificação completa leva cerca de 10 s.
4. **Pull request:** o CI do repositório roda o mesmo `make verify`. Esse passo
   não é do plugin, é do repositório, e é ele que decide o merge quando o
   workflow está marcado como verificação obrigatória na proteção da branch.

## O que vem no pacote

| Arquivo | O que é |
|---|---|
| `hooks/referencia-do-time.md` | A referência do time, injetada no início da sessão |
| `hooks/session-start.mjs` | Injeta a referência e anota o commit em que a sessão começou |
| `hooks/guard-edit.mjs` | Bloqueia edição de configuração, do manifesto e remoção de linha original de teste (convenções 2, 3 e 6) |
| `hooks/guard-bash.mjs` | Bloqueia `npm install <pacote>` e equivalentes (convenção 2) |
| `hooks/stop-check.mjs` | No fim da sessão, confere as oito convenções e roda `make verify` |
| `hooks/lib/diff-rules.mjs` | Cópia byte a byte das regras de convenção usadas no estudo |
| `skills/` | `estender-modulo`, `escrever-testes`, `decidir-ambiguidades`, `convencoes-do-projeto` |
| `templates/CLAUDE.md` | Modelo do `CLAUDE.md` do repositório |

Os hooks só agem num projeto cujo `package.json` se chama `meeting-rooms-api`.
Em qualquer outro repositório, o plugin instalado não faz nada.

## Como instalar

1. Copie `templates/CLAUDE.md` para a raiz do projeto.
2. Instale o plugin:

   ```
   /plugin marketplace add FranciscoGSilverio/tcc-2026
   /plugin install meeting-rooms-conventions@tcc-2026
   ```

3. No repositório, marque o workflow de CI que roda `make verify` como
   verificação obrigatória na proteção da branch principal.

Requer Node 22 e git no `PATH`. Rode `make setup` no projeto antes: as
convenções 4 e 7 (escape de tipo e `console.*`) usam o ESLint do próprio
projeto.

## Reproduzir a condição P2 do estudo

A tag `plugin-v1.0.0-p2` reproduz a condição P2: o `CLAUDE.md` na raiz mais
três skills, idênticos à cópia congelada em `contexts/P2/`, que é a que o
runner usa.

## Origem

- Repositório do estudo: <https://github.com/FranciscoGSilverio/tcc-2026>
- Protocolo experimental: `docs/02-protocolo-experimental.md`
