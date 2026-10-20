#!/usr/bin/env bash
set -euo pipefail

export CONVEX_AGENT_MODE="${CONVEX_AGENT_MODE:-anonymous}"
export CONVEX_ALLOW_ANONYMOUS=true
# Never select or modify a developer/cloud deployment when running tests.
unset CONVEX_DEPLOYMENT CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT_TOKEN
unset CONVEX_SELF_HOSTED_URL CONVEX_SELF_HOSTED_ADMIN_KEY
export SITE_URL="${SITE_URL:-http://localhost:3011}"
export TRUSTED_ORIGINS="${TRUSTED_ORIGINS:-http://localhost:3011,http://127.0.0.1:3011}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-e2e-better-auth-secret-at-least-32-chars}"

convex_env_file="$(mktemp)"
convex_log_file="$(mktemp)"
selection_env_file="$(mktemp)"
env_local_backup="$(mktemp)"
env_local_had_file=0
convex_pid=""
next_pid=""

cleanup() {
  if [[ -n "$next_pid" ]]; then
    kill "$next_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$convex_pid" ]]; then
    kill "$convex_pid" >/dev/null 2>&1 || true
  fi
  if [[ "$env_local_had_file" = 1 ]]; then
    cp "$env_local_backup" .env.local
  else
    rm -f .env.local
  fi
  rm -f "$convex_env_file" "$convex_log_file" "$selection_env_file" "$env_local_backup"
}

trap cleanup EXIT TERM INT

if [[ -f .env.local ]]; then
  cp .env.local "$env_local_backup"
  env_local_had_file=1
fi
printf 'CONVEX_DEPLOYMENT=anonymous-agent\n' > "$selection_env_file"

{
  printf 'SITE_URL=%s\n' "$SITE_URL"
  printf 'TRUSTED_ORIGINS=%s\n' "$TRUSTED_ORIGINS"
  printf 'BETTER_AUTH_SECRET=%s\n' "$BETTER_AUTH_SECRET"
} >"$convex_env_file"

pnpm convex dev --env-file "$selection_env_file" --local-cloud-port 3212 --local-site-port 3213 >"$convex_log_file" 2>&1 &
convex_pid="$!"

for _ in $(seq 1 120); do
  if grep -q "Convex functions ready" "$convex_log_file"; then break; fi
  if ! kill -0 "$convex_pid" >/dev/null 2>&1; then
    printf 'Convex dev exited before becoming ready.\n'
    cat "$convex_log_file"
    exit 1
  fi
  sleep 1
done

if ! grep -q "Convex functions ready" "$convex_log_file"; then
  cat "$convex_log_file"
  printf 'Timed out waiting for the isolated Convex backend.\n' >&2
  exit 1
fi

deployment_name="$(curl -fsS http://127.0.0.1:3212/instance_name)"
CONVEX_DEPLOYMENT="$deployment_name" pnpm convex env set --from-file "$convex_env_file" --force
export NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3212
export NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3213

cat "$convex_log_file"
pnpm dev &
next_pid="$!"
wait "$next_pid"
