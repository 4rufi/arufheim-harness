# Design

## Goal

Cerrar el gap entre “configurado” y “operativamente listo” sin cambiar el contrato duro de health ni relajar los guardrails de bindings/configs.

## Touch

- `src/health.ts`
- `src/status.ts`
- `src/setup.ts`
- `src/repair.ts`
- `src/init.ts`
- `src/help.ts`
- `README.md`
- `CODEX.md`
- `CLAUDE.md`
- `.claude/commands/harness.md`
- `.opencode/commands/harness.md`
- `scripts/smoke-stdio.mjs`
- `scripts/release-check.sh`
- `.github/workflows/*`

## Main decisions

1. No cambiar `client_verification.state` base.
   Se añadirá una capa derivada de “activation/readiness” para UX de CLI y docs, sin romper snapshots existentes.

2. Reusar health como fuente única.
   `setup`, `repair` y `status` derivarán el resumen por cliente desde `HarnessHealthSnapshot`.

3. Unificar el protocolo de arranque textual.
   Los adapters generados deben pedir primero `harness_status(mode: "brief_only")` y, si no existe, usar `arufheim-harness status --brief --json`.

4. CI de release con modo limpio controlado.
   El workflow ejecutará `release:check` con override explícito de dirty worktree, manteniendo el gate local estricto.

## Constraints

- No romper `doctor --json`, `status --brief --json` ni el shape persistido de `health.json`.
- No sobreescribir configs globales inválidas del usuario.
- No introducir un daemon o verificador GUI nuevo en esta feature.

