# Copilot Instructions — harness

## Arranque automático

Al iniciar CUALQUIER conversación en este repo, sin esperar instrucciones:

1. Lee `.harness/feature_list.json`
2. Lee `.harness/progress/current.md`
3. Si hay archivos en `.harness/inbox/`, listarlos

Reporta en máximo 3 líneas: feature activa, próximo paso, pendientes en inbox.

## Comunicación

No narres tus pasos internos. Actúa y reporta solo el resultado. Prohibido el monólogo tipo "Voy a leer...", "Ahora reviso...", "Ya confirmé...". Si leíste un archivo, muestra qué encontraste, no que lo leíste.

## Ante cualquier pedido de feature o tarea

Sin excepción, antes de implementar:

1. Agrega la feature a `.harness/feature_list.json` con `"status": "pending"`
2. Cambia a `"in_progress"` y escribe el plan en `.harness/progress/current.md`
3. Implementa usando las herramientas MCP
4. Al terminar: cambia a `"done"`, mueve resumen a `.harness/progress/history.md`, limpia `current.md`

Una sola feature `in_progress` a la vez. No implementes sin registrar primero.

## Herramientas MCP preferidas

Usa SIEMPRE estas herramientas para operaciones sobre el repo:

| Operación         | Herramienta                        |
| ----------------- | ---------------------------------- |
| Buscar texto      | `mcp_arufheim-harness_search_repo` |
| Listar archivos   | `mcp_arufheim-harness_list_files`  |
| Leer archivos     | `mcp_arufheim-harness_read_file`   |
| Ejecutar comandos | `mcp_arufheim-harness_run_command` |

No uses `grep_search`, `file_search`, `read_file` ni `run_in_terminal` cuando una herramienta arufheim-harness pueda hacer lo mismo.

Usa herramientas nativas solo para:

- editar archivos
- mover archivos de `.harness/inbox/`
