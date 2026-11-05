#!/usr/bin/env bash
set -euo pipefail
terralink_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$terralink_root/.runtime"
# The lock prevents two copies/builds from racing; it does not stop dev.
exec 9>"$terralink_root/.runtime/production-build.lock"
flock -n 9 || { printf 'Another isolated production build is running.\n' >&2; exit 1; }
exec python3 "$terralink_root/scripts/earthmind/build_release.py" "$terralink_root" "$@"
