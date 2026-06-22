# Model Interface

Define el contrato común entre el arnés y cada frontend (`Codex`, `Claude`,
`Copilot`).

## Qué es común

- arranque con `harness_status({ mode: "brief_minimal" })`
- uso de `startup_brief` como snapshot inicial
- si hay feature activa, `harness_loop_status` como estado vivo del intento actual
- `mem_context` antes de abrir más archivos
- paths canónicos en `.harness/` y `.harness-docs/`
- artefactos de salida en `specs/` y `.harness/progress/`

## Qué puede variar por frontend

- sintaxis de tool call
- formato de prompts/agentes
- integración MCP local
- estilo de respuesta al humano

## Startup contract v2

Un agente bien arrancado tiene, en este orden:

1. `startup_brief`
2. `harness_loop_status` si existe feature activa
3. `mem_context`
4. paths canónicos del repo
5. solo después, archivos adicionales mínimos

## Regla

El flujo central no depende de un modelo específico. Las diferencias de Claude,
Codex y Copilot viven en adapters/prompts, no en el contrato base.

## Versionado

El arranque actual usa `startup contract v2`. Si cambia, actualiza también
`.harness-docs/contract_versions.md`.
