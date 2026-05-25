# Orchestration

Define cómo se reparten trabajo y responsabilidades entre agentes.

## Roles base

- `leader`: decide flujo y mueve estados
- `spec_author`: redacta spec
- `implementer`: implementa una sola feature
- `reviewer`: aprueba o rechaza
- `inbox_reader`: convierte input crudo en features
- `scoper`: acota el scope de sesión

## Handoff contract v1

- `spec_author`
  - output: `spec_ready -> specs/<name>/`
- `implementer`
  - output: `done -> .harness/progress/impl_<name>.md`
  - o `blocked -> .harness/progress/impl_<name>.md`
- `reviewer`
  - output: `APPROVED -> .harness/progress/review_<name>.md`
  - o `CHANGES_REQUESTED -> .harness/progress/review_<name>.md`

## Reglas

- una sola feature en `in_progress`
- solo `leader` cambia `.harness/feature_list.json`
- resultados largos viven en archivos, no en chat
- si un handoff no deja artifact, el handoff falló

## Flujo SDD

```text
pending -> spec_ready -> aprobación humana -> in_progress -> done
```

## Objetivo

Que la orquestación sea contrato explícito y no solo convención distribuida
entre prompts.
