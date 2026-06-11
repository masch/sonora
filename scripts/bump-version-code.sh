#!/usr/bin/env bash
set -euo pipefail  # -e: exit on error | -u: error on undefined vars | -o pipefail: fail if any command in a pipe fails

APP_CONFIG="app.config.ts"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_CONFIG_PATH="$PROJECT_ROOT/$APP_CONFIG"

if [[ ! -f "$APP_CONFIG_PATH" ]]; then
  echo "Error: $APP_CONFIG not found in project root" >&2
  exit 1
fi

# Read current versionCode or default to 0
CURRENT=$(grep -oP 'versionCode:\s*\K\d+' "$APP_CONFIG_PATH" || echo "0")

# Guard: must be a positive integer
if ! [[ "$CURRENT" =~ ^[0-9]+$ ]]; then
  echo "Error: versionCode value is not a number: $CURRENT" >&2
  exit 1
fi

NEW=$((CURRENT + 1))

# If versionCode line exists, replace it; otherwise insert after "package:"
if grep -q 'versionCode:' "$APP_CONFIG_PATH"; then
  sed -i "s/versionCode:\s*[0-9]\+/versionCode: $NEW/" "$APP_CONFIG_PATH"
else
  sed -i "/^[[:space:]]*package:/a\    versionCode: $NEW," "$APP_CONFIG_PATH"
fi

# Stage the change
git -C "$PROJECT_ROOT" add "$APP_CONFIG"

echo "versionCode bumped: $CURRENT → $NEW"
