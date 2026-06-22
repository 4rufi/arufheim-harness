# Implementación — repo_bootstrap_contract_alignment

## Objetivo

Hacer que un repo scaffolded parcialmente por cliente siga siendo coherente:
`init.sh` real, `CODEX.md` sin dependencias de Claude y `doctor` sin warnings por
adapters omitidos a propósito.

## Cambios

- `src/config.ts`
  - se usa `scaffold.localClients` como metadata persistida para el scaffold repo-local
- `src/init.ts`
  - nuevo `init.sh` repo-local ejecutable
  - `CODEX.md` ahora apunta a `AGENTS.md`, no a `.claude/agents/leader.md`
  - `runInitLocal` persiste `scaffold.localClients` y muestra mensaje de activación por target
- `src/health.ts`
  - `doctor` filtra checks cliente según `scaffold.localClients`
  - `init.sh` pasa a formar parte del scaffold core esperado del layout actual
- `scripts/smoke-stdio.mjs`
  - smoke nuevo para `setup --clients codex`
  - actualización del contrato smoke para `CODEX.md` e `init.sh`
- `README.md`
  - documenta `init.sh` repo-local y el comportamiento correcto de `setup --clients codex`

## Verificación ejecutada

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

## Trazabilidad

- R1 -> `readExpectedLocalScaffoldClients()` + `filterManagedFileChecks()` en `src/health.ts`
- R2 -> `SCAFFOLD_REPO_INIT_SH` + `writeExecutableIfAbsent()` en `src/init.ts`
- R3 -> `SCAFFOLD_CODEX_MD_TEMPLATE` en `src/init.ts` + smoke de contrato Codex-only
- R4 -> `renderLocalActivationMessage()` en `src/init.ts`
- R5 -> `smokeCodexOnlySetupContract()` + README actualizado
