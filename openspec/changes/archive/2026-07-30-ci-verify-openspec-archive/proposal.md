# Proposal: CI Verification for OpenSpec Archived Status

## Change Name

`ci-verify-openspec-archive`

## Goal

Automate CI checks in `ci-pr.yml` to verify that all completed OpenSpec changes in `openspec/changes/` have been properly moved to `openspec/archived/`.

## Why

In `gentle-ai` SDD workflows, once a spec change's tasks are completed and verified, it must be archived in `openspec/archived/`. Adding an automated verification step to PR CI prevents unarchived completed changes from dangling in `openspec/changes/`.

## Scope

- Create verification script in `scripts/verify-openspec-archived.ts`
- Add Makefile target `make verify-openspec`
- Add CI step to `.github/workflows/ci-pr.yml`
