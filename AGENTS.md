# AGENTS.md

Mapa operativo del repo.

## Arranque

1. Corre `./init.sh`.
2. Lee `.harness/progress/current.md`.
3. Lee `.harness/feature_list.json`.
4. Lee `.harness/progress/README.md` solo si vas a tocar el flujo de sesión.
5. Si la feature activa tiene `"sdd": true`, lee `.harness-docs/specs.md`.
6. Si estás decidiendo si una feature nueva usa SDD, lee `.harness-docs/specs_policy.md`.
7. Si existe `.harness/progress/head_<feature>.md`, úsalo como resumen corto antes de abrir artifacts largos.

## Leer solo si hace falta

- `.harness/feature_history.json`: contexto histórico
- `.harness/progress/history.md`: sesiones anteriores
- `.harness/progress/head_<feature>.md`: foco corto del intento activo
- `.harness/metrics/loops/`: estado vivo y trazabilidad del loop por feature
- `specs/<feature>/`: implementación SDD
- `.harness-docs/architecture.md`: diseño
- `.harness-docs/conventions.md`: edición/código
- `.harness-docs/verification.md`: cierre
- `.harness-docs/model_interface.md`, `.harness-docs/context_manager.md`, `.harness-docs/execution_engine.md`, `.harness-docs/memory_system.md`, `.harness-docs/orchestration.md`, `.harness-docs/tool_catalog.md`, `.harness-docs/observation_policy.md`, `.harness-docs/planning_model.md`, `.harness-docs/budgets.md`, `.harness-docs/contract_versions.md`, `.harness-docs/frontend_adapters.md`, `.harness-docs/loop_contract.md`: solo si cambias el propio arnés
- `CHECKPOINTS.md`: auto-review
- `.harness/inbox/`: input nuevo
- `.claude/agents/`, `.github/prompts/`, `CLAUDE.md`, `CODEX.md`: orquestación

## Reglas duras

- Una sola feature en `in_progress`.
- No cierres nada sin `./init.sh` verde.
- Toda feature con `"sdd": true` pasa por `pending -> spec_ready -> aprobación humana -> in_progress -> done`.
- Dentro de `in_progress`, el trabajo sigue `plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked`.
- Todo retry requiere `strategy_delta` explícito.
- Para cambios observables, elige la capa de feedback correcta: `unit`, `contract` o `smoke`; si no aplica test rápido, deja excepción justificada.
- Antes de declarar `done`, corre la verificación relevante del repo y actualiza README/docs si cambió el uso o comportamiento visible.
- Si el cambio es release-facing, actualiza `CHANGELOG.md` o deja constancia explícita de por qué no aplica.
- No inventes estado: actualiza `.harness/progress/current.md`.
- No rompas la plantilla de `.harness/progress/current.md`.
- No escribas logs arbitrarios a `stdout`.
- Si te bloqueas, deja evidencia en `.harness/progress/current.md`.

## Flujo

```text
[inbox_reader] -> pending
[scoper] -> filtra scope de sesión
pending -> [spec_author] -> spec_ready -> HUMANO -> in_progress
in_progress -> leader(plan) -> implementer(execute) -> verify -> reviewer(review) -> analyze -> route_back -> done|blocked
```

`inbox_reader` y `scoper` son opcionales. SDD es obligatorio para features con `"sdd": true`.

## Cierre

1. Corre la verificación estándar del repo o la mínima relevante y deja evidencia
2. Si cambió el uso o comportamiento visible, actualiza README/docs o deja constancia de por qué no aplica
3. Si el cambio es release-facing, actualiza `CHANGELOG.md` o deja constancia de por qué no aplica
4. `./init.sh`
5. Si la feature quedó `done`, actualiza backlog activo y archívala en `.harness/feature_history.json`
6. Si la sesión dejó cambios o una decisión útil de preservar, añade resumen a `.harness/progress/history.md`
7. Limpia `.harness/progress/current.md`
8. Conserva `explore_*.md`, `impl_*.md`, `review_*.md`, `spec_*.md`, `head_*.md`

<!-- harness-agents-managed:start -->
<!-- harness-agents-v7 -->

## Harness Runtime (managed)

Este bloque lo mantiene el arnés. Puedes agregar instrucciones del repo fuera de esta sección; `setup --update` y `repair` solo regeneran este bloque.

### Arranque

1. Corre `./init.sh`.
2. Lee `.harness/progress/current.md`.
3. Lee `.harness/feature_list.json`.
4. Lee `.harness/progress/README.md` solo si vas a tocar el flujo de sesión.
5. Si la feature activa tiene `"sdd": true`, lee `.harness-docs/specs.md`.
6. Si estás decidiendo si una feature nueva usa SDD, lee `.harness-docs/specs_policy.md`.

### Reglas duras

- Una sola feature en `in_progress`.
- No cierres nada sin `./init.sh` verde.
- Toda feature con `"sdd": true` pasa por `pending -> spec_ready -> aprobación humana -> in_progress -> done`.
- Dentro de `in_progress`, el trabajo sigue `plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked`.
- Todo retry requiere `strategy_delta` explícito.
- Toda requirement observable usa la capa de feedback más útil: `unit`, `contract` o `smoke`, o deja excepción justificada.
- Antes de declarar `done`, corre la verificación relevante del repo y actualiza README/docs si cambió el uso o comportamiento visible.
- Si el cambio es release-facing, actualiza `CHANGELOG.md` o deja constancia explícita de por qué no aplica.
- No inventes estado: actualiza `.harness/progress/current.md`.
- No rompas la plantilla de `.harness/progress/current.md`.
- Si te bloqueas, deja evidencia en `.harness/progress/current.md`.

### Contexto adicional

- `.harness/feature_history.json`: contexto histórico
- `.harness/progress/history.md`: sesiones anteriores
- `.harness/metrics/loops/`: estado vivo y trazabilidad del loop por feature
- `.harness/progress/head_<feature>.md`: resumen corto del intento activo
- `specs/<feature>/`: implementación SDD
- `CHECKPOINTS.md`: auto-review
- `.harness/inbox/`: input nuevo
- `.claude/agents/`, `.github/prompts/`, `CLAUDE.md`, `CODEX.md`: orquestación si esos adapters existen en este repo

### Cierre

1. Corre la verificación estándar del repo o la mínima relevante y deja evidencia
2. Si cambió el uso o comportamiento visible, actualiza README/docs o deja constancia de por qué no aplica
3. Si el cambio es release-facing, actualiza `CHANGELOG.md` o deja constancia de por qué no aplica
4. `./init.sh`
5. Si la feature quedó `done`, actualiza backlog activo y archívala en `.harness/feature_history.json`
6. Si la sesión dejó cambios o decisiones útiles, añade resumen a `.harness/progress/history.md`
7. Limpia `.harness/progress/current.md`
8. Conserva `explore_*.md`, `impl_*.md`, `review_*.md`, `spec_*.md`, `head_*.md`
<!-- harness-agents-managed:end -->
