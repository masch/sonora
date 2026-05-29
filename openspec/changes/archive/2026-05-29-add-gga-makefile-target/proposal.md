## Proposal: Add make gga target

### Intent

Rename `validate` to `validate-static` and add a `gga` target that runs AI-powered code review. A new `validate` target chains both, giving developers an explicit choice between quick static checks and the full CI gate with GGA review.

### Scope

#### In Scope
- Rename existing `validate` to `validate-static` (same deps: test → lint → typecheck)
- Add new `gga` target running `gga run` (PATH-based)
- Add new `validate` target depending on `validate-static` + `gga`
- Add "Review" section between CI and Maintenance sections
- Update help text for all three targets
- All targets remain `.PHONY`

#### Out of Scope
- Adding GGA to CI pipelines
- Configuring GGA rules or providers
- Wrapping `gga run` with flags or options
- Any other Makefile reorganization

### Approach

One file affected: `Makefile`. Rename the existing `validate` target to `validate-static` with updated help text. Add a `gga` target under a new "Review" section between CI and Maintenance. Add a new `validate` target in the CI section that depends on `validate-static` and `gga`.

### Key Decisions
- Use bare `gga` command (PATH lookup), not the full binary path
- `validate-static` stays pure static checks without GGA (explicit choice)
- New "Review" section keeps concerns separated
- `validate` as the combined gate preserves the default CI contract

### Risks
- Low: `gga` not in PATH during local development — fails with clear "command not found" error (acceptable DX)
- Low: Help output order changes slightly due to alphabetization (grep/awk sort), but the added targets are close in name — negligible

### Ready for Spec

Yes — scope is well-defined, all decisions are made, single file change with no spec-level behavior to capture.
