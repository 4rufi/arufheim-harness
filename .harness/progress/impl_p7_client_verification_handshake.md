# Implementación — p7_client_verification_handshake

## Objetivo

Mover la validación de bindings cliente desde la checklist manual a una verificación repo-local automática registrada por el runtime.

## Cambios

- `src/init.ts`
  - los bindings repo-scoped y globales generados ahora incluyen `--client`
  - Claude Desktop y Claude Code usan identidades distintas en config global
- `src/config.ts`
  - `loadConfig` resuelve `clientId` y `configScope`
- `src/index.ts`
  - el arranque del MCP registra verificación repo-local por cliente antes de evaluar health
  - el banner ahora expone `config_scope` y `client`
- `src/health.ts`
  - persistencia de verificación por cliente en `.harness/metrics/client-verifications.json`
  - estados `configured`, `verified`, `stale`, `missing`
  - promoción de bindings globales `assumed` a `verified` cuando existe evidencia vigente
  - warnings de upgrade cuando un binding gestionado todavía no declara `--client`
- `src/tools/harness-status.ts`, `src/doctor.ts`, `src/tui.ts`
  - exponen `client_verification` en status, doctor y TUI
- `scripts/smoke-stdio.mjs`
  - valida `--client` en bindings generados
  - valida `client_verification` en `harness_status` y `harness://health`
  - cubre la promoción `assumed -> verified` tras un arranque real del cliente
- `README.md`, `src/help.ts`, `manual-release-checklist.md`
  - documentan el contrato de upgrade y la verificación automática

## Verificación ejecutada

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

## Trazabilidad

- R1 -> bindings repo/global generados con `--client` y checks de identidad en `health.ts`; smoke de scaffold y repair global.
- R2 -> `recordRuntimeClientVerification` y persistencia en `.harness/metrics/client-verifications.json`; invalidación por `binding_signature`, `binding_scope` y `config_scope`.
- R3 -> `client_verification` en `HarnessHealthSnapshot`, `harness_status`, `harness://health` y TUI.
- R4 -> promoción de globals `assumed` a `verified` en `health.ts`; smoke de Claude Desktop con transición `configured -> verified`.
- R5 -> actualización de `README.md`, `src/help.ts`, `manual-release-checklist.md` y asserts nuevos en `scripts/smoke-stdio.mjs`.
