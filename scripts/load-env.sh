#!/bin/sh
# Load secrets from an .env file into the current shell — never into Make.
#
# Sourced, never executed:
#
#   . scripts/load-env.sh apps/api/.env DATABASE_URL=DATABASE_URL_STAGING ADMIN_API_KEY
#
# Why a sourced helper instead of a Make variable: whatever Make expands into a recipe becomes
# part of the command line. Make echoes recipe lines, prints them under `make -n`, dumps them
# under `make -p`, and the `VAR=value cmd` form keeps the value visible through `ps`. Reading
# the file here confines the secret to the shell and the environment of the child process, where
# only its owner can see it.
#
# Arguments: the .env path, then one or more KEY or KEY=SOURCE_KEY entries, meaning "export KEY
# with the value of SOURCE_KEY". An entry may be prefixed with `?` to make it optional: such a
# key is loaded when available and otherwise left unset without failing, which is what a recipe
# with its own prompt or skip branch needs. A missing required key aborts the recipe with exit 1.
#
# Where a value comes from, in order:
#   1. KEY already in the environment — an ambient variable always wins, so a CI-injected
#      secret is never shadowed by a developer's file;
#   2. SOURCE_KEY in the environment, so `DATABASE_URL_STAGING=... make api-db-migrate-staging`
#      and `make api-db-migrate-staging DATABASE_URL_STAGING=...` keep working exactly as they
#      did when the recipes read the Make variable directly;
#   3. SOURCE_KEY in the file;
#   4. for `?` entries, nothing.
# A missing file is not an error: CI checkouts have none and every key arrives in the
# environment.
#
# Keys must look like shell identifiers, which is checked before use; the value is exported with
# `export NAME=VALUE` and is never re-evaluated, so `$`, backticks, quotes and `&` survive
# verbatim. No value is ever printed.

load_env_file="${1:?load-env.sh: the .env path is required}"
shift

load_env_file_present=0
if [ -f "$load_env_file" ]; then
  load_env_file_present=1
fi

# Strips one symmetric layer of quotes. Asymmetric quotes are left alone rather than trimmed,
# so `KEY=" abc` cannot lose a character of a real secret. Pure parameter expansion: no sed, so
# no pattern ever reaches a regex engine.
strip_quotes() {
  case "$1" in
    \"*\")
      strip_quotes_inner="${1#\"}"
      printf '%s' "${strip_quotes_inner%\"}"
      ;;
    \'*\')
      strip_quotes_inner="${1#\'}"
      printf '%s' "${strip_quotes_inner%\'}"
      ;;
    *)
      printf '%s' "$1"
      ;;
  esac
}

for load_env_pair in "$@"; do
  load_env_required=1
  case "$load_env_pair" in
    \?*)
      load_env_required=0
      load_env_pair="${load_env_pair#\?}"
      ;;
  esac

  load_env_target="${load_env_pair%%=*}"
  load_env_source="${load_env_pair#*=}"

  case "$load_env_target" in
    '' | *[!A-Za-z0-9_]* | [0-9]*)
      echo "load-env.sh: '${load_env_target}' is not a valid variable name" >&2
      exit 1
      ;;
  esac
  case "$load_env_source" in
    '' | *[!A-Za-z0-9_]* | [0-9]*)
      echo "load-env.sh: '${load_env_source}' is not a valid variable name" >&2
      exit 1
      ;;
  esac

  # 1. Ambient target wins.
  eval "load_env_value=\${${load_env_target}:-}"

  # 2. Ambient source, when the entry renames it.
  if [ -z "$load_env_value" ] && [ "$load_env_source" != "$load_env_target" ]; then
    eval "load_env_value=\${${load_env_source}:-}"
  fi

  # 3. The file.
  if [ -z "$load_env_value" ] && [ "$load_env_file_present" -eq 1 ]; then
    load_env_value="$(sed -n "s/^${load_env_source}=//p" "$load_env_file" | head -n 1)"
    load_env_value="$(strip_quotes "$load_env_value")"
  fi

  if [ -z "$load_env_value" ]; then
    if [ "$load_env_required" -eq 0 ]; then
      continue
    fi
    echo "load-env.sh: ${load_env_source} is not in the environment and not in ${load_env_file}" >&2
    exit 1
  fi

  export "$load_env_target=$load_env_value"
done

unset load_env_file load_env_file_present load_env_pair load_env_required load_env_target load_env_source load_env_value
