# Auto-increment and commit Android versionCode in CI

Enable GitHub Actions CI to auto-increment `versionCode` in `app.config.ts`, commit the change, and push it back to the `main` branch to track version increments automatically.

## User Review Required

> [!IMPORTANT]
> This approach requires that the GitHub repository settings allow GitHub Actions to write to the repository. Specifically, in the repository settings:
>
> 1. Go to **Settings** > **Actions** > **General**.
> 2. Under **Workflow permissions**, select **Read and write permissions**.
> 3. Check **Allow GitHub Actions to create and approve pull requests**.

> [!WARNING]
> Since the CI commits back to `main`, developers must pull the latest changes before starting local work to avoid merge conflicts on `app.config.ts`.

## Proposed Changes

### CI/CD Workflow

#### [MODIFY] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

- Update workflow permissions to include `contents: write`.
- Add steps to configure git, commit the modified `app.config.ts` after running the build, and push it back to the `main` branch.
- Use `[skip ci]` in the commit message to prevent recursive workflow runs.

---

### Build Automation

#### [MODIFY] [Makefile](file:///home/masch/dev/js/sonora/Makefile)

- Ensure the `bump-version-code` script/target is run before the Android build in the CI steps.

---

## Verification Plan

### Automated Tests

- No automated tests apply to this CI/CD change, but we will run `make check` to ensure we didn't break formatting or syntax.

### Manual Verification

1. Trigger a run of the "Deploy App" workflow (or push a commit to `main`).
2. Verify that the workflow successfully builds the APK, bumps the version code (e.g., from `6` to `7`), commits the changes to `app.config.ts`, and pushes back to `main`.
3. Verify that the commit message includes `[skip ci]` and does not trigger an infinite loop of workflow builds.
4. Verify the new versionCode is distributed to Firebase App Distribution.
