# Implementación — p3_contract_hardening_followups

## Resumen

Se endurecieron cuatro superficies del arnés: cierre SDD en `harness_update`, binding de repo en `loadConfig`, lectura por rangos en `read_file` y edición operativa de config por CLI.

## Trazabilidad

- R1 -> `src/tools/harness-update.ts` exige `requirements.md`, `design.md`, `tasks.md` y `spec_summary.md` antes de permitir `spec_ready`, `in_progress` o `done` en features con `sdd: true`.
- R2 -> `src/tools/harness-update.ts` exige `impl_<feature>.md`, `review_<feature>.md`, trazabilidad `R<n> -> ...`, checklist marcada y veredicto `APROBADO/APPROVED` antes de archivar una feature SDD.
- R3 -> `src/config.ts` falla cerrado cuando solo existe el fallback global y falta `--repo-path` o `harness.config.json` local.
- R4 -> `src/tools/read-file.ts` rechaza `end_line < start_line` con error explícito.
- R5 -> `src/tools/read-file.ts` ahora recorre el archivo por streaming y calcula el preview sin depender de `readFile()` completo.
- R6 -> `src/config-command.ts`, `src/help.ts` y `README.md` aceptan y documentan `permissionPolicy.*`, `allowedCommands` e `ignored` vía `config set`.
- R7 -> `scripts/smoke-stdio.mjs` cubre fallback global ambiguo, rangos invertidos, cierre SDD inválido/ válido y mutaciones CLI de config.

## Verificación

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
