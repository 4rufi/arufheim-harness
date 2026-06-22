# Requirements

R1. El sistema DEBE exponer un resumen operativo por cliente que distinga, como mínimo, entre `verified`, `configured_needs_activation` y `invalid_manual_fix_required`.
R2. CUANDO `setup` o `repair` terminen, el sistema DEBE imprimir el estado operativo por cliente y el siguiente paso explícito si falta activación real.
R3. El sistema DEBE mantener la semántica actual de `client_verification` y `doctor_summary`, sin perder compatibilidad con consumidores existentes.
R4. El sistema DEBE generar adapters e instrucciones de arranque coherentes entre Codex, Claude y OpenCode, incluyendo el mismo fallback CLI cuando la tool MCP no cargó.
R5. El sistema DEBE converger la config repo-scoped de Codex hacia una entrada con `--client codex`.
R6. El sistema DEBE incluir un workflow de CI que ejecute `typecheck`, `build`, `smoke` y `release:check`.
R7. SI `release:check` requiere worktree limpio en CI, ENTONCES el sistema DEBE soportar una ejecución no bloqueada por worktree sucio en ese contexto automatizado.

