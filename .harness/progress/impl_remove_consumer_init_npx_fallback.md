# Implementación — remove_consumer_init_npx_fallback

## Test Plan

- `smoke`: `scripts/smoke-stdio.mjs` fija que el `init.sh` scaffolded para layout `full` ya no use `npx` como fallback implícito.
- `docs/contract`: `README.md`, `.harness-docs/verification.md` y `src/help.ts` deben reflejar el contrato offline-first y el uso de `verify`.
- `repo gate`: `./scripts/pnpmw.sh typecheck`, `./scripts/pnpmw.sh test`, `./scripts/pnpmw.sh build`, `./scripts/pnpmw.sh smoke` y `./init.sh`.

## Attempt 1

- hypothesis: el bloqueo recurrente viene del wrapper scaffolded del repo consumidor, no del runtime principal; si quitamos solo ese fallback a `npx` y dejamos guidance explícita, el flujo queda offline-first sin romper `thin`.
- strategy_delta: primer intento; endurecer el wrapper `full` y fijar el contrato nuevo en smoke y docs.

### Cambios

- `src/init.ts` eliminó el fallback `npx --yes arufheim-harness doctor --repo-path .` del `init.sh` scaffolded para repos consumidores.
- El mismo wrapper ahora acepta solo `ARUFHEIM_HARNESS_ENTRY` o `arufheim-harness` en `PATH` y, si no existen, falla cerrado con instrucciones hacia `verify` o un binario local.
- `scripts/smoke-stdio.mjs` pasó a verificar explícitamente que el scaffold `full` ya no dependa de `npx`.
- `README.md`, `src/help.ts`, `.harness-docs/verification.md` y `CHANGELOG.md` quedaron alineados con el contrato offline-first.

## Red -> Green Evidence

- `R1-R3 ->` `src/init.ts`, `README.md`, `src/help.ts`, `.harness-docs/verification.md`
- `R4 ->` `scripts/smoke-stdio.mjs`, `CHANGELOG.md`

## Verification

- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh typecheck`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh test`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh build`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh smoke`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./init.sh`

## Exception Justification

- No hizo falta una suite unitaria adicional: el cambio observable vive en el scaffold materializado del repo consumidor y su contrato correcto queda mejor cubierto por smoke + verificación de repo completa.
