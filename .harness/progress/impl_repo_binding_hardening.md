# Implementación: repo_binding_hardening

Registro de implementación para la feature SDD de hardening del binding MCP por repo.

## Archivos tocados

- `src/init.ts`
- `src/doctor.ts`
- `src/tools/harness-status.ts`
- `src/help.ts`
- `README.md`
- `CODEX.md`
- `init.sh`
- `scripts/smoke-stdio.mjs`
- `.mcp.json`
- `.codex/config.toml`
- `specs/repo_binding_hardening/tasks.md`

## Trazabilidad R -> verificación

- R1 -> revisión de `src/init.ts`, scaffold real del repo y `./init.sh`: se genera `.codex/config.toml` repo-scoped con `arufheim-harness`.
- R2 -> revisión de `src/init.ts`, scaffold real del repo y `./init.sh`: se genera `.mcp.json` repo-scoped para Claude Code con `--repo-path`.
- R3 -> revisión de `src/init.ts`, `src/doctor.ts` y smoke: VS Code y OpenCode mantienen `--repo-path` explícito y ahora `doctor` lo valida.
- R4 -> revisión de `src/init.ts`: `init --global` escribe `--repo-path` explícito para VS Code, Claude Desktop, Claude Code y añade opción de Codex.
- R5 -> revisión de `src/tools/harness-status.ts` y smoke: `harness_status` expone `repo_path`, `config_path`, `config_scope` y `workflow_layout` en modo `brief_only` y `full`.
- R6 -> revisión de `src/tools/harness-status.ts` y smoke: `startup_brief` incorpora identidad de repo y layout para detectar mismatches al arranque.
- R7 -> revisión de `src/doctor.ts` y `./init.sh` / smoke: `doctor` valida `.vscode/mcp.json`, `.mcp.json`, `.codex/config.toml`, `.opencode/opencode.json` y detecta bindings globales ambiguos sin romper compatibilidad legacy.
- R8 -> revisión de `init.sh`: `.codex/config.toml` y `.mcp.json` quedan exigidos como artefactos base.
- R9 -> `./init.sh` / smoke: el scaffold verifica `.mcp.json` y `.codex/config.toml`, y `harness_status` verifica visibilidad de `repo_path/config_path`.

## Verificación ejecutada al cierre de la feature

- `./init.sh`
