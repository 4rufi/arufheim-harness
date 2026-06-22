# Review — startup_response_metrics_and_minimal_brief

## Resultado

Aprobado.

## Puntos revisados

- [x] `harness_status` y `status` ya registran bytes/tokens locales de response por surface.
- [x] `brief_minimal` devuelve solo el snapshot mínimo prometido.
- [x] `brief_minimal` evita cargar backlog/`current.md`/inbox en el hot path de arranque.
- [x] `brief_only` sigue disponible para snapshots ricos con activation/`client_readiness`.
- [x] Docs, prompts, comandos y templates scaffolded recomiendan `brief_minimal`.
- [x] El marker gestionado subió a `v4`, así que `setup --update` puede propagar el contrato nuevo.
- [x] Smoke cubre el modo nuevo y la persistencia de métricas por surface.
