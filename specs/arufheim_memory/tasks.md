# Tasks — arufheim_memory

- [x] T1. Extender `MemEntry` y añadir `rewriteMemoryFile` + `upsertMemoryEntry`. Cubre: R12, R13.
- [x] T2. Soportar `topic_key`, `why`, `where`, `learned` en `mem_save` con upsert opcional. Cubre: R3, R4, R5, R13.
- [x] T3. Añadir `full?: boolean` a `mem_search` y devolver formato compacto por defecto. Cubre: R1, R2.
- [x] T4. Implementar y registrar `mem_get`. Cubre: R6, R7, R8, R17.
- [x] T5. Implementar y registrar `mem_context`. Cubre: R9, R10, R11, R17.
- [x] T6. Actualizar templates de `init.ts` para listar `mem_get`/`mem_context` y usar `mem_context` al arrancar. Cubre: R14, R15, R16.
- [x] T7. Verificar build, dedup, `mem_search`, `mem_get` y `mem_context`. Cubre: R1–R17.
