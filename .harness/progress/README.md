# Progress

`progress/` guarda estado operativo, no notas libres.

## Archivos

- `current.md`: sesión viva
- `history.md`: sesiones relevantes append-only
- `explore_<topic>.md`: exploración opcional
- `impl_<feature>.md`: evidencia de implementación
- `review_<feature>.md`: veredicto de review
- `spec_<feature>.md`: bloqueo del spec

## Reglas

- `current.md` se actualiza en tiempo real y se resetea al cerrar
- `history.md` solo agrega al final
- registra en `history.md` toda sesión con cambios en código, docs, config o workflow, y toda decisión útil de preservar
- no registres sesiones sin efecto ni exploración descartable que no deje una decisión o cambio concreto
- nombres válidos: `README.md`, `current.md`, `history.md`, `explore_*.md`, `impl_*.md`, `review_*.md`, `spec_*.md`
- no agregues headings nuevas a `current.md`
- `explore_*.md` es opcional
- `Agente` en `history.md` debe ser real: `Codex`, `humano (Martín)`, `leader -> implementer -> reviewer`

## `current.md`

Debe conservar:
- `Feature en curso`
- `Inicio`
- `Agente`
- `## Plan`
- `## Bitácora`
- `## Próximo paso`

## `history.md`

Cada entrada usa:
- `Agente`
- `Plan`
- `Cambios`
- `Verificación`
- `Cierre`

Úsalo tanto para features completas como para fixes pequeños, ajustes de flujo, migraciones, bootstrap, cambios de tooling o decisiones operativas que el siguiente agente deba entender.

## `explore_*.md`

Si existe, mantenlo corto:
- `Pregunta`
- `Archivos analizados`
- `Hallazgos`
- `Riesgos`
- `Decisión / siguiente paso`
