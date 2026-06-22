# Decision

Agregar un comando CLI nuevo, `simulate`, que construye payloads reales de `status`, `doctor` y `loop` en memoria, calcula bytes/tokens con la misma heurística local del harness y devuelve un breakdown por paso más un total, sin llamar a `recordResponseOutput`.

# Touch

- `src/session-metrics.ts`: exportar helper reusable de estimación local.
- `src/status.ts`: exportar builders/reutilidades necesarias para simular `brief_minimal` y `brief_only`.
- `src/doctor.ts`: exponer un builder serializable para `doctor --json`.
- `src/loop.ts`: reutilizar `readLoopStatus` para el paso de loop.
- `src/simulate.ts`: comando nuevo con flows predefinidos y render humano/JSON.
- `src/index.ts`, `src/help.ts`, `README.md`, `src/init.ts`: wiring y documentación.
- `scripts/smoke-stdio.mjs`: contrato de salida y garantía de no contaminación de métricas.

# Constraints

- No spawn de subprocesos para auto-llamarse; usar builders internos para medir el contrato real.
- La simulación debe ser estable aunque cambie el repo activo.
- `loop` debe seguir reportando un paso válido aunque no exista feature activa.

# Verify

- comparar `startup` vs `activation` en un repo limpio
- validar `loop` con y sin feature activa
- confirmar que `session.json` no cambia por correr la simulación

# Notes

- La surface nueva es CLI; no hace falta agregar tool MCP en esta pasada.
- El formato puede incluir `flow`, `steps[]`, `total_bytes`, `total_tokens`, `note`.
