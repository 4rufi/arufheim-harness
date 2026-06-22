# Harness

Arranque de sesión del repo:

1. Llama `harness_status` con `mode: "brief_minimal"` y usa `startup_brief` como snapshot inicial.
2. Si la feature activa existe, llama `harness_loop_status` antes de abrir más archivos.
3. Si la tool no cargó, usa `arufheim-harness status --brief-minimal --json` como fallback y confirma `repo_path`.
4. Si acabas de cambiar bindings o de abrir el repo, recarga el cliente y vuelve a intentar `harness_status` antes de mutar estado.
5. Si la feature activa existe, trae `mem_context` compacto antes de abrir más archivos.
6. Lee solo los archivos mínimos que falten para el caso actual.

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa `arufheim-harness simulate --flow <startup|activation|loop|triage> --json`.

Resumen corto esperado:

- feature activa
- próximo paso
- inbox pendiente
- bloqueo, si existe

Reglas:

- no saltes SDD cuando la feature tenga `"sdd": true`
- si la feature está `in_progress`, sigue el loop `plan -> execute -> verify -> review -> analyze -> route_back`
- no declares `done` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y `CHANGELOG.md` alineado cuando el cambio sea release-facing
- si te bloqueas, deja el motivo en `.harness/progress/current.md`
