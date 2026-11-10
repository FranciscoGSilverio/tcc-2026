# plugin/

O plugin publicado: a condição P2 da coleta, empacotada para o marketplace.
O README público, que quem instala lê, está em
`meeting-rooms-conventions/README.md`. Este aqui é para quem mantém o pacote.

## A regra

**O pacote é uma cópia de `contexts/P2/`, nunca uma versão nova dela.** O
plano de execução, seção 5, faz de "corresponde à condição P2 usada na coleta"
um critério de pronto do plugin. `contexts/P2/` é o que rodou, e está
congelado. Se uma skill precisar mudar, isso é um plugin diferente, com outro
nome, e não pode ser apresentado como o tratamento que o estudo mediu.

| Publicado | Origem | Como |
|---|---|---|
| `meeting-rooms-conventions/skills/` | `contexts/P2/plugin/skills/` | idêntico byte a byte |
| `meeting-rooms-conventions/templates/CLAUDE.md` | `contexts/P2/CLAUDE.md` (= `contexts/P1/CLAUDE.md`) | idêntico byte a byte |
| `meeting-rooms-conventions/.claude-plugin/plugin.json` | `contexts/P2/plugin/.claude-plugin/plugin.json` | mesmos `name`, `description` e `version`; só acrescenta metadados que o agente nunca leu como instrução |
| `../.claude-plugin/marketplace.json` | — | catálogo do marketplace |

O `CLAUDE.md` vai em `templates/` e não na raiz do plugin porque um plugin não
carrega `CLAUDE.md` como contexto, e `claude plugin validate` avisa quando
encontra um na raiz.

O catálogo fica na **raiz do repositório**, e não aqui, porque
`/plugin marketplace add dono/repo` procura `.claude-plugin/marketplace.json`
na raiz. É o único arquivo do pacote fora desta pasta.

## Verificar

```
node --test plugin/test/*.test.mjs
claude plugin validate ./plugin/meeting-rooms-conventions
claude plugin validate .
```

O primeiro reprova se qualquer byte das skills ou do `CLAUDE.md` divergir de
`contexts/P2/`, se uma skill for acrescentada, ou se o manifesto mudar de
identidade. Foi conferido reprovando com uma skill alterada de propósito.

Para ver o plugin carregar, a mesma conferência que o runner faz no evento de
inicialização:

```
claude -p "ok" --plugin-dir ./plugin/meeting-rooms-conventions --output-format stream-json --verbose --max-turns 1
```

O evento `system/init` precisa listar `meeting-rooms-conventions` em
`plugins` e as três skills, com prefixo `meeting-rooms-conventions:`, em
`skills`. Conferido em 01/10/2026, com o CLI 2.1.286.

## O que falta

- [x] Estrutura do pacote, cópia fiel de P2, catálogo do marketplace
- [x] Guarda de fidelidade contra `contexts/P2/`
- [x] `claude plugin validate` passando no plugin e no catálogo
- [x] Plugin carregando por `--plugin-dir`, com as três skills
- [x] README público com origem, instalação e resultado
- [ ] `author` no `plugin.json` e `owner` no catálogo (o validador avisa que falta autor) — nomes da equipe
- [ ] Licença
- [x] Conferir os números do README público contra a análise final — conferidos em 10/11/2026 contra `docs/08-analise-descritiva.md`: 18 e 21 de 26 em P0, 26/26 em P1 e P2, custo médio de US$ 0,76 em P2 e US$ 0,63 em P1
- [ ] Repositório público (M7) e instalação por terceiro a partir do marketplace — critério de pronto
- [ ] Decidir se também submete ao diretório da Anthropic (`claude.ai/directory/manage`) ou fica só no marketplace próprio
