# Spec Driven Development en Hermess

Las features con `"sdd": true` siguen:

```text
pending -> spec_ready -> aprobación humana -> in_progress -> done
```

## Estructura

Cada feature SDD usa:

```text
specs/<feature>/
  requirements.md
  design.md
  tasks.md
```

## requirements.md

- Requirements numeradas `R1`, `R2`, ...
- Un solo `DEBE` por requirement
- Deben ser verificables

Patrones aceptados:

- `El sistema DEBE ...`
- `CUANDO ..., el sistema DEBE ...`
- `MIENTRAS ..., el sistema DEBE ...`
- `DONDE ..., el sistema DEBE ...`
- `SI ... ENTONCES el sistema DEBE ...`

## design.md

Debe capturar antes de codificar:

- archivos a tocar
- firmas nuevas
- restricciones de seguridad
- alternativa descartada

## tasks.md

Checklist discreta y ejecutable. Cada task referencia los `R<n>` que cubre.

## Regla dura

No se implementa una feature SDD sin aprobación humana explícita cuando queda en `spec_ready`.

