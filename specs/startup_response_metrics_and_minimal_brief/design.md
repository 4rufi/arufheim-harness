# Decision

Añadir una capa explícita de métricas de response en `session-metrics` y un tercer modo de status (`brief_minimal`) que reutilice el health cacheado pero no cargue backlog ni `current.md`.

# Touch

- `src/session-metrics.ts`
- `src/status.ts`
- `src/tools/harness-status.ts`
- `src/tools/harness-metrics.ts`
- `src/help.ts`
- `src/health.ts`
- `src/tui.ts`
- `README.md`
- `.harness-docs/*` y prompts/commands activos
- `src/init.ts`
- `scripts/smoke-stdio.mjs`

# Constraints

- No romper `full` ni `brief_only`.
- `brief_minimal` debe seguir permitiendo validar `repo_path` y salud básica.
- La métrica sigue siendo local/estimada; no debe presentarse como billing real del provider.
- El scaffold generado por `setup --update` debe converger al contrato nuevo.

# Verify

- `harness_status({ mode: "brief_minimal" })` devuelve solo snapshot mínimo.
- `arufheim-harness status --brief-minimal --json` devuelve el mismo contrato mínimo.
- `session.json` registra bytes/tokens de `tool:harness_status:*` y `cli:status:*`.
- Prompts/commands/docs recomiendan `brief_minimal` en startup.
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`
