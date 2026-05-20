# Spec Summary — arufheim_memory

- `Goal:` memoria selectiva con progressive disclosure, dedup y arranque compacto
- `Touch:` `src/tools/shared-memory.ts`, `src/tools/memory.ts`, `src/init.ts`
- `Constraints:` backward-compatible, rename atómico, nada a `stdout`, preservar `id` en upsert
- `Verify:` `pnpm build`, smoke de dedup, `mem_get`, `mem_context`, progressive disclosure
- `Tasks:` `T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7`
