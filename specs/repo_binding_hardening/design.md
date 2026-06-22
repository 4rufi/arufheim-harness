# Design

## Objetivo

Hacer explícito el binding entre una instancia MCP de `arufheim-harness` y el repo que debe operar, reduciendo la posibilidad de que un cliente reutilice una configuración global apuntando a otro workspace.

## Cambios

1. Scaffold local por frontend:
   - Añadir `.codex/config.toml` con un bloque `[mcp_servers.arufheim-harness]` repo-scoped.
   - Añadir `.mcp.json` con `mcpServers.arufheim-harness` repo-scoped para Claude Code.
   - Mantener `.vscode/mcp.json` y `.opencode/opencode.json` con `--repo-path` explícito.

2. Endurecimiento de init global:
   - VS Code global seguirá usando config MCP, pero con `--repo-path` explícito.
   - Claude Desktop y Claude Code globales pasarán `--repo-path .` como binding explícito de proceso, en vez de depender del default del servidor.
   - Esto sigue siendo menos robusto que el scaffold repo-scoped, por lo que la documentación debe marcar el camino local como preferente.

3. Visibilidad en runtime:
   - `harness_status` incluirá `repo_path`, `config_path`, `config_scope` y `workflow_layout`.
   - `startup_brief` añadirá señal de repo/layout para hacer el mismatch evidente al arranque.

4. Validación:
   - `doctor` comprobará `.codex/config.toml`, `.mcp.json`, `.vscode/mcp.json` y `.opencode/opencode.json`.
   - Si encuentra una integración global de `arufheim-harness` sin `--repo-path`, la marcará como riesgosa.
   - `init.sh` exigirá los nuevos artefactos del scaffold actual.

## Decisiones

- Para Codex y Claude Code se privilegia configuración repo-scoped porque ambos soportan archivos por proyecto.
- Para Codex se usa `.codex/config.toml` porque el producto soporta capas de configuración por proyecto.
- Para Claude Code se usa `.mcp.json` porque el producto soporta scope `project` en ese archivo.
- La detección temprana se apoya en `harness_status`, no en heurísticas del agente.
