# Design: Android CI versionCode Auto-increment

We will update the `deploy.yml` workflow to grant write permissions and add steps that commit the version code change.

## Workflow Integration Design

1. **Job-Level Permissions**:
   Add `permissions: contents: write` to the `deploy` job in `.github/workflows/deploy.yml` so that the `GITHUB_TOKEN` has write access to the repository.

2. **Commit and Push Steps**:
   After the local build runs (which bumps `app.config.ts` locally via `make`), we will run a step to:
   - Configure Git using the standard GitHub Actions bot credentials.
   - Stage `app.config.ts`.
   - Commit with the message `chore: bump android versionCode [skip ci]` to prevent recursive triggering.
   - Push to `main`.

```mermaid
sequenceDiagram
    participant GitHub as GitHub Actions Runner
    participant Repo as GitHub Repository
    participant Firebase as Firebase App Distribution

    GitHub->>Repo: git checkout
    GitHub->>GitHub: make eas-build-android-preview-local (bumps app.config.ts)
    GitHub->>Firebase: upload APK
    GitHub->>GitHub: git commit -m "chore: bump versionCode [skip ci]"
    GitHub->>Repo: git push to main
```

## Alternatives Considered

- **Dynamic Calculation via Run Number**: Rejected by user preference in favor of maintaining the version code source of truth in `app.config.ts`.
