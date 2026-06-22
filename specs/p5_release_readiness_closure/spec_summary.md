Goal: cerrar los blockers de release-readiness con contrato final de `setup/update`, versionado público alineado y check de publicación reproducible.
Touch: `init`, `setup`, `repair`, `help`, `index`, `package.json`, `README`, `smoke`, `scripts/release-check.sh`.
Constraints: sin romper `init`, sin depender de `~/.npm`, sin limpiar cambios ajenos automáticamente.
Verify: `npm run typecheck`, `npm run build`, `npm run smoke`, `./scripts/release-check.sh`, `./init.sh`.
Tasks: T1 spec; T2 setup/update + global reconcile; T3 versionado; T4 release-check; T5 verify+cierre.
