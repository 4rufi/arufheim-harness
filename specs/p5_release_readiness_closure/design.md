# Design

## Decision

Cerrar la release con cambios mínimos pero explícitos: distinguir `setup` de `setup --update`, hacer que el update global sí pueda reescribir la entrada gestionada de cada cliente, subir versión menor y dejar un gate de release ejecutable dentro del repo.

## Touch

- `src/init.ts`
- `src/setup.ts`
- `src/repair.ts`
- `src/help.ts`
- `src/index.ts`
- `package.json`
- `README.md`
- `scripts/smoke-stdio.mjs`
- `scripts/release-check.sh`

## Constraints

- No romper `init` ni `repair` existentes.
- `setup` por defecto debe converger a un repo listo con el menor cambio necesario; `--update` debe forzar reconciliación del scaffold/entry gestionado.
- El check de release no debe depender de `~/.npm`.
- No intentar limpiar automáticamente cambios ajenos del worktree; solo fallar si no está limpio.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./scripts/release-check.sh`
- `./init.sh`
