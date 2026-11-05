#!/usr/bin/env bash
set -euo pipefail
terralink_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
terralink_port="${TERRALINK_PORT:-4176}"
if ! [[ "$terralink_port" =~ ^[0-9]+$ ]] || (( 10#$terralink_port < 1 || 10#$terralink_port > 65535 )); then
  printf 'Invalid TERRALINK_PORT.\n' >&2
  exit 1
fi
terralink_runtime="$terralink_root/.runtime/production-$terralink_port"
if [[ ! -f "$terralink_runtime/process.pid" ]]; then
  printf 'No recorded production process for port %s.\n' "$terralink_port"
  exit 0
fi
exec 9>"$terralink_runtime/control.lock"
flock -n 9 || { printf 'Another start/stop operation is running.\n' >&2; exit 1; }
terralink_pid="$(cat "$terralink_runtime/process.pid")"
terralink_release="$(cat "$terralink_runtime/release.path")"
if ! [[ "$terralink_pid" =~ ^[0-9]+$ ]]; then
  printf 'Invalid production PID.\n' >&2
  exit 1
fi
if kill -0 "$terralink_pid" 2>/dev/null; then
  if [[ "$(readlink "/proc/$terralink_pid/cwd")" != "$terralink_release" ]] || \
     [[ "$(ps -o pgid= -p "$terralink_pid" | tr -d ' ')" != "$terralink_pid" ]]; then
    printf 'PID/cwd/process-group mismatch; refusing to stop another process.\n' >&2
    exit 1
  fi
  kill -- "-$terralink_pid"
  for terralink_attempt in {1..20}; do
    if ! kill -0 "$terralink_pid" 2>/dev/null; then break; fi
    if [[ "$(ps -o stat= -p "$terralink_pid")" == Z* ]]; then break; fi
    sleep 0.25
  done
  if kill -0 "$terralink_pid" 2>/dev/null && [[ "$(ps -o stat= -p "$terralink_pid")" != Z* ]]; then
    printf 'Process has not exited; preserving PID file.\n' >&2
    exit 1
  fi
  printf 'Stopped production process group %s.\n' "$terralink_pid"
fi
rm -f "$terralink_runtime/process.pid"
