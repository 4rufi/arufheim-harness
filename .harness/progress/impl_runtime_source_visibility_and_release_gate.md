# Implementación — runtime_source_visibility_and_release_gate

## Test Plan

- `unit`: `tests/runtime.test.ts` fija `workspace_dev`, `package_install` y `linked_dev`.
- `contract`: `runtime_status` en `doctor/status/verify` y el health persistido deben incluir `runtime_source`.
- `smoke`: `scripts/smoke-stdio.mjs` y `release:check` deben tolerar `workspace_dev` en el repo de desarrollo y exigir `package_install` en el tarball instalado.
- `repo gate`: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`, `./init.sh`.

## Attempt 1

- hypothesis: el matiz de launch se resuelve sin rediseñar el runtime si hacemos visible la procedencia real del entrypoint y movemos la garantía fuerte al gate de release sobre el tarball instalado.
- strategy_delta: primero clasificar `runtime_source` en runtime/health, luego degradar el caso dev de forma no bloqueante y finalmente blindar `release:check` con un home temporal y el shim real.

### Cambios

- `src/runtime.ts` ahora deriva y persiste `runtime_source` con clasificación `package_install | workspace_dev | linked_dev | unknown`.
- `src/health.ts` propaga `runtime_source`, invalida health persistido viejo sin esa señal y emite un warning explícito cuando el runtime viene de workspace/link de desarrollo.
- `src/doctor.ts`, `src/verify.ts` y `src/status.ts` muestran `source=<kind>` en la línea de runtime.
- `tests/runtime.test.ts` cubre los tres casos relevantes de procedencia.
- `scripts/smoke-stdio.mjs` acepta `degraded` en repos temporales sembrados desde este workspace y verifica la señal `workspace_dev`.
- `scripts/release-check.sh` ahora usa `XDG_CONFIG_HOME` temporal, siembra el runtime global desde el tarball instalado, ejecuta el shim real y exige `runtime_status.runtime_source.kind === "package_install"`.
- `README.md`, `manual-release-checklist.md`, `src/help.ts` y `CHANGELOG.md` quedaron alineados con la diferencia entre runtime de desarrollo y runtime publicado.

## Red -> Green Evidence

- `R1-R4 ->` `src/runtime.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`
- `R5 ->` `scripts/release-check.sh`, `scripts/smoke-stdio.mjs`
- `R6 ->` `README.md`, `manual-release-checklist.md`, `src/help.ts`, `CHANGELOG.md`

## Verification

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/vitest run`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`
- `./init.sh`

## Exception Justification

- No hizo falta una tool/resource pública nueva: la procedencia ya queda visible en `runtime_status` y el gate fuerte vive en `release:check`.
