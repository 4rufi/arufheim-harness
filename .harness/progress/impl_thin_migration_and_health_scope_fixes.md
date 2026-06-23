# Implementación — thin_migration_and_health_scope_fixes

## Test Plan

- `unit/contract`: mantener `typecheck` y `vitest` verdes para no romper surfaces compartidas del harness.
- `smoke`: cubrir migración real `full -> thin`, `codex-only` con globals válidos fuera de scope y el fixture de global assumed con un repo que realmente espere Claude.

## Attempt 1

- hypothesis: el bug de migración vive en la limpieza de directorios vacíos y la degradación espuria vive en la inspección de globals fuera de `expectedHealthClients`.
- strategy_delta: arreglar la poda/cleanup sin relajar la migración conservadora y cortar la inspección global antes de crear diagnostics o readiness fuera de scope.

### Cambios

- `src/migrate.ts`: la limpieza de directorios gestionados vacíos ahora usa una eliminación válida para directorios tras comprobar que quedaron vacíos.
- `src/health.ts`: los bindings globales JSON y Codex se ignoran completamente cuando el cliente no está dentro del scope esperado del repo.
- `scripts/smoke-stdio.mjs`: se añadió un smoke de migración real `full -> thin`, se endureció el smoke `codex-only` con globals válidos fuera de scope y se corrigió el fixture de `assumed global binding` para que espere Claude de verdad.

## Red -> Green Evidence

- `R1-R2 ->` `src/migrate.ts`, `scripts/smoke-stdio.mjs`
- `R3 ->` `src/health.ts`, `scripts/smoke-stdio.mjs`
- `R4 ->` `scripts/smoke-stdio.mjs`, `./init.sh`

## Verification

- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh typecheck`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh test`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh build`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./scripts/pnpmw.sh smoke`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./init.sh`

## Exception Justification

- No hizo falta abrir surface pública nueva; el fix queda encapsulado en compatibilidad de `migrate` y en el scope efectivo del health repo-local.
