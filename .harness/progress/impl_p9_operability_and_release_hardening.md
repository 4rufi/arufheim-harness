# Implementación — p9_operability_and_release_hardening

## Objetivo

Cerrar la brecha operativa entre setup/runtime/release sin recortar features:
`repoPath` estable, fallback CLI de status, `brief_only` más barato y
`release:check` validando el tarball real.

## Cambios

- `src/init.ts`, `src/health.ts`, `src/setup.ts`, `src/repair.ts`
  - `repoPath` ahora se normaliza a ruta absoluta antes de persistir health o verificaciones
  - las verificaciones determinísticas/runtime guardan `binding.repo_path` y toleran registros legacy relativos
- `src/status.ts`, `src/index.ts`, `src/tools/harness-status.ts`
  - nueva capa compartida de status
  - nuevo comando `arufheim-harness status`
  - `harness_status` deja de duplicar lógica y `brief_only` evita blockers/métricas
  - el fallback CLI puede reutilizar health persistido sin esperar a que el frontend cargue tools
- `src/help.ts`, `README.md`, `manual-release-checklist.md`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/harness.md`, `.opencode/commands/harness.md`
  - documentación operativa del fallback `status --brief --json`
  - protocolo de arranque actualizado cuando el MCP no cargó `harness_status`
- `scripts/release-check.sh`
  - ya no valida solo `npm pack --dry-run`
  - ahora empaqueta, instala el tarball en un repo temporal y corre `setup` + `doctor`
- `scripts/smoke-stdio.mjs`
  - smoke nuevo para `setup --repo-path .` + `status --brief --json`
  - cobertura de ayuda para el nuevo surface `status`

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
- `npm run release:check -- --allow-dirty`

## Trazabilidad

- R1 -> normalización en `readInitRepoPath()`, `runInit()`, `evaluateHarnessHealth()` y persistencia de `client-verifications.json`.
- R2 -> `src/status.ts` + `index.ts` exponen `arufheim-harness status` con salida `--brief` y `--json`.
- R3 -> `buildHarnessStatus()` separa `brief_only` de `full`; el fallback CLI reutiliza health persistido y el tool evita cargas pesadas.
- R4 -> `scripts/release-check.sh` instala el tarball empaquetado y valida bootstrap/runtime desde el artefacto.
- R5 -> docs y smoke actualizados para el fallback CLI, la normalización de rutas y el gate de release.
