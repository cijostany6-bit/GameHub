# =========================================================
# GameHub — one-command developer workflow
#
#   make bootstrap   → build + start + seed + verify
#   make help        → list all targets
# =========================================================

COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.PHONY: bootstrap up down restart logs ps smoke db-reset clean help

bootstrap: up smoke ## Clone → run: build, start, wait for health, verify endpoints
	@echo "✔ GameHub is up → http://localhost:8080"

up: ## Build images and start the stack (detached)
	$(COMPOSE) up -d --build

down: ## Stop and remove containers + network (keeps DB data)
	$(COMPOSE) down

restart: ## Restart the stack
	$(COMPOSE) restart

logs: ## Tail all service logs
	$(COMPOSE) logs -f --tail=100

ps: ## Show container status
	$(COMPOSE) ps

smoke: ## Verify the running stack end-to-end (used by CI later)
	./scripts/smoke.sh

db-reset: ## Delete the DB volume and re-seed from db/init.sql
	$(COMPOSE) down -v
	$(COMPOSE) up -d --build
	./scripts/smoke.sh

clean: ## Full teardown including images and DB volume
	$(COMPOSE) down -v --rmi local

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
