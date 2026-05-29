# Design: Add make gga target

## Technical Approach

Single file change to `Makefile`: rename the `validate` target to `validate-static` (preserving its deps and section), add a `gga` target under a new "Review" section between CI and Maintenance, then add a new `validate` target that depends on both `validate-static` and `gga`. All targets remain `.PHONY`. Help comments updated for all three targets.

## Architecture Decisions

### Decision: PATH-based `gga` invocation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Full path `/home/masch/.local/bin/gga` | Brittle across machines | ❌ Rejected |
| PATH lookup `gga run` | Portable, standard make pattern | ✅ Chosen |

**Rationale**: Makefiles conventionally rely on PATH resolution for commands. A hard-coded absolute path breaks on any other machine and violates the principle of least surprise.

### Decision: `validate-static` as the static-only gate

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep `validate` and add `gga` as separate | No upgrade path for CI scripts | ❌ Rejected |
| Rename to `validate-static` + new `validate` | Explicit naming, preserves CI contract | ✅ Chosen |

**Rationale**: The proposal explicitly requires that `validate` remains the default CI gate. By making `validate-static` the static-check subset, scripts that want only static checks have a clear target, while `validate` continues to mean "the full gate."

### Decision: New "Review" section (not part of CI)

**Rationale**: GGA is a pre-review tool, not a CI step. Keeping concerns separated — CI (static checks), Review (AI review), Maintenance (clean/reset/help) — follows the existing section convention and makes the purpose of each section self-documenting.

## Data Flow

```
make validate
    ├── validate-static (test → lint → typecheck)  ── all static, zero cost to skip
    └── gga (gga run)                                ── reviews staged files via GGA
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `Makefile` | Modify | Rename `validate` → `validate-static`, add `gga` target, add combined `validate`, add "Review" section |

## Target Behavior

| Target | Dependencies | Command | Section |
|--------|-------------|---------|---------|
| `validate-static` | test, lint, typecheck | — | CI |
| `gga` | — | `gga run` | Review |
| `validate` | validate-static, gga | — | CI |

## Execution Order

```
validate
  └→ validate-static (test → lint → typecheck) — all pass
  └→ gga (gga run)                              — must pass
```

## Error Handling

- **gga not in PATH**: Make exits with `make: gga: No such file or directory` — clear, standard shell error.
- **gga exits non-zero**: Make propagates the failure and halts (standard make semantics — any dependency failure stops the target).
- **Static checks fail**: `validate-static` fails before `gga` runs (Make evaluates left-to-right deps), so GGA only runs when static checks pass.

## Dependencies

None. Single file change, no new packages, no config changes, no external service dependency at the Make level.

## Testing Strategy

Not applicable — no code to test. Verification is by inspection and `make` dry run.

## Migration / Rollout

No migration required. Existing `make validate` callers automatically get the new behavior (static + GGA). CI pipelines using `make validate` will now also run GGA — if that's undesirable, update CI to `make validate-static` instead.

## Open Questions

None.
