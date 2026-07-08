# Delta for CI/CD Integrations

## ADDED Requirements

### Requirement: CI.5 — Security Audit Workflow

The system MUST provide a scheduled security audit workflow at `.github/workflows/security-audit.yml` that scans the monorepo for known vulnerabilities using `bun audit`.

#### Scenario: Weekly scheduled run

- GIVEN the current time is Monday 06:00 UTC
- WHEN the cron trigger fires (`schedule: - cron: '0 6 * * 1'`)
- THEN the security-audit workflow MUST execute automatically

#### Scenario: Manual dispatch trigger

- GIVEN a maintainer with write access to the repository
- WHEN they navigate to Actions → Security Audit → "Run workflow"
- THEN the workflow MUST execute on demand via `workflow_dispatch`

#### Scenario: Audit scans entire monorepo

- GIVEN the workflow is triggered
- WHEN it executes
- THEN it MUST run `bun audit` at the repository root to scan all workspace packages

#### Scenario: Vulnerability threshold enforcement

- GIVEN one or more vulnerabilities are found with severity above the configured threshold
- WHEN the `bun audit` step completes
- THEN the workflow MUST fail to alert the team

#### Scenario: Clean audit passes

- GIVEN no vulnerabilities are found above the configured threshold
- WHEN the `bun audit` step completes
- THEN the workflow MUST pass (exit code 0)
- AND the workflow MUST report zero findings

#### Scenario: Workflow summary posted

- GIVEN the `bun audit` step completes
- WHEN the workflow finishes
- THEN the results MUST be posted as a workflow summary via `$GITHUB_STEP_SUMMARY`
- AND the summary MUST include count of findings (or "no vulnerabilities found"), their severity levels, and affected package names

### Requirement: CI.6 — Security Notification (Optional)

The security audit workflow MAY create a GitHub Issue automatically when vulnerabilities are detected above the threshold. This MAY be implemented as a separate `.github/workflows/security-notify.yml` or integrated directly into the audit workflow.

#### Scenario: Issue created on findings

- GIVEN `bun audit` finds vulnerabilities above the configured threshold
- WHEN the workflow completes
- THEN a GitHub Issue MAY be created with the audit findings
- AND the issue SHOULD include the `security` label
- AND the issue SHOULD include the vulnerability details: severity, affected package, and remediation version

#### Scenario: No issue on clean audit

- GIVEN `bun audit` finds no vulnerabilities above the threshold
- WHEN the workflow completes
- THEN no GitHub Issue MUST be created
