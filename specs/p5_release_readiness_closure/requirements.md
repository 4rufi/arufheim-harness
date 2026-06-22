# Requirements

R1. `setup` DEBE aceptar y distinguir `--update` tanto en repos locales como en la ayuda/documentación.
R2. `repair --global` y la ruta global de `setup --update` DEBEN poder reconciliar entradas gestionadas de clientes globales sin depender de que el entry no exista.
R3. La versión pública del paquete y del servidor MCP DEBE reflejar la nueva surface releaseada.
R4. DEBE existir un check de release reproducible que valide `typecheck`, `build`, `smoke`, `npm pack --dry-run` con cache temporal y worktree limpio.
R5. README, help y smoke DEBEN reflejar el contrato final de `setup/update` y del check de release.
