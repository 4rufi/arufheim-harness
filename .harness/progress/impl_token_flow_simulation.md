# Implementación — token_flow_simulation

## Resumen

Se añadió el comando `arufheim-harness simulate`, que estima bytes y tokens locales por flujo usando los builders reales de `status`, `doctor` y `loop`, sin contaminar `.harness/metrics/session.json`.

## Trazabilidad

- R1 -> `src/simulate.ts`, `src/index.ts` y `src/help.ts` exponen el comando CLI `simulate` como surface reproducible de estimación por flujo.
- R2 -> `src/session-metrics.ts` exporta la heurística reusable `estimateLocalTokens`/`estimateSerializedPayload`; `src/simulate.ts` la reutiliza sin llamar a `recordResponseOutput`.
- R3 -> `src/simulate.ts` soporta los flujos predefinidos `startup`, `activation`, `loop` y `triage`, además de `all`.
- R4 -> `src/simulate.ts` devuelve `steps[]` con `surface`, `format`, `bytes`, `tokens` y `detail` opcional, más `total_bytes` y `total_tokens` por flujo.
- R5 -> `src/simulate.ts` reutiliza `readLoopStatus` y sigue devolviendo un paso válido tanto con loop activo como cuando `exists=false`.
- R6 -> `src/simulate.ts` soporta salida humana y `--json` con el mismo breakdown por flujo.
- R7 -> `README.md`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/harness.md`, `.opencode/commands/harness.md`, `src/help.ts` y `src/init.ts` documentan el comando y cuándo usarlo.
- R8 -> `scripts/smoke-stdio.mjs` cubre `simulate --flow startup` y `simulate --flow loop,triage`, y verifica que el comando no muta `.harness/metrics/session.json`.

## Verificación

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `node dist/index.js simulate --repo-path . --flow startup --json`
- `node dist/index.js simulate --repo-path . --flow loop,triage`
- `./init.sh`
