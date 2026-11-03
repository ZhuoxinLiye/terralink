#!/usr/bin/env bash
set -euo pipefail
terralink_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$terralink_root"
if [[ ! -f .runtime/terralink.pid ]]; then
  printf 'No TerraLink PID file.\n'
  exit 0
fi
terralink_pid="$(cat .runtime/terralink.pid)"
if ! [[ "$terralink_pid" =~ ^[0-9]+$ ]]; then
  printf 'Invalid TerraLink PID file.\n' >&2
  exit 1
fi
if kill -0 "$terralink_pid" 2>/dev/null; then
  if [[ "$(readlink "/proc/$terralink_pid/cwd")" != "$terralink_root" ]]; then
    printf 'PID no longer belongs to this TerraLink directory; refusing to stop it.\n' >&2
    exit 1
  fi
  kill -- "-$terralink_pid"
  printf 'Stopped the TerraLink process group %s.\n' "$terralink_pid"
fi
rm -f .runtime/terralink.pid
