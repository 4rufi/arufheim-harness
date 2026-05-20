# Implementación — arufheim_memory

## Archivos tocados

- `src/tools/shared-memory.ts` — extendida interfaz MemEntry, añadidos helpers `rewriteMemoryFile` y `upsertMemoryEntry`
- `src/tools/memory.ts` — modificado `mem_save` y `mem_search`; añadidos `mem_get` y `mem_context`
- `src/init.ts` — tablas MCP en 4 templates (COPILOT_INSTRUCTIONS_CONTENT, CLAUDE_MD_CONTENT, COPILOT_TOOLS_PATCH, CLAUDE_TOOLS_PATCH) y secciones de arranque en 6 templates de agente (LEADER_PROMPT_CONTENT, IMPLEMENTER_PROMPT_CONTENT, REVIEWER_PROMPT_CONTENT, CLAUDE_LEADER_CONTENT, CLAUDE_IMPLEMENTER_CONTENT, CLAUDE_REVIEWER_CONTENT) + SCAFFOLD_LEADER_PROMPT_TEMPLATE
- `specs/arufheim_memory/tasks.md` — marcadas todas las tasks [x]

## Trazabilidad R→ verificación

- R1 → `mem_search` sin `full` recorta a `{id,type,title,feature,timestamp}`; verificado con `node -e` (campo `content` ausente en salida compacta)
- R2 → `mem_search` con `full:true` devuelve entry completo; verificado en código (branch `if (full)` retorna text markdown con contenido)
- R3 → `topic_key` añadido al inputSchema de `mem_save`; verificado por typecheck
- R4 → `upsertMemoryEntry` preserva `id` original al hacer match por `topic_key`; verificado con `node -e`: "Preserved id: 1 (should be 1)"
- R5 → sin `topic_key`, flujo va a `appendMemoryEntry` sin cambio; verificado con `node -e`: "Total after append: 2 (should be 2)"
- R6 → `mem_get` registrado con `{id: z.number().int().positive()}`; verificado por typecheck + build
- R7 → `mem_get` con id existente devuelve JSON completo; verificado en código (retorna `JSON.stringify(entry)`)
- R8 → `mem_get` con id inexistente devuelve `isError: true`; verificado en código (branch `if (!entry)`)
- R9 → `mem_context` registrado con `{feature?, limit? (1-20, default 5)}`; verificado por typecheck + build
- R10 → `mem_context` ordena por timestamp desc y aplica limit; verificado en código (`.sort((a,b) => ...).slice(0, limit)`)
- R11 → `mem_context` recorta a `{id,type,title,feature,timestamp}`; verificado en código (objeto compact)
- R12 → campos `topic_key?`, `why?`, `where?`, `learned?` en `MemEntry`; verificado por typecheck
- R13 → campos opcionales incluidos en el `MemEntry` construido en `mem_save`; verificado en código (spread condicional)
- R14 → `COPILOT_INSTRUCTIONS_CONTENT` actualizado con filas `mem_get` y `mem_context`; verificado con `grep` en init.ts
- R15 → `CLAUDE_MD_CONTENT` actualizado con filas `mem_get` y `mem_context`; verificado con `grep` en init.ts
- R16 → templates de agente (leader, implementer, reviewer) actualizados con mención `mem_context` en arranque; verificado con `grep` en init.ts
- R17 → `mem_get` y `mem_context` registrados dentro de `registerMemoryTools` en `memory.ts`; `src/index.ts` no tocado

## Output de verificación

```
PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck  → sin errores
PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build      → BUILD OK
PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke      → Smoke OK
node -e (dedup test)                                    → ALL OK
```

## Bloqueos o decisiones

- `rewriteMemoryFile` usa `prepareRepoWriteTarget` (de safety.ts) para obtener la ruta absoluta validada, luego escribe a `absolutePath + '.tmp'` y hace rename atómico.
- `upsertMemoryEntry`: cuando hay match por `topic_key`, el `id` del entry nuevo se ignora y se preserva el id original. El entry guardado tiene todos los campos nuevos excepto el `id`.
- R17 especifica que los tools se registran via `registerMemoryTools`; confirmado que `src/index.ts` no fue tocado.
- Smoke tests de T7 (dedup, progressive disclosure, mem_get hit/miss, mem_context) verificados con `node -e` sobre el módulo compilado.
