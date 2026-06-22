# Goal

Cerrar los huecos de release y startup brief que quedan tras `setup/status/repair`: packaging correcto, gate del tarball más completo, brief más barato y changelog alineado.

# Touch

`package.json`, `scripts/release-check.sh`, `src/health.ts`, `src/status.ts`, `src/workflow.ts`, `README.md`, `CHANGELOG.md`, `scripts/smoke-stdio.mjs`, `manual-release-checklist.md`

# Constraints

Sin romper el contrato visible de `harness_status`, `status`, `doctor` o el flujo recomendado ya documentado.

# Verify

`npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`, `npm run release:check -- --allow-dirty`

# Tasks

T1 packaging docs; T2 release tarball coverage; T3 archived_count fuera del hot path; T4 changelog/docs/verify
