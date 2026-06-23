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
  - incluye `## Test Plan`, `## Attempt N`, `## Red -> Green Evidence`, `## Verification` y `## Exception Justification` cuando aplique
  - deja explícita la capa de feedback elegida: `unit`, `contract` o `smoke`
- `reviewer`
  - output: append a `.harness/progress/review_<name>.md`
  - incluye `## Review N`, veredicto y clasificación `verification_failed | review_rejected | tool_failure | context_gap | external_blocker`
  - valida que cada requirement observable tenga la capa correcta de feedback o una excepción justificada

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

## TDD parcial por capas

- `unit-first` cuando el comportamiento es claro, rápido y determinista
- `contract-first` para salidas públicas estables de CLI/MCP
- `smoke-driven` para setup, repair, release, stdio y bindings
- trabajo exploratorio de diseño/UX puede diferir la capa rápida hasta fijar el contrato

## Objetivo

Que la orquestación sea contrato explícito y no solo convención distribuida
entre prompts.
