# Design

Decision
- Centralizar la noción de “archivo pendiente de inbox” en `src/workflow.ts`.
- Reusar esa regla desde `inbox_list`, `harness_status`, `agent`, `tui` e `inbox_consume`.
- Cubrir la regresión en el smoke del layout hidden, donde siempre existe `README.md`.

Touch
- `src/workflow.ts`
- `src/tools/inbox.ts`
- `src/tools/harness-status.ts`
- `src/agent.ts`
- `src/tui.ts`
- `scripts/smoke-stdio.mjs`

Constraints
- No cambiar el layout ni el scaffold del inbox.
- Mantener `README.md` en el repo; solo sacarlo de la señal operativa.
- Evitar duplicar reglas de filtrado.

Verify
- `./init.sh`
