#!/usr/bin/env bash
set -uo pipefail

SEED_DIR="$(cd "$(dirname "$0")/../../seed" && pwd)"

TERMS='TCC|INATEL|harness|semente|repositório-semente|experimento|experimental|Claude|Anthropic|LLM|modelo de linguagem|prompt|avaliador cego|teste oculto|ponto de decisão'

status=0

echo "== forbidden terms =="
if grep -rInE "$TERMS" "$SEED_DIR" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=data --exclude-dir=.cache --exclude=package-lock.json; then
  echo "FAIL: forbidden terms found"
  status=1
else
  echo "ok"
fi

echo "== files addressed to agents or contributors =="
if find "$SEED_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' \
  \( -name 'CLAUDE.md' -o -name 'AGENTS.md' -o -name '.cursorrules' \
     -o -name 'CONTRIBUTING.md' -o -name '.claude' \) -print | grep .; then
  echo "FAIL: files addressed to agents found"
  status=1
else
  echo "ok"
fi

echo "== README stays minimal =="
if grep -qiE '^#+ *(architecture|conventions|layers|design)' "$SEED_DIR/README.md"; then
  echo "FAIL: README documents architecture or conventions"
  status=1
else
  echo "ok"
fi

echo "== research artefacts must stay outside the seed =="
leaked=0
for name in hidden-tests reference run.mjs reference.patch; do
  if find "$SEED_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name "$name" -print | grep .; then
    leaked=1
  fi
done
if grep -rInE 'hidden-tests|reference/T1' "$SEED_DIR" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=data --exclude-dir=.cache --exclude=package-lock.json; then
  leaked=1
fi
if [ "$leaked" -eq 1 ]; then
  echo "FAIL: research artefacts reachable from the seed"
  status=1
else
  echo "ok"
fi

exit $status
