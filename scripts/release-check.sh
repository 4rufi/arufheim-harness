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
  npm run build
  npm run smoke
)

NPM_CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-npm-cache.XXXXXX")"
PACK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-pack.XXXXXX")"
RELEASE_REPO_DIR="$(mktemp -d "${TMPDIR:-/tmp}/arufheim-harness-release-repo.XXXXXX")"
cleanup() {
  rm -rf "$NPM_CACHE_DIR"
  rm -rf "$PACK_DIR"
  rm -rf "$RELEASE_REPO_DIR"
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
  ./node_modules/.bin/arufheim-harness setup --repo-path "$RELEASE_REPO_DIR"
  ./node_modules/.bin/arufheim-harness status --repo-path "$RELEASE_REPO_DIR" --brief --json > status.json
  rm -f .harness/progress/current.md
  ./node_modules/.bin/arufheim-harness repair --repo-path "$RELEASE_REPO_DIR"
  ./node_modules/.bin/arufheim-harness doctor --repo-path "$RELEASE_REPO_DIR" --json > doctor.json
)

node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const status = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const expectedRepo = path.resolve(process.argv[3]);
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
  const snapshot = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  if (snapshot.doctor_summary?.status !== "ok") {
    console.error("[FAIL] Installed tarball did not leave the temp repo healthy.");
    console.error(JSON.stringify(snapshot, null, 2));
    process.exit(1);
  }
' "$RELEASE_REPO_DIR/status.json" "$RELEASE_REPO_DIR/doctor.json" "$RELEASE_REPO_DIR"

require_clean_worktree

echo "[OK] release:check"
echo "      Siguiente paso de publish: completa release-readiness.json y corre 'npm run release:publish-check'."
