# Implementación — loop_engineering_harness

## Resumen

Se integró un loop canónico `plan_execute_verify` dentro del harness con estado persistido por feature, policy configurable, tools MCP dedicadas, observabilidad transversal y scaffold/documentación alineados sin cambiar los estados del backlog.

## Trazabilidad

- R1 -> `src/workflow.ts` añade `loopMetricsDir` y `src/loop.ts` persiste `.harness/metrics/loops/<feature_id>_<feature_slug>.json` como artifact estable por feature.
- R2 -> `src/loop.ts` modela `phase`, `attempt_index`, `review_round`, budgets, `last_error_signature`, `last_strategy_delta`, `no_progress_streak`, `repeated_failure_streak` y `events[]`, con reducción única para `plan_execute_verify`.
- R3 -> `src/tools/harness-update.ts`, `src/setup.ts` y `src/repair.ts` siembran/sincronizan/cerran loop files al pasar a `in_progress`, renombrar features o cerrar en `done`/`blocked`.
- R4 -> `src/tools/harness-loop-status.ts`, `src/tools/harness-loop-event.ts`, `src/resources/repo-resources.ts` y `src/index.ts` exponen `harness_loop_status`, `harness_loop_event` y `harness://loop/active`.
- R5 -> `src/loop.ts` rechaza retries equivalentes sin `strategy_delta`, exige route-back explícito y corta cuando el `error_signature` se repite sin progreso real.
- R6 -> `src/status.ts`, `src/doctor.ts`, `src/health.ts` y `src/tui.ts` propagan `loop_summary`; `brief_minimal` mantiene payload mínimo y solo añade `loop=<phase>:a<attempt>` al `startup_brief`.
- R7 -> `src/loop.ts` y `src/health.ts` detectan loop faltante para una feature `in_progress`, terminalidad inconsistente, features terminales con loop abierto, retries equivalentes y budgets agotados; `doctor --json` hereda ese contrato.
- R8 -> `src/setup.ts`, `src/repair.ts`, `src/init.ts` y `src/help.ts` actualizan/reparan scaffold/docs/prompts del loop y resemean el loop activo faltante sin tocar artifacts humanos existentes.
- R9 -> `src/agent.ts` incorpora `loop_summary`, último fallo/rechazo, `strategy_delta` previo y budgets restantes al brief/routing sin convertir `agent` en executor autónomo.
- R10 -> `src/init.ts`, `AGENTS.md`, `README.md`, `CODEX.md`, `CLAUDE.md`, `.github/prompts/`, `.claude/agents/` y `.opencode/commands/harness.md` hacen explícito el loop `plan -> execute -> verify -> review -> analyze -> route_back`.
- R11 -> `scripts/smoke-stdio.mjs` cubre creación del loop al entrar en `in_progress`, lectura por tool/resource, retries válidos e inválidos, `loop_summary` en surfaces ricas y reconciliación por `setup --update`/`repair`.

## Verificación

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`
