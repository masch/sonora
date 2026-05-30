# Specification: Add Formatter Target

## Requirements

- **R1: Formatter DevDependency**
  Prettier must be added under `devDependencies` in `package.json` to lock down its version.
- **R2: Formatting Configuration**
  A `.prettierrc` file must define the formatting rules (e.g. single quotes, trailing commas, semi-colons, tab width).

- **R3: Formatting Exclusions**
  A `.prettierignore` file must exclude system directories, build outputs, lock files, and node_modules from formatting.

- **R4: Script Integration**
  A `"format"` script must be added to `package.json` to execute prettier write globally across the codebase.

- **R5: Makefile Command**
  A `format` target must be added in the root `Makefile` delegating execution to the package manager (`bun run format`).

- **R6: OpenSpec Integration**
  The `openspec/config.yaml` configuration must have its `"formatter"` field set to `"make format"`.
