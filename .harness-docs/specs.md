# Spec Driven Development

## Flujo

```text
pending -> spec_ready -> aprobación humana -> in_progress -> done
```

No se implementa una feature SDD sin aprobación humana explícita en `spec_ready`.

## Archivos obligatorios

```text
specs/<feature>/
  requirements.md
  design.md
  tasks.md
  spec_summary.md
```

- `requirements.md`: `R<n>` verificables
- `design.md`: archivos, restricciones, decisión principal
- `tasks.md`: pasos discretos con `[ ]` / `[x]`
- `spec_summary.md`: una pantalla máximo; usa `Goal`, `Touch`, `Constraints`, `Verify`, `Tasks`

## Formato compacto recomendado

- `requirements.md`: una línea por `R<n>`; evita secciones narrativas si no aportan decisión
- `tasks.md`: una línea por `T<n>` con cobertura `R<n>`
- `design.md`: abre con `Decision`, `Touch`, `Constraints`, `Verify`; detalle extra solo si hace falta
- `spec_summary.md`: una sola pantalla; si crece, está mal

## EARS mínimo

- `El sistema DEBE ...`
- `CUANDO ..., el sistema DEBE ...`
- `MIENTRAS ..., el sistema DEBE ...`
- `DONDE ..., el sistema DEBE ...`
- `SI ... ENTONCES el sistema DEBE ...`

## Regla de uso

Si una feature nueva todavía no tiene `sdd` decidido, revisa `.harness-docs/specs_policy.md`.
