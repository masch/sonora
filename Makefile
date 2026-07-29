# ──────────────────────────────────────────────
# Makefile — sonora (Expo SDK 56)
# All targets delegate to `bun` (project package manager).
# ──────────────────────────────────────────────

# ── Convenience ────────────────────────────────

# Include .env files (leading '-' prevents error if file is missing)
-include apps/mobile/.env
-include apps/api/.env

# Export token explicitly so it's available in all subshells
EXPO_TOKEN_CLEAN := $(patsubst "%",%,$(EXPO_TOKEN))
export EXPO_TOKEN = $(EXPO_TOKEN_CLEAN)

SOCKET_SECURITY_API_KEY_CLEAN := $(patsubst "%",%,$(SOCKET_SECURITY_API_KEY))
export SOCKET_SECURITY_API_KEY=$(SOCKET_SECURITY_API_KEY_CLEAN)

SOCKET_CLI_ORG_SLUG_CLEAN := $(patsubst "%",%,$(SOCKET_CLI_ORG_SLUG))
export SOCKET_CLI_ORG_SLUG=$(SOCKET_CLI_ORG_SLUG_CLEAN)

FIREBASE_TOKEN_CLEAN := $(patsubst "%",%,$(FIREBASE_TOKEN))
export FIREBASE_TOKEN = $(FIREBASE_TOKEN_CLEAN)

# Bypass expo-doctor during EAS local builds to prevent crashes from Bun workspace false positives
export EXPO_NO_DOCTOR = 1


MOBILE_BUNDLE_ID = org.masch.sonora.app

EAS_CLI_VERSION = 20.1.0

ANDROID_HOME ?= $(HOME)/dev/android/sdk
ANDROID_NDK_HOME ?= $(ANDROID_HOME)/ndk/27.1.12297006
ANDROID_EMULATOR = $(ANDROID_HOME)/emulator/emulator
ANDROID_FIRST_AVD = $(shell $(ANDROID_EMULATOR) -list-avds | head -n 1)

APP_VERSION_NAME ?= 99.99.99
APP_VERSION_CODE ?= 0
.DEFAULT_GOAL := start

.PHONY: kill-metro
kill-metro: ## Kill any process running on Metro port 8081
	@echo "Killing process on port 8081..."
	@lsof -t -i:8081 | xargs kill -9 2>/dev/null || echo "Port 8081 is already free."

.PHONY: start
start: ## Launch Expo dev server
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" EXPO_PUBLIC_BYPASS_GEOFENCE=true bun start

.PHONY: start-wrangler
start-wrangler: ## Launch Expo dev server pointing to local wrangler (port 8787) for iOS/Web
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" EXPO_PUBLIC_API_URL="http://localhost:8787" EXPO_PUBLIC_BYPASS_GEOFENCE=true bun start

.PHONY: start-wrangler-android
start-wrangler-android: ## Launch Expo dev server pointing to local wrangler (port 8787) for Android emulator
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" EXPO_PUBLIC_API_URL="http://10.0.2.2:8787" EXPO_PUBLIC_BYPASS_GEOFENCE=true bun start

.PHONY: start-staging
start-staging: ## Launch Expo dev server pointing to remote staging API
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" EXPO_PUBLIC_API_URL="https://sonora-api-staging.sonora-api.workers.dev" EXPO_PUBLIC_BYPASS_GEOFENCE=true bun start

.PHONY: start-headless
start-headless: ## Launch Expo dev server without interactive TTY
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" bun start

.PHONY: dev-web
dev-web: ## Launch Expo dev server for web
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" bun run web

.PHONY: verify-web
verify-web: ## Build web bundle and execute it to verify CJS interop (catches circular dependencies)
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" bun expo export --platform web
	node -e "require('fs').readdirSync('apps/mobile/dist/_expo/static/js/web').filter(f => f.endsWith('.js')).forEach(f => require('./apps/mobile/dist/_expo/static/js/web/' + f))"

.PHONY: dev-android
dev-android: ## Launch Expo dev server for Android (Expo Go)
	cd apps/mobile && bun run android-dev

.PHONY: dev-ios
dev-ios: ## Launch Expo dev server for iOS
	cd apps/mobile && bun run ios

# ── Native ─────────────────────────────────────

.PHONY: rebuild-android
rebuild-android: ## Rebuild native Android project (after adding native modules like expo-audio)
	cd apps/mobile && bunx expo run:android

.PHONY: rebuild-ios
rebuild-ios: ## Rebuild native iOS project (after adding native modules)
	bunx expo run:ios

.PHONY: prebuild
prebuild: ## Regenerate native project files without compiling
	bunx expo prebuild

.PHONY: doctor
doctor: ## Run React Doctor audit (full verbose scan)
	cd apps/mobile && bunx react-doctor --verbose --scope full -y

# shellcheck disable=SC1073,SC1050,SC1072
# If BASE is set (e.g. make doctor-diff BASE=main), compare against that ref
# so only regressions introduced by the current changes are reported.
DOCTOR_BASE_ARGS = $(if $(BASE),--base $(BASE),)

.PHONY: doctor-diff
doctor-diff: ## Run React Doctor audit on staged diff (regression check)
	cd apps/mobile && bunx react-doctor --verbose --scope changed $(DOCTOR_BASE_ARGS) --blocking warning

.PHONY: expo-doctor
expo-doctor: ## Run Expo Doctor to verify dependency compatibility
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" bunx expo-doctor

.PHONY: expo-upgrade
expo-upgrade: ## Check recommended versions and upgrade Expo SDK packages
	@ROOT=$$(pwd); \
	read -r -p "Minimum release age in days (0 = immediate, default 4): " DAYS; \
	DAYS=$${DAYS:-4}; \
	SECONDS=$$(( DAYS * 86400 )); \
	MOBILE="$$ROOT/apps/mobile"; \
	echo "Checking recommended versions..."; \
	OUTPUT=$$(cd "$$MOBILE" && APP_VERSION_NAME="$(APP_VERSION_NAME)" npx expo install --check 2>&1); \
	PACKAGES=$$(echo "$$OUTPUT" | sed -n 's/  \([^ ]*\)@[^ ]* - expected version: ~\?\([^ ]*\)/\1@\2/p'); \
	if [ -n "$$PACKAGES" ]; then \
		echo "Upgrading: $$PACKAGES"; \
		cd "$$MOBILE" && bun add --minimum-release-age $$SECONDS $$PACKAGES; \
	elif echo "$$OUTPUT" | grep -qE 'ERR_MODULE_NOT_FOUND|command not found'; then \
		echo "Packages not installed. Installing from package.json specs..."; \
		PKGSPECS=$$(node -e "const p=require('$$ROOT/apps/mobile/package.json').dependencies; \
			['@expo/ui','expo','expo-background-fetch','expo-font', \
			 'expo-location','expo-router','expo-task-manager'] \
			.forEach(d=>process.stdout.write(d+'@'+p[d]+' '))"); \
		echo "Installing: $$PKGSPECS"; \
		cd "$$MOBILE" && bun add --minimum-release-age $$SECONDS $$PKGSPECS; \
		echo "Re-checking recommended versions..."; \
		cd "$$ROOT" && PACKAGES=$$(cd "$$MOBILE" && APP_VERSION_NAME="$(APP_VERSION_NAME)" npx expo install --check 2>&1 | \
			sed -n 's/  \([^ ]*\)@[^ ]* - expected version: ~\?\([^ ]*\)/\1@\2/p'); \
		if [ -n "$$PACKAGES" ]; then \
			echo "Upgrading: $$PACKAGES"; \
			cd "$$MOBILE" && bun add --minimum-release-age $$SECONDS $$PACKAGES; \
		else \
			echo "All Expo packages up to date!"; \
		fi \
	else \
		echo "All Expo packages up to date!"; \
	fi

# ── Supply Chain Security ──────────────────────

.PHONY: socket-login socket-scan
socket-login: ## Authenticate with Socket.dev CLI (persists token locally)
	bunx socket login

socket-scan: ## Run Socket.dev security scan and show report (requires: SOCKET_SECURITY_API_KEY + ORG in .env, API token scopes: full-scans:create, full-scans:list, security-policy:read)
	SOCKET_CLI_API_TOKEN=$(SOCKET_SECURITY_API_KEY) bunx socket scan create \
		--json --no-interactive --org=$(SOCKET_CLI_ORG_SLUG) --report \
		--no-set-as-alerts-page --branch=$(shell git branch --show-current)

.PHONY: pin-deps scripts-typecheck
pin-deps: install ## Pin all workspace dependencies to exact versions from bun.lock
	bun run scripts/pin-deps.ts

scripts-typecheck: ## Type-check scripts/ with tsc
	bunx tsc --project scripts/tsconfig.json --noEmit

# ── Utilities ─────────────────────────────────

.PHONY: install
install: ## Install all workspace dependencies and configure git hooks
	bun install
	git config core.hooksPath .githooks

.PHONY: lint
lint: ## Run linters across workspaces
	bun --filter @sonora/mobile lint
	bun --filter @sonora/admin lint
	bun --filter @sonora/api lint

.PHONY: format
format: ## Run prettier to format code
	bunx prettier --write .

.PHONY: format-check
format-check: ## Check code formatting using prettier
	bunx prettier --check .

.PHONY: typecheck
typecheck: ## Run TypeScript type checks across workspaces
	bun --filter @sonora/mobile typecheck
	bun --filter @sonora/api typecheck
	bun --filter @sonora/admin typecheck

.PHONY: admin-dev
admin-dev: ## Launch Expo dev server for Admin Web
	cd apps/admin && EXPO_PUBLIC_API_URL="http://localhost:3000" bun run dev

.PHONY: admin-dev-staging
admin-dev-staging: ## Launch Expo dev server for Admin Web pointing to staging API
	cd apps/admin && EXPO_PUBLIC_API_URL="https://sonora-api-staging.sonora-api.workers.dev" bunx expo start --web

.PHONY: sync-translations-staging
sync-translations-staging: ## Sync DB translations from staging back into .ts locale files (dry-run)
	cd apps/api && API_URL="https://sonora-api-staging.sonora-api.workers.dev" bun run scripts/sync-translations.ts --dry-run; \
	status=$$?; \
	if [ $$status -eq 1 ]; then \
		echo "ℹ️  Cambios detectados (exit 1 — esperado en dry-run, significa que hay diff)"; \
	elif [ $$status -ne 0 ]; then \
		exit $$status; \
	fi

.PHONY: sync-translations-staging-apply
sync-translations-staging-apply: ## Sync DB translations from staging: write changes to .ts files
	cd apps/api && API_URL="https://sonora-api-staging.sonora-api.workers.dev" bun run scripts/sync-translations.ts; \
	status=$$?; \
	if [ $$status -eq 1 ]; then \
		echo "✅ Archivos actualizados. Revisá el diff con 'git diff' antes de commitear."; \
	elif [ $$status -ne 0 ]; then \
		exit $$status; \
	fi

.PHONY: sync-translations-production
sync-translations-production: ## Sync DB translations from production back into .ts locale files (dry-run)
	cd apps/api && API_URL="https://sonora-api.sonora-api.workers.dev" bun run scripts/sync-translations.ts --dry-run; \
	status=$$?; \
	if [ $$status -eq 1 ]; then \
		echo "ℹ️  Cambios detectados (exit 1 — esperado en dry-run, significa que hay diff)"; \
	elif [ $$status -ne 0 ]; then \
		exit $$status; \
	fi



# ── Backend API ───────────────────────────────

API_DIR = apps/api

.PHONY: api-install
api-install: ## Install backend API dependencies (Hono, Wrangler, Vitest) — uses --frozen-lockfile for reproducibility
	cd $(API_DIR) && bun install --frozen-lockfile

.PHONY: api-dev
api-dev: ## Run Hono API locally with wrangler dev (local simulation)
	cd $(API_DIR) && bun run dev

.PHONY: api-dev-remote-staging
api-dev-remote-staging: ## Run Hono API locally connected to remote staging R2/resources
	cd $(API_DIR) && bunx wrangler dev --remote --config wrangler.staging.toml

.PHONY: api-dev-staging
api-dev-staging: ## Run Hono API locally with wrangler dev connected to staging Neon DB
	cd $(API_DIR) && bunx wrangler dev --config wrangler.staging.toml --env-file .env.staging


.PHONY: api-test
api-test: ## Run backend API tests (Vitest)
	cd $(API_DIR) && bun run test

.PHONY: api-test-mp
api-test-mp: ## Run the integrated Mercado Pago payment status polling test (local API and DB)
	cd $(API_DIR) && DATABASE_URL="$(DATABASE_URL_LOCAL_CLEAN)" bun src/scripts/test-mp-polling.ts

.PHONY: api-test-mp-staging
api-test-mp-staging: ## Run the integrated Mercado Pago payment status polling test against staging Neon DB
	@DATABASE_URL="$$(grep DATABASE_URL $(API_DIR)/.env.staging | cut -d'=' -f2- | tr -d '"' | tr -d "'")" \
	cd $(API_DIR) && DATABASE_URL="$$DATABASE_URL" bun src/scripts/test-mp-polling.ts

.PHONY: api-typecheck
api-typecheck: ## Run TypeScript type check for the API
	cd $(API_DIR) && bun run typecheck

.PHONY: api-deploy
api-deploy: api-deploy-production ## Deploy Hono API to Cloudflare Workers (default = production, alias for api-deploy-production)

.PHONY: api-validate-wrangler-vars
api-validate-wrangler-vars: ## Fail if any secret name appears in wrangler.toml [vars]
	@for file in $(API_DIR)/wrangler.toml $(API_DIR)/wrangler.staging.toml; do \
		SECRETS="DATABASE_URL ADMIN_API_KEY MP_ACCESS_TOKEN MP_WEBHOOK_SECRET JWT_SECRET CLIENT_API_KEY ALLOWED_ORIGIN"; \
		IN_VARS=0; \
		while IFS= read -r line; do \
			case "$$line" in \
				\[vars\]*) IN_VARS=1 ;; \
				\[*\]*)   IN_VARS=0 ;; \
			esac; \
			if [ $$IN_VARS -eq 1 ]; then \
				for secret in $$SECRETS; do \
					case "$$line" in \
						$$secret=*) \
							echo ""; \
							echo "✘ SECURITY BLOCKED: $$secret found in [vars] of $$file"; \
							echo "  Secrets must be set via 'wrangler secret put', not in wrangler.toml"; \
							echo ""; \
							exit 1 ;; \
					esac; \
				done; \
			fi; \
		done < "$$file"; \
	done
	@echo "✓ wrangler.toml [vars] — no secrets detected"

.PHONY: api-login
api-login: ## Authenticate wrangler with Cloudflare (opens browser)
	cd $(API_DIR) && bunx wrangler login

.PHONY: api-deploy-production
api-deploy-production: api-validate-wrangler-vars ## Deploy production Worker to Cloudflare (name: sonora-api, config: wrangler.toml)
	cd $(API_DIR) && bunx wrangler deploy
	@echo ""
	@echo "=== Secrets (set individually) ==="
	@echo "  make api-deploy-production-set-db-url"
	@echo "  make api-deploy-production-set-admin-api-key"
	@echo "  make api-deploy-production-set-mp-access-token"
	@echo "  make api-deploy-production-set-mp-webhook-secret"
	@echo "  make api-deploy-production-set-jwt-secret"
	@echo "  make api-deploy-production-set-client-api-key"
	@echo ""

.PHONY: api-deploy-staging
api-deploy-staging: api-validate-wrangler-vars ## Deploy staging Worker to Cloudflare (name: sonora-api-staging, config: wrangler.staging.toml)
	cd $(API_DIR) && bunx wrangler deploy --config wrangler.staging.toml
	@echo ""
	@echo "=== Secrets (set individually) ==="
	@echo "  make api-deploy-staging-set-db-url"
	@echo "  make api-deploy-staging-set-admin-api-key"
	@echo "  make api-deploy-staging-set-mp-access-token"
	@echo "  make api-deploy-staging-set-mp-webhook-secret"
	@echo "  make api-deploy-staging-set-jwt-secret"
	@echo "  make api-deploy-staging-set-client-api-key"
	@echo ""


.PHONY: api-r2-buckets-staging
api-r2-buckets-staging: ## Create R2 audio buckets for staging environment
	cd $(API_DIR) && bunx wrangler r2 bucket create sonora-staging-private-audio --config wrangler.staging.toml
	cd $(API_DIR) && bunx wrangler r2 bucket create sonora-staging-public-audio --config wrangler.staging.toml
	cd $(API_DIR) && bunx wrangler r2 bucket dev-url enable sonora-staging-public-audio --config wrangler.staging.toml


.PHONY: api-r2-buckets-production
api-r2-buckets-production: ## Create R2 audio buckets for production environment
	cd $(API_DIR) && bunx wrangler r2 bucket create sonora-production-private-audio
	cd $(API_DIR) && bunx wrangler r2 bucket create sonora-production-public-audio
	cd $(API_DIR) && bunx wrangler r2 bucket dev-url enable sonora-production-public-audio

.PHONY: api-upload-audio-staging
api-upload-audio-staging: ## Upload an audio file to staging R2. Usage: make api-upload-audio-staging FILE="path/to/file.mp3" KEY="experiences/name.mp3"
	@if [ -z "$(FILE)" ] || [ -z "$(KEY)" ]; then \
		echo "Error: FILE and KEY parameters are required. Example: make api-upload-audio-staging FILE=\"/path/to/audio.mp3\" KEY=\"experiences/audio.mp3\""; \
		exit 1; \
	fi
	curl -X POST $(API_STAGING_URL)/audio/upload \
	  -H "Authorization: Bearer $(ADMIN_API_KEY_CLEAN)" \
	  -F "key=$(KEY)" \
	  -F "file=@$(FILE)"

.PHONY: api-upload-audio-production
api-upload-audio-production: ## Upload an audio file to production R2. Usage: make api-upload-audio-production FILE="path/to/file.mp3" KEY="experiences/name.mp3"
	@if [ -z "$(FILE)" ] || [ -z "$(KEY)" ]; then \
		echo "Error: FILE and KEY parameters are required. Example: make api-upload-audio-production FILE=\"/path/to/audio.mp3\" KEY=\"experiences/audio.mp3\""; \
		exit 1; \
	fi
	curl -X POST $(API_PRODUCTION_URL)/audio/upload \
	  -H "Authorization: Bearer $(ADMIN_API_KEY_CLEAN)" \
	  -F "key=$(KEY)" \
	  -F "file=@$(FILE)"

.PHONY: api-upload-public-audio-staging
api-upload-public-audio-staging: ## Upload audio to staging public bucket. Usage: make api-upload-public-audio-staging FILE="path/to/file.mp3" KEY="experiences/name.mp3"
	@cd $(API_DIR) && bunx wrangler r2 object put sonora-staging-public-audio/$(KEY) --file=$(FILE) --config wrangler.staging.toml --remote
	@echo "Uploaded to staging public bucket: sonora-staging-public-audio/$(KEY)"

.PHONY: api-upload-public-audio-production
api-upload-public-audio-production: ## Upload audio to production public bucket. Usage: make api-upload-public-audio-production FILE="path/to/file.mp3" KEY="experiences/name.mp3"
	@cd $(API_DIR) && bunx wrangler r2 object put sonora-production-public-audio/$(KEY) --file=$(FILE) --remote
	@echo "Uploaded to production public bucket: sonora-production-public-audio/$(KEY)"

.PHONY: api-deploy-staging-set-origin
api-deploy-staging-set-origin: ## Set ALLOWED_ORIGIN on staging Worker (interactive)
	@read -r -p "Paste the ALLOWED_ORIGIN for staging (e.g. https://sonora-staging.eas.host): " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put ALLOWED_ORIGIN --config wrangler.staging.toml

.PHONY: api-secret-list-staging
api-secret-list-staging: ## List secrets on staging Worker
	cd $(API_DIR) && bunx wrangler secret list --config wrangler.staging.toml

.PHONY: api-secret-list-production
api-secret-list-production: ## List secrets on production Worker
	cd $(API_DIR) && bunx wrangler secret list

.PHONY: api-secret-delete-staging
api-secret-delete-staging: ## Delete a secret from staging Worker (interactive)
	@read -r -p "Secret name to delete from staging: " NAME; \
	cd $(API_DIR) && bunx wrangler secret delete "$$NAME" --config wrangler.staging.toml

.PHONY: api-secret-delete-production
api-secret-delete-production: ## Delete a secret from production Worker (interactive)
	@read -r -p "Secret name to delete from production: " NAME; \
	cd $(API_DIR) && bunx wrangler secret delete "$$NAME"

.PHONY: api-deploy-staging-set-mp-webhook-secret
api-deploy-staging-set-mp-webhook-secret: ## Set MP_WEBHOOK_SECRET on staging Worker (interactive — paste the secret from MP dashboard)
	@read -r -p "Paste the MP_WEBHOOK_SECRET from MP dashboard: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put MP_WEBHOOK_SECRET --config wrangler.staging.toml

.PHONY: api-deploy-staging-set-mp-access-token
api-deploy-staging-set-mp-access-token: ## Set MP_ACCESS_TOKEN on staging Worker (interactive — paste the access token from MP dashboard)
	@read -r -p "Paste the MP_ACCESS_TOKEN from MP dashboard: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put MP_ACCESS_TOKEN --config wrangler.staging.toml

.PHONY: api-deploy-production-set-mp-webhook-secret
api-deploy-production-set-mp-webhook-secret: ## Set MP_WEBHOOK_SECRET on production Worker (interactive — paste the secret from MP dashboard)
	@read -r -p "Paste the MP_WEBHOOK_SECRET from MP dashboard: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put MP_WEBHOOK_SECRET

.PHONY: api-deploy-production-set-mp-access-token
api-deploy-production-set-mp-access-token: ## Set MP_ACCESS_TOKEN on production Worker (interactive — paste the access token from MP dashboard)
	@read -r -p "Paste the MP_ACCESS_TOKEN from MP dashboard: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put MP_ACCESS_TOKEN

.PHONY: api-deploy-staging-set-jwt-secret
api-deploy-staging-set-jwt-secret: ## Set JWT_SECRET on staging Worker (interactive)
	@read -r -p "Enter the JWT_SECRET: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put JWT_SECRET --config wrangler.staging.toml

.PHONY: api-deploy-production-set-jwt-secret
api-deploy-production-set-jwt-secret: ## Set JWT_SECRET on production Worker (interactive)
	@read -r -p "Enter the JWT_SECRET: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put JWT_SECRET

.PHONY: api-deploy-staging-set-client-api-key
api-deploy-staging-set-client-api-key: ## Set CLIENT_API_KEY on staging Worker (interactive)
	@read -r -p "Enter the CLIENT_API_KEY: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put CLIENT_API_KEY --config wrangler.staging.toml

.PHONY: api-deploy-production-set-client-api-key
api-deploy-production-set-client-api-key: ## Set CLIENT_API_KEY on production Worker (interactive)
	@read -r -p "Enter the CLIENT_API_KEY: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put CLIENT_API_KEY

.PHONY: api-deploy-production-set-origin
api-deploy-production-set-origin: ## Set ALLOWED_ORIGIN on production Worker (interactive)
	@read -r -p "Paste the ALLOWED_ORIGIN for production (e.g. https://sonora.eas.host): " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put ALLOWED_ORIGIN

.PHONY: api-deploy-staging-log-toggle
api-deploy-staging-log-toggle: ## Toggle API logging on staging interactively
	@read -r -p "Enable API logging on staging? (true/false): " ENABLED; \
	cd $(API_DIR) && printf '%s' "$$ENABLED" | bunx wrangler secret put ENABLE_API_LOGGING --config wrangler.staging.toml

.PHONY: api-deploy-production-log-toggle
api-deploy-production-log-toggle: ## Toggle API logging on production interactively
	@read -r -p "Enable API logging on production? (true/false): " ENABLED; \
	cd $(API_DIR) && printf '%s' "$$ENABLED" | bunx wrangler secret put ENABLE_API_LOGGING

# ── Backend API — Test deployed Workers ─────────────

API_STAGING_URL ?= https://sonora-api-staging.sonora-api.workers.dev
API_PRODUCTION_URL ?= https://sonora-api.sonora-api.workers.dev

.PHONY: api-test-staging
api-test-staging: ## Test staging Worker health (GET /health)
	curl -s -o /dev/null -w "HTTP %{http_code} — %{time_total}s\n" '$(API_STAGING_URL)/health'

.PHONY: api-test-staging-verbose
api-test-staging-verbose: ## Test staging Worker with full response (GET /health)
	curl -i '$(API_STAGING_URL)/health'

.PHONY: api-test-production
api-test-production: ## Test production Worker health (GET /health)
	curl -s -o /dev/null -w "HTTP %{http_code} — %{time_total}s\n" '$(API_PRODUCTION_URL)/health'

.PHONY: api-logs-staging
api-logs-staging: ## Tail staging Worker logs (Ctrl+C to stop)
	cd $(API_DIR) && bunx wrangler tail --config wrangler.staging.toml

.PHONY: api-logs-production
api-logs-production: ## Tail production Worker logs (Ctrl+C to stop)
	cd $(API_DIR) && bunx wrangler tail

.PHONY: api-secrets-staging
api-secrets-staging: ## List staging Worker secrets (names only)
	cd $(API_DIR) && bunx wrangler secret list --config wrangler.staging.toml

.PHONY: api-secrets-production
api-secrets-production: ## List production Worker secrets (names only)
	cd $(API_DIR) && bunx wrangler secret list

.PHONY: api-test-staging-db
api-test-staging-db: ## Test staging DB connection (GET /health/db)
	curl -s '$(API_STAGING_URL)/health/db' | jq .

.PHONY: api-test-production-db
api-test-production-db: ## Test production DB connection (GET /health/db)
	curl -s '$(API_PRODUCTION_URL)/health/db' | jq .

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
api-db-migrate: ## Apply pending Drizzle migrations
	cd $(API_DIR) && bun run db:migrate

.PHONY: api-db-seed
api-db-seed: ## Seed default trips data in local Postgres
	cd $(API_DIR) && bun run db:seed

# ── Neon cloud DB (requires DATABASE_URL_STAGING / DATABASE_URL_PRODUCTION in api/.env) ──
# Values are unquoted via patsubst to prevent shell interpretation of special chars (&, etc.)

DATABASE_URL_STAGING_CLEAN := $(patsubst "%",%,$(DATABASE_URL_STAGING))
DATABASE_URL_PRODUCTION_CLEAN := $(patsubst "%",%,$(DATABASE_URL_PRODUCTION))
ADMIN_API_KEY_CLEAN := $(patsubst "%",%,$(ADMIN_API_KEY))
DATABASE_URL_LOCAL_CLEAN := postgres://sonora:sonora@localhost:5432/sonora

.PHONY: api-db-migrate-staging
api-db-migrate-staging: ## Apply Drizzle migrations to staging Neon DB
	cd $(API_DIR) && DATABASE_URL='$(DATABASE_URL_STAGING_CLEAN)' bun run db:migrate

.PHONY: api-db-migrate-production
api-db-migrate-production: ## Apply Drizzle migrations to production Neon DB
	cd $(API_DIR) && DATABASE_URL='$(DATABASE_URL_PRODUCTION_CLEAN)' bun run db:migrate

.PHONY: api-db-migrate-ci
api-db-migrate-ci: ## Apply Drizzle migrations using DATABASE_URL from env (for CI)
	cd $(API_DIR) && DATABASE_URL="$${DATABASE_URL}" bun run db:migrate

.PHONY: api-db-seed-ci
api-db-seed-ci: ## Seed DB using DATABASE_URL from env (for CI)
	cd $(API_DIR) && DATABASE_URL="$${DATABASE_URL}" bun src/db/seed.ts

.PHONY: api-db-seed-staging
api-db-seed-staging: ## Seed staging Neon DB
	cd $(API_DIR) && DATABASE_URL='$(DATABASE_URL_STAGING_CLEAN)' bun src/db/seed.ts

.PHONY: api-db-seed-production
api-db-seed-production: ## Seed production Neon DB
	cd $(API_DIR) && DATABASE_URL='$(DATABASE_URL_PRODUCTION_CLEAN)' bun src/db/seed.ts

.PHONY: api-deploy-staging-full
api-deploy-staging-full: api-deploy-staging api-db-seed-staging ## Deploy staging Worker + seed Neon DB
	@echo "✓ Staging deploy + seed complete"

.PHONY: api-deploy-production-full
api-deploy-production-full: api-deploy-production api-db-seed-production ## Deploy production Worker + seed Neon DB
	@echo "✓ Production deploy + seed complete"

# ── Wrangler secrets — interactive (paste the value, never from .env) ──

.PHONY: api-deploy-staging-set-db-url
api-deploy-staging-set-db-url: ## Set DATABASE_URL on staging Worker (interactive)
	@read -r -p "Paste the DATABASE_URL for staging: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put DATABASE_URL --config wrangler.staging.toml

.PHONY: api-deploy-production-set-db-url
api-deploy-production-set-db-url: ## Set DATABASE_URL on production Worker (interactive)
	@read -r -p "Paste the DATABASE_URL for production: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put DATABASE_URL

.PHONY: api-deploy-staging-set-admin-api-key
api-deploy-staging-set-admin-api-key: ## Set ADMIN_API_KEY on staging Worker (interactive)
	@read -r -p "Paste the ADMIN_API_KEY for staging: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put ADMIN_API_KEY --config wrangler.staging.toml

.PHONY: api-deploy-production-set-admin-api-key
api-deploy-production-set-admin-api-key: ## Set ADMIN_API_KEY on production Worker (interactive)
	@read -r -p "Paste the ADMIN_API_KEY for production: " SECRET; \
	cd $(API_DIR) && printf '%s' "$$SECRET" | bunx wrangler secret put ADMIN_API_KEY

.PHONY: api-db-backup
api-db-backup: ## Dump database, encrypt with GPG, upload to Cloudflare R2, and prune old backups (>90 days)
	@DB_URL="$(DB_URL)"; \
	if [ -z "$$DB_URL" ]; then \
	  DB_URL="$(DATABASE_URL)"; \
	fi; \
	if [ -z "$$DB_URL" ]; then \
	  read -r -p "Enter DATABASE_URL: " DB_URL; \
	fi; \
	if [ -z "$$DB_URL" ]; then echo "Error: DATABASE_URL is required"; exit 1; fi; \
	KEY="$(BACKUP_ENCRYPTION_KEY)"; \
	if [ -z "$$KEY" ]; then \
	  read -r -sp "Enter BACKUP_ENCRYPTION_KEY (GPG passphrase): " KEY; echo ""; \
	fi; \
	if [ -z "$$KEY" ]; then echo "Error: BACKUP_ENCRYPTION_KEY is required"; exit 1; fi; \
	DATE_TAG=$$(date +%Y-%m-%d); \
	BACKUP_FILE="sonora-db-$$DATE_TAG.sql.gz.gpg"; \
	TEMP_DIR=$$(mktemp -d); \
	TEMP_FILE="$$TEMP_DIR/$$BACKUP_FILE"; \
	echo "Dumping database..."; \
	export PATH="/usr/lib/postgresql/18/bin:$$PATH"; \
	pg_dump --clean --if-exists --inserts --no-owner --no-acl "$$DB_URL" \
	  | gzip \
	  | gpg --symmetric --cipher-algo AES256 --batch --passphrase "$$KEY" \
	  > "$$TEMP_FILE" && \
	echo "Uploading to R2..." && \
	bun --cwd apps/api wrangler r2 object put "sonora-db-backups/db/$$BACKUP_FILE" --file "$$TEMP_FILE" --remote && \
	TOKEN="$(CLOUDFLARE_API_TOKEN)"; \
	ACCOUNT="$(CLOUDFLARE_ACCOUNT_ID)"; \
	if [ -n "$$TOKEN" ] && [ -n "$$ACCOUNT" ]; then \
	  echo "Cleaning up backups older than 90 days from R2..." && \
	  CUTOFF=$$(date -d "90 days ago" +%Y-%m-%d); \
	  curl -s -H "Authorization: Bearer $$TOKEN" \
	    "https://api.cloudflare.com/client/v4/accounts/$$ACCOUNT/r2/buckets/sonora-db-backups/objects?prefix=db/&delimiter=/" \
	    | jq -r '.result.objects[]?.key' \
	    | while read -r key; do \
	        DATE_PART=$$(echo "$$key" | grep -oP '\d{4}-\d{2}-\d{2}'); \
	        if [ -n "$$DATE_PART" ] && [[ "$$DATE_PART" < "$$CUTOFF" ]]; then \
	          echo "Deleting old backup: $$key"; \
	          bun --cwd apps/api wrangler r2 object delete "sonora-db-backups/$$key" --remote; \
	        fi \
	      done; \
	else \
	  echo "Skipping pruning of old backups (CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set)"; \
	fi; \
	rm -rf "$$TEMP_DIR"; \
	echo "Backup process finished."

.PHONY: api-db-restore
api-db-restore: ## Download and restore database backup from R2. Usage: make api-db-restore DATE="2026-07-13" [DB_URL="postgresql://..."]
	@KEY="$(BACKUP_ENCRYPTION_KEY)"; \
	if [ -z "$$KEY" ]; then \
	  read -r -sp "Enter BACKUP_ENCRYPTION_KEY (GPG passphrase): " KEY; echo ""; \
	fi; \
	if [ -z "$$KEY" ]; then echo "Error: BACKUP_ENCRYPTION_KEY is required"; exit 1; fi; \
	TARGET_DATE="$(DATE)"; \
	if [ -z "$$TARGET_DATE" ]; then \
	  TARGET_DATE=$$(date +%Y-%m-%d); \
	  echo "No DATE specified. Using today's date ($$TARGET_DATE). Usage: make api-db-restore DATE=YYYY-MM-DD"; \
	fi; \
	TARGET_DB_URL="$(DB_URL)"; \
	if [ -z "$$TARGET_DB_URL" ]; then \
	  TARGET_DB_URL="$(DATABASE_URL)"; \
	fi; \
	if [ -z "$$TARGET_DB_URL" ]; then \
	  read -r -p "Enter DATABASE_URL to restore into: " TARGET_DB_URL; \
	fi; \
	if [ -z "$$TARGET_DB_URL" ]; then \
	  echo "Error: DATABASE_URL is required"; exit 1; \
	fi; \
	BACKUP_FILE="sonora-db-$$TARGET_DATE.sql.gz.gpg"; \
	TEMP_DIR=$$(mktemp -d); \
	TEMP_FILE="$$TEMP_DIR/$$BACKUP_FILE"; \
	echo "Downloading backup $$BACKUP_FILE from R2..."; \
	bun --cwd apps/api wrangler r2 object get "sonora-db-backups/db/$$BACKUP_FILE" --file "$$TEMP_FILE" --remote || { rm -rf "$$TEMP_DIR"; exit 1; }; \
	echo "Decrypting and restoring to database..."; \
	PSQL_CMD="psql"; \
	if command -v psql >/dev/null 2>&1; then \
	  PSQL_CMD="psql"; \
	elif command -v podman >/dev/null 2>&1; then \
	  PSQL_CMD="podman run -i --rm --network host postgres:18-alpine psql"; \
	elif command -v docker >/dev/null 2>&1; then \
	  PSQL_CMD="docker run -i --rm --network host postgres:18-alpine psql"; \
	else \
	  echo "Error: psql, podman, or docker is required to restore"; rm -rf "$$TEMP_DIR"; exit 1; \
	fi; \
	( \
	  echo "DROP SCHEMA IF EXISTS sonora CASCADE;"; \
	  echo "DROP SCHEMA IF EXISTS sonora_db_migrations CASCADE;"; \
	  gpg --decrypt --batch --passphrase "$$KEY" "$$TEMP_FILE" | gunzip \
	) | $$PSQL_CMD "$$TARGET_DB_URL" || { rm -rf "$$TEMP_DIR"; exit 1; }; \
	rm -rf "$$TEMP_DIR"; \
	echo "Restore completed successfully."

.PHONY: api-db-studio
api-db-studio: ## Launch Drizzle Studio (GUI for local DB)
	cd $(API_DIR) && bun run db:studio

# ── psql shell targets (amigables) ──
# Uses .psqlrc-sonora for \x auto, null display, cleaner prompt, etc.

PSQLRC_SONORA := $(CURDIR)/$(API_DIR)/.psqlrc-sonora

.PHONY: api-db-shell
api-db-shell: ## Open psql shell to local Postgres (amigable)
	podman cp $(PSQLRC_SONORA) sonora-postgres:/tmp/.psqlrc-sonora && \
		podman compose -f $(API_DIR)/docker-compose.yml exec \
			-e PSQLRC=/tmp/.psqlrc-sonora \
			postgres psql -U sonora -d sonora

.PHONY: api-db-shell-staging
api-db-shell-staging: ## Open psql shell to Neon staging DB (amigable)
	podman run -it --rm \
		-v $(PSQLRC_SONORA):/root/.psqlrc:Z \
		postgres:18-alpine psql '$(DATABASE_URL_STAGING_CLEAN)'

.PHONY: api-db-shell-production
api-db-shell-production: ## Open psql shell to Neon production DB (amigable)
	podman run -it --rm \
		-v $(PSQLRC_SONORA):/root/.psqlrc:Z \
		postgres:18-alpine psql '$(DATABASE_URL_PRODUCTION_CLEAN)'

.PHONY: api-dev-local
api-dev-local: ## Run Hono API locally with Docker Postgres
	cd $(API_DIR) && bun run dev:local

.PHONY: api-dev-full
api-dev-full: api-db-up api-db-migrate api-db-seed api-dev-local ## Start Postgres, migrate, seed, and run Hono API locally


# ── Test ──────────────────────────────────────

.PHONY: test-front
test-front: ## Run frontend tests (Jest with jest-expo preset, one-shot)
	cd apps/mobile && bun run jest --passWithNoTests --watchAll=false

.PHONY: test-back
test-back: ## Run backend API tests (Vitest, alias for api-test)
	$(MAKE) api-test

.PHONY: test-shared
test-shared: ## Run shared package tests (Bun)
	cd packages/shared && bun run test

.PHONY: test-admin
test-admin: ## Run admin app tests (Jest, one-shot)
	cd apps/admin && bun run jest --passWithNoTests --watchAll=false

.PHONY: test
test: test-front test-back test-shared test-admin ## Run all tests (frontend + backend + shared + admin)

.PHONY: test-ci
test-ci: ## Run all tests silently (for pre-commit/CI)
	cd apps/mobile && bun run jest --passWithNoTests --watchAll=false --silent
	cd apps/api && bunx vitest run --reporter=dot --silent
	cd packages/shared && bunx vitest run --reporter=dot --silent
	cd apps/admin && bun run jest --passWithNoTests --watchAll=false --silent

.PHONY: doctor-ci
doctor-ci: ## Run React Doctor audit (diff scan, for pre-commit, blocking on warnings)
	cd apps/mobile && bunx react-doctor --scope changed -y --blocking warning --verbose

.PHONY: precommit-logs
precommit-logs: ## Show temp files from last pre-commit run
	@LAST=$$(ls /tmp/sonora-precommit-*.log 2>/dev/null | sed 's/.*sonora-precommit-\([0-9]*\).*/\1/' | sort -u | tail -1); \
	if [ -z "$$LAST" ]; then \
	  echo "No pre-commit logs found"; \
	else \
	  for f in /tmp/sonora-precommit-$${LAST}-*.log; do \
	    echo "=== $$(basename $$f) ==="; \
	    cat "$$f"; \
	    echo ""; \
	  done; \
	fi

# ── CI ────────────────────────────────────────

.PHONY: validate
validate: format lint typecheck api-typecheck scripts-typecheck doctor-ci test gga ## Run full development gate (tests + lint + typecheck + gga + react-doctor diff scan)

.PHONY: api-validate
api-validate: api-test api-typecheck ## Run API tests + typecheck

.PHONY: check-static
check-static: lint typecheck ## Run lint + typecheck

.PHONY: check
check: format-check lint typecheck test 
	$(MAKE) expo-doctor || echo "[WARN] expo-doctor checks failed (may be false positives from bun cache layout)"

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
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build:list

.PHONY: eas-init
eas-init: ## Initialize EAS for this project (first-time setup)
	bunx eas-cli@$(EAS_CLI_VERSION) init

# production vs preview:
#   production → signed APK for Google Play (uses production keystore)
#   preview    → test APK for sideloading (internal distribution, no Play Store)

.PHONY: eas-build-android
eas-build-android: eas-whoami ## Build Play Store APK via EAS cloud (needs production keystore)
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile production --wait

.PHONY: eas-build-android-preview
eas-build-android-preview: eas-whoami ## Build test APK for sideload via EAS cloud (internal distribution)
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile preview --wait

.PHONY: eas-build-android-local
eas-build-android-local: eas-whoami ## Build Play Store APK locally (needs Android SDK + production keystore)
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile production --local --wait

.PHONY: eas-build-android-preview-local
eas-build-android-preview-local: eas-whoami ## Build test APK for sideload locally (interactive, prompts for APP_VERSION_CODE)
	@read -r -p "Enter APP_VERSION_CODE (or leave empty for default): " vc; \
	cd apps/mobile && APP_VERSION_CODE=$$vc bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile preview --local

.PHONY: eas-build-android-release-ci-unsigned
eas-build-android-release-ci-unsigned: ## Build unsigned APK + AAB from single prebuild+Gradle
	cd apps/mobile && \
	  npx expo prebuild --platform android --clean && \
	  cd android && \
	  ./gradlew :app:assembleRelease :app:bundleRelease && \
	  cd .. && \
	  zip -d android/app/build/outputs/bundle/release/app-release.aab "META-INF/*.SF" "META-INF/*.RSA" "META-INF/*.DSA" || true && \
	  mv android/app/build/outputs/apk/release/app-release.apk $(if $(OUTPUT_APK),$(OUTPUT_APK),sonora-release-unsigned.apk) && \
	  mv android/app/build/outputs/bundle/release/app-release.aab $(if $(OUTPUT_AAB),$(OUTPUT_AAB),sonora-release-unsigned.aab)

.PHONY: eas-build-android-preview-ci
eas-build-android-preview-ci: eas-whoami ## Build test APK for sideload in CI (kept for local dev, use eas-build-android-release-ci for production)
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile preview --local $(if $(OUTPUT_APK),--output="$(OUTPUT_APK)")

.PHONY: eas-build-android-aab-ci
eas-build-android-aab-ci: eas-whoami ## Build signed AAB (kept for backward compat, use eas-build-android-release-ci for production)
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) build -p android --profile aab --local $(if $(OUTPUT_AAB),--output="$(OUTPUT_AAB)")

.PHONY: eas-upload-apk
eas-upload-apk: eas-whoami ## Upload a local APK to EAS (usage: make eas-upload-apk APK=path/to/file.apk)
	cd apps/mobile && bunx eas-cli@$(EAS_CLI_VERSION) submit -p android --path "$(APK)"

.PHONY: eas-build-web-production
eas-build-web-production: eas-whoami ## Export web app and deploy to EAS Hosting production
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" EXPO_PUBLIC_API_URL="$(API_PRODUCTION_URL)" bunx expo export --clear --platform web && APP_VERSION_NAME="$(APP_VERSION_NAME)" bunx eas-cli@$(EAS_CLI_VERSION) deploy --prod

.PHONY: eas-build-web-staging
eas-build-web-staging: eas-whoami ## Export web app and deploy to EAS Hosting staging (alias: staging)
	cd apps/mobile && APP_VERSION_NAME="$(APP_VERSION_NAME)" EXPO_PUBLIC_API_URL="$(API_STAGING_URL)" bunx expo export --clear --platform web && APP_VERSION_NAME="$(APP_VERSION_NAME)" bunx eas-cli@$(EAS_CLI_VERSION) deploy --alias staging

.PHONY: eas-build-admin-production
eas-build-admin-production: eas-whoami ## Export admin web app and deploy to EAS Hosting production
	cd apps/admin && EXPO_PUBLIC_API_URL="$(API_PRODUCTION_URL)" bunx expo export --clear --platform web && bunx eas-cli@$(EAS_CLI_VERSION) deploy --prod

.PHONY: eas-build-admin-staging
eas-build-admin-staging: eas-whoami ## Export admin web app and deploy to EAS Hosting staging
	cd apps/admin && EXPO_PUBLIC_API_URL="$(API_STAGING_URL)" bunx expo export --clear --platform web && bunx eas-cli@$(EAS_CLI_VERSION) deploy --alias staging

# ── Firebase App Distribution ────────────

# Firebase project App IDs
FIREBASE_APP_ID_PRODUCTION := 1:967054219260:android:61a953910f951dee060479
FIREBASE_APP_ID_STAGING    := 1:967212589494:android:d73fef12d655a13914e117

# Service account key path — auto-sets GOOGLE_APPLICATION_CREDENTIALS if file exists
FIREBASE_SA_KEY_PATH ?= apps/mobile/firebase-sa-key.json
ifneq ($(wildcard $(FIREBASE_SA_KEY_PATH)),)
export GOOGLE_APPLICATION_CREDENTIALS := $(abspath $(FIREBASE_SA_KEY_PATH))
endif
# APK path — auto-picks the newest build-*.apk (override: FIREBASE_APK_PATH=dist/app-release.apk)
FIREBASE_APK_PATH ?= $(shell ls -t apps/mobile/build-*.apk apps/mobile/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)
# Firebase App Distribution groups
FIREBASE_GROUP_DEV      := dev-team
FIREBASE_GROUP_SONORA   := sonora-team

# Dynamic App ID lookup based on APP_ENV (defaults to staging)
APP_ENV ?= staging
ifeq ($(APP_ENV),production)
  FIREBASE_TARGET_APP_ID := $(FIREBASE_APP_ID_PRODUCTION)
else
  FIREBASE_TARGET_APP_ID := $(FIREBASE_APP_ID_STAGING)
endif

# Release notes — dynamically generates multiline list of the last 3 commit messages
FIREBASE_RELEASE_NOTES_CMD = $$(git log -3 --pretty=format:'- %s' 2>/dev/null | tr -d '\"'\''')
FIREBASE_RELEASE_NOTES ?= $(FIREBASE_RELEASE_NOTES_CMD)

.PHONY: firebase-login-ci
firebase-login-ci: ## Firebase CI login — generates a token for FIREBASE_TOKEN in .env
	bun --filter @sonora/mobile firebase-cli login:ci

.PHONY: firebase-distribute
firebase-distribute: ## Upload APK to Firebase App Distribution. Requires: GROUPS. Optional: APP_ENV (staging|production), FIREBASE_RELEASE_NOTES
	@if [ -z "$(GROUPS)" ]; then echo "Error: GROUPS parameter is required (e.g. GROUPS=dev-team)"; exit 1; fi
	bun --filter @sonora/mobile firebase-cli appdistribution:distribute "$(abspath $(FIREBASE_APK_PATH))" \
		--app "$(FIREBASE_TARGET_APP_ID)" \
		--groups "$(GROUPS)" \
		--release-notes "$$FIREBASE_RELEASE_NOTES" \
		--non-interactive

# ── Staging distribution ──────────────────────────────────────────────────────

.PHONY: firebase-distribute-staging-dev
firebase-distribute-staging-dev: ## [staging] Upload APK to dev-team group
	$(MAKE) firebase-distribute APP_ENV=staging GROUPS="$(FIREBASE_GROUP_DEV)"

.PHONY: firebase-distribute-staging-sonora
firebase-distribute-staging-sonora: ## [staging] Upload APK to sonora-team group
	$(MAKE) firebase-distribute APP_ENV=staging GROUPS="$(FIREBASE_GROUP_SONORA)"

.PHONY: firebase-distribute-staging-all
firebase-distribute-staging-all: ## [staging] Upload APK to dev-team + sonora-team
	$(MAKE) firebase-distribute APP_ENV=staging GROUPS="$(FIREBASE_GROUP_DEV),$(FIREBASE_GROUP_SONORA)"

# ── Production distribution ───────────────────────────────────────────────────

.PHONY: firebase-distribute-prod-dev
firebase-distribute-prod-dev: ## [production] Upload APK to dev-team group
	$(MAKE) firebase-distribute APP_ENV=production GROUPS="$(FIREBASE_GROUP_DEV)"

.PHONY: firebase-distribute-prod-sonora
firebase-distribute-prod-sonora: ## [production] Upload APK to sonora-team group
	$(MAKE) firebase-distribute APP_ENV=production GROUPS="$(FIREBASE_GROUP_SONORA)"

.PHONY: firebase-distribute-prod-all
firebase-distribute-prod-all: ## [production] Upload APK to dev-team + sonora-team
	$(MAKE) firebase-distribute APP_ENV=production GROUPS="$(FIREBASE_GROUP_DEV),$(FIREBASE_GROUP_SONORA)"

# ── Emulator ───────────────────────────────

.PHONY: android-stop
android-stop: ## Stop the standalone app on the emulator
	@echo "🛑 Stopping app ($(MOBILE_BUNDLE_ID))..."
	adb shell am force-stop $(MOBILE_BUNDLE_ID)

.PHONY: android-stop-go
android-stop-go: ## Stop Expo Go on the emulator
	@echo "🛑 Stopping Expo Go..."
	adb shell am force-stop host.exp.exponent

.PHONY: android-trigger-bg-go
android-trigger-bg-go: ## Trigger background fetch task in Expo Go on the emulator (replaces 999 with the job ID if needed)
	@echo "🔔 Triggering background fetch task in Expo Go..."
	@JOB_ID=$$(adb shell dumpsys jobscheduler | grep "host.exp.exponent" | grep -oE "JOB #[a-zA-Z0-9_/]+/[0-9]+" | head -n 1 | cut -d/ -f2); \
	if [ -n "$$JOB_ID" ]; then \
		echo "Found Expo Go background job ID: $$JOB_ID"; \
		adb shell cmd jobscheduler run --force host.exp.exponent $$JOB_ID; \
	else \
		echo "No active background job found for host.exp.exponent. Make sure the app ran at least once and is minimized."; \
	fi

.PHONY: android-trigger-bg
android-trigger-bg: ## Trigger background fetch task for the standalone app on the emulator
	@echo "🔔 Triggering background fetch task for standalone app..."
	@JOB_ID=$$(adb shell dumpsys jobscheduler | grep "$(MOBILE_BUNDLE_ID)" | grep -oE "JOB #[a-zA-Z0-9_/]+/[0-9]+" | head -n 1 | cut -d/ -f2); \
	if [ -n "$$JOB_ID" ]; then \
		echo "Found standalone background job ID: $$JOB_ID"; \
		adb shell cmd jobscheduler run --force $(MOBILE_BUNDLE_ID) $$JOB_ID; \
	else \
		echo "No active background job found for $(MOBILE_BUNDLE_ID)."; \
	fi

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

.PHONY: eas-clean
eas-clean: clean ## Clean local build artifacts — EAS cache + APKs + Podman EAS images + Expo caches
	rm -f *.apk *.aab *.ipa
	rm -rf ~/.eas-build ~/.expo/expo-go ~/.expo/android-apk-cache
	-podman image prune -a --filter="reference=*eas*" -f 2>/dev/null || true

.PHONY: eas-clean-full
eas-clean-full: eas-clean ## Clean EVERYTHING (including global Gradle cache + prebuild) — shared across ALL Android projects
	rm -rf ~/.gradle/caches
	rm -rf android/

.PHONY: reset
reset: clean install ## Full reset — clean + reinstall

.PHONY: help
help: ## Print this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' Makefile | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-32s\033[0m %s\n", $$1, $$2}'
