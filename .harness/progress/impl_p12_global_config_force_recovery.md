# Implementación — p12_global_config_force_recovery

## Objetivo

Añadir una ruta explícita para recuperar configs globales inválidas gestionadas
por el arnés, con backup previo y sin romper el fail-closed por defecto.

## Cambios

- `src/init.ts`
  - nuevo modo `forceManagedGlobal` para la capa global
  - clasificación explícita entre error recuperable de parseo y error no recuperable de lectura
  - cache de preflight por archivo para no reparsear ni duplicar backups
  - backup sidecar `*.arufheim-harness.invalid-backup.<timestamp>` antes de regenerar
  - `runInitGlobalWithClients()` y `init --global` soportan `--force-managed-global`
- `src/setup.ts`, `src/repair.ts`, `src/index.ts`
  - wiring del flag `--force-managed-global`
  - resumen operativo con `invalid_global_recovery` y rutas de backup cuando aplica
- `src/health.ts`
  - `doctor` ya propone `repair --global --force-managed-global` cuando detecta configs globales inválidas recuperables
- `src/help.ts`, `README.md`, `manual-release-checklist.md`
  - contrato nuevo documentado sin cambiar el default fail-closed
- `scripts/smoke-stdio.mjs`
  - smoke del fail-closed actualizado con el hint nuevo
  - smoke nuevo para recuperación exitosa con backup en Claude Desktop y Codex

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

## Trazabilidad

- R1 -> `readOptionalJsoncConfig()`, `readOptionalCodexGlobalConfig()` y `validateGlobalClientConfigs()` mantienen el fail-closed sin `--force-managed-global`.
- R2 -> `backupInvalidGlobalConfig()`, `resolveManagedJsoncConfig()` y `resolveManagedCodexGlobalConfig()` crean backup y fallback controlado solo con la bandera explícita.
- R3 -> `runInitGlobalWithClients()` sigue limitando la escritura a clientes globales seleccionados y no toca artifacts del workflow.
- R4 -> `renderManagedGlobalRecoverySummary()` expone backups creados en `setup`, `repair` e `init --global`.
- R5 -> help, README, checklist manual y smoke quedaron alineados con el contrato nuevo.
