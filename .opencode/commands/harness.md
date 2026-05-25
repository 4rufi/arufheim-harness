# Harness

Arranque de sesión del repo:

1. Llama `harness_status` con `mode: "brief_only"`.
2. Usa `startup_brief` como snapshot inicial.
3. Si la feature activa existe, trae `mem_context` compacto antes de abrir más archivos.
4. Lee solo los archivos mínimos que falten para el caso actual.

Resumen corto esperado:

- feature activa
- próximo paso
- inbox pendiente
- bloqueo, si existe

Reglas:

- no saltes SDD cuando la feature tenga `"sdd": true`
- no declares `done` sin verificación ejecutable
- si te bloqueas, deja el motivo en `.harness/progress/current.md`
