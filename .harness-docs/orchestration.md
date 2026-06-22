# Orchestration

Define cómo se reparten trabajo y responsabilidades entre agentes.

## Roles base

- `leader`: decide flujo, mueve estados y controla el loop
- `spec_author`: redacta spec
- `implementer`: ejecuta un solo intento por handoff
- `reviewer`: aprueba o rechaza un solo intento por handoff
- `inbox_reader`: convierte input crudo en features
- `scoper`: acota el scope de sesión

## Handoff contract v2

- `spec_author`
  - output: `spec_ready -> specs/<name>/`
- `implementer`
  - output: append a `.harness/progress/impl_<name>.md`
  - incluye `## Attempt N`, hipótesis, cambios, checks, resultado y `strategy_delta`
- `reviewer`
  - output: append a `.harness/progress/review_<name>.md`
  - incluye `## Review N`, veredicto y clasificación `verification_failed | review_rejected | tool_failure | context_gap | external_blocker`

## Reglas

- una sola feature en `in_progress`
- solo `leader` cambia `.harness/feature_list.json`
- solo `leader` registra `route_back` y terminalidad del loop
- resultados largos viven en archivos, no en chat
- si un handoff no deja artifact, el handoff falló

## Flujo SDD

```text
pending -> spec_ready -> aprobación humana -> in_progress
in_progress -> plan -> execute -> verify -> review -> route_back? -> done|blocked
```

## Objetivo

Que la orquestación sea contrato explícito y no solo convención distribuida
entre prompts.
