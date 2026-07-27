# Design: README Refresh

**Change**: `readme-refresh`
**Based on**: proposal

## Approach

### Edit strategy

- **Inline replacements** — every section is updated in-place. No new sections added, no sections removed.
- **Single file edit** — only `README.md` is modified.
- **Section order preserved** — the current flow of the README stays: header → env links → prerequisites → setup → dev → Makefile → validation → project structure → API → version check → platform → deps.

### Specific decisions

| Decision                 | Choice                                | Rationale                              |
| ------------------------ | ------------------------------------- | -------------------------------------- |
| Project structure format | Tree with descriptions                | Easier to scan than flat bullet list   |
| API path references      | All `api/` → `apps/api/`              | Reflects actual filesystem layout      |
| Makefile table           | Complete dump from `make help` output | Single source of truth, no manual sync |
| Validation pipeline      | Match `.githooks/pre-commit` exactly  | Users need to know what actually runs  |
| GGA install mention      | Keep as `bun install -g gga`          | Still the correct install command      |

### Risk

- **Table maintenance**: Makefile targets table will drift again when new targets are added. Mitigation: document in the README that the table is generated from `make help`.
