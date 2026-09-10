SHELL := /bin/bash

.PHONY: setup verify typecheck lint format build test clean

setup:
	@[ -d node_modules ] || npm ci

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
