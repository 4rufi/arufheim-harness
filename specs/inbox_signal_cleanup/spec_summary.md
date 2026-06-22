Goal
- Reducir ruido operativo del inbox excluyendo `README.md` y archivos reservados de todas las superficies visibles.

Touch
- `src/workflow.ts`
- `src/tools/inbox.ts`
- `src/tools/harness-status.ts`
- `src/agent.ts`
- `src/tui.ts`
- `scripts/smoke-stdio.mjs`

Constraints
- No borrar ni mover `README.md`.
- Regla única y compartida, sin duplicación.
- Mantener el contrato actual de las tools.

Verify
- `./init.sh`

Tasks
- T1 regla central
- T2 aplicar filtro
- T3 smoke
- T4 cierre
