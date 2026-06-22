# Design

## Decision

`evaluateHarnessHealth()` derivará un conjunto de `HealthClientKey` esperados desde `scaffold.localClients`. Ese conjunto filtrará checks repo-scoped/globales y el snapshot de verification/readiness. Para la familia Claude, el cliente local `claude` cubre `claude_code` y `claude_desktop`.

## Touch

- `src/health.ts`
- `scripts/smoke-stdio.mjs`

## Constraints

- Si el repo todavía no tiene `harness.config.json`, el comportamiento sigue amplio como hoy.
- Los globales shadowed por repo-scoped válido no deben bloquear aunque el archivo global esté roto.
- No se cambia el contrato de recovery explícito; solo su alcance dentro del health repo-local.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
