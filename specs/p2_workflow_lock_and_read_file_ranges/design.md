# Design

Decision
- Reusar `withWorkflowWriteLock()` en `harness_add` y `harness_update` para serializar el bloque completo de lectura, validación y escritura.
- Mantener el flujo actual de archivado en `harness_update`, pero ejecutarlo dentro del lock compartido.
- En `read_file`, calcular líneas completas y el rango lógico antes de truncar por `MAX_FILE_CHARS`.

Touch
- `src/tools/harness-update.ts`
- `src/tools/read-file.ts`
- `scripts/smoke-stdio.mjs`

Constraints
- No cambiar el contrato de estados ni el shape principal de las tools.
- No romper la compatibilidad del smoke existente.
- Evitar ensanchar la superficie más allá de los dos P2 detectados.

Verify
- `./init.sh`
