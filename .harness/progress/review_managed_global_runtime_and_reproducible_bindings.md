# Review — managed_global_runtime_and_reproducible_bindings

## Review 1

- verdict: APPROVED
- classification: review_passed

- [x] `R1-R2` quedaron cubiertos: existe runtime global gestionado fuera del repo, con shim estable y metadata verificable.
- [x] `R3-R4` quedaron alineados: los bindings globales usan shim absoluto y los repo-scoped usan launcher portable sin rutas absolutas del usuario en el repo.
- [x] `R5-R7` se cumplen en flujo: `setup`, `repair`, `setup --global`, `migrate --to thin` y el scaffold `full` convergen al contrato nuevo y tratan `npx` como legacy reparable.
- [x] `R6` quedó visible en surfaces ricas: `doctor`, `status`, `verify`, `harness_status` y `harness://health` ya incluyen `runtime_status`.
- [x] `R8` quedó documentado: README, help, checklist y templates gestionados explican que el repo no necesita dependencia local del paquete y `setup --help` ya no ejecuta setup.
- [x] `R9` queda cubierto por `vitest`, `smoke` y `./init.sh`, incluyendo el seed de runtime global en un home temporal para no contaminar el entorno real.
