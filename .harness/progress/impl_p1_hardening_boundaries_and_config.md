# Implementación: p1_hardening_boundaries_and_config

Registro de implementación para la feature SDD de hardening P1.

## Archivos tocados

- `src/config.ts`
- `src/tools/search-repo.ts`
- `scripts/smoke-stdio.mjs`
- `specs/p1_hardening_boundaries_and_config/tasks.md`

## Trazabilidad R -> verificación

- R1 -> revisión de `src/config.ts` y `pnpm smoke`: `loadConfig()` ya no cae a defaults cuando `--repo-path` encuentra una config inválida.
- R2 -> `pnpm smoke`: ausencia de `harness.config.json` con `--repo-path` sigue permitiendo arranque con defaults.
- R3 -> revisión de `src/tools/search-repo.ts` y `pnpm smoke`: `search_repo` valida `include` antes del glob y rechaza traversal.
- R4 -> `pnpm smoke`: `search_repo` mantiene búsqueda normal dentro del repo y no filtra symlinks externos.
- R5 -> `pnpm smoke`: el fixture legacy ahora incluye `CODEX.md`, por lo que `doctor` vuelve a aceptar el repo legacy compatible.
- R6 -> `pnpm smoke`: se agregó una regresión explícita para config inválida con `--repo-path` y para `include` inseguro.

## Verificación ejecutada al cierre de la feature

- `./init.sh`
