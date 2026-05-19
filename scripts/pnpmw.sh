#!/usr/bin/env bash
set -euo pipefail

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
