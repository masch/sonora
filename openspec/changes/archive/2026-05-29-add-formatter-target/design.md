co# Design: Add Formatter Target

## Technical Decisions

### 1. Formatter Tooling & Dependency Configuration

We lock Prettier version `3.8.3` (to match current local environment cache capability) under `devDependencies` in [package.json](file:///home/masch/dev/js/sonora/package.json):

```json
"prettier": "3.8.3"
```

And define the execution script in `package.json`:

```json
"scripts": {
  ...
  "format": "prettier --write ."
}
```

### 2. Configuration Settings (.prettierrc)

Create a new file [.prettierrc](file:///home/masch/dev/js/sonora/.prettierrc) with standard rules compatible with current flat eslint-config-expo rules:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100
}
```

### 3. Ignoring Directories (.prettierignore)

Create [.prettierignore](file:///home/masch/dev/js/sonora/.prettierignore) to prevent unwanted modifications:

```ignore
node_modules
.expo
dist
web-build
coverage
bun.lock
```

### 4. Makefile Target Addition

Add the following target in the `Makefile` under a new or existing section (e.g., right under `lint` or under `Utilities`):

```makefile
.PHONY: format
format: ## Run prettier to format code
	bun run format
```

### 5. OpenSpec Integration

In [openspec/config.yaml](file:///home/masch/dev/js/sonora/openspec/config.yaml), update:

```yaml
formatter: make format
```

## Affected Files

- [package.json](file:///home/masch/dev/js/sonora/package.json)
- [Makefile](file:///home/masch/dev/js/sonora/Makefile)
- [openspec/config.yaml](file:///home/masch/dev/js/sonora/openspec/config.yaml)
- [NEW] [.prettierrc](file:///home/masch/dev/js/sonora/.prettierrc)
- [NEW] [.prettierignore](file:///home/masch/dev/js/sonora/.prettierignore)
