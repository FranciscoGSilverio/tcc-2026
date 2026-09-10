# seed-audit

Verificações de aceite executadas contra o repositório-semente antes do congelamento.
Nada aqui pode ser copiado para dentro de `seed/`.

## false-negatives.mjs

Confirma que os defeitos deliberados da semente continuam presentes. Cada verificação
afirma que um pedido que o contrato de T1 recusaria é aceito pela semente. Essas
afirmações são proibidas na suíte da própria semente, porque T1 as torna falsas e elas
produziriam regressão falsa em toda sessão.

```bash
cd seed && make db-reset && make start &
# aguarde GET /health responder 200
node tools/seed-audit/false-negatives.mjs
```

## Ordem de execução do aceite

```bash
./tools/seed-audit/check-no-leak.sh
./tools/seed-audit/check-structure.sh
./tools/seed-audit/check-ballast-inert.sh
cd seed && make db-reset && (make start &) && sleep 5
node ../tools/seed-audit/false-negatives.mjs
```

Depois, percorrer `CHECKLIST.md` e preencher os itens de revisão humana.
