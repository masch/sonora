# Tasks: Google Play Store Publishing Integration

- [x] Add `play_track` and `enable_firebase` inputs to `.github/workflows/deploy-mobile-android-production.yml`.
- [x] Add condition `if: ${{ inputs.enable_firebase == true }}` to `deploy-firebase` job in workflow.
- [x] Add `deploy-play-store` job to `.github/workflows/deploy-mobile-android-production.yml`.
- [x] Verify GitHub Actions workflow syntax using action-lint or yaml validation.
