# Progress

`progress/` guarda el estado operativo del harness. No es una carpeta de notas
libres.

## Archivos canónicos

- `current.md`: estado vivo de la sesión actual. Usa siempre la plantilla
  canónica con `Feature en curso`, `Inicio`, `Agente`, `## Plan`,
  `## Bitácora` y `## Próximo paso`.
- `history.md`: bitácora append-only de sesiones cerradas. Cada cierre añade un
  bloque con `Agente`, `Plan`, `Cambios`, `Verificación` y `Cierre`.
- `explore_<topic>.md`: notas opcionales de exploración o discovery para una
  duda técnica, una feature compleja o una decisión que conviene dejar
  documentada.
- `impl_<feature>.md`: evidencia del implementador para una feature; incluye
  archivos tocados, trazabilidad `R<n> -> verificación` y output relevante.
- `review_<feature>.md`: veredicto del reviewer con trazabilidad, tasks,
  checkpoints y hallazgos.
- `spec_<feature>.md`: bloqueo o aclaración pedida por `spec_author` cuando no
  puede producir un spec verificable.

## Reglas

- `current.md` se actualiza durante la sesión y se resetea a la plantilla al
  cerrar.
- `history.md` no se reescribe; solo se añaden entradas al final.
- Los nombres válidos dentro de `progress/` son `README.md`, `current.md`,
  `history.md`, `explore_*.md`, `impl_*.md`, `review_*.md` y `spec_*.md`.
- No añadas headings ad hoc a `current.md`; el detalle extra va dentro de
  `## Bitácora` o `## Próximo paso`.
- `explore_*.md` es opcional. Úsalo solo cuando exista exploración real antes
  de diseñar o implementar; no es un requisito del flujo base ni de `init.sh`.
- El campo `Agente` en `history.md` debe identificar al actor real o a la
  cadena de roles usada en la sesión. Ejemplos válidos: `humano (Martín)`,
  `Codex`, `leader -> spec_author`, `leader -> implementer -> reviewer`.
- No uses placeholders como `_no registrado_` o `_—_` en `history.md`.

## Plantilla de `current.md`

```markdown
# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** _ninguna_
- **Inicio:** _—_
- **Agente:** _—_

## Plan

_—_

## Bitácora

_—_

## Próximo paso

_—_
```

## Plantilla de cierre para `history.md`

```markdown
## YYYY-MM-DD — Título de la sesión
- **Agente:** <rol o nombre>
- **Plan:** <objetivo corto>
- **Cambios:** <archivos o decisiones principales>
- **Verificación:** <comandos o chequeos ejecutados>
- **Cierre:** <resultado, bloqueo o siguiente paso>
```

## Plantilla sugerida para `explore_*.md`

Usa `explore_*.md` para capturar contexto útil antes del spec o de la
implementación. No lo conviertas en un inventario mecánico del código.

```markdown
# Exploración: <tema>

## Pregunta
Qué hay que entender antes de diseñar o implementar.

## Archivos analizados
- src/...
- docs/...

## Hallazgos
- ...
- ...

## Riesgos
- ...

## Decisión / siguiente paso
- ...
```
