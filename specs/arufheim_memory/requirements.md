# Requirements — arufheim_memory

R1. `CUANDO` se llama `mem_search` sin `full:true`, el sistema DEBE devolver solo `id`, `type`, `title`, `feature` y `timestamp`.
R2. `CUANDO` se llama `mem_search` con `full:true`, el sistema DEBE devolver todos los campos del `MemEntry`, incluyendo `content`, `why`, `where` y `learned`.
R3. El sistema DEBE aceptar `topic_key` opcional y no vacío en `mem_save`.
R4. `CUANDO` `mem_save` recibe un `topic_key` existente, el sistema DEBE hacer upsert y preservar el `id`.
R5. `CUANDO` `mem_save` no recibe `topic_key` o recibe uno nuevo, el sistema DEBE mantener append con nuevo `id`.
R6. El sistema DEBE registrar una tool `mem_get` con parámetro `id` entero positivo.
R7. `CUANDO` `mem_get` recibe un `id` existente, el sistema DEBE devolver el `MemEntry` completo.
R8. `CUANDO` `mem_get` recibe un `id` inexistente, el sistema DEBE devolver error descriptivo.
R9. El sistema DEBE registrar una tool `mem_context` con `feature?` y `limit?` (1–20, default 5).
R10. `CUANDO` se llama `mem_context`, el sistema DEBE devolver hasta `limit` entradas ordenadas por `timestamp` descendente y filtradas por `feature` si aplica.
R11. `CUANDO` se llama `mem_context`, el sistema DEBE devolver formato compacto: `id`, `type`, `title`, `feature`, `timestamp`.
R12. El sistema DEBE extender `MemEntry` con `topic_key?`, `why?`, `where?` y `learned?`.
R13. `CUANDO` `mem_save` recibe `why`, `where` o `learned`, el sistema DEBE persistirlos.
R14. El sistema DEBE actualizar `COPILOT_INSTRUCTIONS_CONTENT` en `src/init.ts` para listar `mem_get` y `mem_context`.
R15. El sistema DEBE actualizar `CLAUDE_MD_CONTENT` en `src/init.ts` para listar `mem_get` y `mem_context`.
R16. El sistema DEBE actualizar los templates `leader`, `implementer` y `reviewer` en `src/init.ts` para usar `mem_context` al arrancar.
R17. El sistema DEBE registrar `mem_get` y `mem_context` a través de `registerMemoryTools`.
