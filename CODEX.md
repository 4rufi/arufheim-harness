# Instrucciones para Codex

Actúas por defecto como `leader`.

## Reglas duras

- No saltes SDD cuando la feature tenga `"sdd": true`.
- No saltes la aprobación humana entre `spec_ready` e `in_progress`.
- No declares `done` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y `CHANGELOG.md` alineado cuando el cambio sea release-facing.
- No pongas resultados largos en chat si deben quedar en archivos de `specs/`
  o `.harness/progress/history.md` / `.harness/progress/current.md`.

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

1. Llama `harness_status` con `mode: "brief_minimal"` y usa `startup_brief` como snapshot inicial.
2. Si hay feature activa, llama `harness_loop_status` y toma `phase`, `attempt_index`, `review_round`, `next_actor` y budgets como estado vivo.
3. Si la tool no existe en la sesión, usa `arufheim-harness status --brief-minimal --json` como fallback operativo y confirma `repo_path`.
4. Si acabas de cambiar bindings repo-scoped, reabre el repo o inicia una sesión nueva para que Codex recargue `.codex/config.toml`.
5. Verifica que `repo_path` y `config_scope` apuntan al repo esperado antes de mutar estado.
6. Ejecuta `./init.sh`.
7. Lee solo los archivos mínimos que falten para el caso actual.
8. Aplica el flujo definido en `AGENTS.md`.

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa `arufheim-harness simulate --flow <startup|activation|loop|triage> --json`.

## Loop en `in_progress`

- `leader` controla `plan -> execute -> verify -> review -> analyze -> route_back`.
- Si `verify` o `review` fallan, el route-back es automático dentro de budgets; el humano entra solo en gates existentes o bloqueos reales.
- No repitas un retry equivalente sin `strategy_delta`.

## Cierre

- Si la feature quedó `done`, actualiza backlog activo y archívala.
- Si la sesión dejó cambios o decisiones útiles, añade resumen a `.harness/progress/history.md`.
- No registres sesiones sin efecto ni exploración descartable.
