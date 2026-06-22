Goal: mover la validación cliente desde la checklist manual al runtime con handshake persistido y estados de verificación visibles.
Touch: `init`, `config`, `index`, `health`, `harness_status`, `tui`, `resources`, `README`, `help`, `smoke`.
Constraints: sin romper clientes viejos, sin tool manual obligatoria, persistencia repo-local y promoción a verificado solo con evidencia vigente.
Verify: `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`.
Tasks: T1 identidad cliente; T2 persistencia+stale; T3 surfaces health/status/tui; T4 docs+smoke; T5 verify+cierre.
