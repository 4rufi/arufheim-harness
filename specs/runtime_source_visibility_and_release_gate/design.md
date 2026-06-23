# Design

## Decision

La procedencia del runtime se calculará desde el entrypoint/package root real del paquete y se persistirá en metadata. Health la expondrá como `runtime_source` y añadirá un warning no bloqueante para `workspace_dev` o `linked_dev`. `release:check` sembrará el runtime con el tarball instalado en un `XDG_CONFIG_HOME` temporal y validará que el source final sea `package_install`.

## Touch

`src/runtime.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`, `scripts/release-check.sh`, `tests/runtime.test.ts`, `README.md`, `manual-release-checklist.md`, `CHANGELOG.md`

## Constraints

- No romper el contrato recién arreglado del shim/launcher
- Mantener `runtime_status.state` para salud operativa y usar warning separado para la procedencia dev
- El gate de release no debe contaminar `~/.config` real del usuario

## Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`
