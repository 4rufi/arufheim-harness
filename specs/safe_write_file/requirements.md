# Requirements: safe_write_file

R1. El sistema DEBE rechazar rutas absolutas o que intenten salir de `repoPath`.
R2. El sistema DEBE crear o reemplazar archivos UTF-8 de texto dentro de `repoPath`.
R3. El sistema DEBE registrar cada escritura en el log JSONL del servidor.
R4. El sistema DEBE rechazar destinos que salgan de `repoPath` mediante symlinks.
R5. El sistema DEBE documentar en `README.md` el alcance y las restricciones de la tool.
