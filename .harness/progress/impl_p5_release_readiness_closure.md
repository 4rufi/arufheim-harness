# Implementación — p5_release_readiness_closure

## Resumen

Se cerraron los hallazgos de release-readiness pendientes: contrato explícito de `setup --update`, reconciliación real de bindings globales gestionados, bump de versión pública y gate de publicación reproducible.

## Trazabilidad

- R1 -> `src/setup.ts`, `src/help.ts` y `README.md` distinguen `setup` de `setup --update`; el modo normal converge con el menor cambio necesario y `--update` fuerza reconciliación.
- R2 -> `src/init.ts` ahora hace upsert de entradas globales gestionadas para VS Code, Claude Desktop, Claude Code y Codex; `src/repair.ts` usa esa ruta con `update: true`.
- R3 -> `package.json`, `src/index.ts`, `CHANGELOG.md` y el `npm pack --dry-run` actualizado publican `1.1.0` como nueva surface del paquete y del servidor MCP.
- R4 -> `scripts/release-check.sh` valida worktree limpio, `npm run typecheck`, `npm run build`, `npm run smoke` y `npm pack --dry-run` con cache temporal; soporta `HARNESS_RELEASE_ALLOW_DIRTY=1` para depuración local.
- R5 -> `README.md`, `src/help.ts` y `scripts/smoke-stdio.mjs` reflejan `setup --update`, `release:check`, versión `1.1.0` y la reconciliación global gestionada.

## Verificación

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./scripts/release-check.sh` (fallo esperado con worktree sucio)
- `HARNESS_RELEASE_ALLOW_DIRTY=1 ./scripts/release-check.sh`
- `./init.sh`
