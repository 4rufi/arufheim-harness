# Harness

## Arranque

1. Llama `harness_status` con `mode: "brief_minimal"` y usa `startup_brief` como snapshot inicial.
2. Si hay feature activa, llama `harness_loop_status` y resume fase, intento y budget restante.
3. Si existe `.harness/progress/head_<feature>.md`, úsalo como resumen corto antes de abrir artifacts largos.
4. Si la tool no cargó, usa `arufheim-harness status --brief-minimal --json` como fallback y confirma `repo_path`.
5. Si acabas de cambiar bindings o de abrir el repo, recarga el cliente y vuelve a intentar `harness_status` antes de mutar estado.
6. Si hay archivos nuevos en `.harness/inbox/`, procésalos antes del flujo normal.
7. Lee solo los archivos mínimos que falten para el caso actual.
8. Lee `.harness-docs/verification.md`.

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa `arufheim-harness simulate --flow <startup|activation|loop|triage> --json`.

Resume en pocas líneas: feature activa, próximo paso, inbox pendiente y bloqueo
si existe.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Flujo

- Si la feature tiene `"sdd": true`, sigue
  `pending -> spec_ready -> aprobación humana -> in_progress`, y dentro de `in_progress`
  sigue `plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked`.
- Una sola feature puede estar en `in_progress`.
- No declares `done` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y `CHANGELOG.md` alineado cuando el cambio sea release-facing.
- Si te bloqueas, deja el estado en `.harness/progress/current.md` antes de cerrar.
