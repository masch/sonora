# ──────────────────────────────────────────────
# Makefile — sonora (Expo SDK 56)
# All targets delegate to `bun` (project package manager).
# ──────────────────────────────────────────────

# ── Convenience ────────────────────────────────

# Incluye el archivo .env (el guión '-' evita que falle si el archivo no existe)
-include .env

# Exporta explícitamente el token para que esté disponible en todas las subshells
EXPO_TOKEN_CLEAN := $(patsubst "%",%,$(EXPO_TOKEN))
export EXPO_TOKEN = $(EXPO_TOKEN_CLEAN)

SOCKET_SECURITY_API_KEY_CLEAN := $(patsubst "%",%,$(SOCKET_SECURITY_API_KEY))
export SOCKET_SECURITY_API_KEY=$(SOCKET_SECURITY_API_KEY_CLEAN)

SOCKET_CLI_ORG_SLUG_CLEAN := $(patsubst "%",%,$(SOCKET_CLI_ORG_SLUG))
export SOCKET_CLI_ORG_SLUG=$(SOCKET_CLI_ORG_SLUG_CLEAN)


EAS_CLI_VERSION = 20.0.0

ANDROID_HOME ?= $(HOME)/dev/android/sdk
ANDROID_EMULATOR = $(ANDROID_HOME)/emulator/emulator
ANDROID_FIRST_AVD = $(shell $(ANDROID_EMULATOR) -list-avds | head -n 1)

.DEFAULT_GOAL := start

.PHONY: start
start: ## Launch Expo dev server (default)
	bun run start

.PHONY: dev-web
dev-web: ## Launch Expo dev server for web
	bun run web

.PHONY: dev-android
dev-android: ## Launch Expo dev server for Android
	bun run android

.PHONY: dev-ios
dev-ios: ## Launch Expo dev server for iOS
	bun run ios

# ── Native ─────────────────────────────────────

.PHONY: rebuild-android
rebuild-android: ## Rebuild native Android project (after adding native modules like expo-av)
	bunx expo run:android

.PHONY: rebuild-ios
rebuild-ios: ## Rebuild native iOS project (after adding native modules)
	bunx expo run:ios

.PHONY: prebuild
prebuild: ## Regenerate native project files without compiling
	bunx expo prebuild

.PHONY: doctor
doctor: ## Run React Doctor audit (full verbose scan)
	bunx react-doctor@latest --verbose

.PHONY: doctor-diff
doctor-diff: ## Run React Doctor audit on staged diff (regression check)
	bunx react-doctor@latest --verbose --diff --fail-on warning

# ── Supply Chain Security ──────────────────────

.PHONY: socket-login socket-scan
socket-login: ## Authenticate with Socket.dev CLI (persists token locally)
	bunx socket login

socket-scan: ## Run Socket.dev security scan and show report (requires: SOCKET_SECURITY_API_KEY + ORG in .env, API token scopes: full-scans:create, full-scans:list, security-policy:read)
	SOCKET_CLI_API_TOKEN=$(SOCKET_SECURITY_API_KEY) bunx socket scan create \
		--json --no-interactive --org=$(SOCKET_CLI_ORG_SLUG) --report \
		--no-set-as-alerts-page --branch=$(shell git branch --show-current)

# ── Utilities ─────────────────────────────────

.PHONY: install
install: ## Install project + backend API dependencies and configure git hooks
	bun install
	cd $(API_DIR) && bun install 2>/dev/null || true
	git config core.hooksPath .githooks

.PHONY: lint
lint: ## Run linter (expo lint)
	bun run lint

.PHONY: format
format: ## Run prettier to format code
	bun run format

.PHONY: format-check
format-check: ## Check code formatting using prettier
	bun run format:check

.PHONY: typecheck
typecheck: ## Run TypeScript type check
	tsc --noEmit

# ── Backend API ───────────────────────────────

API_DIR = api

.PHONY: api-install
api-install: ## Install backend API dependencies (Hono, Wrangler, Vitest)
	cd $(API_DIR) && bun install

.PHONY: api-dev
api-dev: ## Run Hono API locally with wrangler dev
	cd $(API_DIR) && bun run dev

.PHONY: api-test
api-test: ## Run backend API tests (Vitest)
	cd $(API_DIR) && bun run test

.PHONY: api-typecheck
api-typecheck: ## Run TypeScript type check for the API
	cd $(API_DIR) && bun run typecheck

.PHONY: api-deploy
api-deploy: ## Deploy Hono API to Cloudflare Workers
	cd $(API_DIR) && bun run deploy

# ── Backend API — Database ──────────────────────

.PHONY: api-db-up
api-db-up: ## Start Postgres (Podman)
	podman compose -f $(API_DIR)/docker-compose.yml up -d

.PHONY: api-db-down
api-db-down: ## Stop Postgres (Podman)
	podman compose -f $(API_DIR)/docker-compose.yml down

.PHONY: api-db-generate
api-db-generate: ## Generate Drizzle migration from schema changes
	cd $(API_DIR) && bun run db:generate

.PHONY: api-db-migrate
api-db-migrate: api-db-generate ## Apply pending Drizzle migrations
	cd $(API_DIR) && DATABASE_URL="postgres://sonora:sonora@localhost:5432/sonora" bun run db:migrate

.PHONY: api-db-studio
api-db-studio: ## Launch Drizzle Studio (GUI for local DB)
	cd $(API_DIR) && bun run db:studio

.PHONY: api-db-shell
api-db-shell: ## Open psql shell to local Postgres
	podman compose -f $(API_DIR)/docker-compose.yml exec postgres psql -U sonora -d sonora

.PHONY: api-dev-local
api-dev-local: ## Run Hono API locally with Docker Postgres
	cd $(API_DIR) && DATABASE_URL="postgres://sonora:sonora@localhost:5432/sonora" bun run dev:local

# ── Test ──────────────────────────────────────

.PHONY: test-front
test-front: ## Run frontend tests (Jest with jest-expo preset, one-shot)
	bunx jest --passWithNoTests

.PHONY: test-back
test-back: ## Run backend API tests (Vitest, alias for api-test)
	$(MAKE) api-test

.PHONY: test
test: test-front test-back ## Run all tests (frontend + backend)

# ── CI ────────────────────────────────────────

.PHONY: validate
validate: format test lint typecheck api-typecheck gga ## Run full development gate (tests + lint + typecheck + gga)

.PHONY: api-validate
api-validate: api-test api-typecheck ## Run API tests + typecheck

.PHONY: check
check: format-check test lint typecheck ## Run CI verification gate (format-check → test → lint → typecheck)

# ── Review ─────────────────────────────────────

.PHONY: gga
gga: ## Run GGA (Gentleman Guardian Angel) code review on staged files
	gga run

.PHONY: gga-full
gga-full: ## Run GGA review on ALL matching source files (stages, reviews, unstages)
	@FILES="$$(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx')"; \
	for f in $$FILES; do echo "" >> $$f; done; \
	git add $$FILES; \
	gga run; \
	EXIT_CODE=$$?; \
	git checkout -- $$FILES; \
	exit $$EXIT_CODE

# ── EAS Deploy ───────────────────────────────

EAS_CLI_VERSION ?=

.PHONY: eas-whoami
eas-whoami: ## Verify EAS authentication (uses EXPO_TOKEN from .env)
	bunx eas-cli@$(EAS_CLI_VERSION) whoami

.PHONY: eas-list
eas-list: ## List recent EAS builds
	bunx eas-cli@$(EAS_CLI_VERSION) build:list

.PHONY: eas-init
eas-init: ## Initialize EAS for this project (first-time setup)
	bunx eas-cli@$(EAS_CLI_VERSION) init

# production vs preview:
#   production → APK firmado para Google Play (firma con keystore de producción)
#   preview    → APK de prueba para instalar directo en el celu (distribución interna, sin Play Store)

.PHONY: eas-build-android
eas-build-android: eas-whoami ## Build Play Store APK via EAS cloud (needs production keystore)
	bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile production --wait

.PHONY: eas-build-android-preview
eas-build-android-preview: eas-whoami ## Build test APK for sideload via EAS cloud (internal distribution)
	bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile preview --wait

.PHONY: eas-build-android-local
eas-build-android-local: eas-whoami ## Build Play Store APK locally (needs Android SDK + production keystore)
	bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile production --local --wait

.PHONY: eas-build-android-preview-local
eas-build-android-preview-local: eas-whoami ## Build test APK for sideload locally (needs Android SDK, no keystore needed)
	bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile preview --local

.PHONY: eas-upload-apk
eas-upload-apk: eas-whoami ## Upload a local APK to EAS (usage: make eas-upload-apk APK=path/to/file.apk)
	bunx eas-cli@$(EAS_CLI_VERSION) submit -p android --path "$(APK)"

.PHONY: eas-build-web
eas-build-web: eas-whoami ## Export web app and deploy to EAS Hosting (checks auth first)
	bunx expo export --platform web && bunx eas-cli@$(EAS_CLI_VERSION) deploy --prod

# ── Emulator ───────────────────────────────

.PHONY: android-reset
android-reset:
	@echo "🚀 Resetting the emulator: $(ANDROID_FIRST_AVD)..."
	$(ANDROID_EMULATOR) @$(ANDROID_FIRST_AVD) -wipe-data &

.PHONY: android-restart
android-restart: android-stop
	@echo "🔄 Restarting the emulator: $(ANDROID_FIRST_AVD)..."
	@sleep 1
	$(ANDROID_EMULATOR) @$(ANDROID_FIRST_AVD) &

.PHONY: android-kill
android-kill:
	@echo "💀 Killing the emulator (force): $(ANDROID_FIRST_AVD)..."
	-pkill -9 emulator || true
	-pkill -9 qemu-system || true

# ── Maintenance ───────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	rm -rf node_modules .expo web-build dist

.PHONY: reset
reset: clean install ## Full reset — clean + reinstall

.PHONY: help
help: ## Print this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
