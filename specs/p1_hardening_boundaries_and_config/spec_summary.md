Goal
- Cerrar los tres P1 de seguridad/runtime detectados en config explícita, boundaries de `search_repo` y smoke legacy.

Touch
- `src/config.ts`
- `src/tools/search-repo.ts`
- `scripts/smoke-stdio.mjs`

Constraints
- Fail-closed solo para config existente pero inválida.
- Mantener fallback cuando la config no existe.
- No ampliar surface ni relajar boundaries.

Verify
- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke`
- `./init.sh`

Tasks
- T1 fail-closed config
- T2 validar `include`
- T3 reparar y ampliar smoke
- T4 verificar fin a fin
