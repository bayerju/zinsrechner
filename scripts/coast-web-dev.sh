#!/usr/bin/env bash
set -euo pipefail

cd /workspace

mkdir -p node_modules
flock -w 600 node_modules/.coast-install.lock pnpm install --frozen-lockfile

forward_pids=()
next_pid=""

cleanup() {
  for pid in "${forward_pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  if [ -n "$next_pid" ]; then
    kill "$next_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT TERM INT

start_loopback_forward() {
  local listen_port="$1"
  local target_host="$2"
  local target_port="$3"

  if [ "$listen_port" != "$target_port" ]; then
    socat "TCP-LISTEN:$listen_port,bind=127.0.0.1,fork,reuseaddr" "TCP:$target_host:$target_port" &
    forward_pids+=("$!")
  fi
}

start_loopback_forward "${CONVEX_CLOUD_DYNAMIC_PORT:-3212}" convex 3212
start_loopback_forward "${CONVEX_SITE_DYNAMIC_PORT:-3213}" convex 3213

export DATABASE_URL="${DATABASE_URL:?DATABASE_URL must be set in .env}"
export NEXT_PUBLIC_CONVEX_URL="http://localhost:${CONVEX_CLOUD_DYNAMIC_PORT:-3212}"
export NEXT_PUBLIC_CONVEX_SITE_URL="http://localhost:${CONVEX_SITE_DYNAMIC_PORT:-3213}"
export SITE_URL="http://localhost:${WEB_DYNAMIC_PORT:-3011}"
export TRUSTED_ORIGINS="http://localhost:${WEB_DYNAMIC_PORT:-3011},http://127.0.0.1:${WEB_DYNAMIC_PORT:-3011},http://localhost:3011,http://127.0.0.1:3011"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-coast-better-auth-secret-at-least-32-chars}"

pnpm exec next dev --turbo -p 3011 --hostname 0.0.0.0 &
next_pid="$!"
wait "$next_pid"
