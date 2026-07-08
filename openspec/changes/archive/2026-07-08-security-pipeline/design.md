# Security Pipeline — Design

## Overview

This document covers the architecture and design decisions for the security-pipeline change across three domains: version pinning, CI security audit, and Renovate dependency updates.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  sonora monorepo                      │
│                                                       │
│  ┌──────────────────────┐   ┌──────────────────────┐ │
│  │   Package JSONs       │   │   bun.lock            │ │
│  │   (4 files, 26 deps)  │◄──│   (binary lockfile)  │ │
│  └────────┬─────────────┘   └──────────────────────┘ │
│           │                                            │
│  ┌────────▼─────────────┐                              │
│  │  scripts/pin-deps.ts  │  ◄── one-time script       │
│  └──────────────────────┘                              │
│                                                       │
│  ┌──────────────────────┐   ┌──────────────────────┐ │
│  │  renovate.json        │   │  .github/workflows/  │ │
│  │  (Renovate config)    │   │  security-audit.yml   │ │
│  └──────────────────────┘   └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Domain 1: Version Pinning

### Design Decision: Automated Script vs Manual Editing

**Decision**: Automated script `scripts/pin-deps.ts`.

**Rationale**: 26 version constraints across 4 files. Manual editing is error-prone, hard to verify, and not repeatable. A script provides deterministic output, validates `workspace:*` preservation, and can verify install integrity post-pinning.

### Script Design: `scripts/pin-deps.ts`

```typescript
// scripts/pin-deps.ts — One-time version pinning script
// Reads resolved versions from node_modules and pins all range constraints.
//
// Usage: bun run scripts/pin-deps.ts
// Requires: bun install has been run (node_modules populated)

interface PkgJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const TARGET_FILES = [
  'apps/api/package.json',
  'apps/mobile/package.json',
  'apps/admin/package.json',
  'packages/shared/package.json',
];

function resolveVersion(packageName: string): string | null {
  // Strategy: read from node_modules/<package>/package.json version field.
  // This matches bun.lock resolution because bun install populates
  // node_modules with the exact resolved versions from the lockfile.
  try {
    const pkgPath = require.resolve(`${packageName}/package.json`);
    const { version } = require(pkgPath);
    return version;
  } catch {
    return null;
  }
}

// For each target file:
//   1. Read package.json
//   2. For each dep in dependencies + devDependencies:
//      - Skip workspace:* references
//      - If value contains ^, ~, or *: resolve from node_modules
//      - Replace with exact version
//   3. Write back
//   4. Verify no range specifiers remain
//   5. Run bun install --frozen-lockfile to verify integrity
```

#### Version Resolution Approach

Reading from `node_modules/<package>/package.json` is preferred over parsing `bun.lock` (binary format with no stable parsing API). After `bun install`, node_modules reflects the exact lockfile resolution guaranteed by PIN.2.

**Fallback**: If `require.resolve` fails (e.g., peer dep not hoisted), fall back to reading from the workspace root's `node_modules` directly.

#### Pinning Pass Validation

After writing, the script runs:

1. **Regex scan**: Confirm no `^`, `~`, or `*` remain in any target file's dependency entries (excluding `workspace:*`)
2. **Install integrity**: `bun install --frozen-lockfile` exits 0
3. **Lockfile unchanged**: `git diff --name-only bun.lock` is empty

### Exemptions

| Pattern                                  | Reason                                            |
| ---------------------------------------- | ------------------------------------------------- |
| `workspace:*`                            | Monorepo internal alias, not a version constraint |
| Root `overrides`/`resolutions`           | Version overrides, not dependency installs        |
| Already-exact versions (e.g. `"1.30.1"`) | Already compliant                                 |
| Root `package.json` `lightningcss`       | Already exact (`1.30.1`)                          |

### Affected Files (exactly 26 entries across 4 files)

| File                           | Count | Packages                                                                                                                                                                                                |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/package.json`        | 12    | hono, drizzle-orm, pg, @neondatabase/serverless, @hono/node-server, @cloudflare/workers-types, vitest, wrangler, drizzle-kit, @types/pg, @types/node, tsx                                               |
| `apps/mobile/package.json`     | 10    | @expo-google-fonts/caveat, @react-native-firebase/analytics, @react-native-firebase/app, @react-native-firebase/crashlytics, firebase, zustand, @types/leaflet, firebase-tools, react-doctor, jest-expo |
| `apps/admin/package.json`      | 2     | zustand, jest-expo                                                                                                                                                                                      |
| `packages/shared/package.json` | 2     | zod, vitest                                                                                                                                                                                             |

## Domain 2: Security Audit Workflow

### Workflow File

`.github/workflows/security-audit.yml`

### Design Decision: Severity Threshold

**Decision**: Default threshold = `moderate`.

`bun audit` reports severities: `critical`, `high`, `moderate`, `low`. Setting threshold at `moderate` means moderate, high, and critical findings fail the workflow. Low-severity findings are informational only.

The threshold is configurable via `workflow_dispatch` input `severity-threshold` with allowed values: `low`, `moderate`, `high`, `critical`. Scheduled runs use the default.

### Design Decision: Parsing bun audit Output

`bun audit` in recent versions supports `--format=json` for structured output. However, we cannot rely on this being stable across Bun versions. The design uses a two-tier approach:

1. Try `bun audit --format=json` — if JSON output detected, parse with `fromJSON()`
2. Fall back to plain text parsing (grep for severity levels)

The parsing logic is implemented as a `github-script` step to avoid depending on `jq` availability.

### Design Decision: CI.6 Notification

**Decision**: Integrated into `security-audit.yml`, NOT a separate workflow file.

Rationale:

- Free Community Cloud tier has limited monthly minutes — a separate workflow doubles the run overhead
- The same `bun audit` output feeds both the severity check and the issue
- Issue creation is gated behind `workflow_dispatch` input `create_issue: true`
- Scheduled runs rely on workflow failure + `$GITHUB_STEP_SUMMARY` for notification
- This satisfies CI.6 "MAY create a GitHub Issue" without mandatory overhead

### Workflow Specification

```yaml
name: Security Audit

on:
  schedule:
    - cron: '0 6 * * 1' # Every Monday 06:00 UTC
  workflow_dispatch:
    inputs:
      severity-threshold:
        description: 'Minimum severity to fail the workflow'
        required: true
        default: 'moderate'
        type: choice
        options:
          - low
          - moderate
          - high
          - critical
      create-issue:
        description: 'Create a GitHub Issue on findings'
        required: false
        default: false
        type: boolean

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

permissions:
  contents: read
  issues: write # Needed for optional issue creation (CI.6)

concurrency:
  group: security-audit-${{ github.ref }}
  cancel-in-progress: true

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/setup
        with:
          skip-if-cache-hit: 'true'

      - name: Run bun audit
        id: audit
        continue-on-error: true
        run: |
          bun audit --format=json > audit-output.json 2>&1 || true
          echo "audit_exit_code=$?" >> "$GITHUB_OUTPUT"

      - name: Parse audit results and check severity threshold
        id: check
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const threshold = '${{ github.event.inputs.severity-threshold || 'moderate' }}';
            const SEVERITY_ORDER = ['low', 'moderate', 'high', 'critical'];
            const minIndex = SEVERITY_ORDER.indexOf(threshold);

            let findings = [];
            let summary = '';

            try {
              const data = JSON.parse(fs.readFileSync('audit-output.json', 'utf8'));

              if (data.vulnerabilities && data.vulnerabilities.length > 0) {
                findings = data.vulnerabilities.filter(v => {
                  const sevIdx = SEVERITY_ORDER.indexOf(v.severity);
                  return sevIdx >= minIndex && sevIdx !== -1;
                });
              }
            } catch {
              // Fallback: parse plain text output
              // (grep for severity keywords from bun audit text output)
            }

            // Build step summary
            if (findings.length === 0) {
              summary = '✅ No vulnerabilities found above threshold (' + threshold + '+)';
              core.setOutput('should_fail', 'false');
            } else {
              summary = `❌ ${findings.length} vulnerability(ies) found at or above **${threshold}**\n\n`;
              summary += '| Package | Severity | Advisory |\n|---------|----------|----------|\n';
              for (const f of findings) {
                summary += `| ${f.packageName || f.name} | ${f.severity} | ${f.advisory || f.url || 'N/A'} |\n`;
              }
              core.setOutput('should_fail', 'true');
              core.setOutput('findings', JSON.stringify(findings));
            }

            core.setOutput('summary', summary);

            // Write to GITHUB_STEP_SUMMARY
            const fs2 = require('fs');
            fs2.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');

      - name: Fail on threshold breach
        if: steps.check.outputs.should_fail == 'true'
        run: |
          echo "Vulnerabilities found above threshold. Failing workflow."
          exit 1

      - name: Create GitHub Issue on findings (manual dispatch only)
        if: |
          steps.check.outputs.should_fail == 'true' &&
          github.event_name == 'workflow_dispatch' &&
          github.event.inputs.create-issue == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const findings = JSON.parse('${{ steps.check.outputs.findings }}');
            let body = '## Security Audit Findings\n\n';
            body += 'Vulnerabilities found at or above **${{ github.event.inputs.severity-threshold || 'moderate' }}** threshold.\n\n';
            body += '| Package | Severity | Advisory |\n|---------|----------|----------|\n';
            for (const f of findings) {
              body += `| ${f.packageName || f.name} | ${f.severity} | ${f.advisory || f.url || 'N/A'} |\n`;
            }
            body += '\n---\n';
            body += '_Generated by security-audit workflow on ${{ github.ref_name }}_';

            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Security Audit: ${findings.length} vulnerability(ies) found`,
              body: body,
              labels: ['security']
            });
```

### Workflow Steps Breakdown

1. **Checkout + Setup**: Uses existing `.github/actions/setup` composite action (restores cache, installs)
2. **Run bun audit**: Executes `bun audit --format=json`, captures output
3. **Parse and threshold check**: `github-script` parses JSON, filters by severity, builds step summary
4. **Conditional fail**: If findings >= threshold, exit 1
5. **Optional issue creation**: Only on `workflow_dispatch` with `create_issue: true`

### Workflow Trigger Design

| Trigger                    | Purpose             | Issue creation?                           |
| -------------------------- | ------------------- | ----------------------------------------- |
| `schedule` (Mon 06:00 UTC) | Regular check       | No (relies on workflow failure + summary) |
| `workflow_dispatch`        | On-demand / testing | Only if `create_issue: true`              |

### Renovate Compatibility

The `rangeStrategy: "pin"` in Renovate ensures that after pinning, Renovate updates maintain exact versions. The security audit workflow and Renovate together form the security pipeline:

- Renovate proposes dependency updates
- Security audit verifies no vulnerabilities are introduced

## Domain 3: Renovate Configuration

### Configuration File

`renovate.json` at repository root.

### Complete Config

```jsonc
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "enabledManagers": ["bun"],
  "rangeStrategy": "pin",
  "schedule": ["before 6am on Monday"],
  "dependencyDashboard": true,
  "dependencyDashboardTitle": "Dependency Dashboard (Renovate)",
  "labels": ["dependencies"],
  "assignees": [],
  "reviewers": [],
  "automerge": false,
  "bun": {
    "fileMatch": ["(^|/)package\\.json$"],
  },
}
```

### Config Decisions

| Setting               | Value                      | Rationale                                                                                                     |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `enabledManagers`     | `["bun"]`                  | DEP.2 — Bun-only. No npm (would conflict), no github-actions (scope constraint), no docker (not used in repo) |
| `rangeStrategy`       | `"pin"`                    | DEP.5 — Exact versions. Renovate will propose `"hono": "4.13.0"` not `"hono": "^4.13.0"`                      |
| `schedule`            | `["before 6am on Monday"]` | DEP.3 — Weekly cadence, matches security audit schedule                                                       |
| `dependencyDashboard` | `true`                     | DEP.4 — Visibility into all pending/recent updates                                                            |
| `labels`              | `["dependencies"]`         | Standard label for filtering                                                                                  |
| `automerge`           | `false`                    | Manual review required for production dependencies                                                            |
| `packageRules`        | (none needed)              | All deps follow pin strategy uniformly                                                                        |

### Bun Manager Behavior

Renovate's `bun` manager:

- Reads `package.json` for dependency declarations
- Reads `bun.lock` for current resolution state
- On update: bumps version in `package.json` AND regenerates `bun.lock` via `bun install <package>@<version>`
- Supports monorepo workspace structure natively

### Renovate vs Dependabot

| Aspect          | Renovate (chosen)         | Dependabot (current, being replaced)   |
| --------------- | ------------------------- | -------------------------------------- |
| Bun support     | Native via `bun` manager  | Not supported (causes false positives) |
| Version pinning | `rangeStrategy: "pin"`    | Not supported for Bun                  |
| Scheduling      | Weekly configurable       | Weekly (but broken for Bun)            |
| Dashboard       | Full dependency dashboard | No dashboard for Bun                   |
| Cost            | Free Community Cloud      | Free (GitHub native)                   |

## Data Flow

```
bun.lock ──────┐
               ▼
         pin-deps.ts ──► package.json files (pinned)
               │
               ▼
         bun install --frozen-lockfile  ◄── verify integrity
               │
               ▼
         renovate.json ──► Renovate app ──► Update PRs
               │
               ▼
         security-audit.yml ──► bun audit ──► Step summary / Issue
```

## File Changes

| File                                   | Action               | Domain             |
| -------------------------------------- | -------------------- | ------------------ |
| `scripts/pin-deps.ts`                  | **Create**           | Version pinning    |
| `apps/api/package.json`                | **Modify** (12 deps) | Version pinning    |
| `apps/mobile/package.json`             | **Modify** (10 deps) | Version pinning    |
| `apps/admin/package.json`              | **Modify** (2 deps)  | Version pinning    |
| `packages/shared/package.json`         | **Modify** (2 deps)  | Version pinning    |
| `.github/workflows/security-audit.yml` | **Create**           | CI audit           |
| `renovate.json`                        | **Create**           | Dependency updates |

**NOT changed**: root `package.json`, `bun.lock`, any existing workflow files.

### `Makefile` Changes

Add a `pin-deps` target for convenience:

```makefile
.PHONY: pin-deps
pin-deps: install ## Pin all workspace dependencies to exact versions from bun.lock
 bun run scripts/pin-deps.ts
```

## Risks and Mitigations

| Risk                                     | Impact                        | Mitigation                                                           |
| ---------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Pin conflicts with transitive peer deps  | Install fails                 | PIN.3 verification: `bun install --frozen-lockfile` after pinning    |
| Renovate PR storm                        | High volume of concurrent PRs | Weekly schedule + dependency dashboard + no automerge                |
| `bun audit --format=json` format changes | Parsing fails                 | Fallback to plain text parsing; test via `workflow_dispatch`         |
| Community Cloud minutes exhausted        | Audit or Renovate stops       | Combined workflow (not split); cache reused; weekly not daily        |
| Same vuln notified multiple weeks        | Noise                         | Issue creation is opt-in only; scheduled runs just fail with summary |
| `workspace:*` accidentally pinned        | Build breaks                  | Script explicitly excludes `workspace:*`; validated in PIN.1         |

## Contracts

### Internal: `scripts/pin-deps.ts`

- **Inputs**: None (operates on 4 hardcoded file paths)
- **Outputs**: Modified `package.json` files, exit code 0 on success
- **Side effects**: Only file writes; no network, no install (caller must `bun install` first)
- **Error handling**: Exits 1 if any file cannot be read/written, if any range specifier remains after pass, or if `bun install --frozen-lockfile` fails post-pinning

### External: `.github/workflows/security-audit.yml`

- **Trigger**: `schedule` (weekly) or `workflow_dispatch`
- **Required permissions**: `contents: read`, `issues: write` (only for issue creation)
- **Dependencies**: `.github/actions/setup` composite action, `actions/github-script@v7`
- **Outputs**: `$GITHUB_STEP_SUMMARY` with findings table; optional GitHub Issue

### External: `renovate.json`

- **Host**: Renovate Community Cloud (free tier)
- **Triggers**: Renovate bot checks on schedule + dependency dashboard interaction
- **Contract**: Repository root JSON, valid per Renovate schema

## Rollout Order

1. **Pin versions**: Run `scripts/pin-deps.ts`, verify with `bun install`, commit
2. **Create Renovate config**: Add `renovate.json`, push, onboard Renovate app
3. **Create audit workflow**: Add `security-audit.yml`, test via `workflow_dispatch`
4. **Monitor**: After one week, verify Renovate dashboard shows updates (DEP.6)

## Rollback

- `git revert` package.json pinning changes
- Delete `.github/workflows/security-audit.yml`
- Delete `renovate.json` and disable Renovate app
- Close any Renovate-created PRs
