# Implementación — flow_test_and_readme_step

## Objetivo

Hacer explícito en el flujo del harness que antes de `done` hay que:

- correr verificación relevante
- actualizar `README.md` o docs de uso cuando cambie el comportamiento visible

## Cambios

- `AGENTS.md`
  - el flujo ahora muestra `tests+README` antes de `reviewer -> done`
  - el cierre ahora exige verificación + actualización de docs si aplica antes de `./init.sh`
- `README.md`
  - el flujo bootstrappeado ya muestra el paso explícito `implementer -> tests+README -> reviewer -> done`
- `.harness-docs/verification.md`
  - se añadió un paso documental explícito
- `CODEX.md`, `CLAUDE.md`, `.github/copilot-instructions.md`
  - endurecen la regla de `done` para incluir docs visibles cuando aplica
- `.claude/commands/harness.md`, `.opencode/commands/harness.md`
  - reflejan la misma regla operativa
- `.claude/agents/*`, `.github/prompts/*`
  - `leader` ahora orquesta `tests+README` antes de review
  - `implementer` debe actualizar README/docs si cambia el uso visible
  - `reviewer` exige docs actualizados o justificación
- `src/init.ts`
  - los templates scaffolded quedaron alineados
  - el marker de agentes subió a `v2` para que `setup --update` regenere repos aún en `v1`
  - `promptBody()` acepta markers `v1` y `v2`

## Verificación final

- `./init.sh`
