# Implementación — p10_release_and_brief_closure

## Objetivo

Cerrar los cuatro huecos detectados en el flujo completo: packaging de release
docs, cobertura del artefacto publicado, costo residual del startup brief y
desalineación del changelog.

## Cambios

- `package.json`
  - el paquete npm ahora incluye `manual-release-checklist.md`
- `scripts/release-check.sh`
  - el gate del tarball instalado valida que la checklist venga dentro del paquete
  - ejecuta `setup`, `status --brief --json`, rompe `current.md`, corre `repair` y termina con `doctor --json`
  - acepta ruta lógica o canónica (`/var` vs `/private/var`) al verificar `repo_path`
- `src/health.ts`
  - `archived_count` pasa a formar parte del snapshot de health persistido/fresco
  - el conteo sale de `feature_history.json` durante la evaluación de health
- `src/status.ts`
  - `buildHarnessStatus()` deja de leer `feature_history.json` para el brief
  - `archived_count` y `archived_features_count` salen desde health compartido
- `README.md`, `CHANGELOG.md`
  - docs y changelog alineados con el gate real y el fallback `status`

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
- `npm run release:check -- --allow-dirty`

## Trazabilidad

- R1 -> `package.json#files` incluye `manual-release-checklist.md`; `release-check` lo verifica dentro del paquete instalado.
- R2 -> `scripts/release-check.sh` ejecuta `setup`, `status`, `repair` y `doctor` sobre el tarball instalado.
- R3 -> `src/health.ts` persiste `archived_count`; `src/status.ts` lo consume sin reparsear `feature_history.json`.
- R4 -> `CHANGELOG.md` y `README.md` describen el gate y fallback reales.
