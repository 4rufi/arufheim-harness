# Implementación — startup_response_metrics_and_minimal_brief

## Objetivo

- medir bytes/tokens locales realmente devueltos por `harness_status` y `status`
- bajar el costo y la latencia del arranque con un modo `brief_minimal`

## Cambios

- `src/session-metrics.ts`
  - añade `response_output_bytes`, `response_output_tokens` y breakdown por surface
  - `estimated_local_tokens` ahora suma también bytes devueltos por surfaces medidas
- `src/status.ts`
  - añade `StatusMode = "brief_minimal"`
  - `brief_minimal` devuelve solo `startup_brief`, `repo_path`, `config_scope` y `doctor_summary`
  - evita leer backlog, `current.md` e inbox en ese modo
  - registra output real de `cli:status:*`
- `src/tools/harness-status.ts`
  - acepta `brief_minimal`
  - registra output real de `tool:harness_status:*`
- `src/tools/harness-metrics.ts`, `src/tui.ts`
  - exponen la métrica nueva
- docs y adapters
  - `README.md`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/`, `.opencode/commands/`, `.claude/agents/`, `.github/prompts/`, `.github/copilot-instructions.md`, `.harness-docs/model_interface.md`
  - el startup recomendado pasa a `brief_minimal`
  - `brief_only` queda como snapshot rico cuando hace falta activation/`client_readiness`
- `src/init.ts`
  - templates scaffolded alineados con `brief_minimal`
  - marker gestionado sube a `v4` para propagar el contrato vía `setup --update`
- `scripts/smoke-stdio.mjs`
  - nuevo smoke de `brief_minimal`
  - verifica persistencia de métricas por surface
  - mantiene cobertura de compatibilidad para `brief_only`

## Verificación final

- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p tsconfig.json`
- `node scripts/smoke-stdio.mjs`
- `node dist/index.js status --repo-path . --brief-minimal --json`
- `node dist/index.js status --repo-path . --brief --json`
- `./init.sh`

## Trazabilidad

- R1 -> `src/tools/harness-status.ts` registra `tool:harness_status:*` y `src/session-metrics.ts` persiste bytes/tokens por surface.
- R2 -> `src/status.ts` registra `cli:status:*` y `scripts/smoke-stdio.mjs` verifica persistencia en `session.json`.
- R3 -> `src/status.ts` añade `brief_minimal` con contrato mínimo: `startup_brief`, `repo_path`, `config_scope`, `doctor_summary`.
- R4 -> `buildHarnessStatus()` evita leer backlog, `current.md` e inbox cuando `mode === "brief_minimal"`.
- R5 -> `README.md`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/`, `.opencode/commands/`, `.claude/agents/`, `.github/prompts/`, `.github/copilot-instructions.md`, `.harness-docs/model_interface.md` y `src/init.ts` mueven el startup recomendado a `brief_minimal` sin quitar `brief_only`.
- R6 -> `scripts/smoke-stdio.mjs` cubre `brief_minimal`, métricas por surface y compatibilidad de `brief_only`.
