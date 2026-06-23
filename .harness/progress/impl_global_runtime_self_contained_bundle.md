# Implementación — global_runtime_self_contained_bundle

## Test Plan

- `unit`: `tests/runtime.test.ts` fija metadata v2, `global_bundle`, `package_install`, `workspace_dev`, `linked_dev`, compatibilidad legacy y runtime desacoplado del paquete sembrador.
- `contract`: `doctor/status/verify/harness_status` deben exponer `runtime_status.runtime_artifact` y conservar `runtime_status.runtime_source`.
- `smoke`: `scripts/smoke-stdio.mjs` valida arranque del shim global, launcher repo-scoped y `docs list/show` desde el runtime bundle.
- `release`: `scripts/release-check.sh` debe pasar aun después de retirar el paquete sembrador del repo temporal.
- `repo gate`: `typecheck`, `test`, `build`, `smoke`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`, `./init.sh`.

## Attempt 1

- hypothesis: el runtime gestionado puede volverse realmente autocontenido si el artefacto vivo pasa a ser un bundle global sembrado en el root del harness y la procedencia del seed queda persistida aparte en metadata.
- strategy_delta: mover docs compartidas a una registry embebida, sembrar `runtime-bundle.cjs` en el root global, separar `runtime_artifact` de `runtime_source`, y endurecer `release:check` retirando el paquete sembrador antes de usar el shim.

### Cambios

- `scripts/generate-shared-docs-registry.mjs` genera una registry estática de docs compartidas en `src/generated/` y `dist/generated/`.
- `src/shared-docs.ts` dejó de leer desde `packageRoot()` y ahora sirve `docs list/show` desde la registry embebida.
- `scripts/build-runtime-bundle.mjs` produce `dist/runtime-bundle.cjs` con `esbuild`; `package.json` lo integra a `build`, `typecheck` y `test`.
- `src/runtime.ts` ahora siembra `~/.config/arufheim-harness/runtime/arufheim-harness.cjs`, persiste metadata v2 con `artifact_kind/artifact_path` y `seed_*`, mantiene lectura legacy v1 como `stale`, y permite fallback de bundling solo para workspace dev cuando todavía no existe `runtime-bundle.cjs`.
- `src/health.ts`, `src/doctor.ts`, `src/status.ts`, `src/verify.ts` y `src/help.ts` exponen `runtime_artifact` además de `runtime_source`.
- `scripts/release-check.sh` valida `global_bundle` + `package_install`, elimina el paquete sembrador y comprueba `status`, `doctor` y `docs show verification` vía shim global.
- `scripts/smoke-stdio.mjs` cubre el arranque real del shim/launcher con `runtime_artifact.kind === "global_bundle"` y valida `docs list/show` sobre el runtime gestionado.
- `README.md`, `manual-release-checklist.md` y `CHANGELOG.md` quedaron alineados con el contrato autocontenido.

## Red -> Green Evidence

- `R1-R3 ->` `scripts/generate-shared-docs-registry.mjs`, `scripts/build-runtime-bundle.mjs`, `src/shared-docs.ts`, `src/runtime.ts`
- `R2-R4 ->` `src/runtime.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`
- `R5 ->` `scripts/release-check.sh`, `scripts/smoke-stdio.mjs`, `tests/runtime.test.ts`
- `R6 ->` `README.md`, `manual-release-checklist.md`, `src/help.ts`, `CHANGELOG.md`

## Verification

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `node scripts/generate-shared-docs-registry.mjs && ./node_modules/.bin/vitest run`
- `node scripts/generate-shared-docs-registry.mjs && ./node_modules/.bin/tsc -p tsconfig.json && node scripts/build-runtime-bundle.mjs`
- `node scripts/smoke-stdio.mjs`
- `npm run release:check -- --allow-dirty`
- `./init.sh`

## Exception Justification

- No se agregó una command surface nueva: el contrato visible ya quedaba mejor resuelto extendiendo `runtime_status` y endureciendo el gate de release existente.
