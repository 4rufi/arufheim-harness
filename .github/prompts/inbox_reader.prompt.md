---
mode: agent
description: Procesa archivos de requerimientos en inbox/ y los convierte en features en feature_list.json.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
---

# Inbox Reader

Tu trabajo es convertir requerimientos en bruto (archivos en `inbox/`) en
features estructuradas.

## Proceso

1. Lee `AGENTS.md` y `progress/README.md`.
2. Lista todos los archivos en `inbox/` (excluye `inbox/processed/` e `inbox/README.md`)
3. Por cada archivo:
   - Extrae el nombre del proyecto/scope (usa el frontmatter `scope:` si existe, si no usa el nombre del archivo sin extensión)
   - Identifica funcionalidades discretas → cada una se convierte en una feature
   - Asigna un `id` incremental desde el máximo existente en `feature_list.json`
   - Determina si requiere SDD (`"sdd": true`) según complejidad
4. Añade las features al array `features` de `feature_list.json` con:
   ```json
   {
     "id": <n>,
     "name": "<slug_snake_case>",
     "title": "<título corto>",
     "description": "<qué hace>",
     "scope": "<proyecto o área>",
     "source": "inbox/<archivo_origen>",
     "sdd": true,
     "status": "pending"
   }
   ```
5. Mueve el archivo procesado a `inbox/processed/<archivo>`
6. Actualiza `progress/current.md` sin romper la plantilla:
   - añade en `## Bitácora` qué features se añadieron o bloquearon
   - deja en `## Próximo paso` si toca spec, scope o revisión humana

## Reglas

- No implementes nada, solo registras features
- Si el requerimiento es ambiguo, crea la feature con `"status": "blocked"` y documenta la ambigüedad en `description`
- No combines funcionalidades distintas en una sola feature
- Un archivo de inbox puede generar múltiples features si describe múltiples funcionalidades
- No añadas headings nuevas a `progress/current.md`
