# Implementación — managed_repo_scoped_update_convergence

## Objetivo

Cerrar el gap donde `setup --update` dejaba archivos repo-scoped viejos sin
reconciliar aunque el scaffold nuevo ya conociera el contrato correcto.

## Cambios

- `src/init.ts`
  - nuevo `writeManagedFile()` para entrypoints managed completos
  - `.vscode/mcp.json`, `.mcp.json` y `.opencode/opencode.json` ahora actualizan la entrada `arufheim-harness` existente
  - `.codex/config.toml` ahora reemplaza la sección `mcp_servers.arufheim-harness` existente
  - errores `EPERM` / `EACCES` ya no se silencian en reconciliaciones managed
- `scripts/smoke-stdio.mjs`
  - smoke nuevo que degrada artificialmente `CODEX.md` y bindings repo-scoped, corre `setup --update` y exige `doctor` en `ok`

## Verificación

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

## Trazabilidad

- R1 -> `writeManagedFile()` + uso en `CODEX.md`, `CLAUDE.md`, `copilot-instructions` y `OpenCode command` dentro de `src/init.ts`
- R2 -> `ensureVSCodeMcpServer()`, `ensureClaudeProjectMcpServer()`, `ensureCodexMcpServer()` y `ensureOpenCodeConfig()` en `src/init.ts`
- R3 -> reconciliación managed de `CODEX.md` y demás entrypoints en `src/init.ts`
- R4 -> `isPermissionLikeError()` + rethrow de `EPERM/EACCES` en `src/init.ts`
- R5 -> `smokeRepoScopedManagedUpdate()` en `scripts/smoke-stdio.mjs`

## Nota

En este workspace concreto, `.codex/config.toml` no es escribible por la policy
del runtime Codex, así que la mejora adicional fue hacer ese fallo visible en vez
de esconderlo.
