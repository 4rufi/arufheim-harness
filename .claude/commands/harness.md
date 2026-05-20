# Harness

## Arranque

1. Llama `harness_status` con `mode: "brief_only"`.
2. Si hace falta más contexto, lee solo archivos mínimos.
3. Si existe `.harness/inbox/`, revisa pendientes antes de implementar.
4. Ejecuta `./init.sh`.

Resume en pocas líneas: feature activa, próximo paso, inbox pendiente y bloqueo si existe.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Flujo

- Si la feature tiene `"sdd": true`, sigue `pending -> spec_ready -> aprobación humana -> in_progress -> done`.
- Una sola feature puede estar en `in_progress`.
- No declares `done` sin verificación ejecutable.
- Si te bloqueas, deja el estado en `.harness/progress/current.md` antes de cerrar.
