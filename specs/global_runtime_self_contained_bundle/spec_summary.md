# Goal

Sembrar el runtime global del harness como un bundle autocontenido que siga funcionando sin el paquete original instalado, manteniendo bindings portables y docs compartidas en layout `thin`.

# Touch

`package.json`, `scripts/*bundle*`, `src/runtime.ts`, `src/shared-docs.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`, `tests/runtime.test.ts`, `scripts/smoke-stdio.mjs`, `scripts/release-check.sh`, `README.md`, `manual-release-checklist.md`, `CHANGELOG.md`

# Constraints

Sin cambiar comandos públicos, sin dependencia local del proyecto y sin requerir un binario nativo.

# Verify

`typecheck`, `test`, `build`, `smoke`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`, `./init.sh`

# Tasks

`T1-T4`
