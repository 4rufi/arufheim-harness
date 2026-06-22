# Goal

Integrar un loop canónico `plan_execute_verify` dentro del harness con retries acotados, route-back automático y observabilidad compartida entre workflow, MCP, CLI, TUI y scaffold.

# Touch

- `src/config.ts`
- `src/workflow.ts`
- `src/loop.ts`
- `src/tools/harness-update.ts`
- `src/tools/harness-loop-status.ts`
- `src/tools/harness-loop-event.ts`
- `src/status.ts`
- `src/doctor.ts`
- `src/health.ts`
- `src/resources/repo-resources.ts`
- `src/tui.ts`
- `src/agent.ts`
- `src/init.ts`
- docs/prompts/adapters
- `scripts/smoke-stdio.mjs`

# Constraints

- Mantener `pending | spec_ready | in_progress | done | blocked`.
- No borrar ni reescribir artifacts humanos históricos.
- `brief_minimal` sigue mínimo; solo añade señal compacta del loop.

# Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

# Tasks

- T1 policy + artifact de loop
- T2 tools/resources/status surfaces
- T3 doctor/repair/setup/agent
- T4 scaffold/docs/prompts
- T5 smoke + cierre
