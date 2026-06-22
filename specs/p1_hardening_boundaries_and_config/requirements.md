# Requirements

R1. SI el servidor arranca con `--repo-path` o `HARNESS_REPO_PATH` y `harness.config.json` existe pero es inválido o no parsea, el sistema DEBE fallar y NO DEBE continuar con defaults.
R2. SI el servidor arranca con `--repo-path` o `HARNESS_REPO_PATH` y `harness.config.json` no existe, el sistema DEBE continuar con defaults válidos.
R3. CUANDO `search_repo` reciba `include`, el sistema DEBE rechazar patrones absolutos o con traversal antes de expandir el glob.
R4. MIENTRAS `search_repo` opera sobre `include` válido, el sistema DEBE preservar el comportamiento actual de búsqueda dentro del repo.
R5. DONDE el smoke valida compatibilidad legacy, el fixture DEBE incluir los archivos requeridos por `doctor`.
R6. El smoke DEBE cubrir explícitamente el rechazo de `include` inseguro y el fail-closed de config inválida con `--repo-path`.
