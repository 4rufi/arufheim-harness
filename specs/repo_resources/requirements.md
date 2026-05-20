# Requirements: repo_resources

R1. El sistema DEBE listar un resource estático para la configuración resuelta de harness.
R2. El sistema DEBE listar un resource estático para el archivo de logs JSONL de harness.
R3. `CUANDO` un cliente lea el resource de configuración, el sistema DEBE devolver el contenido actual de `harness.config.json`.
R4. `CUANDO` un cliente lea el resource de logs y el archivo exista, el sistema DEBE devolver el contenido actual de `.harness/logs/harness.jsonl`.
R5. `SI` el cliente lee el resource de logs y el archivo no existe, `ENTONCES` el sistema DEBE responder texto vacío con metadata de ausencia.
R6. El sistema DEBE resolver ambos resources usando rutas confinadas a `repoPath`.
R7. El sistema DEBE exponer ambos resources como solo lectura y no introducir escritura nueva.
R8. El sistema DEBE registrar cada lectura de resource en `.harness/logs/harness.jsonl`.
R9. El sistema DEBE mantener intactas `list_files`, `read_file`, `search_repo` y `run_command`.
R10. El sistema DEBE documentar en `README.md` cómo descubrir y leer los resources.
