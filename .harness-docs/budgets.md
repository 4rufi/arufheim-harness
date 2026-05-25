# Budgets

Los budgets existen para evitar loops ruidosos, inflación de memoria y gasto
innecesario de tokens.

## Action budget v1

- máximo `2` retries equivalentes para la misma acción
- máximo `1` escalado de contexto antes de decidir
- si una acción `R2` o `R3` no da señal nueva tras retries razonables, parar
- si el trabajo real requiere más intentos, documenta por qué en `progress/`

## Memory budget v1

- una memoria nueva debe comprimir o consolidar
- si el mismo tema ya existe, usar `topic_key` y actualizar
- preferir `mem_session_summary` al cierre en vez de muchas observaciones sueltas
- no convertir memoria en bitácora cruda del trabajo

## Context budget v1

- arranca con `brief`
- sube a `summary` o `full` solo si la siguiente decisión lo exige
- no abras historial, diseño o memoria larga “por si acaso”

## Regla

Si un budget se rompe, debe quedar razón explícita en el artifact de la sesión.
