# Requirements

## R1. Repo identity estable

`setup`, `repair`, `init` y `doctor` deben resolver `repoPath` a una ruta absoluta consistente antes de persistir verificaciones o evaluar health.

### Acceptance

- Un `--repo-path .` no deja clientes `stale` por mismatch textual con el binding detectado.
- Los snapshots y verificaciones usan el mismo `repo_path` efectivo.

## R2. Fallback CLI del startup brief

Debe existir un comando CLI soportado para obtener el mismo snapshot base que consume el arranque MCP cuando los tools no quedaron cargados en el frontend.

### Acceptance

- El comando expone `startup_brief`, `repo_path`, `config_scope`, `binding_status`, `doctor_summary` y `client_verification`.
- Debe soportar una salida compacta y una salida JSON estable.

## R3. `brief_only` barato

`harness_status(mode: "brief_only")` debe evitar lecturas y cálculos no necesarios para el snapshot inicial.

### Acceptance

- No debe leer memoria de blockers ni métricas de sesión.
- Puede reutilizar `health.json` persistido si el caller solo necesita alertas/resumen/bindings.

## R4. Release gate realista

`npm run release:check` debe validar el paquete empaquetado instalándolo en un repo temporal y ejecutando `setup` + `doctor` desde el artefacto real.

### Acceptance

- El check falla si el tarball omitió archivos necesarios para bootstrap o runtime.
- El flujo usa el bin empaquetado, no imports al source tree.

## R5. Operabilidad y docs

La documentación y los smokes deben reflejar la ruta recomendada y cubrir estas superficies nuevas.

### Acceptance

- Help/README/release checklist documentan `status`.
- Smoke cubre repo path absoluto y el fallback CLI.
