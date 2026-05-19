# Arquitectura

Hermess es un servidor MCP local por `stdio`.

## Fronteras del sistema

- `src/index.ts` levanta el servidor y registra tools
- `src/config.ts` resuelve y valida la configuración
- `src/safety.ts` concentra invariantes de seguridad
- `src/logger.ts` escribe logs JSONL en `.hermess/logs`
- `src/tools/*.ts` implementa capacidades concretas del repositorio

## Restricciones duras

- No hay transporte HTTP en este corte
- `stdout` es solo para JSON-RPC MCP
- Todo path se resuelve dentro de `repoPath`
- `run_command` ejecuta solo comandos allowlisted
- La config no debe depender del cwd del cliente; usar `--config` o `HERMESS_CONFIG` cuando aplique

## Qué significa “buen trabajo”

- Cambios pequeños y auditables
- Seguridad primero en tools de filesystem y shell
- Resultados estructurados, no texto libre ambiguo
- Documentación y verificación actualizadas junto con el código

