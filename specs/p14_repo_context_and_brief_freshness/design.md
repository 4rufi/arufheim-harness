# Decision

Mantener la UX actual pero subir el umbral de auto-detección y añadir una firma ligera de entradas observadas al snapshot persistido de health.

# Touch

- `src/global-mode.ts`: reemplazar markers débiles por detección de scaffold suficiente para hidden/root-legacy.
- `src/health.ts`: persistir y validar una firma de inputs observados por health antes de reutilizar cache.
- `src/status.ts`: seguir prefiriendo cache en `brief_only`, pero solo si la validación de frescura pasa.
- `scripts/smoke-stdio.mjs`: reproducir falso positivo de repo detectado y health stale del brief.

# Constraints

- `setup --global --repo-path ...` sigue mandando sobre cualquier heurística.
- Un snapshot viejo sin firma nueva debe tratarse como no confiable y forzar refresh.
- La firma debe ser barata: existencia + `mtimeMs` de archivos relevantes, no parseo completo.

# Verify

- El cwd con solo `feature_list.json` ya no recibe `.codex/config.toml` ni `.mcp.json` por auto-detección.
- Tras borrar `.codex/config.toml`, `status --brief --json` deja de reportar `repo_scoped.codex=true`.
