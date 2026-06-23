# Tasks

- [ ] T1 (R1-R2, R9-R11) Añadir `scaffold.layout`, inferencia `thin|full` y propagar `scaffold_layout` a config, setup, repair, health, status y detección de repo.
- [ ] T2 (R1-R2, R5-R6, R10-R11) Refactorizar `init/setup` para soportar `thin` por defecto en repos nuevos, `full` explícito y wrappers mínimos por cliente sin materializar assets compartidos.
- [ ] T3 (R3-R4, R10) Implementar `migrate --to thin` con `--dry-run`, `--json`, poda conservadora de assets `full` y preservación de overrides.
- [ ] T4 (R7-R8) Implementar `docs list`, `docs show <topic>` y resources `harness://docs/index` / `harness://docs/<topic>` desde una fuente de verdad compartida.
- [ ] T5 (R6, R13) Implementar `verify` como entrypoint consumidor y alinear help/README/AGENTS/CODEX/CLAUDE con el flujo nuevo.
- [ ] T6 (R12-R13) Extender tests unit/contract/smoke para layout thin/full, migración, docs CLI/MCP y guidance neutral `npm`/`yarn`/`pnpm`.
