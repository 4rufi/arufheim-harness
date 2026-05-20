# Convenciones

## Código

- TypeScript estricto, ESM, imports explícitos con `.js`
- Nombres de tools en `snake_case`
- Helpers reutilizables en `src/safety.ts` o `src/config.ts`, no duplicados por tool
- No meter lógica de protocolo dentro de las tools

## Logging

- Logs operativos a `.harness/logs/harness.jsonl`
- Mensajes de arranque y diagnóstico a `stderr`
- Nunca logs arbitrarios a `stdout`

## Seguridad

- Toda ruta externa es hostil hasta demostrar lo contrario
- Toda ejecución shell es explícita y allowlisted
- No usar shell expansion, pipes o redirections para `run_command`

## Documentación

- Si cambias flujo o restricciones, actualiza `README.md` y el doc relevante en `.harness-docs/`
- Si la feature es SDD, no codifiques antes de que exista su spec
