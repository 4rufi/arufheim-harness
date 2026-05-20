# Progress

`progress/` guarda estado operativo, no notas libres.

## Archivos

- `current.md`: sesión viva
- `history.md`: cierre append-only
- `explore_<topic>.md`: exploración opcional
- `impl_<feature>.md`: evidencia de implementación
- `review_<feature>.md`: veredicto de review
- `spec_<feature>.md`: bloqueo del spec

## Reglas

- `current.md` se actualiza en tiempo real y se resetea al cerrar
- `history.md` solo agrega al final
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

## `explore_*.md`

Si existe, mantenlo corto:
- `Pregunta`
- `Archivos analizados`
- `Hallazgos`
- `Riesgos`
- `Decisión / siguiente paso`
