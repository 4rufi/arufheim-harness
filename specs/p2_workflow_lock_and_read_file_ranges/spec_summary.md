Goal
- Cerrar los P2 de atomicidad en mutaciones del workflow y de lectura incorrecta por rangos en `read_file`.

Touch
- `src/tools/harness-update.ts`
- `src/tools/read-file.ts`
- `scripts/smoke-stdio.mjs`

Constraints
- Mantener el contrato actual de las tools.
- Serializar por repo, no globalmente.
- Truncar contenido sin romper el rango lógico solicitado.

Verify
- `./init.sh`

Tasks
- T1 lock en workflow
- T2 fix de `read_file`
- T3 smoke de regresión
- T4 verificación final
