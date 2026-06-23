# Design

- `migrate.ts`: separar la eliminación de archivos gestionados de la limpieza de directorios vacíos; para contenedores vacíos usar una operación válida sobre directorios y mantener el prune conservador.
- `health.ts`: cortar la inspección de bindings globales tan pronto como el cliente no esté dentro de `expectedHealthClients`, antes de crear diagnostics, bindings o readiness fuera de scope.
- `smoke-stdio.mjs`: añadir una pasada de migración real full->thin y reforzar el contrato `codex-only` con globals válidos de clientes no pedidos.
