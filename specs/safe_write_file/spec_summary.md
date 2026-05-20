# Spec Summary: safe_write_file

- `Goal:` exponer `write_file` dentro de `repoPath` sin romper el boundary
- `Touch:` `src/index.ts`, `src/tools/write-file.ts`, `src/safety.ts`, `scripts/smoke-stdio.mjs`, `README.md`
- `Constraints:` solo rutas relativas, rechazo por symlink externo, logging estándar, texto UTF-8
- `Verify:` `pnpm typecheck`, `pnpm build`, `pnpm smoke`, smoke normal + rechazo por symlink
- `Tasks:` `T1 -> T2 -> T3 -> T4 -> T5`
