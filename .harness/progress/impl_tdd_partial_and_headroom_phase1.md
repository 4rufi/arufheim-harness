# Implementación — tdd_partial_and_headroom_phase1

## Test Plan

- `unit`: `tests/testing.test.ts` cubre autodetección, merge conservador y clasificación de test layer.
- `contract`: `tests/contracts.test.ts` y `tests/headroom.test.ts` fijan shapes de `doctor/status/simulate` y refresh de `head_<feature>.md`.
- `smoke`: `scripts/smoke-stdio.mjs` cubre scaffold, autodetección de `testing.*`, prompts/docs gestionados y refresh de `head_<feature>.md`.

## Attempt 1

- hypothesis: el cambio se puede cerrar sin tocar surfaces públicas nuevas si la guidance de testing vive en config/scaffold y `headroom` queda como artifact interno consumido por `agent` y prompts.
- strategy_delta: implementación inicial, sin route-back.

### Cambios

- Se añadió `Vitest` como suite rápida oficial y se separó `test/test:unit` de `smoke`.
- Se implementó `src/testing.ts` para `testing.fastCommand`, `testing.integrationCommand`, autodetección y merge conservador de `allowedCommands`.
- Se implementó `src/headroom.ts` y se conectó a `agent`, `setup`, `repair`, `harness_update` y `harness_loop_event`.
- Se propagó la policy TDD parcial y el nivel `head` a `README.md`, `.harness-docs/*`, `AGENTS.md`, `src/help.ts`, prompts/agentes y templates de `src/init.ts`.
- Se amplió `scripts/smoke-stdio.mjs` para validar autodetección, guidance de testing, fallback JS/TS vs no-JS y refresh de `head_<feature>.md`.
- Se endureció `scripts/pnpmw.sh` para reutilizar un `pnpm` cacheado antes de caer al shim de Corepack en entornos como este sandbox.

## Red -> Green Evidence

- `R1 ->` `package.json`, `init.sh`, `scripts/release-check.sh`, `tests/contracts.test.ts`, `scripts/pnpmw.sh`
- `R2 ->` `README.md`, `.harness-docs/verification.md`, `.harness-docs/orchestration.md`, `.harness-docs/planning_model.md`, `AGENTS.md`, `src/init.ts`
- `R3-R6 ->` `src/config.ts`, `src/config-command.ts`, `src/testing.ts`, `src/init.ts`, `src/setup.ts`, `src/repair.ts`
- `R7-R9 ->` `src/headroom.ts`, `src/agent.ts`, `.harness-docs/context_manager.md`, `src/tools/harness-update.ts`, `src/tools/harness-loop-event.ts`
- `R10 ->` `tests/testing.test.ts`, `tests/headroom.test.ts`, `tests/contracts.test.ts`, `scripts/smoke-stdio.mjs`, `./init.sh`

## Verification

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/vitest run`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `node dist/index.js setup --repo-path . --update`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./init.sh`

## Exception Justification

- No se añadió un surface público nuevo para `headroom`; la fase v1 queda interna por contrato.
- El `init.sh` verde en esta sesión requiere `COREPACK_HOME=/private/tmp/corepack-home` porque el `pnpm` shim del sandbox intenta hacer fetch; el repo ya quedó endurecido para reutilizar un `pnpm` cacheado cuando existe.
