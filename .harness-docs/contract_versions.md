# Contract Versions

Versiona los contratos del arnés para evitar drift entre docs, scaffold y
prompts.

## Versiones actuales

- `startup contract v2`
- `handoff contract v2`
- `loop contract v2`
- `observation contract v1`
- `retrieval contract v1`
- `retry policy v1`
- `blocked policy v1`
- `risk classes v1`

## Regla

Si cambias un contrato de forma incompatible:

1. sube la versión
2. actualiza docs relacionadas
3. actualiza `src/init.ts`
4. actualiza `smoke` y `doctor` si aplica

## Objetivo

Que el scaffold de un repo nuevo y el repo fuente hablen exactamente el mismo
idioma operativo.
