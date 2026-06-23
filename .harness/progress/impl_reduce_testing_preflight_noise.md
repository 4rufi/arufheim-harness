# Implementación — reduce_testing_preflight_noise

## Test Plan

- `unit`: `tests/testing.test.ts` fija que la guidance derivada hable de uso contextual y no de preflight universal.
- `smoke`: `scripts/smoke-stdio.mjs` valida que `verification.md` y el prompt del implementer propaguen la regla nueva.
- `repo gate`: `./scripts/pnpmw.sh test`, `./scripts/pnpmw.sh smoke` y `./init.sh`.

## Attempt 1

- hypothesis: el ruido sale de prompts/templates/headroom más que del runtime de ejecución; si cambiamos la instrucción base y regeneramos scaffold, desaparece el preflight innecesario.
- strategy_delta: primer intento; corrección directa en guidance y scaffold managed.

### Cambios

- `src/testing.ts` ahora presenta `testing.fastCommand` / `integrationCommand` como comandos reales a usar cuando aplican, no como chequeos previos universales.
- `src/headroom.ts` dejó de empujar “verifica el tooling” y pasó a recomendar el primer comando real solo cuando el cambio lo necesita.
- `src/init.ts` endureció prompts, checkpoints y `verification.md` del scaffold para prohibir preflights de `pnpm --version` / `vitest --version` salvo fallo real o trabajo explícito sobre tooling/testing.
- `README.md`, `.harness-docs/verification.md` y `CHECKPOINTS.md` quedaron alineados con esa regla.
- `setup --update` regeneró `.github/prompts/implementer.prompt.md` y `.claude/agents/implementer.md` con el marker `v7`.

## Red -> Green Evidence

- `R1-R3 ->` `src/testing.ts`, `src/init.ts`, `.github/prompts/implementer.prompt.md`, `.claude/agents/implementer.md`
- `R4 ->` `src/headroom.ts`, `.harness/progress/head_reduce_testing_preflight_noise.md`
- `R5 ->` `README.md`, `.harness-docs/verification.md`, `CHECKPOINTS.md`, `scripts/smoke-stdio.mjs`

## Verification

- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh test`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh build`
- `node dist/index.js setup --repo-path . --update`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh smoke`
- `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./init.sh`

## Exception Justification

- No hizo falta cambiar el contrato público de `testing.fastCommand` ni introducir config nueva; el problema era de instruction pressure, no de feature surface.
