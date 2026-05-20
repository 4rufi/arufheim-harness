# AGENTS.md

Mapa operativo del repo.

## Arranque

1. Corre `./init.sh`.
2. Lee `.harness/progress/current.md`.
3. Lee `.harness/feature_list.json`.
4. Lee `.harness/progress/README.md` solo si vas a tocar el flujo de sesión.
5. Si la feature activa tiene `"sdd": true`, lee `.harness-docs/specs.md`.
6. Si estás decidiendo si una feature nueva usa SDD, lee `.harness-docs/specs_policy.md`.

## Leer solo si hace falta

- `.harness/feature_history.json`: contexto histórico
- `.harness/progress/history.md`: sesiones anteriores
- `specs/<feature>/`: implementación SDD
- `.harness-docs/architecture.md`: diseño
- `.harness-docs/conventions.md`: edición/código
- `.harness-docs/verification.md`: cierre
- `CHECKPOINTS.md`: auto-review
- `.harness/inbox/`: input nuevo
- `.claude/agents/`, `.github/prompts/`, `CLAUDE.md`, `CODEX.md`: orquestación

## Reglas duras

- Una sola feature en `in_progress`.
- No cierres nada sin `./init.sh` verde.
- Toda feature con `"sdd": true` pasa por `pending -> spec_ready -> aprobación humana -> in_progress -> done`.
- No inventes estado: actualiza `.harness/progress/current.md`.
- No rompas la plantilla de `.harness/progress/current.md`.
- No escribas logs arbitrarios a `stdout`.
- Si te bloqueas, deja evidencia en `.harness/progress/current.md`.

## Flujo

```text
[inbox_reader] -> pending
[scoper] -> filtra scope de sesión
pending -> [spec_author] -> spec_ready -> HUMANO -> in_progress -> [implementer -> reviewer] -> done
```

`inbox_reader` y `scoper` son opcionales. SDD es obligatorio para features con `"sdd": true`.

## Cierre

1. `./init.sh`
2. Si acabaste la feature, actualiza backlog activo y archívala en `.harness/feature_history.json`
3. Añade resumen a `.harness/progress/history.md`
4. Limpia `.harness/progress/current.md`
5. Conserva `explore_*.md`, `impl_*.md`, `review_*.md`, `spec_*.md`
