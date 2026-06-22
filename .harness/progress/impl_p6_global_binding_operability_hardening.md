# Implementación — p6_global_binding_operability_hardening

## Objetivo

Endurecer la capa global del arnés para no sobrescribir configs inválidas, distinguir bindings globales asumidos de bindings verificables y dejar pasos operativos claros por cliente.

## Cambios

- `src/init.ts`
  - validación previa de configs globales JSON/JSONC y TOML antes de escribir
  - fallo cerrado cuando el archivo global no parsea
  - salida común de activación/reinicio por cliente para rutas globales
- `src/setup.ts` y `src/repair.ts`
  - resumen global con guía de activación y validación manual
- `src/health.ts`
  - nuevos estados `assumed` y `global_assumed`
  - clasificación conservadora de bindings globales por cliente
- `scripts/smoke-stdio.mjs`
  - smoke de fail-closed sobre config global inválida
  - smoke de bindings globales asumidos con warning
- `README.md`, `src/help.ts`, `manual-release-checklist.md`
  - documentación del contrato nuevo y checklist manual por cliente

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

## Trazabilidad

- R1 -> `readOptionalJsoncConfig`, `readOptionalCodexGlobalConfig`, `validateGlobalClientConfigs`; smoke de preservación/fail-closed sobre configs globales inválidas.
- R2 -> `renderGlobalActivationSteps` consumido por `setup --global`, `repair --global` e `init --global`; smoke de salida operativa.
- R3 -> clasificación `portable`/`assumed`/`explicit`/`incompatible` en `health.ts` con reglas por cliente.
- R4 -> warnings accionables para bindings asumidos y errores para bindings ambiguos o inválidos; smoke de `doctor --json` con `state === "assumed"`.
- R5 -> actualización de `README.md`, `src/help.ts`, `manual-release-checklist.md` y asserts nuevos en `scripts/smoke-stdio.mjs`.
