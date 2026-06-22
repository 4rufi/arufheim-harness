Goal: cerrar huecos de contrato en cierre SDD, binding de repo, `read_file` y `config set`.
Touch: `harness-update`, `read-file`, `config`, `smoke`, `help`, `README`.
Constraints: mismo layout hidden/legacy, arrays por JSON en CLI, fail-closed solo para fallback global ambiguo.
Verify: `pnpm typecheck`, `pnpm build`, `pnpm smoke`, `./init.sh`.
Tasks: T1 validación SDD; T2 fail-closed global; T3 `read_file` incremental; T4 config CLI; T5 smoke+docs.
