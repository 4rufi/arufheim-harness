# Goal

Hacer que el runtime global gestionado arranque de verdad fuera del repo y que el smoke lo verifique end-to-end.

# Touch

`src/runtime.ts`, `src/config.ts`, `scripts/smoke-stdio.mjs`, `tests/contracts.test.ts`, `README.md`, `CHANGELOG.md`

# Constraints

Sin dependencia local del paquete en repos consumidores; bindings repo-scoped siguen portables.

# Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`

# Tasks

`T1-T4`
