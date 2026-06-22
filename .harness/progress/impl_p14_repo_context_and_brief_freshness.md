# Implementación — p14_repo_context_and_brief_freshness

## Objetivo

Cerrar dos fallos P1 operativos:

- evitar que `setup/repair --global` trate como repo válido un cwd con markers débiles
- evitar que `status --brief` reutilice `health.json` cuando la evidencia observada ya cambió

## Cambios

- `src/global-mode.ts`
  - la auto-detección de repo ya no acepta un `feature_list.json` suelto como evidencia suficiente
  - el camino detectado hidden sigue aceptando markers fuertes del scaffold actual
  - el camino root-legacy ahora exige `feature_list.json` más al menos un marker compañero real del workflow legacy
- `src/health.ts`
  - el snapshot persistido de health ahora guarda una firma ligera de inputs observados
  - la firma mezcla `exists` y `mtime` según sensibilidad: bindings/configs/listas usan `mtime`; archivos de presencia usan `exists`
  - `readPersistedHarnessHealth()` invalida el cache cuando cambian o desaparecen esos inputs
- `src/status.ts`
  - `status --brief` sigue prefiriendo cache, pero si el snapshot persistido es viejo o no confiable recalcula health y refresca `health.json`
- `scripts/smoke-stdio.mjs`
  - smoke nuevo para refresh de `status --brief` tras romper `.codex/config.toml`
  - smoke de globals preferidos ahora cubre cwd con marker débil y repo legacy real detectado

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- repro manual: `setup --global` en cwd con solo `feature_list.json` ya no scaffoldea repo local
- repro manual: tras borrar `.codex/config.toml`, `status --brief --json` pasa a `degraded` y coincide con `doctor --json`
- `./init.sh`

## Trazabilidad

- R1 -> `isDetectableHarnessRepo()` deja de aceptar markers débiles aislados.
- R2 -> `resolveGlobalRepoContext()` mantiene `--repo-path` explícito intacto.
- R3 -> `StoredHealthSnapshot.input_signature` y `isStoredHealthSnapshotFresh()` validan frescura antes de reutilizar cache.
- R4 -> `readStatusHealth()` refresca health en `brief_only` cuando el snapshot persistido ya no coincide con los inputs observados.
- R5 -> smoke cubre tanto el falso positivo de repo detectado como el stale brief.
