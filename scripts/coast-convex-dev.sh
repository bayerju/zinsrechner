#!/usr/bin/env bash
set -euo pipefail

cd /workspace

mkdir -p node_modules
flock -w 600 node_modules/.coast-install.lock pnpm install --frozen-lockfile

unset CONVEX_DEPLOYMENT
unset CONVEX_DEPLOYMENT_TOKEN
unset CONVEX_DEPLOY_KEY
unset CONVEX_SELF_HOSTED_URL
unset CONVEX_SELF_HOSTED_ADMIN_KEY
unset NEXT_PUBLIC_CONVEX_URL
unset NEXT_PUBLIC_CONVEX_SITE_URL

web_dynamic="${WEB_DYNAMIC_PORT:-3011}"
convex_env_file="$(mktemp)"
auth_env_file="$(mktemp)"
instance_name_file="$(mktemp)"
env_local_backup="$(mktemp)"
env_local_had_file=0
convex_pid=""

cleanup() {
  if [ -n "$convex_pid" ]; then
    kill "$convex_pid" >/dev/null 2>&1 || true
  fi
  if [ "$env_local_had_file" = "1" ]; then
    cp "$env_local_backup" .env.local
  else
    rm -f .env.local
  fi
  rm -f "$convex_env_file" "$auth_env_file" "$instance_name_file" "$env_local_backup"
}

trap cleanup EXIT TERM INT

if [ -f .env.local ]; then
  cp .env.local "$env_local_backup"
  env_local_had_file=1
fi

printf 'CONVEX_DEPLOYMENT=anonymous-agent\n' > "$convex_env_file"

{
  printf 'SITE_URL=http://localhost:%s\n' "$web_dynamic"
  printf 'TRUSTED_ORIGINS=http://localhost:%s,http://127.0.0.1:%s,http://localhost:3011,http://127.0.0.1:3011\n' "$web_dynamic" "$web_dynamic"
  printf 'BETTER_AUTH_SECRET=%s\n' "${BETTER_AUTH_SECRET:-coast-better-auth-secret-at-least-32-chars}"
} > "$auth_env_file"

pnpm convex dev --env-file "$convex_env_file" --local-cloud-port 3212 --local-site-port 3213 --tail-logs always &
convex_pid="$!"

for _ in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:3212/instance_name > "$instance_name_file"; then
    break
  fi
  if ! kill -0 "$convex_pid" >/dev/null 2>&1; then
    wait "$convex_pid"
    exit $?
  fi
  sleep 1
done

if [ ! -s "$instance_name_file" ]; then
  echo "Convex local backend did not become ready on port 3212." >&2
  exit 1
fi

deployment_name="$(cat "$instance_name_file")"
CONVEX_DEPLOYMENT="$deployment_name" pnpm convex env set --from-file "$auth_env_file" --force

if [ "$env_local_had_file" = "1" ]; then
  cp "$env_local_backup" .env.local
else
  rm -f .env.local
fi

wait "$convex_pid"
