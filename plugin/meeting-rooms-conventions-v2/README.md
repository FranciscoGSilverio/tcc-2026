# meeting-rooms-conventions-v2 (experimental)

Versão derivada do plugin `meeting-rooms-conventions`, o tratamento P2 do
estudo sobre engenharia de harness para agentes de IA (TCC de Engenharia
de Software do INATEL, 2026).

**Esta versão não foi medida.** O estudo comparou P1 (só um `CLAUDE.md`)
com P2 (o `CLAUDE.md` mais o plugin original) e não detectou vantagem do
plugin, que ainda custou mais. Esta versão tenta corrigir as causas
prováveis. Se ela é de fato melhor só uma nova coleta, com o mesmo runner
e o mesmo avaliador, pode dizer. Para reproduzir o estudo, use o plugin
original.

## O que muda em relação ao P2

| Problema no P2 | Mudança |
|---|---|
| O plugin repetia o `CLAUDE.md`: as oito convenções e as regras de domínio apareciam duas vezes, e o agente pagava pelas duas | Cada informação fica num lugar só. O guia (arquitetura, erros, regras de domínio) é injetado pelo hook de início de sessão; as skills têm só procedimento |
| Plugin não carrega `CLAUDE.md`, então o usuário precisava copiar um à mão | O próprio plugin põe o guia no contexto. Instalar basta — **não** copie um `CLAUDE.md` junto, ou o conteúdo volta a se repetir |
| As convenções eram só texto, que o agente pode ignorar | Hooks: editar configuração ou `package.json`, instalar pacote e remover linha original de teste são **bloqueados** antes de acontecer; ao encerrar, as oito convenções são **verificadas** e o agente volta para corrigir |
| Na tarefa ambígua, o agente muitas vezes não tomava posição sobre fuso, limite de horário e passado | Skill nova, `decidir-ambiguidades`: listar o que ficou em aberto, decidir e registrar a decisão em schema, constante e teste |

## O que vem no pacote

| Arquivo | O que é |
|---|---|
| `hooks/guia-do-projeto.md` | O guia do projeto, injetado no início da sessão |
| `hooks/session-start.mjs` | Injeta o guia e anota o commit em que a sessão começou |
| `hooks/guard-edit.mjs` | Bloqueia edição de configuração, manifesto e remoção de linha original de teste (convenções 2, 3 e 6) |
| `hooks/guard-bash.mjs` | Bloqueia `npm install <pacote>` e equivalentes (convenção 2) |
| `hooks/stop-check.mjs` | Ao encerrar, confere as oito convenções sobre tudo o que mudou desde o início da sessão; manda o agente corrigir no máximo duas vezes |
| `hooks/lib/diff-rules.mjs` | Cópia byte a byte das regras do script de convenções da coleta |
| `skills/` | `estender-modulo`, `escrever-testes`, `convencoes-do-projeto`, `decidir-ambiguidades` |

Todos os hooks só agem num projeto cujo `package.json` se chama
`meeting-rooms-api` (a semente do estudo). Em qualquer outro repositório,
o plugin instalado não faz nada.

## Instalar

```
/plugin marketplace add FranciscoGSilverio/tcc-2026
/plugin install meeting-rooms-conventions-v2@tcc-2026
```

Requer Node 22 e git no `PATH`. Para as convenções 4 e 7 (escape de tipo e
`console.*`), rode `make setup` no projeto antes: a verificação usa o
ESLint do próprio projeto e avisa quando ele não está instalado.

Não instale junto com o plugin original: as skills têm os mesmos nomes.

## Cuidados para quem for medir

- A skill `decidir-ambiguidades` foi escrita depois de ver onde a tarefa
  ambígua do estudo (T2) mostrou divergência, e as perguntas dela cobrem
  dimensões parecidas com os pontos de decisão usados na avaliação. Medir
  esta versão com os mesmos pontos de decisão favorece a convergência dela
  por construção; uma comparação justa precisa de uma tarefa ambígua nova.
- O hook de encerramento usa as mesmas regras que geraram a coluna
  `violacoes`. Uma queda de `violacoes` é esperada por construção; o que
  interessa medir é se acerto, qualidade e custo melhoram junto.
