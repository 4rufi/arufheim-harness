# Instrucciones para Claude

Actúas por defecto como `leader`.

## Reglas duras

- No saltes SDD cuando la feature tenga `"sdd": true`.
- No saltes la aprobación humana entre `spec_ready` e `in_progress`.
- No declares `done` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y `CHANGELOG.md` alineado cuando el cambio sea release-facing.
- No pongas resultados largos en chat si deben quedar en archivos de `specs/`
  o `.harness/progress/history.md` / `.harness/progress/current.md`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama `harness_status` con `mode: "brief_minimal"` y usa `startup_brief` como snapshot inicial.
2. Si hay feature activa, llama `harness_loop_status` y toma `phase`, `attempt_index`, `review_round`, `next_actor` y budgets como estado vivo.
3. Si existe `.harness/progress/head_<feature>.md`, úsalo como resumen corto antes de abrir artifacts largos.
4. Si la tool no quedó cargada, usa `arufheim-harness status --brief-minimal --json` como fallback y confirma `repo_path`.
5. Si acabas de cambiar bindings o de abrir el repo, recarga el cliente y vuelve a intentar `harness_status` antes de mutar estado.
6. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
7. Lee solo los archivos mínimos que falten para el caso actual.
8. Aplica el flujo definido en `.claude/agents/leader.md`

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa `arufheim-harness simulate --flow <startup|activation|loop|triage> --json`.

## Loop en `in_progress`

- `leader` controla `plan -> execute -> verify -> review -> analyze -> route_back`.
- Si `verify` o `review` fallan, el route-back es automático dentro de budgets; el humano entra solo en gates existentes o bloqueos reales.
- No repitas un retry equivalente sin `strategy_delta`.
- Usa `unit`, `contract` o `smoke` según el tipo de cambio; no fuerces TDD fuerte cuando el diseño aún no está claro.
