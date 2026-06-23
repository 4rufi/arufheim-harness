# Head — tdd_partial_and_headroom_phase1

- feature: 38:tdd_partial_and_headroom_phase1
- goal: Formaliza TDD por capas, añade suite rápida con Vitest, autodetección de fastCommand/integrationCommand y un artifact head_<feature>.md consumido por agent y prompts.
- loop: phase=plan attempt=1 review=0 next=leader
- requirements_focus: R1, R2, R10, R3, R6, R7, R9, R8
- test_layer: smoke
- fast_command: pnpm test:unit
- integration_command: pnpm verify
- last_error: none
- last_strategy_delta: none
- next_action: Aterriza el cambio en tasks discretas y fija la capa de test antes de editar código.

## Minimal Files

- AGENTS.md
- specs/tdd_partial_and_headroom_phase1/spec_summary.md
- specs/tdd_partial_and_headroom_phase1/tasks.md
- .harness-docs/verification.md

## Testing Guidance

- Comando rápido sugerido para este repo: `pnpm test:unit`.
- Comando de integración sugerido para este repo: `pnpm verify`.
- La suite rápida ya está resuelta para este repo.
