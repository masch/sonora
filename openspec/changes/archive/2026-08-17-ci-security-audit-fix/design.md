# Design: Fix CI Security Audit Vulnerabilities

## Architecture & Implementation Strategy

### 1. Root `package.json` Updates

Add the following to both `overrides` and `resolutions`:

```json
{
  "overrides": {
    "lodash": "4.18.1",
    "sharp": "0.35.3",
    "undici": "7.29.0"
  },
  "resolutions": {
    "lodash": "4.18.1",
    "sharp": "0.35.3",
    "undici": "7.29.0"
  }
}
```

### 2. Workflow Allowlist Architecture (`.github/workflows/security-audit.yml`)

Add an explicit ignore list in the parser script:

```javascript
const IGNORED_ADVISORIES = [
  // No patched version published by maintainers (2.0.2 is latest on npm)
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
];
```

During advisory evaluation:

```javascript
if (IGNORED_ADVISORIES.includes(adv.url)) {
  console.log(`Ignoring allowlisted advisory for ${pkg}: ${adv.url}`);
  continue;
}
```

This guarantees:

1. True vulnerabilities (`lodash`, `sharp`, `undici`) are resolved via package upgrades.
2. Unpatchable upstream build-tool dependencies (`image-size` in Expo/React Native) are explicitly audited and allowlisted with clear rationale rather than disabling audit.
