# Goal

Hacer que el harness sea más operable en runtime y más confiable en release sin recortar features: `repoPath` estable, fallback CLI de status, startup brief barato y publish validado desde el tarball real.

# Touch

`src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/doctor.ts`, `src/index.ts`, `src/help.ts`, `src/health.ts`, `src/tools/harness-status.ts`, `scripts/release-check.sh`, `scripts/smoke-stdio.mjs`, `README.md`, `manual-release-checklist.md`

# Constraints

Mantener compatibilidad con `init`, `doctor`, `setup`, `repair` y el contrato MCP actual; no tocar contenido funcional del workflow más allá de reducir costo y ambigüedad operativa.

# Verify

`npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`

# Tasks

T1 normalizar repo path; T2 añadir status CLI; T3 abaratar brief_only; T4 endurecer release:check sobre tarball; T5 docs/smoke/verify
