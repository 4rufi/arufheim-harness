# Decision

Separar el gate automatizado (`release:check`) del gate de publicación (`release:publish-check`) y usar un archivo machine-readable de readiness manual por versión.

# Touch

- `package.json` y `CHANGELOG.md`: liberar `1.1.0`.
- `src/index.ts` + `src/version.ts`: leer la versión desde `package.json`.
- `release-readiness.json`: signoff manual versionado y rastreable.
- `scripts/release-publish-check.mjs`: valida versión, changelog y signoff manual; puede saltar el gate automatizado para smoke.
- docs/help/smoke: reflejar el flujo `release:check -> checklist -> release:publish-check`.

# Constraints

- `release:publish-check` debe poder testearse con fixtures temporales.
- `release-readiness.json` puede quedar incompleto hasta que una release real se valide; eso debe bloquear publish, no el desarrollo normal.

# Verify

- `release:publish-check --skip-automated --root <fixture>` pasa en fixture válido.
- El repo sigue verde con `release:check`.
