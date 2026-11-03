#!/usr/bin/env bash
set -euo pipefail
terralink_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$terralink_root"
mkdir -p .runtime
if [[ -f .runtime/terralink.pid ]] && kill -0 "$(cat .runtime/terralink.pid)" 2>/dev/null; then
  printf 'TerraLink is already running (PID %s).\n' "$(cat .runtime/terralink.pid)"
  exit 0
fi
terralink_host="${TERRALINK_HOST:-127.0.0.1}"
terralink_port="${TERRALINK_PORT:-4174}"
terralink_mode="${TERRALINK_MODE:-dev}"
if [[ "$terralink_mode" != dev && "$terralink_mode" != start ]]; then
  printf 'TERRALINK_MODE must be dev or start.\n' >&2
  exit 1
fi
setsid node node_modules/next/dist/bin/next "$terralink_mode" --hostname "$terralink_host" --port "$terralink_port" >.runtime/terralink.log 2>&1 < /dev/null &
terralink_pid=$!
printf '%s\n' "$terralink_pid" >.runtime/terralink.pid
printf 'TerraLink started: PID %s, http://%s:%s, log %s/.runtime/terralink.log\n' "$terralink_pid" "$terralink_host" "$terralink_port" "$terralink_root"
