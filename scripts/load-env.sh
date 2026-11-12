#!/bin/sh
# Load secrets from an .env file into the current shell — never into Make.
#
# Sourced, never executed. The arguments are the shell's positional parameters, because dash
# (Ubuntu's /bin/sh, and therefore every GitHub runner) does NOT pass arguments to a sourced file:
#
#   set -- apps/api/.env DATABASE_URL=DATABASE_URL_STAGING ADMIN_API_KEY
#   . scripts/load-env.sh
#
# Never write `. scripts/load-env.sh <file> <keys>`: bash accepts it and dash silently drops the
# arguments, which is how this helper once broke a deploy in CI.
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
# with its own prompt or skip branch needs. A missing required key aborts the recipe.
#
# A required key that cannot be resolved calls `exit 1` on purpose: this file is sourced into the
# recipe's own shell, so exiting it is what stops the command that follows from running with an
# empty secret. Returning instead would let the recipe continue.
#
# Where a value comes from, in order:
#   1. KEY in the environment, even when it is empty. An empty value is a deliberate answer, not
#      an absence, so it never falls through to the file and silently points a destructive recipe
#      at a different database;
#   2. SOURCE_KEY in the environment, so `DATABASE_URL_STAGING=... make api-db-migrate-staging`
#      and `make api-db-migrate-staging DATABASE_URL_STAGING=...` keep working exactly as they
#      did when the recipes read the Make variable directly;
#   3. SOURCE_KEY in the file;
#   4. for `?` entries, nothing.
# A missing file is not an error: CI checkouts have none and every key arrives in the environment.
#
# Keys must look like shell identifiers, which is checked before use; the value is exported with
# `export NAME=VALUE` and is never re-evaluated, so `$`, backticks, quotes and `&` survive
# verbatim. No value is ever printed.

# Fail closed with a plain check rather than `${1:?word}`: the word's expansions are evaluated by
# the shell and can abort with an unrelated status, and this message is the one a future caller
# will read when a recipe forgets to set the parameters first.
if [ -z "${1-}" ]; then
  echo "load-env.sh: the positional parameters are empty; pass the environment file and its keys first, with: set -- FILE KEY..." >&2
  exit 1
fi
load_env_file="$1"
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

  load_env_from=''
  load_env_value=''

  # 1. The ambient target, considered present as soon as it is set at all.
  eval "load_env_present=\${${load_env_target}+set}"
  if [ -n "$load_env_present" ]; then
    eval "load_env_value=\${${load_env_target}-}"
    load_env_from=environment
  fi

  # 2. The ambient source, for entries that rename it.
  if [ -z "$load_env_from" ] && [ "$load_env_source" != "$load_env_target" ]; then
    eval "load_env_present=\${${load_env_source}+set}"
    if [ -n "$load_env_present" ]; then
      eval "load_env_value=\${${load_env_source}-}"
      load_env_from=environment
    fi
  fi

  # 3. The file.
  if [ -z "$load_env_from" ] && [ "$load_env_file_present" -eq 1 ]; then
    load_env_value="$(sed -n "s/^${load_env_source}=//p" "$load_env_file" | head -n 1)"
    load_env_value="$(strip_quotes "$load_env_value")"
    load_env_from=file
  fi

  if [ -z "$load_env_value" ]; then
    if [ "$load_env_required" -eq 0 ]; then
      continue
    fi
    echo "load-env.sh: ${load_env_source} resolved to no usable value (environment or ${load_env_file})" >&2
    exit 1
  fi

  export "$load_env_target=$load_env_value"
done

unset load_env_file load_env_file_present load_env_from load_env_pair load_env_present load_env_required load_env_target load_env_source load_env_value strip_quotes_inner
