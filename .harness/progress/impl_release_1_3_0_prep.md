# Implementación — release_1_3_0_prep

## Test Plan

- `release gate`: `./scripts/release-check.sh --allow-dirty` como preflight del tarball actual.
- `manual package validation`: instalar el paquete actual en un repo limpio, correr `setup --layout full`, validar `init.sh` y `doctor --json`.
- `metadata contract`: `scripts/release-publish-check.mjs --skip-automated`.

## Attempt 1

- hypothesis: antes de publicar, el mayor riesgo ya no está en el código sino en la coherencia entre tarball, scaffold full y metadata de release.
- strategy_delta: primer intento; validar primero el paquete instalado y luego recién alinear versión/changelog/readiness.

### Cambios

- Se creó el loop file de la feature para que `doctor` y `release:check` no bloquearan por estado inconsistente del workflow.
- `package.json` y `release-readiness.json` pasaron a `1.3.0`.
- `release-readiness.json` refrescó `repo_base` con evidencia del `release-check` real y del repo limpio con `setup --layout full`.
- `CHANGELOG.md` movió `Unreleased` a `## 1.3.0`.

## Red -> Green Evidence

- `R1 ->` `./scripts/release-check.sh --allow-dirty`
- `R2 ->` repo limpio desde tarball actual con `setup --layout full`, `./init.sh` y `doctor --json`
- `R3-R4 ->` `package.json`, `release-readiness.json`, `CHANGELOG.md`, `scripts/release-publish-check.mjs --skip-automated`

## Verification

- `PATH=/private/tmp/harness-release-bin:/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/release-check.sh --allow-dirty`
- repo limpio desde tarball actual:
  `setup --layout full`
  `./init.sh` con `node_modules/.bin` y el runtime de Node en `PATH`
  `arufheim-harness doctor --repo-path <repo> --json`
- `/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/release-publish-check.mjs --skip-automated`

## Exception Justification

- El publish gate completo sin `--skip-automated` sigue exigiendo worktree limpio en este repo, así que la validación de metadata se ejecutó por separado después del `release-check` preflight. Eso no deja una reserva de contrato, solo el paso operativo normal de commit/tag/publicación.
