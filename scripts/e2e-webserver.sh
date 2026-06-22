#!/usr/bin/env bash
set -euo pipefail

export CONVEX_AGENT_MODE="${CONVEX_AGENT_MODE:-anonymous}"
export DATABASE_URL="${DATABASE_URL:-file:./db.sqlite}"
export SITE_URL="${SITE_URL:-http://localhost:3010}"
export TRUSTED_ORIGINS="${TRUSTED_ORIGINS:-http://localhost:3010,http://127.0.0.1:3010}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-e2e-better-auth-secret-at-least-32-chars}"

convex_env_file="$(mktemp)"
convex_log_file="$(mktemp)"
convex_pid=""
next_pid=""

cleanup() {
  if [[ -n "$next_pid" ]]; then
    kill "$next_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$convex_pid" ]]; then
    kill "$convex_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$convex_env_file" "$convex_log_file"
}

trap cleanup EXIT TERM INT

{
  printf 'SITE_URL=%s\n' "$SITE_URL"
  printf 'TRUSTED_ORIGINS=%s\n' "$TRUSTED_ORIGINS"
  printf 'BETTER_AUTH_SECRET=%s\n' "$BETTER_AUTH_SECRET"
} >"$convex_env_file"

pnpm convex deployment select local >/dev/null 2>&1 || pnpm convex deployment create local --select
pnpm convex env set --deployment local --from-file "$convex_env_file" --force

pnpm convex dev >"$convex_log_file" 2>&1 &
convex_pid="$!"

while ! grep -q "Convex functions ready" "$convex_log_file"; do
  if ! kill -0 "$convex_pid" >/dev/null 2>&1; then
    printf 'Convex dev exited before becoming ready.\n'
    cat "$convex_log_file"
    exit 1
  fi
  sleep 1
done

cat "$convex_log_file"
pnpm dev &
next_pid="$!"
wait "$next_pid"
