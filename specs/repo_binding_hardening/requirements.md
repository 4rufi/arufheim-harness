# Requirements

R1. El scaffold local DEBE generar una configuración repo-scoped para Codex en `.codex/config.toml` que fije `arufheim-harness` al repo actual.
R2. El scaffold local DEBE generar una configuración repo-scoped para Claude Code en `.mcp.json` que fije `arufheim-harness` al repo actual.
R3. El scaffold local DEBE seguir generando configuraciones repo-scoped explícitas para VS Code y OpenCode.
R4. `init --global` DEBE dejar entradas de VS Code, Claude Desktop y Claude Code con `--repo-path` explícito en vez de depender de defaults implícitos del servidor.
R5. `harness_status` DEBE exponer `repo_path`, `config_path`, `config_scope` y `workflow_layout` en modo `brief_only` y `full`.
R6. `startup_brief` DEBE incluir señal suficiente para detectar si el servidor está unido al repo equivocado antes de mutar estado.
R7. `doctor` DEBE validar las configuraciones repo-scoped de Codex y Claude Code, además de detectar configuraciones ambiguas de binding en los archivos del repo y en las integraciones globales controladas por el arnés.
R8. `init.sh` DEBE tratar `.codex/config.toml` y `.mcp.json` como artefactos base del scaffold actual.
R9. El smoke DEBE cubrir los nuevos artefactos repo-scoped y la visibilidad de `repo_path/config_path` en `harness_status`.
