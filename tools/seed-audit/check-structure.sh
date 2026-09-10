#!/usr/bin/env bash
set -uo pipefail

SEED_DIR="$(cd "$(dirname "$0")/../../seed" && pwd)"
status=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok   $label"
  else
    echo "FAIL $label: expected $expected, found $actual"
    status=1
  fi
}

for module in rooms users bookings; do
  count=$(find "$SEED_DIR/src/modules/$module" -maxdepth 1 -name '*.ts' | wc -l | tr -d ' ')
  check "$module has four layers" 4 "$count"
done

count=$(find "$SEED_DIR/src/modules/amenities" -maxdepth 1 -name '*.ts' | wc -l | tr -d ' ')
check "amenities has two files" 2 "$count"

users_of_reply=$(grep -rl "http-reply" "$SEED_DIR/src/modules" | wc -l | tr -d ' ')
check "only one module uses the alternate reply helper" 1 "$users_of_reply"

overlap=$(grep -ciE 'overlap|intersect' "$SEED_DIR/src/shared/time.ts" | tr -d ' ')
check "the time helper has no interval overlap function" 0 "$overlap"

date_libs=$(grep -cE '"(date-fns|dayjs|luxon|moment|temporal-polyfill)"' "$SEED_DIR/package.json" | tr -d ' ')
check "no date library in the manifest" 0 "$date_libs"

markers=$(grep -rciE 'deprecated|legacy|migrate to|old pattern' "$SEED_DIR/src" | grep -v ':0$' | wc -l | tr -d ' ')
check "nothing in the source declares which pattern is current" 0 "$markers"

exit $status
