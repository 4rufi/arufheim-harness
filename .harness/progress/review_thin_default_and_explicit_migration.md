# Review — thin_default_and_explicit_migration

## Review 1

- verdict: APPROVED
- classification: review_passed

- [x] `setup` usa `thin` por defecto en repo nuevo y `setup --layout full` sigue materializando el scaffold largo.
- [x] `setup --update` ya no migra layouts por sorpresa; `migrate --to thin` es el camino explícito.
- [x] `verify`, `docs list/show` y `harness://docs/*` quedaron operativos y cubiertos por verificación ejecutable.
- [x] `doctor/status/health` exponen `scaffold_layout` y la detección de repo válido dejó de aceptar markers legacy débiles.
- [x] El scaffold respeta `scaffold.localClients` reales desde el primer setup repo-local; el contrato codex-only quedó protegido por smoke.
- [x] README/CHANGELOG/help quedaron alineados con `thin` por defecto y `verify` como gate del repo consumidor.
- [x] La verificación ejecutada cubre `test`, `build`, `smoke`, `docs list`, `migrate --dry-run`, `verify --json` y luego `./init.sh` del repo harness.
