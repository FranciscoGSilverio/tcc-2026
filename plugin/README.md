# plugin/

O plugin publicado: um entregável do trabalho, derivado dos resultados do
estudo e empacotado para o marketplace. O README público, que quem instala lê,
está em `meeting-rooms-conventions/README.md`. Este aqui é para quem mantém o
pacote.

## A regra

**O plugin depende do estudo; o estudo não depende do plugin.** Até 13/11/2026
o pacote era a própria condição P2 e não podia divergir de `contexts/P2/` em um
byte. Essa regra caiu na rodada 11 do `docs/00-log-sessao-planejamento.md`: o
plugin pode evoluir até a apresentação, e o artigo descreve o que foi medido (o
guia e três skills) sem depender dele.

Duas coisas continuam fixas:

- **`contexts/P2/` é o que rodou, e está congelado.** É de lá que o runner lê a
  condição P2. Nada que se faça aqui o altera.
- **A versão equivalente à condição medida é a tag `plugin-v1.0.0-p2`.** Nela o
  pacote é cópia byte a byte de `contexts/P2/`. Quem quiser reproduzir P2 usa a
  tag ou `contexts/P2/`, nunca o `main`.

Na versão 1.0.0, o pacote tem esta origem:

| Publicado | Origem em 1.0.0 |
|---|---|
| `meeting-rooms-conventions/skills/` | `contexts/P2/plugin/skills/`, idêntico byte a byte |
| `meeting-rooms-conventions/templates/CLAUDE.md` | `contexts/P2/CLAUDE.md` (= `contexts/P1/CLAUDE.md`), idêntico byte a byte |
| `meeting-rooms-conventions/.claude-plugin/plugin.json` | `contexts/P2/plugin/.claude-plugin/plugin.json`, com metadados de publicação acrescentados |
| `../.claude-plugin/marketplace.json` | catálogo do marketplace |

**Ao mudar o conteúdo**, suba a `version` no `plugin.json` e no catálogo, e
revise o README público: a seção sobre o estudo vale para a condição P2, não
para versões posteriores.

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

O primeiro reprova se o catálogo não apontar para esta pasta ou se a versão do
catálogo divergir da do `plugin.json`. A guarda de fidelidade contra
`contexts/P2/`, que reprovava qualquer byte diferente, foi retirada junto com a
regra antiga; ela existe no histórico, na tag `plugin-v1.0.0-p2`.

Para ver o plugin carregar, a mesma conferência que o runner faz no evento de
inicialização:

```
claude -p "ok" --plugin-dir ./plugin/meeting-rooms-conventions --output-format stream-json --verbose --max-turns 1
```

O evento `system/init` precisa listar `meeting-rooms-conventions` em
`plugins` e as três skills, com prefixo `meeting-rooms-conventions:`, em
`skills`. Conferido em 01/10/2026, com o CLI 2.1.286.

## O que falta

- [x] Estrutura do pacote, cópia fiel de P2 (até 1.0.0), catálogo do marketplace
- [x] Guarda de fidelidade contra `contexts/P2/` — retirada em 13/11/2026 (rodada 11); a versão fiel é a tag `plugin-v1.0.0-p2`
- [x] `claude plugin validate` passando no plugin e no catálogo
- [x] Plugin carregando por `--plugin-dir`, com as três skills
- [x] README público com origem, instalação e resultado
- [x] `author` no `plugin.json` e `owner` no catálogo — Bianca Souza, Francisco Silvério, Lavínia Amaral e Vinícius Telles (12/11/2026)
- [x] Licença — MIT, em `LICENSE` na raiz e dentro do plugin (que é copiado sozinho para o cache de quem instala), e `license` no `plugin.json`
- [x] Conferir os números do README público contra a análise final — conferidos em 10/11/2026 contra `docs/08-analise-descritiva.md`: 18 e 21 de 26 em P0, 26/26 em P1 e P2, custo médio de US$ 0,76 em P2 e US$ 0,63 em P1
- [ ] Repositório público (M7) e instalação por terceiro a partir do marketplace — critério de pronto
- [ ] Decidir se também submete ao diretório da Anthropic (`claude.ai/directory/manage`) ou fica só no marketplace próprio. Se submeter, falta um ícone quadrado PNG (512–2048 px) em `.claude-plugin/icon.png` — o validador avisa, e o ícone só é lido na primeira submissão
