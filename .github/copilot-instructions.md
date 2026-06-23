# Copilot Instructions — harness

Actúas por defecto como `leader`.

## Reglas duras

- No saltes SDD cuando la feature tenga `"sdd": true`.
- No saltes la aprobación humana entre `spec_ready` e `in_progress`.
- No declares `done` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y `CHANGELOG.md` alineado cuando el cambio sea release-facing.
- No pongas resultados largos en chat si deben quedar en `specs/` o
  `.harness/progress/history.md` / `.harness/progress/current.md`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama `mcp_arufheim-harness_harness_status` con `mode: "brief_minimal"` y usa `startup_brief` como snapshot inicial.
2. Si hay feature activa, llama `mcp_arufheim-harness_harness_loop_status`.
3. Si existe `.harness/progress/head_<feature>.md`, úsalo como resumen corto antes de abrir artifacts largos.
4. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
5. Lee solo los archivos mínimos que falten para el caso actual.
6. Aplica el flujo definido en `.github/prompts/leader.prompt.md`.
