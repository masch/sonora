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

.PHONY: doctor
doctor: ## Run expo-doctor diagnostics
	bunx expo-doctor

# ── Utilities ─────────────────────────────────

.PHONY: install
install: ## Install project dependencies
	bun install

.PHONY: lint
lint: ## Run linter (expo lint)
	bun run lint

.PHONY: typecheck
typecheck: ## Run TypeScript type check
	tsc --noEmit

# ── Test ──────────────────────────────────────

.PHONY: test
test: ## Run tests (Jest with jest-expo preset, one-shot)
	bunx jest --passWithNoTests

# ── CI ────────────────────────────────────────

.PHONY: validate-static
validate-static: test lint typecheck ## Run CI gate without GGA (test → lint → typecheck)

.PHONY: validate
validate: validate-static gga ## Run full CI gate with GGA review (test → lint → typecheck → gga)

# ── Review ─────────────────────────────────────

.PHONY: gga
gga: ## Run GGA (Gentleman Guardian Angel) code review on staged files
	gga run

.PHONY: gga-full
gga-full: ## Run GGA review on ALL matching source files (stages, reviews, unstages)
	git add $(shell git ls-files '*.ts' '*.tsx' '*.js' '*.jsx') && gga run && git reset

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
