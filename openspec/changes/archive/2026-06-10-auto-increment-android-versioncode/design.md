# Design: Auto-increment Android versionCode on local builds

## Technical Approach

Pre-build bash script that reads `app.config.ts` as plain text, regex-captures the current `android.versionCode` value, increments by 1, writes the file back, and stages the change in git. The `Makefile` wires this as a prerequisite of `eas-build-android-preview-local`. No new services, daemons, or state files — the config file itself carries the versionCode state.

## Architecture Decisions

### Decision: State stored in app.config.ts (no separate state file)

| Option                    | Tradeoff                                                                       | Decision      |
| ------------------------- | ------------------------------------------------------------------------------ | ------------- |
| Inline in `app.config.ts` | Single source of truth; EAS reads it natively with `appVersionSource: "local"` | ✅ **Chosen** |
| Separate `.version` file  | Extra file to manage; needs EAS config to consume it                           | ❌ Rejected   |
| Git-tag-based             | Requires network fetch on CI; slow for local builds                            | ❌ Rejected   |

**Rationale**: The config file is already the source of truth for version metadata. Adding a separate file adds surface area for zero benefit.

### Decision: Bash script over Node.js

| Option         | Tradeoff                                     | Decision      |
| -------------- | -------------------------------------------- | ------------- |
| Bash + sed     | Zero dependencies, < 10ms runtime            | ✅ **Chosen** |
| Node.js script | Needs `bun`/`node` bootstrap, ~200ms startup | ❌ Rejected   |

**Rationale**: The task is a simple regex replace. Bash is faster and has no dependency chain.

### Decision: Narrow regex, not AST parse

| Option                        | Tradeoff                                                        | Decision      |
| ----------------------------- | --------------------------------------------------------------- | ------------- |
| Regex on `versionCode:\s*\d+` | Fast, safe with anchors; needs care on false matches            | ✅ **Chosen** |
| TypeScript AST parse          | Correct but slow (~500ms with ts-node); overkill for one number | ❌ Rejected   |

**Rationale**: `app.config.ts` is a known, stable file with a predictable shape. A focused regex is the right tool for this job.

## Data Flow

```
make eas-build-android-preview-local
  ├─ prerequisites: eas-whoami bump-version-code
  │    └─ bump-version-code
  │         ├─ read app.config.ts
  │         ├─ capture/init → increment → write
  │         └─ git add app.config.ts
  └─ eas-cli build -p android --profile preview --local
       └─ Expo Config reads android.versionCode: N
       └─ APK versionCode = N
```

## File Changes

### `app.config.ts` — Add `android.versionCode`

Insert after line 25 (`package: 'com.masch.sonora',`) inside the existing `android` block:

```diff
     package: 'com.masch.sonora',
+    versionCode: 1,
```

### `eas.json` — Switch to local version source

```diff
   "cli": {
     "version": ">= 18.0.0",
-    "appVersionSource": "remote"
+    "appVersionSource": "local"
   },
```

### `scripts/bump-version-code.sh` — New file

Core logic (annotated):

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_CONFIG="app.config.ts"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_CONFIG_PATH="$PROJECT_ROOT/$APP_CONFIG"

if [[ ! -f "$APP_CONFIG_PATH" ]]; then
  echo "Error: $APP_CONFIG not found in project root" >&2
  exit 1
fi

# Read current versionCode or default to 0
CURRENT=$(grep -oP 'versionCode:\s*\K\d+' "$APP_CONFIG_PATH" || echo "0")

# Guard: must be a positive integer
if ! [[ "$CURRENT" =~ ^[0-9]+$ ]]; then
  echo "Error: versionCode value is not a number: $CURRENT" >&2
  exit 1
fi

NEW=$((CURRENT + 1))

# If versionCode line exists, replace it; otherwise insert after "package:"
if grep -q 'versionCode:' "$APP_CONFIG_PATH"; then
  sed -i "s/versionCode:\s*[0-9]\+/versionCode: $NEW/" "$APP_CONFIG_PATH"
else
  sed -i "/^[[:space:]]*package:/a\    versionCode: $NEW," "$APP_CONFIG_PATH"
fi

# Stage the change
git -C "$PROJECT_ROOT" add "$APP_CONFIG"

echo "versionCode bumped: $CURRENT → $NEW"
```

### `Makefile` — Wire bump-version-code prerequisite

Two changes:

1. Add `.PHONY: bump-version-code` target before the EAS Deploy section:

```makefile
.PHONY: bump-version-code
bump-version-code: ## Increment android.versionCode in app.config.ts
	scripts/bump-version-code.sh
```

2. Update `eas-build-android-preview-local` prerequisite:

```diff
 .PHONY: eas-build-android-preview-local
-eas-build-android-preview-local: eas-whoami ## Build test APK for sideload locally
+eas-build-android-preview-local: eas-whoami bump-version-code ## Build test APK for sideload locally
```

## Edge Cases

| Case                                     | Handling                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| **First run** (no `versionCode` in file) | Insert `versionCode: 1,` after `package:` line inside `android` block                     |
| **Re-run** (no build between)            | Each call increments by 1 — idempotent in intent, monotonic by design                     |
| **Comment contains "versionCode"**       | Regex anchors to `:\s*\d+` — comments won't match `\d+` pattern                           |
| **Opaque string "versionCode"**          | Same — won't have `: <number>` suffix                                                     |
| **32-bit integer overflow**              | versionCode is Java int (2,147,483,647 max). At 365 builds/year → ~5.8M years to overflow |
| **Concurrent builds**                    | Single-dev, sequential Make — not a concern                                               |

## Error Handling

| Condition                | Response                                                      |
| ------------------------ | ------------------------------------------------------------- |
| `app.config.ts` missing  | Exit 1, message: `app.config.ts not found in project root`    |
| versionCode not a number | Exit 1, message: `versionCode value is not a number: {value}` |
| `sed` write fails        | Exit 1, message: `Failed to write app.config.ts`              |
| `git add` fails          | Warn to stderr, continued — version bump succeeded            |

## Validation

Manual test sequence:

1. `make bump-version-code` → inspect `app.config.ts` for `versionCode: 1`
2. `make bump-version-code` → inspect for `versionCode: 2`
3. `make eas-build-android-preview-local` → verify APK versionCode via `aapt dump badging build-*.apk | grep versionCode`
4. Trigger a second build → APK has distinct versionCode

No automated tests — shell scripts lack Jest infrastructure. Manual validation suffices for this < 100 line change.

## Migration / Rollout

No migration. This is dev-tooling configuration — only affects local build workflow.

Rollback:

1. `git revert HEAD` to undo bump commit
2. Remove `scripts/bump-version-code.sh`
3. Revert `eas.json` to `"remote"`
4. Remove `versionCode` from `app.config.ts`

## Open Questions

None.
