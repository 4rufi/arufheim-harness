# Decision

Integrar la policy TDD en tres capas coordinadas: una suite rápida real con `Vitest` dentro del repo, una capa reusable de detección/configuración de testing para scaffold y un módulo interno `headroom` que derive `.harness/progress/head_<feature>.md` desde workflow + specs + loop + guidance de testing. `headroom` queda solo en `agent + prompts`; no se agrega surface pública nueva.

# Touch

- `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, `tests/**`
- `src/config.ts`, `src/config-command.ts`, `src/help.ts`
- `src/testing.ts` nuevo para autodetección y merge de commands
- `src/headroom.ts` nuevo para render/refresh del artifact `head_<feature>.md`
- `src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/agent.ts`
- `src/tools/harness-update.ts`, `src/tools/harness-loop-event.ts`
- `README.md`, `CHECKPOINTS.md`, `.harness-docs/*`, `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, prompts y agentes gestionados
- `scripts/smoke-stdio.mjs`

# Constraints

- No crear estados nuevos en backlog o loop.
- No volver obligatorio un “red phase” machine-readable para cerrar features.
- `headroom` debe ser interno en esta pasada; nada de tools/resources/campos públicos nuevos.
- La autodetección debe ser conservadora: reutiliza el stack existente y no instala tooling en repos consumidores.
- `allowedCommands` solo se expande por merge; no se pisan personalizaciones.

# Verify

- `./scripts/pnpmw.sh typecheck`
- `./scripts/pnpmw.sh test`
- `./scripts/pnpmw.sh build`
- `./scripts/pnpmw.sh smoke`
- `./init.sh`

# Notes

- `head_<feature>.md` se refresca en puntos de mutación del workflow y al entrar al `agent`, lo que cubre drift razonable sin añadir watchers.
- La guidance de testing del scaffold sale de precedencia cerrada: config explícita -> autodetección -> fallback.
- La policy TDD se valida por docs/prompts/checklists y por tests; no por un nuevo bloqueo en `doctor`.
