# Requirements

- R1. El sistema DEBE hacer que el shim global gestionado ejecute un entrypoint real instalado del paquete y no un `dist` copiado que no pueda resolver sus dependencias.
- R2. El sistema DEBE permitir `setup --global-runtime` y `repair --global-runtime` aun cuando el proceso actual ya fue arrancado desde el runtime gestionado.
- R3. El sistema DEBE usar una sola regla de resolución del global root entre instalador, shim, launcher repo-scoped y health.
- R4. El sistema DEBE conservar el contrato repo-scoped portable: el repo no graba rutas absolutas del usuario y el launcher sigue resolviendo el runtime global en tiempo de ejecución.
- R5. El smoke DEBE ejecutar realmente el shim global gestionado y el launcher repo-scoped sobre un `XDG_CONFIG_HOME` temporal y fallar si cualquiera de los dos no arranca.
- R6. `doctor`, `status`, `verify` y `harness_status` DEBEN seguir reportando `runtime_status` coherente con el contrato nuevo sin degradar el flujo actual.
