# Loop Contract

Define el loop operativo del agente sin convertir el arnés en un runtime de chat.

## Loop contract v1

El loop canónico es:

1. `request`
2. `observe`
3. `decide`
4. `act`
5. `retry` o `block`

## Request

- parte desde `startup_brief`
- trae `mem_context` solo si hace falta contexto reusable
- abre archivos adicionales solo cuando el brief no alcanza

## Observe

- usa `observation contract v1`
- registra solo señal útil
- no dupliques outputs largos si no cambian la decisión

## Decide

- si la observación trae señal nueva, ajusta estrategia
- si no trae señal nueva, no repitas la misma acción
- si falta contexto, escala a `summary`, spec completa o código

## Act

- prioriza tools seguras y resultados estructurados
- respeta `PermissionPolicy`
- respeta `action budget v1`

## Retry

- máximo `2` retries equivalentes
- un retry equivalente requiere cambiar comando, contexto o hipótesis
- si el resultado es igual, no cuenta como progreso

## Block

Marca `blocked` cuando:

- falta información esencial
- el output no mejora tras retries razonables
- una tool necesaria falla de forma persistente
- seguir exige desviarse del spec o del contrato aprobado

## Regla

Hermess define el contrato del loop, no un engine propio de provider. Claude,
Codex, Copilot u OpenCode ejecutan ese loop con el mismo contrato operativo.
