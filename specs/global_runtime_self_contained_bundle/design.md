# Design

## Decision

El runtime global gestionado dejará de apuntar al `dist/index.js` del paquete sembrador y pasará a copiar un bundle único `dist/runtime-bundle.cjs` a la raíz global. La metadata v2 persistirá `artifact_kind/artifact_path` más la procedencia del seed. Las docs compartidas pasarán a una registry estática embebida en el runtime para que el layout `thin` no dependa del package root.

## Touch

`package.json`, `pnpm-lock.yaml`, `scripts/generate-shared-docs-registry.mjs`, `scripts/build-runtime-bundle.mjs`, `scripts/release-check.sh`, `src/runtime.ts`, `src/shared-docs.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`, `src/resources/repo-resources.ts`, `tests/runtime.test.ts`, `README.md`, `manual-release-checklist.md`, `CHANGELOG.md`

## Constraints

- Mantener compatibilidad de comandos públicos y launchers repo-scoped.
- No convertir `arufheim-harness` en dependencia del proyecto consumidor.
- Seguir requiriendo solo `node` como prerequisito del host.
- No dejar el runtime autocontenido dependiendo de `packageRoot()` ni de `node_modules` después del seed.

## Verify

`typecheck`, `test`, `build`, `smoke`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`, `./init.sh`
