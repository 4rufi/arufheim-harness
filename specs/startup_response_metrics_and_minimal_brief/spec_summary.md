# Goal

Medir el costo real local de las responses de `harness_status`/`status` y bajar el hot path de arranque con `brief_minimal`.

# Touch

- `src/session-metrics.ts`
- `src/status.ts`
- `src/tools/harness-status.ts`
- prompts/docs/templates
- `scripts/smoke-stdio.mjs`

# Constraints

- Mantener compatibilidad con `brief_only`.
- No vender billing real; solo estimación local por bytes.

# Verify

- `harness_status(mode: "brief_minimal")`
- `status --brief-minimal --json`
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

# Tasks

- T1 métricas de response
- T2 modo `brief_minimal`
- T3 contrato de startup
- T4 smoke + cierre
