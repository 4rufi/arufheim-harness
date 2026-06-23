# Implementación — thin_default_and_explicit_migration

## Test Plan

- `unit`: `tests/scaffold-layout.test.ts` cubre resolución de layout, docs compartidas y detección de repo válido sin markers débiles.
- `contract`: `tests/contracts.test.ts` fija `scaffold_layout` en `doctor/status` y el default `thin` para repos nuevos.
- `smoke`: `scripts/smoke-stdio.mjs` cubre setup `thin`, `full`, refresh de health, setup global, scaffold repo-scoped y contrato del repo nuevo con Codex.

## Attempt 1

- hypothesis: el cambio puede entrar sin romper compatibilidad si el runtime separa claramente estado repo-canónico de assets compartidos, y si `setup --update` conserva layout mientras `migrate` asume el cambio explícito.
- strategy_delta: implementación inicial con separación `thin/full`, docs servidas desde runtime y endurecimiento de detección para global setup.

### Cambios

- Se añadió `src/scaffold-layout.ts` para formalizar `scaffold.layout`, assets full-only, docs compartidas y detección de repos harness válidos.
- `setup`, `init`, `repair`, `doctor`, `health`, `status` y `harness://health` ahora propagan `scaffold_layout`; los repos nuevos nacen en `thin` salvo `--layout full`.
- Se añadieron los comandos `migrate --to thin`, `verify`, `docs list` y `docs show <topic>`, junto con resources `harness://docs/index` y `harness://docs/<topic>`.
- `src/init.ts` pasó a emitir wrappers mínimos en `thin`, a respetar `scaffold.localClients` reales desde el primer write y a mantener el scaffold largo solo en `full`.
- `src/global-mode.ts` ya no trata `feature_list.json` suelto como señal suficiente para repo detectable; sigue detectando repos canónicos y legacy reales.
- `README.md`, `CHANGELOG.md` y `src/help.ts` quedaron alineados con `thin` por defecto, `verify` como gate de repo consumidor y migración explícita a `thin`.

## Red -> Green Evidence

- `R1-R2 ->` `src/scaffold-layout.ts`, `src/config.ts`, `src/init.ts`, `src/setup.ts`, `src/repair.ts`
- `R3-R4 ->` `src/migrate.ts`, `src/verify.ts`, `src/shared-docs.ts`, `src/docs-command.ts`, `src/index.ts`, `src/resources/repo-resources.ts`
- `R5-R7 ->` `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/global-mode.ts`
- `R8 ->` `README.md`, `CHANGELOG.md`, `src/help.ts`
- `R9 ->` `tests/scaffold-layout.test.ts`, `tests/contracts.test.ts`, `scripts/smoke-stdio.mjs`

## Verification

- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh test`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh build`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh smoke`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home node dist/index.js docs list`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home node dist/index.js migrate --to thin --repo-path <tmp-repo> --dry-run --json`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home node dist/index.js verify --repo-path . --json`

## Exception Justification

- `verify` se valida sobre este repo como sanity check del command shape, pero el gate canónico del propio repo harness sigue siendo `./init.sh`.
