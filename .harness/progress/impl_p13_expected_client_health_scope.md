# Implementación — p13_expected_client_health_scope

## Objetivo

Evitar que `setup`, `doctor` y el brief de un repo degraden o fallen por bindings de
clientes que ese repo no espera usar, sin ocultar bindings válidos que sí aplican
como fallback o que necesitan activación real.

## Cambios

- `src/health.ts`
  - nuevo mapeo entre `scaffold.localClients` y `HealthClientKey` observables
  - `evaluateHarnessHealth()` ahora limita checks repo-scoped y errores globales a los clientes esperados por el repo
  - los bindings globales válidos `explicit`, `portable` y `assumed` siguen apareciendo aunque no sean parte del scaffold local
  - `buildClientVerificationSnapshot()` y `buildClientReadinessSnapshot()` ya no muestran clientes irrelevantes como faltantes, pero preservan bindings/validaciones existentes
  - `readPersistedHarnessHealth()` reutiliza el mismo scope esperado para snapshots persistidos
- `scripts/smoke-stdio.mjs`
  - smoke nuevo `codex-only` con config global ajena rota para asegurar que `setup --clients codex` no cae por un Claude Desktop inválido
  - smoke de bindings globales asumidos sigue exigiendo que un binding válido se vea como `assumed` y luego promocione a `verified`

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

## Trazabilidad

- R1 -> `deriveExpectedHealthClients()` y `shouldInspectHealthClient()` fijan el scope observable desde `scaffold.localClients`.
- R2 -> `evaluateHarnessHealth()` filtra alerts repo-scoped/globales irrelevantes sin tocar los clientes esperados del repo.
- R3 -> `buildClientVerificationSnapshot()` y `buildClientReadinessSnapshot()` dejan de degradar por clientes no esperados, pero conservan bindings válidos ya presentes.
- R4 -> `smokeCodexOnlySetupContract()` cubre el caso reproducido de `setup` local afectado por un global inválido ajeno.
