# CHECKPOINTS

Un cambio en Hermess está realmente listo solo si:

- `./scripts/pnpmw.sh typecheck` pasa
- `./scripts/pnpmw.sh build` pasa
- `./scripts/pnpmw.sh smoke` pasa
- El servidor sigue arrancando por `stdio`
- No se añadió logging funcional a `stdout`
- `run_command` sigue protegido por allowlist
- Las rutas siguen confinadas a `repoPath`
- Si la feature era SDD, existe trazabilidad `R<n> -> verificación`
- Existe `progress/impl_<feature>.md` con archivos tocados + mapa R→test + output de verificación
- Existe `progress/review_<feature>.md` con checklist completo y veredicto APROBADO
- `feature_list.json`, `progress/current.md` y `progress/history.md` reflejan el estado real
