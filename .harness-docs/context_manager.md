# Context Manager

Decide qué entra al contexto y cuándo.

## Niveles

1. `brief`
   - `startup_brief`
   - `harness_loop_status` si hay feature activa
   - `mem_context`
2. `summary`
   - `spec_summary.md`
   - `.harness/progress/current.md`
3. `full`
   - `requirements.md`
   - `tasks.md`
   - `design.md` solo si hace falta
4. `code`
   - archivos tocados
   - verificación relevante

## Regla de escalado

- no abras backlog completo si `startup_brief` alcanza
- no abras specs completas si `harness_loop_status` ya te dice fase, intento y budget
- no abras `design.md` si `spec_summary.md` resuelve la tarea
- no abras historial salvo bloqueo o duda real
- si una lectura no cambia la decisión siguiente, no era necesaria

## Qué no se lee por defecto

- `.harness/feature_history.json`
- `.harness/progress/history.md`
- memoria completa
- specs completas de otras features

## Objetivo

Mantener el hot path corto sin perder capacidad de escalar contexto cuando haga
falta.
