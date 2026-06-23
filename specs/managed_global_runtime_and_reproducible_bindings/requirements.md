# Requirements

- R1. El sistema DEBE proveer un runtime global gestionado del harness, fuera del repo consumidor y sin depender de `npx` para su ejecución normal.
- R2. El runtime global DEBE instalar un shim estable por usuario y persistir metadata suficiente para verificar versión, `node`, entrypoint y timestamp.
- R3. Los bindings globales DEBEN apuntar al shim absoluto gestionado.
- R4. Los bindings repo-scoped DEBEN usar un launcher portable dentro del repo que resuelva el runtime global en tiempo de ejecución sin grabar rutas absolutas del usuario.
- R5. `setup`, `setup --global`, `setup --update`, `repair`, `repair --global`, `migrate --to thin` y el scaffold `full` DEBEN sembrar o reconciliar el runtime y bindings nuevos automáticamente.
- R6. `doctor --json`, `status --json`, `harness_status` y `harness://health` DEBEN exponer `runtime_status` con estado, path, versión, timestamp y fix recomendado.
- R7. Los bindings legacy con `npx` DEBEN seguir detectándose como drift reparable y migrarse automáticamente al correr `setup` o `repair`.
- R8. La ayuda, README, checklist manual y templates gestionados DEBEN dejar claro que el proyecto no necesita `arufheim-harness` como dependencia local y que `setup --help` muestra ayuda real.
- R9. La cobertura DEBE incluir unit tests del runtime y smoke del flujo `setup/repair/global/full/thin` con el contrato nuevo, sin romper el comportamiento existente.
