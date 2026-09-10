SHELL := /bin/bash

CACHE   := .cache
SCHEMA  := prisma/schema.prisma
STAMP   := $(CACHE)/schema.sha
DB_URL  := file:../data/app.db
DB      := data/app.db

.PHONY: setup verify typecheck lint format build test clean db-reset

setup:
	@[ -d node_modules ] || npm ci
	@mkdir -p $(CACHE) data
	@current=$$(sha256sum $(SCHEMA) | cut -d' ' -f1); \
	if [ ! -f "$(STAMP)" ] || [ ! -f "$(DB)" ] || [ "$$current" != "$$(cat $(STAMP))" ]; then \
	  npx prisma generate >/dev/null; \
	  DATABASE_URL=$(DB_URL) npx prisma db push --skip-generate --accept-data-loss >/dev/null; \
	  echo "$$current" > $(STAMP); \
	fi

db-reset:
	@rm -f $(DB) $(STAMP)
	@$(MAKE) --no-print-directory setup

verify: setup typecheck lint build test

typecheck: setup
	@npm run typecheck

lint: setup
	@npm run lint

format: setup
	@npm run format

build: setup
	@npm run build

test: setup
	@npm test

clean:
	@rm -rf dist data .cache coverage
