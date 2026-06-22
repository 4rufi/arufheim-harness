# Requirements

R1. CUANDO `harness_add` o `harness_update` muten el workflow, el sistema DEBE serializar esas mutaciones por repo para evitar carreras entre lecturas y escrituras.
R2. SI varias llamadas concurrentes a `harness_add` llegan sobre el mismo repo, el sistema DEBE asignar ids únicos y preservar todas las features agregadas.
R3. CUANDO `harness_update` corra, el sistema DEBE ejecutar su read-modify-write bajo el mismo lock de workflow.
R4. CUANDO `read_file` reciba `start_line` y `end_line`, el sistema DEBE seleccionar primero el rango solicitado y solo después aplicar el límite de tamaño de respuesta.
R5. SI el rango solicitado excede `MAX_FILE_CHARS`, el sistema DEBE truncar la respuesta sin falsear el rango lógico pedido.
R6. El smoke DEBE cubrir concurrencia de `harness_add` y lectura de líneas tardías en un archivo grande.
