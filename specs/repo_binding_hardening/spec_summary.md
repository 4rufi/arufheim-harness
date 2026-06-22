Goal
- Evitar que `arufheim-harness` quede unido en silencio al repo equivocado y hacer visible ese binding desde el primer `harness_status`.

Touch
- `src/init.ts`
- `src/doctor.ts`
- `src/tools/harness-status.ts`
- `init.sh`
- `README.md`
- `CODEX.md`
- `scripts/smoke-stdio.mjs`

Constraints
- No romper el flujo local actual de VS Code y OpenCode.
- Codex y Claude Code deben quedar configurables por repo, no solo por usuario.
- `doctor` debe señalar bindings ambiguos sin requerir al usuario inspección manual.

Verify
- `./init.sh`

Tasks
- T1 scaffold repo-scoped
- T2 global + docs
- T3 status visible
- T4 doctor/init/smoke
- T5 cierre
