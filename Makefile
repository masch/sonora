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

EAS_CLI_VERSION = 20.0.0

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

.PHONY: socket-scan
socket-scan: ## Run Socket.dev security scan (set SOCKET_CLI_API_TOKEN in .env)
	bunx socket scan create --json --no-set-as-alerts-page --branch=$(shell git branch --show-current)

# ── Utilities ─────────────────────────────────

.PHONY: install
install: ## Install project dependencies and configure git hooks
	bun install
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

# ── Test ──────────────────────────────────────

.PHONY: test
test: ## Run tests (Jest with jest-expo preset, one-shot)
	bunx jest --passWithNoTests

# ── CI ────────────────────────────────────────

.PHONY: validate
validate: format test lint typecheck gga ## Run full development gate (format → test → lint → typecheck → gga)

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
