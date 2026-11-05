#!/usr/bin/env python3
"""Build an immutable source/dependency snapshot without touching live .next."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    source = Path(sys.argv[1]).resolve()
    if len(sys.argv) > 3:
        raise SystemExit("Usage: build.sh [NEW_RELEASE_DIRECTORY]")
    if not (source / "node_modules/next/dist/bin/next").is_file():
        raise SystemExit("Dependencies are absent. No automatic installation is performed.")
    if len(sys.argv) == 3:
        release = Path(sys.argv[2]).expanduser().resolve()
        if release == source or source in release.parents:
            raise SystemExit("Release must be outside the live source tree.")
        release.mkdir(parents=True, exist_ok=False)
    else:
        base = Path(os.environ.get("TERRALINK_RELEASE_ROOT", f"/tmp/earthmind-terralink-{os.getuid()}"))
        base.mkdir(parents=True, exist_ok=True)
        release = Path(tempfile.mkdtemp(prefix="release-", dir=base)).resolve()
        if release == source or source in release.parents:
            raise SystemExit("Release must be outside the live source tree.")
    started = time.monotonic()
    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_directory": str(source),
        "source_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip(),
        "release_directory": str(release),
        "node_version": subprocess.check_output(["node", "--version"], text=True).strip(),
        "package_lock_sha256": sha256(source / "package-lock.json"),
        "environment_file_copied": (source / ".env.local").is_file(),
        "environment_contents_recorded": False,
        "dependencies": "read-only use of existing node_modules through symlink; no install or upgrade",
        "build_command": ["node", "node_modules/next/dist/bin/next", "build"],
        "lint_and_types_skipped": False,
        "source_files": {},
        "state": "COPYING",
    }
    manifest_path = release / "earthmind-release.json"

    def record():
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    record()
    print(f"Release: {release}", flush=True)
    try:
        files = subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=source
        ).decode().split("\0")
        for relative in sorted(set(files) - {""}):
            original = source / relative
            if not original.is_file():
                continue
            destination = release / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, destination)
            manifest["source_files"][relative] = sha256(destination)
        if manifest["environment_file_copied"]:
            shutil.copy2(source / ".env.local", release / ".env.local")
            (release / ".env.local").chmod(0o600)
        # Dependency installation is a separate, coordinated operation. Neither
        # this script nor next build installs/upgrades dependencies. Source,
        # types, lint caches and .next remain inside this isolated release.
        (release / "node_modules").symlink_to(source / "node_modules", target_is_directory=True)
        print("Using existing dependencies read-only (no copy/install/upgrade).", flush=True)
        manifest["copy_seconds"] = round(time.monotonic() - started, 3)
        manifest["state"] = "BUILDING"
        record()
        build_started = time.monotonic()
        env = dict(os.environ, NODE_ENV="production", NEXT_TELEMETRY_DISABLED="1")
        with (release / "build.log").open("w") as log:
            process = subprocess.Popen(manifest["build_command"], cwd=release, env=env,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                log.write(line)
                log.flush()
                print(line, end="", flush=True)
            code = process.wait()
        manifest["build_seconds"] = round(time.monotonic() - build_started, 3)
        manifest["exit_code"] = code
        manifest["state"] = "READY" if code == 0 and (release / ".next/BUILD_ID").is_file() else "FAILED"
        if manifest["state"] == "READY":
            manifest["build_id"] = (release / ".next/BUILD_ID").read_text().strip()
            manifest["build_log_sha256"] = sha256(release / "build.log")
        manifest["total_seconds"] = round(time.monotonic() - started, 3)
        record()
        print(f"Result: {manifest['state']}; manifest: {manifest_path}", flush=True)
        return 0 if manifest["state"] == "READY" else (code or 1)
    except BaseException as error:
        manifest["state"] = "FAILED"
        manifest["error_type"] = type(error).__name__
        manifest["total_seconds"] = round(time.monotonic() - started, 3)
        record()
        raise


if __name__ == "__main__":
    sys.exit(main())
