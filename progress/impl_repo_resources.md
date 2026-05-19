# Implementación: repo_resources

Registro retrospectivo para dejar la evidencia SDD exigida por el arnés.

## Archivos tocados

- `src/resources/repo-resources.ts`
- `src/index.ts`
- `src/safety.ts`
- `scripts/smoke-stdio.mjs`
- `README.md`
- `feature_list.json`
- `progress/current.md`
- `progress/history.md`
- `specs/repo_resources/tasks.md`

## Trazabilidad R -> verificación

- R1 -> `pnpm smoke`: `listResources()` expone `hermess://config/resolved`.
- R2 -> `pnpm smoke`: `listResources()` expone `hermess://logs/main`.
- R3 -> `pnpm smoke`: `readResource("hermess://config/resolved")` devuelve JSON con `allowedCommands`.
- R4 -> `pnpm smoke`: `readResource("hermess://logs/main")` devuelve contenido textual cuando el log existe.
- R5 -> revisión de implementación en `src/resources/repo-resources.ts`: el resource de log responde texto vacío con `_meta.exists=false` si el archivo aún no existe.
- R6 -> revisión de implementación en `src/resources/repo-resources.ts` + helpers de `src/safety.ts`: ambas rutas quedan confinadas a `repoPath`.
- R7 -> revisión de API MCP en `src/index.ts`: solo se registran resources de lectura; no se añadieron tools de escritura.
- R8 -> `pnpm smoke` + revisión de `src/resources/repo-resources.ts`: cada lectura registra `resource_read_started` y `resource_read_finished`.
- R9 -> `pnpm typecheck` + `pnpm build` + `pnpm smoke`: las tools `list_files`, `read_file`, `search_repo` y `run_command` siguieron operativas.
- R10 -> revisión manual de `README.md`: resources documentados para clientes MCP compatibles.

## Verificación ejecutada al cierre de la feature

- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
