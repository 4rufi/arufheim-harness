# Design

Decision
- `loadConfig()` hará fail-closed cuando hay `--repo-path` y el archivo de config existe pero no parsea; solo `ENOENT` seguirá usando defaults.
- `search_repo` validará `include` con `assertSafeGlobPattern()` antes de llamar a `fast-glob`.
- El smoke agregará cobertura para config inválida con `--repo-path` y alineará el fixture legacy con los requisitos reales de `doctor`.

Touch
- `src/config.ts`
- `src/tools/search-repo.ts`
- `scripts/smoke-stdio.mjs`

Constraints
- No romper el fallback actual cuando falta `harness.config.json`.
- No cambiar el contrato de `search_repo` para patrones válidos.
- Mantener la compatibilidad legacy y el smoke autocontenido.

Verify
- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke`
- `./init.sh`
