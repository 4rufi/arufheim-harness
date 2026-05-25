# Frontend Adapters

Describe qué parte del arnés es común y qué parte depende del cliente.

## Core común

- layout en `.harness/` y `.harness-docs/`
- `startup_brief`
- `mem_context`
- artifacts en `specs/` y `.harness/progress/`
- contracts versionados del arnés

## Claude

- usa `CLAUDE.md`
- roles en `.claude/agents/`
- comando corto en `.claude/commands/harness.md`

## Codex

- usa `CODEX.md`
- mismo flujo central del `leader`
- adapta tono/herramientas al runtime Codex

## Copilot

- usa `.github/copilot-instructions.md`
- prompts en `.github/prompts/`
- mismas transiciones y artifacts que Claude/Codex

## OpenCode

- usa `.opencode/opencode.json`
- comando corto en `.opencode/commands/harness.md`
- puede usar MCP e instructions del repo
- puede mapear permisos por tool o wildcard
- puede usar agents/subagents según frontend
- billed tokens del provider pueden o no estar expuestos al arnés

## Capability matrix

- MCP: Claude / Codex / Copilot / OpenCode = sí
- startup contract del arnés: sí
- permission policy local del harness: sí
- metrics de tokens facturados por provider: depende del frontend

## Regla

Las diferencias por frontend viven en adapters/prompts. El contrato operativo,
la memoria, el workflow y los artifacts siguen siendo los mismos.
