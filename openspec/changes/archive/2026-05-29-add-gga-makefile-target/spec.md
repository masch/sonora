# Delta Spec: Add make gga target

## Requirements

### REQ-1: Rename validate to validate-static
- rename current `.PHONY: validate` target to `validate-static`
- same dependencies: `test lint typecheck`
- help: `Run CI gate without GGA (test → lint → typecheck)`
- stays in `# ── CI ──` section

### REQ-2: Add gga target
- new `.PHONY: gga` target
- command: `gga run`
- help: `Run GGA (Gentleman Guardian Angel) code review`
- place in new `# ── Review ──` section between CI and Maintenance

### REQ-3: New validate target
- new `.PHONY: validate` target
- depends on `validate-static` and `gga`
- help: `Run full CI gate with GGA review (test → lint → typecheck → gga)`
- place in `# ── CI ──` section

### REQ-4: Help text consistency
- all new/changed targets MUST use `##` self-documenting format
- `help` target MUST continue to work without changes

## Scenarios

### SCENARIO-1: Quick validation (static checks only)
- GIVEN a developer wants fast feedback without AI review
- WHEN they run `make validate-static`
- THEN test → lint → typecheck execute
- AND GGA is NOT invoked

### SCENARIO-2: Full CI gate with AI review
- GIVEN a developer wants the complete CI gate
- WHEN they run `make validate`
- THEN test → lint → typecheck → gga run execute sequentially

### SCENARIO-3: Standalone AI review
- GIVEN a developer wants only AI code review
- WHEN they run `make gga`
- THEN `gga run` executes on staged changes

### SCENARIO-4: Help discovers new targets
- GIVEN any developer
- WHEN they run `make help`
- THEN `validate-static`, `gga`, and `validate` appear in the sorted target list
- AND each target shows its updated `##` help text

## Constraints
- ALL targets MUST be `.PHONY`
- `gga` command MUST resolve via PATH (not hardcoded path)
- No changes to `.gga` configuration or GGA installation
- NO changes to any other files
