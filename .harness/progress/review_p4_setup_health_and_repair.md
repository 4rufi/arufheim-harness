# Review — p4_setup_health_and_repair

- [x] `setup` agrega una capa recomendada sin romper `init`, `init --update`, `init --global` ni layouts legacy.
- [x] `doctor`, `repair`, `harness_status`, `harness://health`, la TUI y el banner comparten el mismo snapshot de health.
- [x] Los bindings/config peligrosos siguen saliendo como `error` bloqueante y las degradaciones no fatales quedan como `warn`.
- [x] El smoke cubre `setup`, idempotencia, `doctor --json`, `repair`, `harness://health` y los campos nuevos de `harness_status`.

## Veredicto

APROBADO
