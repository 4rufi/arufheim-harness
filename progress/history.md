# Historial

Este archivo es append-only. Cada sesión cerrada deja un resumen corto:

- fecha
- feature
- cambios principales
- verificación ejecutada
- bloqueos o follow-ups

- 2026-05-18 | repo_resources | Se creó la spec inicial (`requirements`, `design`, `tasks`) y la feature pasó a `spec_ready`. | Revisión de arnés actual + API del SDK para resources. | Pendiente aprobación humana antes de implementar.
- 2026-05-19 | repo_resources | Se implementaron los resources `hermess://config/resolved` y `hermess://logs/main`, con logging de lecturas y smoke MCP por cliente stdio. | `./node_modules/.bin/tsc -p tsconfig.json` + `node scripts/smoke-stdio.mjs`. | `init.sh` no pudo correrse en este sandbox por falta de `pnpm` en PATH.
- 2026-05-19 | hardening_followups | Se bloquearon escapes por symlink y glob, `run_command` ahora propaga errores MCP, `raw_config` soporta ausencia de archivo, `init.sh` exige evidencia SDD y el smoke cubre estos contratos. | `PATH="/private/tmp:$PATH" ./init.sh`. | Próximo frente: `safe_write_file` con flujo SDD completo.
