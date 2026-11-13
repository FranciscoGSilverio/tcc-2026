# meeting-rooms-conventions

Plugin do Claude Code com três skills procedimentais para trabalhar numa API
HTTP de salas de reunião em TypeScript, Fastify e Prisma: onde entra cada
camada de um módulo, como escrever teste no padrão do projeto, e um checklist
de convenções antes de dar uma mudança por pronta.

É um entregável de um estudo experimental sobre engenharia de harness para
agentes de IA — TCC de Engenharia de Software do INATEL, 2026. Foi construído a
partir do que o estudo mediu, e pode evoluir depois dele. A versão **1.0.0**
(tag `plugin-v1.0.0-p2`) é idêntica, byte a byte, às skills e ao guia que o
agente recebeu na condição P2 do estudo. Versões posteriores podem divergir.

## O que vem no pacote

| Arquivo | O que é |
|---|---|
| `skills/estender-modulo/` | Onde entram schema, rota, regra de negócio, consulta e erro ao estender um módulo existente; inclui as regras de domínio de reservas. |
| `skills/escrever-testes/` | Onde vive o arquivo de teste, como a aplicação sobe no teste, o que afirmar sobre a resposta HTTP. |
| `skills/convencoes-do-projeto/` | As oito convenções do projeto, em forma de checklist. |
| `templates/CLAUDE.md` | O guia do projeto, para copiar para a raiz. Um plugin não carrega `CLAUDE.md`, então ele vai como modelo. |

## Como instalar

1. Copie `templates/CLAUDE.md` para a raiz do projeto.
2. Instale o plugin:

   ```
   /plugin marketplace add FranciscoGSilverio/tcc-2026
   /plugin install meeting-rooms-conventions@tcc-2026
   ```

   Ou, sem instalar, para uma sessão só:

   ```
   claude --plugin-dir caminho/para/meeting-rooms-conventions
   ```

O conteúdo descreve um projeto específico: o repositório-semente do estudo, que
está publicado no mesmo repositório, em `seed/`. Em outro projeto, as skills
precisam ser reescritas para as convenções dele. O que se transfere é a forma
(procedimento invocável sob demanda, em vez de documento lido de uma vez), não
o texto.

## Como reproduzir a condição P2 do estudo

Instalar pelo marketplace traz a versão atual, que pode não ser a que foi
medida. Para reproduzir P2, use a tag `plugin-v1.0.0-p2`, ou diretamente
`contexts/P2/`, que é a cópia congelada que o runner usou na coleta. P2 é
**o `CLAUDE.md` na raiz do projeto mais as três skills**; as skills sem o
arquivo não são P2.

## O que o estudo encontrou

Os resultados abaixo são da condição P2, ou seja, da versão 1.0.0. Não valem
automaticamente para versões posteriores. São resultados descritivos de 50
sessões, com n pequeno por célula (duas repetições em T1, três em T2). A
análise completa e as limitações estão no artigo.

- **Ter contexto ajuda muito.** Na tarefa bem especificada, em Sonnet 5, as
  sessões sem contexto passaram em 18 a 21 de 26 testes ocultos; todas as sessões
  com contexto, tanto P1 quanto P2, passaram em 26 de 26.
- **As skills não superaram o documento.** Não detectamos diferença entre P1 (só
  o `CLAUDE.md`) e P2 (o `CLAUDE.md` mais as três skills) em nada que foi
  medido: acerto, qualidade e convergência na tarefa ambígua. P2 custou em média
  US$ 0,76 por sessão, contra US$ 0,63 de P1. "Não detectamos diferença" não é
  o mesmo que "são equivalentes": na tarefa bem especificada os dois estão no
  teto, e um teto esconde diferença em vez de refutá-la.

Se você vai escolher entre os dois, o estudo não dá razão para preferir as
skills ao documento: o que fez diferença foi o conteúdo do `CLAUDE.md`, que vem
neste pacote como modelo.

## Origem

- Repositório do estudo: <https://github.com/FranciscoGSilverio/tcc-2026>
- Protocolo experimental: `docs/02-protocolo-experimental.md`
- Cópia que rodou na coleta, congelada: `contexts/P2/`
- Versão idêntica à condição medida: tag `plugin-v1.0.0-p2`
