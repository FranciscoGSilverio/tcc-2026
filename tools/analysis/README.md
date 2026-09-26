# tools/analysis

Regras aplicadas ao dataset no momento da análise. Nenhum script aqui escreve nada.

## `aderencia-o2.mjs`

```
node tools/analysis/aderencia-o2.mjs
```

Conta, por passo, quantas alterações de arquivo cada sessão O2 fez, e nomeia
as que alteraram nos passos 1 ou 2 — onde o enunciado do passo proíbe.

Existe porque a fronteira entre os passos de O2 é **instrução, não trava**.
Uma sessão que implementa durante a exploração está rotulada O2 e executou
algo mais próximo de O1, e a análise do fator O precisa saber quais são.

A contagem é heurística, e os padrões estão no topo do arquivo. Duas famílias
de escrita, e nenhuma pode ser ignorada: as ferramentas de edição, que são
inequívocas, e comandos de shell, que não são — o Opus edita com
`cat > arquivo <<'EOF'` e nunca toca numa ferramenta de edição. Escrita fora
da cópia de trabalho não conta, e o corpo de heredoc não é lido como shell.
