#!/usr/bin/env node
/**
 * Patches the generated android/app/build.gradle to add release signing config.
 *
 * After `expo prebuild --platform android`, the native project is generated
 * with a debug-only keystore in the signing config. This script injects a
 * release signing config that reads keystore credentials from environment
 * variables (set in CI).
 *
 * Usage: node scripts/patch-android-signing.js
 *
 * Env vars:
 *   KEYSTORE_PASSWORD - keystore password
 *   KEY_ALIAS         - key alias
 *   KEY_PASSWORD      - key password
 */

const fs = require('fs');
const path = require('path');

const BUILD_GRADLE = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (!fs.existsSync(BUILD_GRADLE)) {
  console.error(`[patch-android-signing] build.gradle not found at ${BUILD_GRADLE}`);
  console.error('[patch-android-signing] Did you run expo prebuild first?');
  process.exit(1);
}

let content = fs.readFileSync(BUILD_GRADLE, 'utf8');

// 1. Add a release signing config entry inside the signingConfigs block
const RELEASE_SIGNING = `
        release {
            storeFile file("\${projectRoot}/sonora-production-keystore.jks")
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }
`;

const signingConfigsMatch = content.match(/signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\}\s*\}/);
if (!signingConfigsMatch) {
  console.error(
    '[patch-android-signing] Could not find signingConfigs.debug block in build.gradle',
  );
  process.exit(1);
}

// Insert release signing config right after the closing } of signingConfigs,
// before the closing } of the enclosing block
content = content.replace(signingConfigsMatch[0], signingConfigsMatch[0] + RELEASE_SIGNING);

// 2. Change the release build type's signingConfig from debug to release
const debugSigningInRelease = /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
if (!debugSigningInRelease.test(content)) {
  console.error(
    '[patch-android-signing] Could not find signingConfig signingConfigs.debug in release block',
  );
  process.exit(1);
}

content = content.replace(
  debugSigningInRelease,
  (_, before) => before + 'signingConfig signingConfigs.release',
);

fs.writeFileSync(BUILD_GRADLE, content);
console.log(
  '[patch-android-signing] ✓ Patched android/app/build.gradle with release signing config',
);
