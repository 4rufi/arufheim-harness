# Implementación — p11_activation_contract_and_release_gate

## Objetivo

Cerrar el bloque P1 de operabilidad: estados claros por cliente, adapters coherentes y gate automático de release.

## Cambios

- Se añadió `client_readiness` como capa derivada sobre `client_verification` en `src/health.ts`.
- `setup`, `repair`, `doctor`, `status` y `tui` ahora muestran estados operativos por cliente y el siguiente paso cuando no están listos.
- Se alinearon `CODEX.md`, `CLAUDE.md`, `.claude/commands/harness.md`, `.opencode/commands/harness.md` y sus templates para usar el mismo protocolo `harness_status(mode: "brief_only")` con fallback CLI.
- Se reconciliaron los bindings repo-scoped de Codex con `--client codex`.
- Se añadió `.github/workflows/ci.yml` para correr `typecheck`, `build`, `smoke` y `release:check`.
- Se extendió `scripts/smoke-stdio.mjs` para validar `client_readiness`, la promoción de Claude Desktop asumido y la convergencia de Codex.

## Verificación

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
- `npm run release:check -- --allow-dirty`

## Trazabilidad

- R1 -> `src/health.ts` deriva `client_readiness`; verificado con `node dist/index.js doctor --repo-path . --json` y `node dist/index.js status --repo-path . --brief --json`.
- R2 -> `src/setup.ts`, `src/repair.ts` y `src/status.ts` imprimen resumen operativo por cliente; verificado con `node dist/index.js repair --repo-path . --clients codex` y `node dist/index.js status --repo-path . --brief`.
- R3 -> `client_verification` se conserva y `client_readiness` se añade de forma aditiva; verificado por `npm run typecheck` y por el shape JSON de `doctor/status`.
- R4 -> `src/init.ts`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/harness.md` y `.opencode/commands/harness.md` usan el mismo fallback `harness_status -> status --brief --json`; verificado por revisión de scaffold y `npm run smoke`.
- R5 -> `.codex/config.toml` y el scaffold de `src/init.ts` convergen con `--client codex`; verificado con `node dist/index.js repair --repo-path . --clients codex` y `node dist/index.js doctor --repo-path . --json`.
- R6 -> `.github/workflows/ci.yml` corre `typecheck`, `build`, `smoke` y `release:check`; verificado por revisión del workflow y `npm run release:check -- --allow-dirty`.
- R7 -> el workflow usa `HARNESS_RELEASE_ALLOW_DIRTY=1` solo para el gate de worktree limpio; verificado en `.github/workflows/ci.yml` y `npm run release:check -- --allow-dirty`.
