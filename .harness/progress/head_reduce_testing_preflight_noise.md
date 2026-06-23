# Head — reduce_testing_preflight_noise

- feature: 39:reduce_testing_preflight_noise
- goal: Hace que prompts, headroom y docs del harness traten la suite rápida como feedback contextual y no como chequeo universal previo a editar.
- loop: phase=plan attempt=1 review=0 next=leader
- requirements_focus: R1, R3, R2, R4, R5
- test_layer: smoke
- fast_command: pnpm test:unit
- integration_command: pnpm verify
- last_error: none
- last_strategy_delta: none
- next_action: Aterriza el cambio en tasks discretas y fija la capa de test sin convertir el tooling en un preflight universal.

## Minimal Files

- AGENTS.md
- specs/reduce_testing_preflight_noise/spec_summary.md
- specs/reduce_testing_preflight_noise/tasks.md
- .harness-docs/verification.md

## Testing Guidance

- Si el cambio necesita feedback rápido y este repo ya lo declara, usa `pnpm test:unit`. No hace falta validar binarios o versiones antes; corre el primer comando real cuando aplique.
- Si necesitas cierre de integración, usa `pnpm verify` después del cambio real; no como chequeo previo universal.
- La suite rápida ya está resuelta para este repo; úsala cuando el cambio lo amerite.
