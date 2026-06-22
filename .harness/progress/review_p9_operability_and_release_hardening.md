# Review — p9_operability_and_release_hardening

## Resultado

Aprobado.

## Puntos revisados

- [x] `--repo-path .` ya no deja verificaciones `stale` por mismatch textual entre ruta relativa y absoluta.
- [x] Existe un fallback CLI estable para el snapshot de arranque cuando el frontend no cargó tools MCP.
- [x] `harness_status(mode: "brief_only")` ya no lee blockers ni métricas de sesión.
- [x] `release:check` valida el tarball instalado en un repo temporal, no solo el source tree.
- [x] Docs, prompts y smoke quedaron alineados con el nuevo flujo operativo.

## Riesgos residuales

- El cliente MCP real sigue necesitando su primera sesión cargada para exponer tools; el fallback CLI reduce el impacto, pero no sustituye un bug del frontend.
- El `release:check` del tarball depende de que `npm install` pueda resolver dependencias; en CI o máquinas nuevas eso sigue implicando red o cache válida.
