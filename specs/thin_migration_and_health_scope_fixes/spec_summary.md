# Goal

Cerrar dos regresiones de compatibilidad del rollout `thin`: migración real full->thin y health repo-local contaminado por globals fuera de scope.

# Touch

`migrate.ts`, `health.ts`, `smoke-stdio.mjs` y verificación del repo.

# Constraints

No relajar la poda conservadora; no esconder problemas de clientes realmente esperados por el repo.

# Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`
