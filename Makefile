.PHONY: help dev build preview docker-build docker-run test lint typecheck e2e clean

help:
	@echo "Common commands:"
	@echo "  make dev          # run dev server (npm run dev)"
	@echo "  make build        # local production build"
	@echo "  make preview      # preview built app"
	@echo "  make test         # unit tests"
	@echo "  make e2e          # playwright e2e"
	@echo "  make docker-build # build Docker image"
	@echo "  make docker-run   # run image on :8080"
	@echo "  make clean        # clean artifacts"

# Use existing scripts defined in package.json

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

e2e:
	npm run e2e

docker-build:
	docker build -t ai-assistant:local .

docker-run:
	docker run --rm -p 8080:80 ai-assistant:local

clean:
	npm run clean || true
	if exist node_modules (rmdir /S /Q node_modules) 2> NUL || true
