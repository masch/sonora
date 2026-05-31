# ──────────────────────────────────────────────
# Makefile — sonora (Expo SDK 56)
# All targets delegate to `bun` (project package manager).
# ──────────────────────────────────────────────

# ── Convenience ────────────────────────────────

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

.PHONY: eas-whoami
eas-whoami: ## Verify EAS authentication (uses EXPO_TOKEN from .env)
	eas whoami

.PHONY: eas-build-android
eas-build-android: ## Build Android production APK via EAS Build
	eas build -p android --profile production --wait

.PHONY: eas-build-android-preview
eas-build-android-preview: ## Build Android preview APK (internal distribution) via EAS Build
	eas build -p android --profile preview --wait

.PHONY: eas-build-web
eas-build-web: ## Export web app and deploy to EAS Hosting
	bunx expo export --platform web && eas deploy --prod

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
