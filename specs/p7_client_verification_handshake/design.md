# Design

## Decision

Mover la verificación desde la checklist al runtime usando identidad de cliente en los bindings generados. Cada frontend lanzará `arufheim-harness` con un identificador estable de cliente; el servidor persistirá una verificación por repo cuando vea ese arranque y health comparará esa evidencia contra la configuración actual para derivar `verified`, `stale` o `missing`.

## Touch

- `src/init.ts`
- `src/config.ts`
- `src/index.ts`
- `src/health.ts`
- `src/tools/harness-status.ts`
- `src/tui.ts`
- `src/resources/repo-resources.ts`
- `README.md`
- `src/help.ts`
- `scripts/smoke-stdio.mjs`

## Constraints

- No romper clientes que todavía usen bindings sin identidad de cliente.
- La verificación debe ser local-first y persistirse dentro del repo, no en estado global externo.
- No introducir una tool manual obligatoria para registrar la verificación.
- `doctor` debe seguir siendo conservador: solo promover a verificado cuando la evidencia siga vigente.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
