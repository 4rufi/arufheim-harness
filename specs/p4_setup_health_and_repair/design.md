# Design

## Decision

Encapsular la complejidad actual detrás de una capa operativa nueva (`setup`, `repair`, health compartido) sin recortar funcionalidades ni cambiar el contrato fuerte de `init.sh`, SDD, backlog, memoria o bindings repo-scoped.

## Touch

- `src/index.ts`
- `src/init.ts`
- `src/doctor.ts`
- `src/help.ts`
- `src/tui.ts`
- `src/resources/repo-resources.ts`
- `src/tools/harness-status.ts`
- `src/workflow.ts` o un módulo nuevo de health/verification
- `scripts/smoke-stdio.mjs`
- `README.md`

## Constraints

- Mantener compatibilidad con layouts `hidden` y `root-legacy`.
- `init` sigue siendo primitive low-level; `setup` solo lo orquesta y resume.
- `repair` no puede tocar artefactos humanos ni workflow state ajeno al scaffold/config gestionado por el arnés.
- `doctor`, `repair`, `status`, resource y TUI deben compartir clasificación; no se permite duplicar reglas ad hoc por superficie.
- El health usado por `status`/TUI/banner debe ser suficientemente barato para no meter verificaciones pesadas en cada arranque; la verificación completa sigue en `doctor` / `init.sh`.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

## Notes

- Conviene separar un evaluador reutilizable de diagnósticos y un renderer CLI para `doctor`.
- `last_verified_at` puede persistirse en un artefacto gestionado por el arnés para que `status` y `tui` muestren la última verificación fuerte sin recomputar todo.
- `setup` debe poder operar tanto repo-local como global; `--clients` necesita filtrar la instalación global sin introducir otra surface incompatible.
