# Requirements: repo_resources

## Objetivo

Exponer resources MCP de solo lectura para metadata y logs de harness sin cambiar el comportamiento de las tools existentes.

## Requirements

R1. El sistema DEBE listar un resource estático para la configuración resuelta de harness.

R2. El sistema DEBE listar un resource estático para el archivo de logs JSONL de harness.

R3. CUANDO un cliente lea el resource de configuración, el sistema DEBE devolver el contenido actual del archivo `harness.config.json` resuelto.

R4. CUANDO un cliente lea el resource de logs y el archivo exista, el sistema DEBE devolver el contenido actual de `.harness/logs/harness.jsonl`.

R5. SI un cliente lee el resource de logs y el archivo todavía no existe, ENTONCES el sistema DEBE responder con contenido de texto vacío y metadata que indique que el archivo aún no existe.

R6. El sistema DEBE resolver ambos resources usando rutas confinadas a `repoPath`.

R7. El sistema DEBE exponer ambos resources como solo lectura y no DEBE introducir capacidades de escritura nuevas.

R8. El sistema DEBE registrar en `.harness/logs/harness.jsonl` cada lectura de resource con nombre, URI y resultado.

R9. El sistema DEBE mantener intactas las cuatro tools actuales: `list_files`, `read_file`, `search_repo` y `run_command`.

R10. El sistema DEBE documentar en `README.md` cómo descubrir y leer los resources desde un cliente MCP compatible.
