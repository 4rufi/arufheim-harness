# Memory System

La memoria existe para recuperar solo contexto relevante, no para guardar toda
la sesión cruda.

## Tipos

- episódica: decisiones y eventos concretos
- semántica: hechos o restricciones estables del repo
- resumen de sesión: cierre compacto de una sesión
- observación puntual: detalle recuperable con `mem_get_observation`

## Tools

- `mem_context`: snapshot corto para arranque
- `mem_search`: búsqueda por relevancia
- `mem_get_observation`: detalle puntual
- `mem_save`: memoria estructurada (`what/why/where/learned`)
- `mem_session_summary`: cierre compacto de sesión

## Reglas

- no guardar raw tool spam
- usa `topic_key` si el tema evoluciona
- resume antes de duplicar
- si una memoria no ayuda a decidir algo futuro, no la guardes
- prefiere `mem_session_summary` para cierres y `mem_save` para decisiones puntuales
- no uses memoria como reemplazo de `progress/` o del spec actual

## Retrieval contract v1

1. `mem_context`
2. `mem_search` solo si falta contexto
3. `mem_get_observation` solo si hace falta detalle

## Save policy v1

- `mem_save`: una decisión, fix o hallazgo reusable
- `mem_session_summary`: resumen final de sesión
- `topic_key`: cuando actualizas el mismo tema en vez de abrir otro hilo

## Budget

- una memoria debe comprimir, no duplicar
- si el mismo tema ya existe y solo cambió un detalle, actualiza
- si una sesión deja muchas observaciones sueltas, resume y cierra

Aplica `memory budget v1` de `.harness-docs/budgets.md`.

## Objetivo

Sobrevivir a compaction y ahorrar tokens sin perder decisiones importantes.
