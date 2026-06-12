# Tasks: Android CI versionCode Auto-increment

## Review Workload Forecast

- Decision needed before apply: No
- Chained PRs recommended: No
- 400-line budget risk: Low

## Tasks

### Phase 1: Implementation

- [x] 1.1 **Update deploy.yml permissions**
      Configure job-level write permissions in `.github/workflows/deploy.yml` by adding:
  ```yaml
  permissions:
    contents: write
  ```
- [x] 1.2 **Add Commit and Push steps**
      Add steps in `.github/workflows/deploy.yml` after building the APK to configure Git user, stage `app.config.ts`, commit with `[skip ci]`, and push back to `main`.

### Phase 2: Verification

- [x] 2.1 **Syntax and Validation check**
      Run `make check` to ensure yaml parsing and formatting are valid.
- [x] 2.2 **Review Changes**
      Review git diff to ensure changes match the spec and minimum permissions rules.
