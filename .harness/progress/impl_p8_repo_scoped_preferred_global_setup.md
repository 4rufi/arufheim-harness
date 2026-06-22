# Implementación — p8_repo_scoped_preferred_global_setup

## Objetivo

Hacer que `setup --global` y `repair --global` no dejen a `Claude Code` y `Codex`
dependiendo solo del fallback global ambiguo cuando ya existe un repo utilizable.

## Cambios

- `src/global-mode.ts`
  - nuevo helper para resolver un `repo_context` seguro en modo global
  - distingue `--repo-path` explícito de cwd detectable como repo harness
  - evita escribir scaffold local en cwd arbitrarios
  - centraliza el scaffold repo-scoped preferido y la pre-verificación determinística
- `src/setup.ts`, `src/repair.ts`
  - el modo global ahora puede operar en modo híbrido: config global + scaffold repo-scoped preferido
  - el summary expone `repo_context` y `repo_scoped_preferred`
- `src/init.ts`
  - `renderGlobalActivationSteps` ahora distingue cuando Claude Code o Codex ya tienen binding repo-scoped preferido
  - se exportó `readExplicitInitRepoPath` para reutilizar el parseo seguro de `--repo-path`
- `scripts/smoke-stdio.mjs`
  - nuevo smoke para validar que el modo global no contamina cwd arbitrarios
  - smoke para `setup --global --repo-path <repo>` y `repair --global` con repo detectable
  - el caso `assumed` quedó aislado a `claude-desktop`
- `README.md`, `src/help.ts`, `manual-release-checklist.md`
  - documentan el camino híbrido global + repo-scoped y el uso de `--repo-path`

## Verificación ejecutada

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `./init.sh`

## Trazabilidad

- R1 -> `resolveGlobalRepoContext` + `scaffoldPreferredRepoScopedBindings` en `src/global-mode.ts`; uso desde `src/setup.ts` y `src/repair.ts`.
- R2 -> detección solo por `--repo-path` explícito o markers fuertes del repo harness; smoke de cwd arbitrario sin contaminación.
- R3 -> summaries globales con `repo_context` y `repo_scoped_preferred`; `renderGlobalActivationSteps` ahora diferencia la ruta preferente repo-scoped.
- R4 -> actualización de `README.md`, `src/help.ts`, `manual-release-checklist.md` y smoke dedicado al flujo híbrido.
