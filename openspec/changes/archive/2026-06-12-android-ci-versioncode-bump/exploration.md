## Exploration: Android CI versionCode Auto-increment

### Current State

Currently, `app.config.ts` has a hardcoded `versionCode: 6`. When local builds are executed, the `scripts/bump-version-code.sh` script runs via the Makefile `bump-version-code` target. This script edits `app.config.ts` using `sed` to increment the number.
However, in GitHub Actions CI, the runner compiles the build and throws away the virtual machine. Because the modified `app.config.ts` is never committed and pushed back to the GitHub repository, the next CI run starts again with the hardcoded `versionCode: 6` (bumping it to `7` during that run, but again not persisting it). This leads to duplicate version codes for all CI builds distributed to Firebase App Distribution.

### Affected Areas

- `app.config.ts` — needs dynamic resolution of `versionCode`.
- `.github/workflows/deploy.yml` — needs to pass or configure the versionCode increment source.
- `scripts/bump-version-code.sh` — may need modifications to avoid conflicts or handle environment variables.

### Approaches

1. **Auto-commit and Push Back from CI**
   - **Description**: Add git configuration in the CI workflow, commit the changed `app.config.ts` post-bump, and push it back to the `main` branch.
   - **Pros**: The repository remains the single source of truth for the exact build version.
   - **Cons**: Requires write permissions for GitHub Token (`contents: write`), can trigger infinite loop builds (needs `[skip ci]`), and might cause git merge conflicts if a developer pushes code at the same time.
   - Effort: Medium

2. **Environment Variable & GITHUB_RUN_NUMBER Integration**
   - **Description**: Modify `app.config.ts` to read `versionCode` from an environment variable (e.g. `ANDROID_VERSION_CODE`) with a fallback base number (e.g. `6`). In the GitHub Actions CI workflow, inject `ANDROID_VERSION_CODE` computed dynamically: `6 + GITHUB_RUN_NUMBER`.
   - **Pros**: Clean, fast, requires no repository write permissions, and completely avoids git merge conflicts or circular builds.
   - **Cons**: Version code increment in CI isn't tracked in the Git repository file, but is fully tracked in GitHub Action runs and Firebase App Distribution.
   - Effort: Low

### Recommendation

We recommend **Approach 2 (Environment Variable & GITHUB_RUN_NUMBER Integration)**. It is standard practice for CI systems because it is robust, completely conflict-free, and doesn't require modifying/writing back to git from the CI runner.

### Risks

- Local builds must still work correctly. (They will fall back to the base number or continue using the bump script if it sets the env/file value).
- If a developer updates `app.config.ts` manually, the base offset in CI must be aligned.

### Ready for Proposal

Yes
