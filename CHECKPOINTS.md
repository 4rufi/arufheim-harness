# CHECKPOINTS

Un cambio en harness está realmente listo solo si:

- `./scripts/pnpmw.sh typecheck` pasa
- `./scripts/pnpmw.sh test` pasa
- `./scripts/pnpmw.sh build` pasa
- `./scripts/pnpmw.sh smoke` pasa
- El servidor sigue arrancando por `stdio`
- No se añadió logging funcional a `stdout`
- `run_command` sigue protegido por allowlist
- Las rutas siguen confinadas a `repoPath`
- Si la feature era SDD, existe trazabilidad `R<n> -> verificación`
- Cada requirement observable usa la capa correcta de feedback: `unit`, `contract` o `smoke`, o deja excepción justificada
- Si hubo feedback rápido, salió de un comando real del repo; no de preflights de binarios/versiones innecesarios
- Si existe `.harness/progress/head_<feature>.md`, sigue alineado con fase, foco y siguiente acción del loop
- Existe `progress/impl_<feature>.md` con archivos tocados + mapa R→verificación + output de verificación
- Existe `progress/review_<feature>.md` con checklist completo y veredicto APROBADO
- `progress/current.md` respeta la plantilla canónica del arnés
- `progress/history.md` conserva formato append-only y recibe el cierre de cada sesión
- `feature_list.json`, `progress/current.md` y `progress/history.md` reflejan el estado real
- README/docs quedaron alineados o existe justificación explícita de no aplicación
- Si el cambio es release-facing, `CHANGELOG.md` quedó alineado o existe justificación explícita de no aplicación
