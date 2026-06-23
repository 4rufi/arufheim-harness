# Requirements

- R1. El sistema DEBE exponer la procedencia del runtime gestionado con una clasificación estable al menos entre `package_install`, `workspace_dev`, `linked_dev` y `unknown`.
- R2. `runtime_status`, `doctor --json`, `status --json`, `verify --json` y `harness_status` DEBEN incluir esa procedencia del runtime.
- R3. Si el runtime fue sembrado desde un workspace o link de desarrollo, `doctor` DEBE degradar con un warning explícito y accionable, sin marcar el runtime como roto.
- R4. Si el runtime fue sembrado desde una instalación publicada normal del paquete, el estado DEBE permanecer limpio y no degradado por esa procedencia.
- R5. `release:check` DEBE sembrar el runtime desde el tarball real en un root global temporal y fallar si la procedencia resultante no es `package_install`.
- R6. README y checklist manual DEBEN explicar la diferencia entre runtime de desarrollo y runtime publicado.
