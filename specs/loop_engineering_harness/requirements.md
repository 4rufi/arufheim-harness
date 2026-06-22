# Requirements

- R1. El sistema DEBE persistir un estado machine-readable de loop por feature en `.harness/metrics/loops/<feature_id>_<feature_slug>.json`.
- R2. El sistema DEBE modelar el loop como `plan_execute_verify` con `phase`, `attempt_index`, `review_round`, `next_actor`, budgets, `last_error_signature`, `last_strategy_delta`, `no_progress_streak`, `repeated_failure_streak` y `events[]`.
- R3. El sistema DEBE inicializar el loop file cuando una feature entra en `in_progress`, mantenerlo alineado si la feature se renombra y marcarlo terminal cuando la feature cierra en `done` o `blocked`.
- R4. El sistema DEBE exponer `harness_loop_status`, `harness_loop_event` y el resource `harness://loop/active`.
- R5. `harness_loop_event` DEBE rechazar retries equivalentes sin `strategy_delta` cuando el evento implica route-back o reintento tras un fallo/rechazo comparable.
- R6. El sistema DEBE exponer `loop_summary` en `harness_status`, `status --json`, `doctor --json` y `tui`; en `brief_minimal` solo DEBE añadir una señal compacta `loop=<phase>:a<attempt>` dentro de `startup_brief`.
- R7. `doctor` DEBE detectar loop file faltante para una feature `in_progress`, loops terminales inconsistentes con la feature, features terminales con loop abierto, retries equivalentes sin `strategy_delta` y budgets agotados con la feature aún `in_progress`.
- R8. `repair` y `setup --update` DEBEN reparar solo drift gestionado por el harness: scaffold/docs/prompts del loop y loop file inicial faltante para la feature activa.
- R9. El modo `agent` DEBE incorporar `loop_summary` y señales del último rechazo/fallo, `strategy_delta` previo y budgets restantes para routing y contexto base, sin mutar el repo automáticamente.
- R10. El scaffold gestionado por `src/init.ts`, junto con `README.md`, `AGENTS.md`, `CODEX.md`, `CLAUDE.md`, prompts y docs de contrato, DEBE hacer explícito el loop `plan_execute_verify` y el route-back automático.
- R11. El smoke DEBE cubrir creación del loop al entrar en `in_progress`, lectura del estado activo, registro de eventos, rechazo de retries inválidos, surfaces ricas con `loop_summary` y reconciliación por `setup --update`/`repair`.
