# Implementación: inbox_signal_cleanup

Registro de implementación para la feature SDD de limpieza de señal del inbox.

## Archivos tocados

- `src/workflow.ts`
- `src/tools/inbox.ts`
- `src/tools/harness-status.ts`
- `src/agent.ts`
- `src/tui.ts`
- `scripts/smoke-stdio.mjs`
- `specs/inbox_signal_cleanup/tasks.md`

## Trazabilidad R -> verificación

- R1 -> revisión de `src/workflow.ts`: `INBOX_RESERVED_BASENAMES`, `isPendingInboxEntryName()` y `listPendingInboxEntries()` centralizan la exclusión de `README.md`.
- R2 -> revisión de `src/tools/inbox.ts` y `./init.sh`: `inbox_list` usa `listPendingInboxEntries()` y ya no expone archivos reservados.
- R3 -> revisión de `src/tools/harness-status.ts` y `./init.sh`: el snapshot de `harness_status` calcula `inbox_count` desde la regla compartida.
- R4 -> revisión de `src/agent.ts`: `readWorkflowBrief()` usa `listPendingInboxEntries()` y elimina ruido del `WorkflowBrief`.
- R5 -> revisión de `src/tui.ts`: el panel Inbox reutiliza la misma regla compartida.
- R6 -> revisión de `src/tools/inbox.ts` y smoke: `inbox_consume` rechaza archivos reservados con error explícito.
- R7 -> `./init.sh` / smoke: el fixture hidden-layout valida que `README.md` no aparece en status ni `inbox_list`, y que `inbox_consume("README.md")` falla.

## Verificación ejecutada al cierre de la feature

- `./init.sh`
