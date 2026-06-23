# Goal

Eliminar la dependencia operativa de `npx`/PATH ambiguo en los bindings MCP sin meter `arufheim-harness` como dependencia del repo consumidor.

# Touch

`src/runtime.ts`, `src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/help.ts`, `scripts/smoke-stdio.mjs`, `README.md`, `manual-release-checklist.md`, `CHANGELOG.md`

# Constraints

Mantener portabilidad repo-scoped, migración automática de lo gestionado y compatibilidad con repos existentes en `thin` y `full`.

# Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`
