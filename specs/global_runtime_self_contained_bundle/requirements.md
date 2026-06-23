# Requirements

- R1. El runtime global gestionado DEBE sembrarse como un artefacto JS autocontenido en el root global del harness, sin depender del `dist/index.js` del paquete que lo instaló.
- R2. `runtime_status` DEBE separar el artefacto vivo del runtime (`runtime_artifact`) de la procedencia del seed (`runtime_source`).
- R3. `docs list`, `docs show <topic>` y `harness://docs/*` DEBEN seguir funcionando aunque el paquete sembrador ya no esté disponible.
- R4. Metadata legacy que apunte al paquete instalado o a `runtime/dist/index.js` DEBE clasificarse como `stale` y quedar reparable con `repair --global-runtime`.
- R5. `release:check` DEBE probar que el shim global sigue operativo después de retirar el paquete instalado del repo temporal.
- R6. README, help y checklist manual DEBEN explicar el runtime global autocontenido y la diferencia entre `runtime_artifact` y `runtime_source`.
