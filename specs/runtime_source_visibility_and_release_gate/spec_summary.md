# Goal

Hacer visible si el runtime gestionado viene de una instalación publicada o de un workspace/link de desarrollo, y convertir eso en un gate real de release.

# Touch

`src/runtime.ts`, `src/health.ts`, `src/status.ts`, `src/doctor.ts`, `src/verify.ts`, `scripts/release-check.sh`, `tests/runtime.test.ts`, `README.md`, `manual-release-checklist.md`, `CHANGELOG.md`

# Constraints

Sin romper shim/launcher ni contaminar el home real durante el gate de release.

# Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`

# Tasks

`T1-T4`
