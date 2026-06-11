# Walkthrough - GH Actions Android Firebase Distribution

I have updated the GitHub Actions deploy workflow to distribute the compiled Android APK to Firebase App Distribution.

## Changes

### CI/CD Configuration

#### [MODIFY] [deploy.yml](file:///home/masch/dev/js/sonora/.github/workflows/deploy.yml)

Modified `.github/workflows/deploy.yml` with the following:

- **Firebase Distribution**: Added a step running `make firebase-distribute-all` which distributes the compiled APK to the `dev-team` and `sonora-team` tester groups. It uses `FIREBASE_TOKEN` exposed from GitHub repository secrets.

## Verification Results

### Automated Tests

- Checked workflow syntax and verified git diff.
