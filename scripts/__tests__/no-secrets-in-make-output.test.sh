#!/bin/sh
# Regression tests for "a cloud secret never reaches make output".
# Run with: sh scripts/__tests__/no-secrets-in-make-output.test.sh
#
# Make echoes recipes, prints them under `make -n` and dumps them under `make -p`, and a
# `VAR=value cmd` recipe assignment is visible through ps. The Makefile therefore reads secrets
# through scripts/load-env.sh and only ever references the variable name. These checks pin that
# contract from the outside: whatever a recipe would print must be shell-valid and secret-free.
#
# Only `make -n` and `make -pn` are used. Nothing here connects to a database, cloud API, podman,
# wrangler or psql, and no real .env file is ever opened.
set -u

root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
makefile="$root/Makefile"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail=0
pass() { echo "ok   $1"; }
fault() { echo "FAIL $1: $2"; fail=1; }

# The one documented, not-secret database URL recipes are allowed to print.
dev_url='postgres://sonora:sonora@localhost:5432/sonora'

# A URL carrying credentials: `postgres://user:password@host`.
credentialled_url='postgres(ql)?://[^ ]*:[^ ]*@'
# A literal bearer credential. `$ADMIN_API_KEY` cannot match: `$` is not a credential character,
# so the recipes must reference the variable rather than inlining a token.
bearer_literal='Bearer [A-Za-z0-9_.~+/=-]{8,}'

converted_targets='
db-migrate-staging
db-migrate-production
api-upload-audio-staging
api-upload-audio-production
api-create-coupon-staging
api-create-coupon-production
api-db-migrate-staging
api-db-migrate-production
api-db-seed-ci
api-db-seed-ci-staging
api-db-seed-staging
api-db-seed-production
api-db-backup
api-db-restore
api-db-shell-staging
api-db-shell-production
'

# The mobile CLI targets read their token the same way, so their recipes must stay printable and
# secret-free under `make -n` too.
mobile_cli_targets='
socket-login
socket-scan
eas-whoami
eas-list
eas-init
eas-build-android
eas-build-android-preview
eas-build-android-local
eas-build-android-preview-local
eas-build-android-preview-ci
eas-build-android-aab-ci
eas-build-ios-simulator-ci
eas-build-ios-device-ci
eas-upload-apk
eas-build-web-production
eas-build-web-staging
eas-build-admin-production
eas-build-admin-staging
firebase-login-ci
firebase-distribute
'

# Synthetic canaries: a recipe that expanded a credential into its text would print one of these
# names, which `make -n` must never do. Without them the audit could not tell "no leak" from "the
# variable was simply unset", so an expansion that exposes a real value for an operator would pass.
canary_names='DATABASE_URL_STAGING DATABASE_URL_PRODUCTION ADMIN_API_KEY BACKUP_ENCRYPTION_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID EXPO_TOKEN FIREBASE_TOKEN SOCKET_SECURITY_API_KEY SOCKET_CLI_ORG_SLUG'
for name in $canary_names; do
  eval "CANARY_$name=\"canary-value-of-$name\""
  eval "export CANARY_$name"
done

for target in $converted_targets $mobile_cli_targets; do
  env \
    DATABASE_URL_STAGING="$CANARY_DATABASE_URL_STAGING" \
    DATABASE_URL_PRODUCTION="$CANARY_DATABASE_URL_PRODUCTION" \
    ADMIN_API_KEY="$CANARY_ADMIN_API_KEY" \
    BACKUP_ENCRYPTION_KEY="$CANARY_BACKUP_ENCRYPTION_KEY" \
    CLOUDFLARE_API_TOKEN="$CANARY_CLOUDFLARE_API_TOKEN" \
    CLOUDFLARE_ACCOUNT_ID="$CANARY_CLOUDFLARE_ACCOUNT_ID" \
    EXPO_TOKEN="$CANARY_EXPO_TOKEN" \
    FIREBASE_TOKEN="$CANARY_FIREBASE_TOKEN" \
    SOCKET_SECURITY_API_KEY="$CANARY_SOCKET_SECURITY_API_KEY" \
    SOCKET_CLI_ORG_SLUG="$CANARY_SOCKET_CLI_ORG_SLUG" \
    make -C "$root" -n "$target" >"$tmp/recipe" 2>"$tmp/stderr"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    pass "make -n $target exits 0"
  else
    fault "make -n $target exits 0" "exit $rc, first stderr line differs"
  fi

  if sh -n "$tmp/recipe" 2>"$tmp/syntax"; then
    pass "make -n $target is valid shell"
  else
    fault "make -n $target is valid shell" "sh -n rejected the rendered recipe"
  fi

  # Any canary that reached the recipe text is a credential expansion, whatever its real value is.
  leaked_canary=''
  for name in $canary_names; do
    eval "value=\$CANARY_$name"
    if grep -Fq -- "$value" "$tmp/recipe"; then
      leaked_canary="$name"
      break
    fi
  done
  if [ -z "$leaked_canary" ]; then
    pass "make -n $target expands no credential canary"
  else
    fault "make -n $target expands no credential canary" "$leaked_canary reached the recipe text"
  fi

  # Strip the local dev URL, then any postgres URL left behind is a cloud one. The value itself is
  # never interpolated into the message: a test that guards leaks must not print the leak.
  sed "s|$dev_url||g" "$tmp/recipe" >"$tmp/recipe.redacted"
  if ! grep -Eq "$credentialled_url" "$tmp/recipe.redacted"; then
    pass "make -n $target prints no cloud database URL"
  else
    fault "make -n $target prints no cloud database URL" "a credentialled database URL reached the recipe text"
  fi

  if ! grep -Eq "$bearer_literal" "$tmp/recipe"; then
    pass "make -n $target prints no literal bearer token"
  else
    fault "make -n $target prints no literal bearer token" "a literal bearer token reached the recipe text"
  fi
done

# The whole variable database, not just the sixteen converted recipes.
make -C "$root" -pn >"$tmp/database" 2>/dev/null
sed "s|$dev_url||g" "$tmp/database" >"$tmp/database.redacted"
if ! grep -Eq "$credentialled_url" "$tmp/database.redacted"; then
  pass "make -pn prints no cloud database URL"
else
  fault "make -pn prints no cloud database URL" "a credentialled database URL reached the variable database"
fi

# The mobile tokens are read by the sourced helper inside the recipe shell, never by Make: a Make
# variable would be printed by `make -p`, quoted by `make -d` and expanded into the recipe text.
# The dump is taken with those four names removed from the environment, so only what the Makefile
# itself defines is inspected. A definition is anchored at the start of a line, which the recipe
# lines that legitimately name one of them (they are tab-indented) never are.
env -u EXPO_TOKEN -u FIREBASE_TOKEN -u SOCKET_SECURITY_API_KEY -u SOCKET_CLI_ORG_SLUG \
  make -C "$root" -pn >"$tmp/database.no-mobile-tokens" 2>/dev/null

for mobile_var in EXPO_TOKEN FIREBASE_TOKEN SOCKET_SECURITY_API_KEY SOCKET_CLI_ORG_SLUG; do
  if grep -Eq "^${mobile_var}[[:space:]]*[:+?!]?=" "$tmp/database.no-mobile-tokens"; then
    fault "make -pn defines no $mobile_var variable" "found a $mobile_var definition"
  else
    pass "make -pn defines no $mobile_var variable"
  fi
done

# No `*_CLEAN` holding a cloud secret: a Make variable is part of the recipe text and of the
# `make -p` dump, so the staging/production URLs and the admin key must never have one.
for cloud_var in DATABASE_URL_STAGING_CLEAN DATABASE_URL_PRODUCTION_CLEAN ADMIN_API_KEY_CLEAN; do
  if grep -Fq -- "$cloud_var" "$makefile"; then
    fault "Makefile defines no $cloud_var" "found $cloud_var"
  else
    pass "Makefile defines no $cloud_var"
  fi
done

# apps/api/.env is read by the sourced helper inside the recipe shell, never included by Make.
if grep -Fq -- '-include apps/api/.env' "$makefile"; then
  fault "Makefile does not include apps/api/.env" "found '-include apps/api/.env'"
else
  pass "Makefile does not include apps/api/.env"
fi

# apps/mobile/.env is read by the sourced helper too, never included by Make.
if grep -Fq -- '-include apps/mobile/.env' "$makefile"; then
  fault "Makefile does not include apps/mobile/.env" "found '-include apps/mobile/.env'"
else
  pass "Makefile does not include apps/mobile/.env"
fi

# Every recipe line that drives a credentialled CLI sources the helper first. Make runs each recipe
# line in its own shell, so the prefix has to sit on the line that launches the CLI: a token
# exported on an earlier line of the same recipe never reaches it. Each entry pairs the marker the
# launching line carries, the prefix it must then also carry, and the label the check reports.
tab=$(printf '\t')
awk -v tab="$tab" '
  /^[[:alnum:]_.-]+:/ { target = $0; sub(/:.*/, "", target); next }
  index($0, tab) == 1 { if (target != "") printf "%s\t%s\n", target, substr($0, 2); next }
  { target = "" }
' "$makefile" >"$tmp/recipe-lines"

cli_prefix_check() {
  matched=$(awk -F "$tab" -v marker="$1" 'index($2, marker) { print $1 }' "$tmp/recipe-lines" |
    sort -u | wc -l | tr -d ' ')
  unprefixed=$(awk -F "$tab" -v marker="$1" -v prefix="$2" '
    index($2, marker) && substr($2, 1, length(prefix)) != prefix { print $1 }
  ' "$tmp/recipe-lines" | sort -u | tr '\n' ' ')

  if [ "$matched" -eq 0 ]; then
    fault "$3" "no recipe line invokes $1; the check would pass vacuously"
  elif [ -z "$unprefixed" ]; then
    pass "$3"
  else
    fault "$3" "not prefixed: $unprefixed"
  fi
}

cli_prefix_check 'bunx eas-cli@' '$(LOAD_EXPO)' 'every bunx eas-cli@ line starts with $(LOAD_EXPO)'
cli_prefix_check 'firebase-cli' '$(LOAD_FIREBASE)' 'every Firebase CLI line starts with $(LOAD_FIREBASE)'
cli_prefix_check 'bunx socket' '$(LOAD_SOCKET)' 'every bunx socket line starts with $(LOAD_SOCKET)'

# The prefix must sit at the start of the launching command: a prefix moved behind the CLI, or
# placed after an earlier command, is not a prefix. Synthetic recipe lines, so the Makefile is
# never touched.
tab=$(printf '\t')
printf '%s\n%s\n%s\n' \
  "t1${tab}bunx eas-cli@1 whoami; \$(LOAD_EXPO)" \
  "t2${tab}true; \$(LOAD_EXPO) bunx eas-cli@1 whoami" \
  "t3${tab}\$(LOAD_EXPO) bunx eas-cli@1 whoami" >"$tmp/prefix-samples"
anchored=$(awk -F "$tab" -v prefix='$(LOAD_EXPO)' \
  'index($2, "bunx eas-cli@") && substr($2, 1, length(prefix)) != prefix { print $1 }' \
  "$tmp/prefix-samples" | tr '\n' ' ')
if [ "$anchored" = 't1 t2 ' ]; then
  pass "the CLI prefix check rejects a prefix that is not first"
else
  fault "the CLI prefix check rejects a prefix that is not first" "misclassified samples: [$anchored]"
fi

# The CI seed entry must forward SEED_ENV empty-preserving: the base entry fails closed on an
# empty SEED_ENV but allows an absent one, so `-` (keep unset as empty) is the only correct form.
seed_ci_recipe=$(awk '
  /^api-db-seed-ci:/ { grab = 1; next }
  grab && /^\t/ { print; next }
  grab { exit }
' "$makefile")

if printf '%s\n' "$seed_ci_recipe" | grep -Fq -- 'SEED_ENV="$${SEED_ENV-}"'; then
  pass "api-db-seed-ci forwards SEED_ENV empty-preserving"
else
  fault "api-db-seed-ci forwards SEED_ENV empty-preserving" "recipe lacks SEED_ENV=\"\$\${SEED_ENV-}\""
fi

if grep -Fq -- 'SEED_ENV:-staging' "$makefile"; then
  fault "no recipe substitutes SEED_ENV with a default" "found SEED_ENV:-staging"
else
  pass "no recipe substitutes SEED_ENV with a default"
fi

# The helper reads its arguments from the shell's positional parameters, set by `set --`.
# `. loader <file> <keys>` works in bash and silently drops the arguments in dash, which is
# /bin/sh on every GitHub runner: that is what broke a deploy in CI once.
if grep -Eq '\.\s+([.][.]/)*\$\(LOAD_ENV\)\s+[^;&[:space:]]' "$makefile"; then
  fault "every loader call passes its arguments with set --" "found the . loader <args> form"
else
  pass "every loader call passes its arguments with set --"
fi

# Every spelling of the old call: a literal path (`. path/to/load-env.sh <args>`) and a variable
# (`. "$loader" <args>` or `. $(LOADER) <args>`). grep sees text, not expansions, so the variable
# form can only be caught by its own spelling. Anchored on the repository root so the check cannot
# pass vacuously from another directory.
legacy_call='\.\s+"?((\$[{A-Za-z_][A-Za-z0-9_]*|\$\([A-Za-z_][A-Za-z0-9_]*\)|[^;[:space:]]*load-env\.sh))"?\s+[^;&[:space:]]'
if grep -Ev '^[[:space:]]*#' "$root"/scripts/__tests__/*.sh | grep -Eq "$legacy_call"; then
  fault "the suites themselves use the portable call form" "found . loader <file> <keys>"
else
  pass "the suites themselves use the portable call form"
fi

# The check is only worth its message while it still bites, so each legacy spelling is exercised
# here. They are assembled at runtime so this file never contains an example of the form it forbids.
for legacy in \
  "$(printf '%s "%s" "%s" PLAIN' '.' '$loader' '$fixture')" \
  "$(printf '%s %s %s PLAIN' '.' 'scripts/load-env.sh' '"$fixture"')" \
  "$(printf '%s $(%s) %s' '.' 'LOADER' 'x')"
do
  if printf '%s\n' "$legacy" | grep -Eq "$legacy_call"; then
    pass "the portable call check still detects [$legacy]"
  else
    fault "the portable call check still detects [$legacy]" "no match"
  fi
done

# A CI staging run has no apps/api/.env: the ambient secret must win and must not be masked.
ambient=$(DATABASE_URL=ambient-ci-url sh -c \
  "set -- /nonexistent/file DATABASE_URL=DATABASE_URL_STAGING; . '$root/scripts/load-env.sh'; printf %s \"\$DATABASE_URL\"" 2>&1)
rc=$?
if [ "$rc" -eq 0 ] && [ "$ambient" = 'ambient-ci-url' ]; then
  pass "missing .env keeps the ambient DATABASE_URL"
else
  fault "missing .env keeps the ambient DATABASE_URL" "exit $rc, value [$ambient]"
fi

( cd "$root" || exit 1
  env -u DATABASE_URL sh -c 'set -- /nonexistent/file DATABASE_URL=DATABASE_URL_STAGING; . scripts/load-env.sh' \
    >"$tmp/absent.out" 2>"$tmp/absent.err" )
rc=$?
if [ "$rc" -eq 1 ]; then
  pass "missing .env and no ambient secret exits 1"
else
  fault "missing .env and no ambient secret exits 1" "exit $rc"
fi

if [ -s "$tmp/absent.out" ]; then
  fault "missing secret failure prints no value" "stdout: $(head -n 1 "$tmp/absent.out")"
else
  pass "missing secret failure prints no value"
fi

exit $fail
