# Proposal: Pin Exact Dependency Versions

## Intent

Resolve security warnings regarding variant dependency versions in `package.json` by pinning all packages to their exact, resolved versions. This mitigates risks associated with dependency hijacking and confusion attacks.

## Scope

### In Scope

- Pin all dependencies in `package.json` to their exact resolved versions.
- Pin all devDependencies in `package.json` to their exact resolved versions.

### Not in Scope

- Upgrading packages to newer major or minor versions.
- Changing runtime logic or codebase components.

## Affected Areas

- [package.json](file:///home/masch/dev/js/sonora/package.json)

## Verification Plan

- Run `npx tsc --noEmit` to verify type safety.
- Run `npx jest --watchAll=false` to verify test suite passing.
- Run SecureCoder `/scan` to ensure variant version warnings are resolved.
