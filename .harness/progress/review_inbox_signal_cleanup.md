# Review: inbox_signal_cleanup

## Checklist

- [x] La regla de exclusión quedó centralizada en `src/workflow.ts`.
- [x] `inbox_list`, `harness_status`, `agent` y `tui` consumen la regla compartida.
- [x] `inbox_consume` bloquea archivos reservados del inbox.
- [x] El smoke cubre exclusión de `README.md` y rechazo de consumo reservado.
- [x] `./init.sh` quedó verde con la feature implementada.

## Veredicto

APROBADO
