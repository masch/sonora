#!/bin/sh
# Regression tests for scripts/load-env.sh. Run with: sh scripts/__tests__/load-env.test.sh
#
# The helper is the only thing standing between a secret and a recipe line, `make -n` output or
# a `make -p` dump, so its contract is pinned here: ambient wins, the file is only a fallback, a
# missing file is not an error, a genuinely missing key fails closed, and quoted values survive.
#
# Every call uses `set -- <file> <keys>...` before sourcing, never `. loader <file> <keys>`:
# dash, which is /bin/sh on every GitHub runner, silently drops the arguments of a sourced file.
set -u
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

loader="$root/scripts/load-env.sh"
missing="$tmp/missing"

# A fixture file, not an environment path: a real one must never be read by a test.
fixture="$tmp/fixture.txt"
printf '%s\n' 'PLAIN=hello world' 'DQUOTED="a&b c$d"' "SQUOTED='x&y \$z\`w\`'" 'HASHED=val#tail' 'EMPTY=' >"$fixture"

fail=0
check() {
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1: got [$2] want [$3]"
    fail=1
  fi
}

export loader missing fixture

# A missing file is legitimate (CI has none): ambient values still work.
out=$(DATABASE_URL=ambient sh -c '. "$loader"' 2>/dev/null; true)
out=$(DATABASE_URL=ambient sh -c 'set -- "$missing" DATABASE_URL=DATABASE_URL_STAGING; . "$loader"; printf %s "$DATABASE_URL"' 2>&1)
check "missing file + ambient key succeeds" "$out" ambient

err=$(sh -c 'set -- "$missing" NOPE; . "$loader"' 2>&1)
rc=$?
check "missing file + missing key exits 1" "$rc" 1
case "$err" in
  *"resolved to no usable value"*) check "missing file + missing key explains why" yes yes ;;
  *) check "missing file + missing key explains why" no yes ;;
esac

sh -c 'set -- "$fixture" NOSUCH; . "$loader"' >"$tmp/out" 2>&1
check "missing key exits 1" "$?" 1
check "missing key prints no value" "$(grep -c '=' "$tmp/out")" 0

check "ambient wins over the file" \
  "$(AMBIENT_KEEP=fromenv sh -c 'set -- "$fixture" AMBIENT_KEEP=PLAIN; . "$loader"; printf %s "$AMBIENT_KEEP"')" \
  fromenv

check "plain value with spaces" \
  "$(sh -c 'set -- "$fixture" PLAIN; . "$loader"; printf %s "$PLAIN"')" \
  "hello world"

check "double quotes stripped, & and \$ kept" \
  "$(sh -c 'set -- "$fixture" DQUOTED; . "$loader"; printf %s "$DQUOTED"')" \
  'a&b c$d'

check "single quotes stripped, backticks kept" \
  "$(sh -c 'set -- "$fixture" SQUOTED; . "$loader"; printf %s "$SQUOTED"')" \
  'x&y $z`w`'

check "inline # kept" \
  "$(sh -c 'set -- "$fixture" HASHED; . "$loader"; printf %s "$HASHED"')" \
  'val#tail'

sh -c 'set -- "$fixture" EMPTY; . "$loader"' >/dev/null 2>&1
check "empty value refuses" "$?" 1

check "KEY=SOURCE_KEY remaps the name" \
  "$(sh -c 'set -- "$fixture" TARGET=PLAIN; . "$loader"; printf %s "$TARGET"')" \
  "hello world"

# Optional entries (?KEY) never fail: a recipe with its own prompt or skip branch depends on it.
check "optional key absent everywhere is not fatal" \
  "$(sh -c 'set -- "$missing" ?NOTHERE; . "$loader"; echo $?')" \
  0

check "optional key still loads from the file" \
  "$(sh -c 'set -- "$fixture" ?PLAIN; . "$loader"; printf %s "$PLAIN"')" \
  "hello world"

check "optional key stays unset when absent" \
  "$(sh -c 'set -- "$fixture" ?NOTHERE; . "$loader"; printf %s "${NOTHERE:-unset}"')" \
  unset

check "optional key still respects ambient" \
  "$(AMBIENT_KEEP=fromenv sh -c 'set -- "$fixture" ?AMBIENT_KEEP=PLAIN; . "$loader"; printf %s "$AMBIENT_KEEP"')" \
  fromenv

# `DATABASE_URL_STAGING=... make api-db-migrate-staging` and its command-line form were valid
# before this helper existed, so the renamed SOURCE is read from the environment too.
check "exported SOURCE key is honoured with no file" \
  "$(DATABASE_URL_STAGING=env-url sh -c 'set -- "$missing" DATABASE_URL=DATABASE_URL_STAGING; . "$loader"; printf %s "$DATABASE_URL"')" \
  env-url

check "an ambient target beats an ambient source" \
  "$(DATABASE_URL=target-url DATABASE_URL_STAGING=source-url sh -c 'set -- "$missing" DATABASE_URL=DATABASE_URL_STAGING; . "$loader"; printf %s "$DATABASE_URL"')" \
  target-url

staging="$tmp/staging.txt"
printf '%s\n' 'DATABASE_URL_STAGING="file-url"' 'LEAD=abc"' >"$staging"
export staging

check "an ambient source beats the file" \
  "$(DATABASE_URL_STAGING=source-url sh -c 'set -- "$staging" DATABASE_URL=DATABASE_URL_STAGING; . "$loader"; printf %s "$DATABASE_URL"')" \
  source-url

# An exported-but-empty value is a deliberate answer, not an absence: falling through to the file
# would silently point a destructive recipe at a different database than the caller named.
DATABASE_URL= sh -c 'set -- "$staging" DATABASE_URL=DATABASE_URL_STAGING; . "$loader"' >"$tmp/emptyamb" 2>&1
check "an empty ambient value refuses instead of using the file" "$?" 1
check "and it never reveals the file value" "$(grep -c 'file-url' "$tmp/emptyamb")" 0

check "unbalanced quotes are not trimmed" \
  "$(sh -c 'set -- "$staging" LEAD; . "$loader"; printf %s "$LEAD"')" \
  'abc"'

sh -c 'set -- "$fixture" "A.B"; . "$loader"' >"$tmp/badkey" 2>&1
check "a key that is not an identifier is refused" "$?" 1

exit $fail
