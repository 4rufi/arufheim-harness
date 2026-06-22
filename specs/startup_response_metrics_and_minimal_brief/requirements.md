# Requirements

- R1. El sistema DEBE registrar bytes y tokens locales estimados de las respuestas devueltas por `harness_status`.
- R2. El sistema DEBE registrar bytes y tokens locales estimados de la salida devuelta por `arufheim-harness status`.
- R3. El sistema DEBE exponer un modo `brief_minimal` en `harness_status` y en `status` que devuelva solo el snapshot mínimo de arranque: `startup_brief`, `repo_path`, `config_scope` y `doctor_summary`.
- R4. El modo `brief_minimal` DEBE evitar lecturas innecesarias de workflow que no hagan falta para ese snapshot mínimo.
- R5. El contrato recomendado de arranque en prompts, comandos y docs DEBE pasar de `brief_only` a `brief_minimal` para ahorrar contexto, sin eliminar `brief_only`.
- R6. El sistema DEBE cubrir con smoke el modo `brief_minimal`, la persistencia de métricas de response y la compatibilidad de `brief_only`.
