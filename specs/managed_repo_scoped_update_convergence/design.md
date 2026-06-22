# Design

## Decision

Tratar `CODEX.md`, `CLAUDE.md`, `copilot-instructions`, `OpenCode command` y las
entradas MCP repo-scoped como assets managed reconciliables en `setup --update`.

## Touch

- `src/init.ts`
- `scripts/smoke-stdio.mjs`

## Constraints

- preservar contenedores JSON existentes mientras se actualiza solo la entrada `arufheim-harness`
- no ocultar errores `EPERM` / `EACCES` al escribir assets managed
- `AGENTS.md` sigue con tratamiento especial por bloque managed, no overwrite total

## Verify

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`
