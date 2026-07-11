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

// 1. Change the release build type's signingConfig from debug to release
// Do this BEFORE inserting the new signingConfigs.release block so the regex
// only finds the ONE 'release {' with 'signingConfigs.debug' in the file.
const debugSigningInRelease = /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
if (!debugSigningInRelease.test(content)) {
  console.error(
    '[patch-android-signing] Could not find signingConfig signingConfigs.debug in release block',
  );
  process.exit(1);
}

content = content.replace(debugSigningInRelease, '$1signingConfig signingConfigs.release');

// 2. Add a release signing config entry inside the signingConfigs block
// Indentation matches generated build.gradle (4-space base)
const RELEASE_SIGNING =
  '\n        release {' +
  '\n            storeFile file("${projectRoot}/sonora-production-keystore.jks")' +
  "\n            storePassword System.getenv('KEYSTORE_PASSWORD')" +
  "\n            keyAlias System.getenv('KEY_ALIAS')" +
  "\n            keyPassword System.getenv('KEY_PASSWORD')" +
  '\n        }';

// Find signingConfigs block and its matching closing brace
const signingConfigsStart = content.match(/signingConfigs\s*\{/);
if (!signingConfigsStart) {
  console.error('[patch-android-signing] Could not find signingConfigs block in build.gradle');
  process.exit(1);
}

// Count braces to find the matching closing } of signingConfigs
const blockStart = signingConfigsStart.index + signingConfigsStart[0].length - 1; // position of {
let depth = 1;
let pos = blockStart + 1;
while (depth > 0 && pos < content.length) {
  if (content[pos] === '{') depth++;
  if (content[pos] === '}') depth--;
  pos++;
}
// pos is now past the closing } of signingConfigs
// Insert release signing config before that closing }
const insertPos = pos - 1; // position of signingConfigs closing }
content =
  content.substring(0, insertPos) + RELEASE_SIGNING + '\n    ' + content.substring(insertPos);

fs.writeFileSync(BUILD_GRADLE, content);
console.log(
  '[patch-android-signing] ✓ Patched android/app/build.gradle with release signing config',
);
