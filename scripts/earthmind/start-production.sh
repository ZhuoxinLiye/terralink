#!/usr/bin/env bash
set -euo pipefail
terralink_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ $# != 1 ]]; then
  printf 'Usage: start-production.sh RELEASE_DIRECTORY\n' >&2
  exit 1
fi
terralink_release="$(realpath "$1")"
terralink_host="${TERRALINK_HOST:-127.0.0.1}"
terralink_port="${TERRALINK_PORT:-4176}"
if ! [[ "$terralink_port" =~ ^[0-9]+$ ]] || (( 10#$terralink_port < 1 || 10#$terralink_port > 65535 )); then
  printf 'Invalid TERRALINK_PORT.\n' >&2
  exit 1
fi
terralink_runtime="$terralink_root/.runtime/production-$terralink_port"
mkdir -p "$terralink_runtime"
exec 9>"$terralink_runtime/control.lock"
flock -n 9 || { printf 'Another start/stop operation is running.\n' >&2; exit 1; }
python3 - "$terralink_release" <<'PY'
import json, sys
from pathlib import Path
release=Path(sys.argv[1])
manifest=json.loads((release/'earthmind-release.json').read_text())
assert manifest['state']=='READY', 'Release build did not succeed'
assert manifest['release_directory']==str(release), 'Release directory does not match manifest'
assert (release/'.next/BUILD_ID').read_text().strip()==manifest['build_id'], 'Build ID mismatch'
assert (release/'node_modules/next/dist/bin/next').is_file(), 'Dependencies missing'
PY
if [[ -f "$terralink_runtime/process.pid" ]]; then
  terralink_old_pid="$(cat "$terralink_runtime/process.pid")"
  if [[ "$terralink_old_pid" =~ ^[0-9]+$ ]] && kill -0 "$terralink_old_pid" 2>/dev/null; then
    printf 'Production instance already has a live PID %s; stop it explicitly first.\n' "$terralink_old_pid" >&2
    exit 1
  fi
fi
# The listen preflight does not touch or stop any existing service.
python3 - "$terralink_host" "$terralink_port" <<'PY'
import socket, sys
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
    server.bind((sys.argv[1], int(sys.argv[2])))
PY
printf '%s\n' "$terralink_release" >"$terralink_runtime/release.path"
(
  cd "$terralink_release"
  exec 9>&-
  exec setsid env NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next start \
    --hostname "$terralink_host" --port "$terralink_port"
) >"$terralink_runtime/server.log" 2>&1 < /dev/null &
terralink_pid=$!
printf '%s\n' "$terralink_pid" >"$terralink_runtime/process.pid"
sleep 1
if ! kill -0 "$terralink_pid" 2>/dev/null; then
  printf 'Production server exited; inspect %s/server.log.\n' "$terralink_runtime" >&2
  exit 1
fi
printf 'Production PID %s, http://%s:%s, release %s\n' "$terralink_pid" "$terralink_host" "$terralink_port" "$terralink_release"
printf 'Log: %s/server.log\nReadiness and authenticated browser acceptance remain separate checks.\n' "$terralink_runtime"
