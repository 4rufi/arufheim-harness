# Model Interface

Define el contrato común entre el arnés y cada frontend (`Codex`, `Claude`,
`Copilot`).

## Qué es común

- arranque con `harness_status({ mode: "brief_only" })`
- uso de `startup_brief` como snapshot inicial
- `mem_context` antes de abrir más archivos
- paths canónicos en `.harness/` y `.harness-docs/`
- artefactos de salida en `specs/` y `.harness/progress/`

## Qué puede variar por frontend

- sintaxis de tool call
- formato de prompts/agentes
- integración MCP local
- estilo de respuesta al humano

## Startup contract v1

Un agente bien arrancado tiene, en este orden:

1. `startup_brief`
2. `mem_context`
3. paths canónicos del repo
4. solo después, archivos adicionales mínimos

## Regla

El flujo central no depende de un modelo específico. Las diferencias de Claude,
Codex y Copilot viven en adapters/prompts, no en el contrato base.

## Versionado

El arranque actual usa `startup contract v1`. Si cambia, actualiza también
`.harness-docs/contract_versions.md`.
