# Design

## Decision

Introducir un contrato repo-local explícito de scaffold esperado:

- generar `init.sh` repo-local en repos bootstrappeados
- registrar en `harness.config.json` qué clientes locales fueron scaffolded
- hacer que `health` valide solo esos clientes esperados
- desacoplar `CODEX.md` de `.claude/agents/leader.md` y apoyarlo en `AGENTS.md` / workflow base
- mejorar mensaje de activación final según target local

## Touch

- `src/init.ts`
- `src/config.ts`
- `src/health.ts`
- `scripts/smoke-stdio.mjs`
- `README.md`
- `src/help.ts`

## Constraints

- compatibilidad backward con repos existentes sin metadata de clientes
- no romper setup completo actual
- `init.sh` repo-local debe ser autocontenido y usar `arufheim-harness` instalado

## Verify

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`
