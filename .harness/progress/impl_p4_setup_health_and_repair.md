# Implementación — p4_setup_health_and_repair

## Resumen

Se añadió una capa operativa de `setup`, `doctor`, `repair` y `health` compartido sobre el arnés existente, preservando `init`, `init.sh`, SDD, backlog, memoria y compatibilidad de layouts.

## Trazabilidad

- R1 -> `src/setup.ts` orquesta scaffold, bindings repo-scoped, validación final y resumen legible apoyándose en `runInit(..., update:true)` y `evaluateHarnessHealth(...)`.
- R2 -> `src/client-selection.ts`, `src/init.ts`, `src/index.ts`, `src/help.ts` y `README.md` añaden `setup --repo-path/--global/--clients`, soporte `init --codex` y compatibilidad con `init`/`doctor`.
- R3 -> `src/health.ts` y `src/doctor.ts` exponen diagnósticos estructurados con `code`, `severity`, `blocking`, `message`, `detected_at`, `fix_available`, `fix_command` y `fix_hint`; `doctor --json` serializa ese contrato estable.
- R4 -> `src/repair.ts` reutiliza el mismo modelo de health y solo reejecuta scaffold/config/bindings gestionados por el arnés; los archivos humanos inválidos quedan como `fix_hint` manual.
- R5 -> `src/tools/harness-status.ts` añade `alerts`, `binding_status`, `doctor_summary`, `last_verified_at` y `degraded_mode`, todos derivados del snapshot común.
- R6 -> `src/resources/repo-resources.ts`, `src/tui.ts` y `src/index.ts` exponen `harness://health`, alertas activas en TUI y banner MCP con `repo/config/layout/health`.
- R7 -> `src/health.ts` clasifica bindings/config peligrosos como `error + blocking`, mantiene degradaciones no fatales como `warn`, y persiste `last_verified_at` en `.harness/metrics/health.json`.
- R8 -> `scripts/smoke-stdio.mjs`, `src/help.ts` y `README.md` cambian la narrativa al flujo `setup -> doctor -> repair -> init.sh` y verifican compatibilidad de `init`, `doctor`, `tui` y resources.

## Verificación

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
