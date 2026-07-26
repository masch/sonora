# Design: splash-version

## Identifiers

| Field       | Value            |
| ----------- | ---------------- |
| Change name | `splash-version` |
| Status      | implemented      |
| Based on    | proposal, spec   |

## Architecture Overview

Four independent change points:

```
┌────────────────────────────────────────────────────┐
│  CI/CD (2 workflows)                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1. Extract semver from tag                  │   │
│  │ 2. Validate semver                          │   │
│  │ 3. Output version-name                      │   │
│  │ 4. Pass APP_VERSION_NAME to build           │   │
│  └──────────┬──────────────────────────────────┘   │
│             ↓ APP_VERSION_NAME env var              │
│  ┌─────────────────────────────────────────────┐   │
│  │ app.config.ts (build-time guard)            │   │
│  │ → throw if APP_VERSION_NAME missing          │   │
│  │ → set version field                          │   │
│  └──────────────────────────────────────────────┘   │
│             ↓ bundled into native app               │
│  ┌─────────────────────────────────────────────┐   │
│  │ animated-icon.tsx (runtime render)           │   │
│  │ → expo-application reads native version      │   │
│  │ → Constants detects prod/staging             │   │
│  │ → renders "1.0.12 (12)"                      │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## 1. CI/CD Workflows

### Extract & Validate Version Name step

Insert after "Calculate Version Code" and before build step. Same in both workflows.

```yaml
- name: Extract & Validate Version Name
  id: version-name
  run: |
    TAG="${{ steps.get-tag.outputs.tag }}"
    VERSION_NAME="${TAG#prod-v}"
    VERSION_NAME="${VERSION_NAME#stg-v}"

    if [ -z "$VERSION_NAME" ]; then
      echo "::error::Empty version extracted from tag '$TAG'"
      exit 1
    fi

    if ! echo "$VERSION_NAME" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
      echo "::error::Invalid semver '$VERSION_NAME' extracted from tag '$TAG'"
      exit 1
    fi

    echo "version-name=$VERSION_NAME" >> "$GITHUB_OUTPUT"
```

Add `APP_VERSION_NAME` to build env:

```yaml
APP_VERSION_NAME: ${{ steps.version-name.outputs.version-name }}
```

## 2. app.config.ts

```typescript
const appVersionName = process.env.APP_VERSION_NAME;
if (!appVersionName) {
  throw new Error(
    'APP_VERSION_NAME environment variable is required. ' +
    'Set it via CI (extracted from git tag) or pass it manually for local builds.'
  );
}

// In ExpoConfig return:
version: appVersionName,
```

## 3. animated-icon.tsx

### Imports

```typescript
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { TwText, TwView } from '@/tw';
```

### Constants

```typescript
const DURATION = 2000;
```

### Component logic

```typescript
const appVersion = Application.nativeApplicationVersion;
const buildNumber = Application.nativeBuildVersion;
const versionText = appVersion && buildNumber ? `${appVersion} (${buildNumber})` : null;

const isProduction = Constants.expoConfig?.extra?.isProduction === true;
const backgroundColor = isProduction ? SPLASH_COLORS.production : SPLASH_COLORS.staging;
```

### Render

```tsx
{
  versionText && (
    <TwText className="absolute self-center bottom-12 text-xs font-semibold text-white tracking-[0.5px]">
      {versionText}
    </TwText>
  );
}
```

## 4. theme.ts

```typescript
export const SPLASH_COLORS = {
  production: '#208AEF',
  staging: '#F59E0B',
} as const;
```

## 5. bundle-size workflow fix

```yaml
- name: Build web export
  env:
    APP_VERSION_NAME: '0.0.0'
  run: |
    cd apps/mobile
    npx expo export --platform web --output-dir /tmp/expo-web-build
```

## Files Summary

| File                                                        | Lines changed | Type                   |
| ----------------------------------------------------------- | ------------- | ---------------------- |
| `.github/workflows/deploy-mobile-android-production.yml`    | ~+15          | CI                     |
| `.github/workflows/deploy-mobile-android-staging.yml`       | ~+15          | CI                     |
| `.github/workflows/ci-bundle-size.yml`                      | ~+2           | CI                     |
| `apps/mobile/app.config.ts`                                 | ~+8, ~-1      | Build config           |
| `apps/mobile/src/components/animated-icon.tsx`              | ~+30, ~-10    | React Native component |
| `apps/mobile/src/constants/theme.ts`                        | ~+5           | Constants              |
| `apps/mobile/src/__tests__/animated-splash-screen.test.tsx` | ~+34          | Tests                  |
| `Makefile`                                                  | ~+1, ~-1      | Build config           |
| `.githooks/pre-commit`                                      | ~+1, ~-7      | Git hook               |

**Total**: ~111 lines added, ~19 removed
