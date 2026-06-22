# Design

## Decision

Extender `setup --global` y `repair --global` para que, cuando detecten un repo harness explícito o el cwd de un repo harness, además de escribir configs globales generen los bindings repo-scoped preferidos para `claude-code` y `codex`. Esto preserva compatibilidad con la surface global actual, pero mueve la UX operativa hacia el binding determinístico cuando existe repo.

## Touch

- `src/setup.ts`
- `src/repair.ts`
- `src/init.ts`
- `README.md`
- `src/help.ts`
- `manual-release-checklist.md`
- `scripts/smoke-stdio.mjs`

## Constraints

- No escribir scaffold repo-scoped cuando `--global` se corre fuera de un repo harness detectable.
- No eliminar ni romper la config global existente.
- Mantener el flujo actual para VS Code global y para Claude Desktop global.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
