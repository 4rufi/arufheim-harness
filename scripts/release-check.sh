#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALLOW_DIRTY="${HARNESS_RELEASE_ALLOW_DIRTY:-0}"

if [[ "${1:-}" == "--allow-dirty" ]]; then
  ALLOW_DIRTY="1"
fi

require_clean_worktree() {
  if [[ "$ALLOW_DIRTY" == "1" ]]; then
    return 0
  fi

  if [[ -n "$(git -C "$ROOT_DIR" status --short)" ]]; then
    echo "[FAIL] Release requires a clean worktree." >&2
    echo "        Commit, stash or discard local changes before publishing." >&2
    exit 1
  fi
}

require_clean_worktree

(
  cd "$ROOT_DIR"
  npm run typecheck
  npm run test
  npm run build
  npm run smoke
)

NPM_CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-npm-cache.XXXXXX")"
PACK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-pack.XXXXXX")"
RELEASE_REPO_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-release-repo.XXXXXX")"
RELEASE_XDG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-release-xdg.XXXXXX")"
cleanup() {
  rm -rf "$NPM_CACHE_DIR"
  rm -rf "$PACK_DIR"
  rm -rf "$RELEASE_REPO_DIR"
  rm -rf "$RELEASE_XDG_DIR"
}
trap cleanup EXIT

PACK_JSON_FILE="$PACK_DIR/pack.json"

(
  cd "$ROOT_DIR"
  npm pack --json --pack-destination "$PACK_DIR" --cache "$NPM_CACHE_DIR" > "$PACK_JSON_FILE"
)

PACK_TARBALL_NAME="$(
  node -e '
    const fs = require("node:fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(data) || typeof data[0]?.filename !== "string") {
      process.exit(1);
    }
    process.stdout.write(data[0].filename);
  ' "$PACK_JSON_FILE"
)"
PACK_TARBALL_PATH="$PACK_DIR/$PACK_TARBALL_NAME"

(
  cd "$RELEASE_REPO_DIR"
  npm init -y >/dev/null 2>&1
  npm install --cache "$NPM_CACHE_DIR" --no-package-lock "$PACK_TARBALL_PATH"
  test -f ./node_modules/arufheim-harness/manual-release-checklist.md
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" ./node_modules/.bin/arufheim-harness setup --global-runtime
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" ./node_modules/.bin/arufheim-harness setup --repo-path "$RELEASE_REPO_DIR"
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" ./node_modules/.bin/arufheim-harness status --repo-path "$RELEASE_REPO_DIR" --brief --json > status.json
  rm -f .harness/progress/current.md
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" ./node_modules/.bin/arufheim-harness repair --repo-path "$RELEASE_REPO_DIR"
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" ./node_modules/.bin/arufheim-harness doctor --repo-path "$RELEASE_REPO_DIR" --json > doctor.json
  rm -rf ./node_modules/arufheim-harness ./node_modules/.bin/arufheim-harness
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" "$RELEASE_XDG_DIR/arufheim-harness/bin/arufheim-harness" status --repo-path "$RELEASE_REPO_DIR" --brief --json > managed-status.json
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" "$RELEASE_XDG_DIR/arufheim-harness/bin/arufheim-harness" doctor --repo-path "$RELEASE_REPO_DIR" --json > managed-doctor.json
  XDG_CONFIG_HOME="$RELEASE_XDG_DIR" "$RELEASE_XDG_DIR/arufheim-harness/bin/arufheim-harness" docs show verification > managed-doc.txt
)

node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const status = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const managedStatus = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const expectedRepo = path.resolve(process.argv[4]);
  const expectedCandidates = new Set([expectedRepo]);
  try {
    expectedCandidates.add(fs.realpathSync(expectedRepo));
  } catch {}
  if (typeof status.repo_path !== "string" || !expectedCandidates.has(status.repo_path)) {
    console.error("[FAIL] Installed tarball status did not resolve the expected repo_path.");
    console.error(JSON.stringify(status, null, 2));
    process.exit(1);
  }
  if (typeof status.startup_brief !== "string" || !status.startup_brief.includes(`repo=${status.repo_path}`)) {
    console.error("[FAIL] Installed tarball status did not emit the expected startup_brief.");
    console.error(JSON.stringify(status, null, 2));
    process.exit(1);
  }
  if (managedStatus.runtime_status?.runtime_artifact?.kind !== "global_bundle") {
    console.error("[FAIL] Managed runtime did not classify as a global_bundle artifact.");
    console.error(JSON.stringify(managedStatus, null, 2));
    process.exit(1);
  }
  if (managedStatus.runtime_status?.runtime_source?.kind !== "package_install") {
    console.error("[FAIL] Managed runtime seeded from the tarball did not classify as package_install.");
    console.error(JSON.stringify(managedStatus, null, 2));
    process.exit(1);
  }
  const packageRoot = managedStatus.runtime_status?.runtime_source?.package_root;
  if (typeof packageRoot !== "string" || !packageRoot.includes(`${path.sep}node_modules${path.sep}`)) {
    console.error("[FAIL] Managed runtime package_root does not look like an installed package.");
    console.error(JSON.stringify(managedStatus, null, 2));
    process.exit(1);
  }
  const snapshot = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  if (snapshot.doctor_summary?.status !== "ok") {
    console.error("[FAIL] Installed tarball did not leave the temp repo healthy.");
    console.error(JSON.stringify(snapshot, null, 2));
    process.exit(1);
  }
  const managedDoctor = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
  if (managedDoctor.doctor_summary?.status !== "ok") {
    console.error("[FAIL] Managed global shim doctor did not stay healthy after removing the seed package.");
    console.error(JSON.stringify(managedDoctor, null, 2));
    process.exit(1);
  }
  const managedDoc = fs.readFileSync(process.argv[6], "utf8");
  if (!managedDoc.includes("# Verificación")) {
    console.error("[FAIL] Managed global shim could not serve shared docs after removing the seed package.");
    process.exit(1);
  }
' "$RELEASE_REPO_DIR/status.json" "$RELEASE_REPO_DIR/managed-status.json" "$RELEASE_REPO_DIR/doctor.json" "$RELEASE_REPO_DIR" "$RELEASE_REPO_DIR/managed-doctor.json" "$RELEASE_REPO_DIR/managed-doc.txt"

require_clean_worktree

echo "[OK] release:check"
echo "      Siguiente paso de publish: completa release-readiness.json y corre 'npm run release:publish-check'."
