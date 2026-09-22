#!/usr/bin/env bash
set -euo pipefail

SEED_DIR="$(cd "$(dirname "$0")/../../seed" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -a "$SEED_DIR" "$TMP/seed"
cd "$TMP/seed"
rm -rf data .cache dist
rm -rf infra .github CHANGELOG.md LICENSE .editorconfig

echo "running verification without the ballast"
make verify

echo "ballast is inert"
