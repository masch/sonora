#!/bin/sh
# Regression tests for scripts/load-env.sh. Run with: sh scripts/__tests__/load-env.test.sh
#
# The helper is the only thing standing between a secret and a recipe line, `make -n` output or
# a `make -p` dump, so its contract is pinned here: ambient wins, the file is only a fallback, a
# missing file is not an error, a genuinely missing key fails closed, and quoted values survive.
set -u
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# A fixture file, not a .env path: a real .env must never be read by a test.
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

# A missing file is legitimate (CI has no .env): ambient values still work.
out=$(DATABASE_URL=ambient sh -c ". '$root/scripts/load-env.sh' '$tmp/missing' DATABASE_URL=DATABASE_URL_STAGING; printf %s \"\$DATABASE_URL\"" 2>&1)
check "missing file + ambient key succeeds" "$out" ambient

err=$(sh -c ". '$root/scripts/load-env.sh' '$tmp/missing' NOPE" 2>&1)
rc=$?
check "missing file + missing key exits 1" "$rc" 1
case "$err" in
  *"does not exist"*) check "missing file + missing key explains why" yes yes ;;
  *) check "missing file + missing key explains why" no yes ;;
esac

sh -c ". '$root/scripts/load-env.sh' '$fixture' NOSUCH" >"$tmp/out" 2>&1
check "missing key exits 1" "$?" 1
check "missing key prints no value" "$(grep -c '=' "$tmp/out")" 0

check "ambient wins over the file" \
  "$(AMBIENT_KEEP=fromenv sh -c ". '$root/scripts/load-env.sh' '$fixture' AMBIENT_KEEP=PLAIN; printf %s \"\$AMBIENT_KEEP\"")" \
  fromenv

check "plain value with spaces" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' PLAIN; printf %s \"\$PLAIN\"")" \
  "hello world"

check "double quotes stripped, & and \$ kept" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' DQUOTED; printf %s \"\$DQUOTED\"")" \
  'a&b c$d'

check "single quotes stripped, backticks kept" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' SQUOTED; printf %s \"\$SQUOTED\"")" \
  'x&y $z`w`'

check "inline # kept" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' HASHED; printf %s \"\$HASHED\"")" \
  'val#tail'

sh -c ". '$root/scripts/load-env.sh' '$fixture' EMPTY" >/dev/null 2>&1
check "empty value refuses" "$?" 1

# Optional entries (?KEY) never fail: a recipe with its own prompt or skip branch depends on it.
check "optional key absent everywhere is not fatal" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$tmp/missing' ?NOTHERE; echo \$?" 2>&1)" \
  0

check "optional key still loads from the file" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' ?PLAIN; printf %s \"\$PLAIN\"")" \
  "hello world"

check "optional key stays unset when absent" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' ?NOTHERE; printf %s \"\${NOTHERE:-unset}\"")" \
  unset

check "optional key still respects ambient" \
  "$(AMBIENT_KEEP=fromenv sh -c ". '$root/scripts/load-env.sh' '$fixture' ?AMBIENT_KEEP=PLAIN; printf %s \"\$AMBIENT_KEEP\"")" \
  fromenv

check "KEY=SOURCE_KEY remaps the name" \
  "$(sh -c ". '$root/scripts/load-env.sh' '$fixture' TARGET=PLAIN; printf %s \"\$TARGET\"")" \
  "hello world"

exit $fail
