# Design

## Decision

Endurecer la capa global sin cambiar el flujo repo-scoped como camino preferente: los writers globales dejarán de recrear archivos inválidos, `doctor` pasará a validar portabilidad por cliente en vez de aceptar `"."` de forma universal, y `setup/repair --global` mostrarán instrucciones operativas explícitas después de escribir.

## Touch

- `src/init.ts`
- `src/setup.ts`
- `src/repair.ts`
- `src/health.ts`
- `src/help.ts`
- `README.md`
- `scripts/smoke-stdio.mjs`

## Constraints

- No romper `setup`, `repair` ni `doctor` locales.
- Repo-scoped sigue siendo la ruta preferente para Codex, Claude y VS Code.
- Si un config global es inválido, no se reescribe: el usuario debe corregirlo manualmente.
- La clasificación de bindings portables debe ser conservadora; mejor degradar que marcar verde un repo incorrecto.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

