# Design — arufheim_memory

## Decision

Extender la memoria actual con campos estructurados, upsert por `topic_key`, `mem_get` y `mem_context`, manteniendo backward-compatibility sobre el mismo storage.

## Touch

- `src/tools/shared-memory.ts`: `MemEntry`, `rewriteMemoryFile`, `upsertMemoryEntry`
- `src/tools/memory.ts`: `mem_save`, `mem_search`, `mem_get`, `mem_context`
- `src/init.ts`: templates de arranque y tablas de tools
- `src/index.ts`: sin cambio directo; `registerMemoryTools` registra las nuevas tools

## Constraints

- escritura atómica via temporal + rename
- nada a `stdout`
- rutas validadas por `safety.ts`
- `id` se preserva en upsert
- `why`, `where`, `learned`, `topic_key` son opcionales

## Verify

- `pnpm build`
- verificación de dedup con `topic_key`
- `mem_search` compacto vs `full:true`
- `mem_get` hit/miss
- `mem_context` compacto y ordenado

## Notes

- `mem_save`: si hay `topic_key`, usa `upsertMemoryEntry`; si no, mantiene append
- `mem_search`: `full` default `false`; salida compacta por defecto
- `mem_get`: recibe `{ id }`; devuelve entry completa o error
- `mem_context`: recibe `{ feature?, limit? }`; devuelve recientes compactos

## Rejected

No se crea `memory-v2.jsonl`: duplicaría lectura, complicaría ids y no aporta porque los campos nuevos son opcionales.
