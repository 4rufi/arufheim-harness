# Implementación — managed_global_runtime_and_reproducible_bindings

## Test Plan

- `unit/contract`: `tests/contracts.test.ts` y la lógica de runtime/health/status fijan `runtime_status`, el contrato de bindings repo-scoped/globales y la ayuda real de `setup --help`.
- `smoke`: `scripts/smoke-stdio.mjs` valida siembra del runtime global gestionado, launcher repo-portable, migración de bindings legacy y continuidad de los layouts `thin` y `full`.
- `repo gate`: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.

## Attempt 1

- hypothesis: si el harness materializa un runtime global estable y hace que todos los bindings gestionados dependan de ese shim o de un launcher repo-portable, se elimina la ambigüedad de `npx`/PATH sin convertir el paquete en dependencia del repo consumidor.
- strategy_delta: primer intento; mover primero la fuente de verdad del runtime a `src/runtime.ts`, luego migrar scaffold/bindings y solo después endurecer health/status/docs alrededor del contrato nuevo.

### Cambios

- Se añadió `src/runtime.ts` para resolver el root global del harness, instalar/validar el runtime gestionado, persistir `runtime.json` y generar el launcher repo-portable `.harness/runtime/launch-global-runtime.mjs`.
- `src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/config.ts` y `src/index.ts` ahora siembran o reparan el runtime global antes de reconciliar bindings, generan configs globales apuntando al shim absoluto gestionado y usan `node + .harness/runtime/launch-global-runtime.mjs` para bindings repo-scoped.
- El `init.sh` scaffolded para layout `full` ahora prioriza `ARUFHEIM_HARNESS_ENTRY`, luego el shim global gestionado y recién después `arufheim-harness` en `PATH`, sin volver a `npx`.
- `src/health.ts`, `src/status.ts`, `src/doctor.ts` y `src/verify.ts` exponen `runtime_status`, distinguen bindings gestionados de legacy reparable y consideran `.harness/runtime/launch-global-runtime.mjs` parte del scaffold canónico.
- `README.md`, `manual-release-checklist.md`, `src/help.ts` y `CHANGELOG.md` quedaron alineados con el contrato nuevo: runtime gestionado por máquina, repo portable y `setup --help` mostrando ayuda real.
- `scripts/smoke-stdio.mjs` ahora siembra un `XDG_CONFIG_HOME` temporal, instala el runtime gestionado de smoke y valida el flujo nuevo sin tocar el home real.

## Red -> Green Evidence

- `R1-R2 ->` `src/runtime.ts`, `src/config.ts`
- `R3-R5 ->` `src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/index.ts`
- `R6-R7 ->` `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`
- `R8 ->` `README.md`, `manual-release-checklist.md`, `src/help.ts`, `CHANGELOG.md`
- `R9 ->` `tests/contracts.test.ts`, `scripts/smoke-stdio.mjs`

## Verification

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/vitest run`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

## Exception Justification

- No se añadió una surface pública extra para administrar el runtime fuera de `setup`/`repair`; el contrato observable ya queda cubierto por `runtime_status`, `verify`, `doctor`, smoke y el scaffold gestionado.
