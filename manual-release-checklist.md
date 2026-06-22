# Manual Release Checklist

Usa esta pasada manual además de `npm run release:check`.

Cuando cierres cada bloque, marca el item correspondiente en `release-readiness.json`
poniendo:

- `checked: true`
- `verified_at: "<ISO8601>"`
- `notes`: contexto breve si hace falta

Al final corre `npm run release:publish-check`.

## Gate de publish

1. Deja worktree limpio.
2. Corre `npm run release:check`.
3. Si falla solo por worktree sucio, puedes depurarlo con `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check`, pero no publiques todavía.
4. Ejecuta la pasada manual de clientes debajo cuando toques integraciones MCP o antes de una release importante.
5. Actualiza `release-readiness.json` con el estado real de cada bloque.
6. Corre `npm run release:publish-check`.

## Repo base

`release-readiness.json` → `repo_base`

1. En un repo limpio corre `arufheim-harness setup`.
2. Corre `arufheim-harness doctor --json`.
3. Confirma `doctor_summary.status`, `repo_path`, `config_scope`, `binding_status`, `client_verification` y `client_readiness`.
4. Si el frontend aún no cargó tools MCP, usa `arufheim-harness status --brief --json` como fallback y confirma el mismo `repo_path`.

## VS Code

`release-readiness.json` → `vscode`

1. Corre `arufheim-harness setup --global --clients copilot`.
2. Abre el repo en VS Code.
3. Recarga la ventana.
4. Inicia `arufheim-harness` desde el panel MCP.
5. Fuerza una llamada a `harness_status(mode: "brief_only")`.
6. Confirma que `repo_path` coincide con el workspace abierto.
7. `setup` ya debería dejar `client_readiness.vscode.state=verified`; el arranque real confirma el repo observado.

## Claude Desktop

`release-readiness.json` → `claude_desktop` (`required=false`; márcalo solo si ese cliente entra en scope para la release o si realmente lo configuraste y validaste)

1. Corre `arufheim-harness setup --global --clients claude`.
2. Reinicia Claude Desktop.
3. Fuerza una llamada a `harness_status`.
4. Confirma que `repo_path` coincide con el repo esperado.
5. Si el binding usa `--repo-path "."`, confirma que `client_readiness.claude_desktop.state` queda en `verified`.

## Claude Code

`release-readiness.json` → `claude_code_repo_scoped`

1. Valida el camino repo-scoped y el global por separado.
2. Para el camino híbrido, corre `arufheim-harness setup --global --repo-path /ruta/al/repo --clients claude-code`.
3. Confirma que el repo quedó con `.mcp.json`.
4. Abre el repo en Claude Code.
5. Fuerza una llamada inicial a `harness_status`.
6. Confirma que `repo_path` coincide con el repo actual y no con otro workspace previo.
7. Confirma que `client_readiness.claude_code.state=verified` sin depender del binding global.

## Claude Code global puro

`release-readiness.json` → `claude_code_global_assumed` (`required=false`; márcalo solo si cubriste ese caso)

1. Valida el fallback global por separado si quieres cubrir el caso `assumed`.
2. Abre el repo en Claude Code.
3. Fuerza una llamada inicial a `harness_status`.
4. Confirma que `repo_path` coincide con el repo actual y no con otro workspace previo.
5. Si estás probando el binding repo-scoped, `setup` ya debería haber dejado `client_readiness.claude_code.state=verified`.
6. Si estás probando el binding global `assumed`, confirma que ese arranque lo lleva a `verified`.

## Codex

`release-readiness.json` → `codex_repo_scoped`

1. Para el camino repo-scoped o híbrido, corre `arufheim-harness setup` o `arufheim-harness setup --global --repo-path /ruta/al/repo --clients codex`.
2. Abre ese repo en Codex.
3. Confirma que el arranque usa `.codex/config.toml`.
4. Fuerza una llamada a `harness_status`.
5. Confirma `repo_path` antes de mutar estado.
6. Si usas `.codex/config.toml` repo-scoped, `setup` ya debería dejar `client_readiness.codex.state=verified`.
7. Si pruebas el binding global `assumed`, confirma que ese arranque lo lleva a `verified`.
8. Si la sesión no cargó `harness_status`, usa `arufheim-harness status --brief --json` desde el repo antes de seguir.

## OpenCode

`release-readiness.json` → `opencode`

1. Valida que `.opencode/opencode.json` carga el MCP.
2. Confirma que el command generado funciona.
3. Revisa que la policy `allow`/`ask` coincide con lo esperado.
4. Fuerza una llamada a `harness_status` y valida `repo_path`.
5. `setup` ya debería dejar `client_readiness.opencode.state=verified`.

## Escenarios rotos

`release-readiness.json` → `broken_global_recovery`

1. Prepara un config global inválido para VS Code, Claude o Codex.
2. Corre `arufheim-harness doctor`.
3. Corre `arufheim-harness setup --global` o `arufheim-harness repair --global`.
4. Confirma que el comando falla cerrado.
5. Confirma que el archivo inválido no fue sobrescrito.
6. Corre `arufheim-harness repair --global --force-managed-global --clients <cliente>`.
7. Confirma que el comando crea un backup al lado del archivo roto y regenera una config válida gestionada por el arnés.

## Publish gate

Antes de publicar, `release-readiness.json` debe:

- apuntar a la misma versión que `package.json`
- tener todos los checks `required=true` en `checked: true`
- dejar los checks opcionales sin marcar salvo que realmente los hayas cubierto y validado
- tener `verified_at` para cada check completado

Gate final:

```bash
npm run release:publish-check
```
