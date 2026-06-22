# Goal

Cerrar los huecos de release del arnés con versionado explícito y un gate de publicación que exija changelog alineado y checklist manual firmada.

# Touch

- `package.json`
- `CHANGELOG.md`
- `src/index.ts`
- `src/help.ts`
- `README.md`
- `manual-release-checklist.md`
- `scripts/release-check.sh`
- `scripts/release-publish-check.mjs`
- `scripts/smoke-stdio.mjs`
- `release-readiness.json`

# Constraints

- `release:check` sigue siendo el gate automatizado/CI.
- El gate manual de publicación no debe bloquear CI ordinaria.
- La fuente de versión del runtime no debe quedar hardcodeada aparte del paquete.

# Verify

- Nueva versión releaseable en `package.json` y changelog alineado.
- `release:publish-check` falla si falta signoff manual o changelog/versionado.
- `release:check` y `smoke` siguen verdes.

# Tasks

- T1 versionado y changelog
- T2 gate manual rastreable
- T3 docs/help/smoke
