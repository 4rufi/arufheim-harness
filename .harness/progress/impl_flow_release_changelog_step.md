# Implementación — flow_release_changelog_step

## Objetivo

Hacer explícito en el flujo del harness que antes de `done`, si el cambio es release-facing, hay que:

- actualizar `CHANGELOG.md`
- o dejar constancia explícita de por qué no aplica

## Cambios

- `AGENTS.md`, `README.md`, `CHECKPOINTS.md`, `.harness-docs/verification.md`
  - el flujo visible ahora muestra `tests+README+CHANGELOG`
  - la regla de cierre exige `CHANGELOG.md` alineado cuando el cambio es release-facing
- `CODEX.md`, `CLAUDE.md`, `.github/copilot-instructions.md`
  - endurecen la regla de `done` para incluir changelog cuando aplica
- `.claude/commands/harness.md`, `.opencode/commands/harness.md`
  - reflejan la misma regla operativa
- `.claude/agents/*`, `.github/prompts/*`
  - `leader` orquesta `tests+README+CHANGELOG` antes de review
  - `implementer` debe actualizar `CHANGELOG.md` o documentar por qué no aplica
  - `reviewer` exige changelog o justificación
- `src/init.ts`
  - los templates scaffolded quedaron alineados
  - el marker de agentes subió a `v3` para que `setup --update` regenere repos aún en `v1` o `v2`
  - `promptBody()` acepta markers previos
  - el scaffold base de `.harness/progress/current.md` volvió a incluir `Feature en curso`, `Inicio` y `Agente` para no divergir de `.harness/progress/README.md`
- `CHANGELOG.md`
  - dejó evidencia del cambio visible bajo `Unreleased`

## Verificación final

- `./init.sh`
