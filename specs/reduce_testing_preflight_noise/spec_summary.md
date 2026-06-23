# Goal

Reducir el ruido de preflight de `pnpm`/`vitest` en el harness sin perder la policy TDD parcial.

# Touch

- prompts/templates
- guidance de testing
- headroom
- docs/checkpoints

# Constraints

- sin quitar autodetección
- sin config nueva
- sin relajar el gate final

# Verify

- `./scripts/pnpmw.sh test`
- `./scripts/pnpmw.sh smoke`
- `./init.sh`

# Tasks

- T1 guidance contextual
- T2 prompts/headroom
- T3 docs + regenerate + verify
