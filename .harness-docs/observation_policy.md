# Observation Policy

Define cómo se registra el resultado de una acción para que el loop de trabajo
pueda decidir el siguiente paso.

## Observation contract v1

Toda observación útil responde:

- `action`: qué se intentó
- `result`: qué pasó
- `error`: qué falló, si aplica
- `next_hint`: qué conviene intentar después

## Calidad mínima

- concreta, no narrativa
- basada en output real
- comparable con la observación anterior
- corta; si hace falta detalle, va al artifact correspondiente

## Retry guidance

- si la observación nueva es sustancialmente igual a la anterior, no seguir igual
- tras `2` retries equivalentes, cambia estrategia o escala contexto
- si el output no mejora tras escalar, marca `blocked`

Aplica `action budget v1` de `.harness-docs/budgets.md`.

## Dónde vive

- estado vivo: `.harness/progress/current.md`
- evidencia larga: `.harness/progress/impl_<name>.md`, `.harness/progress/review_<name>.md`
- memoria reusable: `mem_save` o `mem_session_summary`
