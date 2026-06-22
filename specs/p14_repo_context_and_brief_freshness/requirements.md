# Requirements

- R1. El sistema DEBE auto-detectar `repo_context` para `setup/repair --global` solo cuando el cwd tenga evidencia suficiente de un repo harness real; un `feature_list.json` suelto NO DEBE bastar.
- R2. El sistema DEBE preservar el camino explícito `--repo-path <ruta>` sin endurecerlo ni bloquearlo.
- R3. El sistema DEBE reutilizar health persistido en `status --brief` solo si las entradas observadas por health no cambiaron desde `last_verified_at`.
- R4. SI cambia o desaparece una entrada observada relevante para health, ENTONCES `status --brief` DEBE recomputar health fresco en vez de devolver el snapshot persistido.
- R5. El sistema DEBE cubrir ambos casos con smoke automatizado sin romper los smokes actuales de globals `assumed` ni el flujo repo-scoped normal.
