#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-3311}"
TMP="$(mktemp -d)"
# kill %1 alone is not reliable here: make start runs npm start runs node
# dist/server.js, and a SIGTERM to the backgrounded make job does not always
# reach that grandchild (observed in practice: the job control kill printed
# "Terminated" for make while node kept the port bound). fuser -k targets
# whatever is actually listening on the port, regardless of the process tree.
# PORT and TMP are already final at this point, so expand them now rather
# than at trap-execution time.
trap "kill %1 2>/dev/null || true
fuser -k -TERM $PORT/tcp 2>/dev/null || true
sleep 0.2
fuser -k -KILL $PORT/tcp 2>/dev/null || true
rm -rf '$TMP'" EXIT

echo "== extracting a clean seed =="
git -C "$REPO" archive HEAD seed | tar -x -C "$TMP"

echo "== applying the reference patch =="
patch -p1 -d "$TMP" < "$REPO/reference/T1/reference.patch"

cd "$TMP/seed"
echo "== seed suite must still pass, meaning zero regressions =="
make verify

echo "== hidden suite must score 100% =="
make db-reset
PORT="$PORT" make start &
for _ in $(seq 1 40); do
  curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done

BASE_URL="http://localhost:$PORT" node "$REPO/hidden-tests/T1/run.mjs" > "$TMP/result.json"
node -e '
  const fs = require("node:fs");
  const summary = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  console.log(`hidden suite: ${summary.passed}/${summary.total}`);
  if (summary.passed !== summary.total) {
    console.error(JSON.stringify(summary.failures, null, 2));
    process.exit(1);
  }
' "$TMP/result.json"

echo "reference is valid"
