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
# with the value of SOURCE_KEY read from that file". Prefix an entry with `?` to make it optional:
# `. load-env.sh .env ?DATABASE_URL ?BACKUP_ENCRYPTION_KEY` never fails on a missing key and
# leaves it unset, which is what a recipe with its own interactive fallback needs. A required
# entry with no value in either source aborts the recipe with exit 1. A key already present in
# the environment wins, so a CI-injected secret is never shadowed by a developer's .env. No value
# is ever printed.
#
# Values are exported single-quoted, so $, backticks, spaces and & survive verbatim.

load_env_file="${1:?load-env.sh: the .env path is required}"
shift

# A missing file is not an error: CI checkouts have no apps/api/.env and every key arrives in
# the environment. The file is only an optional fallback, so a key is missing only when neither
# source has it. This keeps the CI workflows working while still failing closed on a real gap.
load_env_file_present=0
if [ -f "$load_env_file" ]; then
  load_env_file_present=1
fi

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

  eval "load_env_current=\${${load_env_target}:-}"
  if [ -n "$load_env_current" ]; then
    continue
  fi

  if [ "$load_env_file_present" -eq 0 ]; then
    if [ "$load_env_required" -eq 0 ]; then
      continue
    fi
    echo "load-env.sh: ${load_env_source} is not in the environment and ${load_env_file} does not exist" >&2
    exit 1
  fi

  load_env_value="$(sed -n "s/^${load_env_source}=//p" "$load_env_file" | head -n 1)"
  load_env_value="${load_env_value%\"}"
  load_env_value="${load_env_value#\"}"
  load_env_value="${load_env_value%\'}"
  load_env_value="${load_env_value#\'}"

  if [ -z "$load_env_value" ]; then
    if [ "$load_env_required" -eq 0 ]; then
      continue
    fi
    echo "load-env.sh: ${load_env_source} is missing from ${load_env_file} and from the environment" >&2
    exit 1
  fi

  load_env_escaped="$(printf '%s' "$load_env_value" | sed "s/'/'\\\\''/g")"
  eval "export ${load_env_target}='${load_env_escaped}'"
done

unset load_env_file load_env_file_present load_env_pair load_env_required load_env_target load_env_source load_env_current load_env_value load_env_escaped
