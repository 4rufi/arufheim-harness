# Loop Contract

Define el loop operativo canónico del arnés. El runtime MCP, `status`,
`doctor`, `tui`, prompts y el modo `agent` hablan el mismo loop.

## Loop contract v2

Dentro de una feature `in_progress`, el subloop es:

```text
leader(plan)
-> implementer(execute attempt N)
-> verify
-> reviewer(review round N)
-> if fail/reject: analyze -> route_back -> implementer(attempt N+1)
-> if success: done
-> if budget exhausted / hard blocker / missing human input: blocked
```

## Reglas

- el `leader` es el único controller del loop
- `implementer` ejecuta un solo intento por handoff
- `reviewer` evalúa un solo intento por handoff
- todo retry requiere `strategy_delta` explícito
- si se repite el mismo `error_signature` sin progreso real, el loop escala a `blocked`
- el gate humano sigue viviendo entre `spec_ready` e `in_progress`

## Estado persistido

Cada feature activa puede tener un loop file en:

` .harness/metrics/loops/<feature_id>_<feature_slug>.json `

Campos base:

- `phase`
- `attempt_index`
- `review_round`
- `next_actor`
- `budgets`
- `last_error_signature`
- `last_strategy_delta`
- `no_progress_streak`
- `repeated_failure_streak`
- `events[]`

## Budgets por defecto

- `max_attempts_total = 3`
- `max_review_route_backs = 2`
- `max_no_progress_rounds = 2`
- `require_strategy_delta = true`
- `auto_route_back = true`

## Arranque

- parte desde `harness_status({ mode: "brief_minimal" })`
- si hay feature activa, consulta `harness_loop_status`
- trae `mem_context` solo si hace falta contexto reusable
- abre archivos adicionales solo cuando el brief o el loop no alcanzan

## Cierre

- `done` o `blocked` cierran el loop y preservan el archivo para trazabilidad
- `repair` puede sembrar el loop inicial faltante
- `repair` no reescribe historial de intentos ni cierra features por su cuenta
