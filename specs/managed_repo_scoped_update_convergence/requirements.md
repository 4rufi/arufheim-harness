# Requirements

- R1. `setup --update` DEBE reconciliar archivos managed repo-scoped existentes cuando su contenido del harness quedó desactualizado.
- R2. `setup --update` DEBE actualizar bindings repo-scoped para incluir `--client` cuando falte en `.codex/config.toml`, `.mcp.json`, `.vscode/mcp.json` u `.opencode/opencode.json`.
- R3. `setup --update` DEBE actualizar `CODEX.md` y demás entrypoints managed cuando el scaffold actual cambió.
- R4. SI una reconciliación managed falla por permisos o acceso, ENTONCES `setup --update` DEBE fallar claro y no esconder el error.
- R5. Smoke DEBE cubrir el caso de repo con bindings/entrypoints repo-scoped viejos y confirmar convergencia.
