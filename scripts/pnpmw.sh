#!/usr/bin/env bash
set -euo pipefail

cached_corepack_pnpm() {
  local expected_version=""
  local root=""
  local candidate=""

  if command -v node >/dev/null 2>&1 && [ -f package.json ]; then
    expected_version="$(
      node --input-type=commonjs - <<'JS' 2>/dev/null || true
const fs = require("node:fs");
try {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const match = String(pkg.packageManager || "").match(/^pnpm@(.+)$/);
  if (match) {
    process.stdout.write(match[1]);
  }
} catch {}
JS
    )"
  fi

  for root in \
    "${COREPACK_HOME:-}" \
    "${HOME:-}/.cache/node/corepack" \
    "${HOME:-}/.cache/corepack" \
    "${HOME:-}/Library/Caches/node/corepack"
  do
    [ -n "$root" ] || continue
    if [ -n "$expected_version" ] && [ -f "$root/pnpm/$expected_version/bin/pnpm.cjs" ]; then
      printf '%s\n' "$root/pnpm/$expected_version/bin/pnpm.cjs"
      return 0
    fi

    candidate="$(
      find "$root/pnpm" -path '*/bin/pnpm.cjs' 2>/dev/null | head -n 1 || true
    )"
    if [ -n "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if command -v node >/dev/null 2>&1; then
  if CACHED_PNPM="$(cached_corepack_pnpm)"; then
    exec node "$CACHED_PNPM" "$@"
  fi
fi

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm "$@"
fi

if command -v corepack >/dev/null 2>&1; then
  exec corepack pnpm "$@"
fi

if command -v npm >/dev/null 2>&1; then
  echo "pnpm no está instalado en PATH. Instálalo con 'npm install -g pnpm' o habilita Corepack." >&2
  exit 1
fi

if command -v yarn >/dev/null 2>&1; then
  echo "pnpm no está instalado en PATH. Instálalo con 'yarn global add pnpm' o habilita Corepack." >&2
  exit 1
fi

echo "pnpm no está instalado y tampoco hay corepack, npm o yarn disponibles para bootstrapearlo." >&2
exit 1
