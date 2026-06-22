# Goal

Añadir una simulación reproducible por flujo para estimar bytes y tokens locales de surfaces del harness usando los builders reales del runtime y sin contaminar `session.json`.

# Touch

- `src/session-metrics.ts`
- `src/status.ts`
- `src/doctor.ts`
- `src/loop.ts`
- `src/help.ts`
- `src/index.ts`
- `src/init.ts`
- `README.md`
- `scripts/smoke-stdio.mjs`

# Constraints

- No mutar las métricas reales de sesión al simular.
- La estimación debe usar el mismo criterio local actual (`bytes/4`).
- El flujo debe ser legible y comparable por paso y total.

# Verify

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

# Tasks

- T1 definir el contrato CLI y los flujos predefinidos
- T2 implementar simulación reusable sin contaminar métricas
- T3 documentar y cubrir en smoke
