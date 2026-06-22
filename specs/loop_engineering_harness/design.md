# Decision

Crear un módulo central `src/loop.ts` que concentre policy defaults, carga/guardado de loop files, reducción de eventos a estado derivado, validaciones de retry, resumen para surfaces y diagnósticos reutilizables por `doctor`, `repair`, `status`, `agent` y `harness_update`.

# Touch

- `src/loop.ts`: tipos, defaults, IO, reducción de estado, validación y diagnósticos.
- `src/config.ts`: `loopPolicy` opcional con defaults compatibles.
- `src/workflow.ts`: path de loops y helpers de identity/slug.
- `src/tools/harness-update.ts`: semilla/sincronización/cierre del loop file.
- `src/tools/harness-loop-status.ts`, `src/tools/harness-loop-event.ts`: surface MCP nueva.
- `src/status.ts`, `src/doctor.ts`, `src/health.ts`, `src/tui.ts`, `src/resources/repo-resources.ts`, `src/agent.ts`: consumo de `loop_summary`.
- `src/init.ts` + docs/prompts/adapters: contrato visible y upgrade managed.
- `scripts/smoke-stdio.mjs`: pruebas end-to-end del contrato nuevo.

# Constraints

- Una sola fuente de verdad para policy y derivación; no duplicar reglas de retry/budget en cada surface.
- Los loops viven fuera de `feature_list.json`; el backlog no cambia de semántica.
- `repair` no puede inventar historial ni cerrar features.
- El archivo del loop debe seguir siendo estable si cambia `feature_name`; la identidad es `feature_id`.

# Verify

- creación automática de loop file al pasar a `in_progress`
- compatibilidad de `brief_minimal`
- diagnósticos coherentes entre `doctor`, `harness://loop/active` y `harness_loop_status`
- propagación de templates vía `setup --update`

# Notes

- El loop file se preserva terminal para trazabilidad.
- `harness_loop_event` solo appendea eventos y luego recomputa el estado derivado completo.
- `agent` consume resumen, no el archivo crudo salvo que lo necesite por contexto.
