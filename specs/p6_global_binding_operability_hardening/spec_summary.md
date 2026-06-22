Goal: endurecer la operabilidad global del arnés sin romper el camino repo-scoped ni el contrato local.
Touch: `init`, `setup`, `repair`, `health`, `help`, `README`, `smoke`.
Constraints: no reescribir configs globales inválidas; repo-scoped sigue preferente; validación de portabilidad conservadora por cliente.
Verify: `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`.
Tasks: T1 writers globales fail-closed; T2 salida operativa post-setup; T3 doctor/health por cliente; T4 docs+smoke; T5 verify+cierre.
