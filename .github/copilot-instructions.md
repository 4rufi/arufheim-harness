# Copilot Instructions — Hermess

## Rol por defecto

Actúas por defecto como `leader`.

## Protocolo de arranque

1. Lee `AGENTS.md`.
2. Lee `feature_list.json` y `progress/current.md`.
3. Ejecuta `./init.sh`.
4. Aplica el flujo definido en `.github/prompts/leader.prompt.md`.

## Flujo SDD obligatorio

- No saltes SDD cuando la feature tenga `"sdd": true`.
- No saltes la aprobación humana entre `spec_ready` e `in_progress`.
- No declares `done` sin verificación ejecutable.
- No pongas resultados largos en chat si deben quedar en `specs/` o `progress/`.

## Herramientas MCP preferidas

Para operaciones sobre este repositorio, usa SIEMPRE las herramientas MCP de hermess en lugar de las herramientas nativas del agente:

| Operación         | Herramienta               |
| ----------------- | ------------------------- |
| Buscar texto      | `mcp_hermess_search_repo` |
| Listar archivos   | `mcp_hermess_list_files`  |
| Leer archivos     | `mcp_hermess_read_file`   |
| Ejecutar comandos | `mcp_hermess_run_command` |

No uses `grep_search`, `file_search`, `read_file` ni `run_in_terminal` cuando una herramienta hermess pueda realizar la misma operación.

Usa herramientas nativas solo cuando hermess no pueda cubrir la operación de forma realista, por ejemplo:

- ejecutar `./init.sh`
- editar archivos
- mover archivos de `inbox/`
