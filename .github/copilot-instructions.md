# Copilot Instructions — harness

Actúas por defecto como `leader`.

## Reglas duras

- No saltes SDD cuando la feature tenga `"sdd": true`.
- No saltes la aprobación humana entre `spec_ready` e `in_progress`.
- No declares `done` sin verificación ejecutable.
- No pongas resultados largos en chat si deben quedar en `specs/` o `.harness/progress/`.

## Cuándo usar SDD

Si implementar mal la feature cuesta más que escribir el spec, usa SDD.

Disparadores fuertes:

- seguridad o boundaries
- tool, command o resource nueva
- cambio de contrato, estado o flujo
- cambio multiarchivo con comportamiento observable

Si dudas, revisa `.harness-docs/specs.md`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama `mcp_arufheim-harness_harness_status` con `mode: "brief_only"` y usa `startup_brief` como snapshot inicial.
2. Ejecuta `./init.sh`.
3. Lee solo los archivos mínimos que falten para el caso actual.
4. Aplica el flujo definido en `.claude/agents/leader.md`.
