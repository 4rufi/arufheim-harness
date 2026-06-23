# Implementación — managed_runtime_boot_contract_hardening

## Test Plan

- `unit`: `tests/runtime.test.ts` fija metadata del runtime, detección de entrypoint legacy y fallback de global root del launcher.
- `contract`: `tests/contracts.test.ts` sigue cubriendo `runtime_status` y scaffold repo-local con runtime gestionado sembrado.
- `smoke`: `scripts/smoke-stdio.mjs` ahora ejecuta el shim global gestionado y el launcher repo-scoped reales contra un `XDG_CONFIG_HOME` temporal.
- `repo gate`: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs`, `./init.sh`.

## Attempt 1

- hypothesis: el problema no era “copiar mejor `dist`”, sino depender de una copia parcial sin dependencias. Si el runtime gestionado pasa a ser metadata + shim sobre el entrypoint real instalado del paquete, desaparecen tanto el boot roto como la reinstalación autodestructiva.
- strategy_delta: sustituir primero la instalación por copia de `dist`, luego blindar el launcher con una única regla de root global y finalmente convertir el smoke en una prueba real del shim y del launcher.

### Cambios

- `src/runtime.ts` dejó de copiar `dist/` al root global y ahora escribe metadata + shim apuntando al entrypoint real instalado del paquete actual.
- El launcher repo-scoped generado en `.harness/runtime/launch-global-runtime.mjs` ahora usa `os.homedir()` y la misma raíz global canónica que `config.ts`, evitando divergencias por `HOME`/`cwd`.
- `evaluateManagedGlobalRuntimeStatus()` ahora marca como `stale` los runtimes legacy que todavía apunten a `~/.config/arufheim-harness/runtime/dist/index.js`.
- `src/config.ts` exporta el dirname global canónico para que runtime/launcher no dupliquen strings divergentes.
- `tests/runtime.test.ts` fija metadata correcta, stale legacy y fallback del launcher.
- `scripts/smoke-stdio.mjs` ahora ejecuta de verdad el shim global y el launcher repo-scoped con `status --brief-minimal --json` sobre un repo temporal.
- `README.md` y `CHANGELOG.md` quedaron alineados con el contrato nuevo del runtime gestionado.

## Red -> Green Evidence

- `R1-R4 ->` `src/runtime.ts`, `src/config.ts`
- `R5 ->` `scripts/smoke-stdio.mjs`
- `R6 ->` `tests/runtime.test.ts`, `tests/contracts.test.ts`, `README.md`, `CHANGELOG.md`

## Verification

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/vitest run`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

## Exception Justification

- No hizo falta una surface pública nueva: el contrato observable ya vive en `setup/repair`, `runtime_status`, el shim global y el launcher repo-scoped ejercidos por smoke.
