# Goal

Cerrar dos P1 operativos: detección automática segura de repo en `setup/repair --global` y frescura real del health cache usado por `status --brief`.

# Touch

- `src/global-mode.ts`
- `src/health.ts`
- `src/status.ts`
- `scripts/smoke-stdio.mjs`

# Constraints

- No romper `--repo-path` explícito.
- No quitar el brief cacheado; solo invalidarlo cuando cambie evidencia observada.
- No ampliar scope a otros hallazgos.

# Verify

- Repro falso positivo de `setup --global` deja de scaffoldear repo-scoped en cwd con marker débil.
- `status --brief --json` deja de devolver health stale tras romper un binding local.
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

# Tasks

- T1 endurecer detección de repo global
- T2 invalidar cache stale del brief
- T3 cubrir repros
