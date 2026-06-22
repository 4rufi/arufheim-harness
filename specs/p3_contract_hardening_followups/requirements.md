# Requirements

R1. SI `harness_update` intenta mover una feature con `sdd: true` a `spec_ready`, `in_progress` o `done`, ENTONCES el sistema DEBE exigir `requirements.md`, `design.md`, `tasks.md` y `spec_summary.md` en `specs/<feature>/`.
R2. SI `harness_update` intenta mover una feature con `sdd: true` a `done`, ENTONCES el sistema DEBE exigir `impl_<feature>.md` y `review_<feature>.md` válidos antes de archivar la feature.
R3. CUANDO el servidor resuelva config desde el fallback global, el sistema DEBE fallar cerrado si no existe un binding explícito de repo.
R4. SI `read_file` recibe `end_line < start_line`, ENTONCES el sistema DEBE devolver error en vez de metadata contradictoria.
R5. CUANDO `read_file` procese archivos grandes, el sistema DEBE calcular preview/rango sin depender de cargar el archivo completo en memoria.
R6. `config set` DEBE aceptar `permissionPolicy.mode`, `permissionPolicy.allowedTools`, `permissionPolicy.allowedRisk`, `allowedCommands` e `ignored` con validación útil.
R7. El smoke DEBE cubrir cierre SDD inválido, fallback global sin binding explícito, rangos invertidos en `read_file` y mutación CLI de config.
