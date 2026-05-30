# Pull Request Description

## Title
`feat: add prettier formatter target and integrate with static validation`

## Body
```markdown
## Goal
This PR adds Prettier formatting target and configurations to the project, formats the codebase, and integrates code style checking into the static validation pipeline.

## Proposed Changes
1. **Prettier DevDependency**: Installed `"prettier": "3.8.3"` under `devDependencies` in `package.json`.
2. **Formatting Configurations**:
   - Created `.prettierrc` defining formatting rules.
   - Created `.prettierignore` to exclude node_modules, build outputs, etc.
3. **Scripts & Targets**:
   - Added `"format": "prettier --write ."` and `"format:check": "prettier --check ."` to `package.json`.
   - Created `format` and `format-check` targets in the `Makefile`.
4. **CI Integration**:
   - Integrated `format-check` as the first dependency of the validation pipeline so static validation fails if files are not properly formatted.
   - Redefined `validate` to run formatting automatically before checks (`format test lint typecheck gga`), and `check` to perform strict format verification without mutating files.
5. **OpenSpec Integration**: Updated `formatter` field to `make format` in `openspec/config.yaml`.
6. **Codebase Formatting**: Formatted all existing source files to adhere to Prettier rules.
```
