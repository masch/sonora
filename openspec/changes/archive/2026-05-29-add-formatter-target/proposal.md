# Proposal: Add Formatter Target

## Intent

Add Prettier code formatter to enforce consistent code style across the Sonora codebase, exposing it via a Makefile target.

## Scope

### In Scope

- Install `prettier` as a devDependency in `package.json`.
- Add a `.prettierrc` configuration file with standard formatting rules.
- Add a `.prettierignore` file to prevent formatting of builds, temporary folders, and lockfiles.
- Add `"format"` script in `package.json` to execute Prettier.
- Add the `.PHONY: format` target in the root [Makefile](file:///home/masch/dev/js/sonora/Makefile).
- Update the `"formatter"` key in [openspec/config.yaml](file:///home/masch/dev/js/sonora/openspec/config.yaml) to run `make format`.

### Not in Scope

- Modifying ESLint rules or mixing formatting with linting logic.
- Rewriting code logic.

## Affected Areas

- [package.json](file:///home/masch/dev/js/sonora/package.json)
- [Makefile](file:///home/masch/dev/js/sonora/Makefile)
- [openspec/config.yaml](file:///home/masch/dev/js/sonora/openspec/config.yaml)
- [NEW] [.prettierrc](file:///home/masch/dev/js/sonora/.prettierrc)
- [NEW] [.prettierignore](file:///home/masch/dev/js/sonora/.prettierignore)

## Verification Plan

- Run `make format` to verify files are successfully formatted.
- Run `make validate-static` (which runs `test`, `lint`, and `typecheck`) to ensure the codebase remains clean and valid.
