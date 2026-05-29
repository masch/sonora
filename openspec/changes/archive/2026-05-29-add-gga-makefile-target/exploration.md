## Exploration: Add `make gga` target

### Current State

- **Makefile** (`Makefile`, 70 lines): 6 sections — Convenience, Utilities, Test, CI, Maintenance, Help. All targets are `.PHONY` with `##` self-documenting comments. Everything delegates to `bun`, `bunx`, or bare `tsc` (relying on PATH). The `validate` target chains `test → lint → typecheck` for CI gating.
- **GGA** (Gentleman Guardian Angel) v2.8.1: installed at `/home/masch/.local/bin/gga`. `~/.local/bin` is in the system PATH. A `.gga` config file exists at the project root with `PROVIDER="opencode"`, file patterns for `*.ts,*.tsx,*.js,*.jsx`, and exclusions for test/spec/d.ts files. Pointing to `AGENTS.md` for review rules.
- **No existing Makefile target** invokes GGA. It must be run manually as `gga run`.

### Affected Areas

- `Makefile` — add new `gga` target with help text

### Approaches

1. **Standalone `gga` target via PATH (recommended)** — Add a self-documented `.PHONY` target that runs `gga run`, placed in a new "Review" section after CI and before Maintenance. Relies on `~/.local/bin` being in PATH (matches existing project convention of `bun`, `bunx`, `tsc`).
   - Pros: Simple, consistent with existing Makefile style, no hardcoded paths, easy to maintain
   - Cons: None significant — PATH resolution works on this system and is the standard Unix convention
   - Effort: Low

2. **Full path `gga` target** — Use absolute path `/home/masch/.local/bin/gga` in the target recipe.
   - Pros: Works regardless of PATH configuration
   - Cons: Hardcodes a user-specific path into a shared Makefile, breaks portability, inconsistent with all other targets
   - Effort: Low

3. **Chain `gga` into the `validate` target** — Add `gga` as a dependency of the existing `validate: test lint typecheck` target.
   - Pros: Ensures GGA runs in CI
   - Cons: GGA requires an AI provider (cost, latency, API key), not appropriate for every CI run. The `validate` target is currently a fast dev gate (test → lint → typecheck). Adding GGA would multiply execution time and add external dependency risk.
   - Effort: Low (to add) but rejected on principle

### Recommendation

**Approach 1**: Add a standalone `gga` target in a new **Review** section, placed between the CI section (validate target) and the Maintenance section. This keeps concerns separated — CI validation is fast and local; code review is async and AI-dependent.

**Placement in Makefile** — after line 53 (validate target), before line 55 (`# ── Maintenance ───────────────────────────────`), insert:

```makefile
# ── Review ──────────────────────────────────────

.PHONY: gga
gga: ## Run GGA (Gentleman Guardian Angel) code review
	gga run
```

**Help text**: `## Run GGA (Gentleman Guardian Angel) code review` — follows the `##` self-documenting convention, clearly describes the target.

**PATH vs full path**: Use bare `gga`. `~/.local/bin` is already in PATH, and the project convention is to rely on PATH (see `bun`, `bunx`, `tsc` usage). This is the standard Unix approach.

**Not chaining into `validate`**: GGA is an AI-powered review tool with latency/cost. It should remain standalone — run on demand (`make gga`) or in a dedicated review step, not in the fast dev validation loop.

### Risks

- If GGA is invoked in a directory without a `.gga` config, it defaults to basic behavior — but a `.gga` config already exists at the project root, so low risk.
- `gga run` can take up to 300s (config timeout). The user needs to know this is not a fast target — it's a thorough code review.
- If `~/.local/bin` were ever removed from PATH, the target would fail. Mitigation: this is standard system configuration, and all other targets (bun, bunx, tsc) would also fail under the same condition.

### Ready for Proposal

Yes — this is a well-scoped, low-risk change. The only decision is where to place the target (standalone vs chained) and path resolution (PATH vs full path), both of which have clear answers. No further exploration needed.
