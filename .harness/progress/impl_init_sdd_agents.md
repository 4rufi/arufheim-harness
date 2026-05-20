# Implementación: init_sdd_agents

Registro retrospectivo para dejar la evidencia SDD exigida por el arnés.

## Archivos tocados

- `src/init.ts`
- `README.md`
- `specs/init_sdd_agents/tasks.md`

## Trazabilidad R -> verificación

- R1 -> revisión de `src/init.ts`: `AGENT_PROMPTS` contiene seis prompts y `runInit()` los escribe en `.github/prompts/`.
- R2 -> revisión de `src/init.ts`: `CLAUDE_AGENT_FILES` contiene seis agentes y `runInit()` los escribe en `.claude/agents/`.
- R3 -> revisión de `src/init.ts`: `runInit()` crea `AGENTS.md` mediante `AGENTS_MD_CONTENT`.
- R4 -> revisión de `src/init.ts`: prompts y agentes usan `AGENTS_VERSION_MARKER`.
- R5 -> revisión de `src/init.ts`: `runInit()` reescribe archivos cuando falta el marker esperado durante `init --update`.
- R6 -> revisión manual de templates en `src/init.ts`: las referencias de archivos y tools quedan dentro del bootstrap soportado por harness.

## Verificación ejecutada al cierre de la feature

- `./scripts/pnpmw.sh typecheck`
- `./scripts/pnpmw.sh build`
- inspección manual de `runInit()` y templates versionados
