# Execution Engine

Define cómo se ejecutan tools y comandos.

## Principios

- seguridad antes que conveniencia
- resultados estructurados antes que texto libre
- timeouts explícitos
- retries limitados
- si el output no cambia, no seguir insistiendo

## Retry policy v1

- máximo `2` reintentos equivalentes
- si un retry falla igual, escala contexto o cambia estrategia
- si tras escalar sigue fallando, marca `blocked`

## Blocked policy v1

Marca `blocked` cuando:

- falta información esencial
- la verificación relevante sigue roja tras retries razonables
- una tool necesaria falla de forma persistente
- completar la task exige desviarse del spec aprobado

## Observation contract v1

Toda observación útil debe responder:

- `action`: qué se intentó
- `result`: qué pasó
- `error`: qué falló, si aplica
- `next_hint`: qué probar después

## Regla

No conviertas el arnés en un loop de comandos. Si una acción deja de producir
señal nueva, paras o escalas.

## Budget

Aplica `action budget v1` de `.harness-docs/budgets.md`.
