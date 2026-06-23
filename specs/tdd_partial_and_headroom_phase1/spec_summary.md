# Goal

Formalizar TDD parcial por capas y sumar un headroom interno de contexto corto para el loop del harness sin abrir surfaces públicas nuevas.

# Touch

- config/testing detection
- suite rápida con `Vitest`
- `head_<feature>.md` + `agent`
- docs/prompts/templates
- smoke + unit/contract

# Constraints

- sin estados nuevos
- sin hard gate extra en `doctor`
- headroom solo interno en v1
- fallback neutral fuera de JS/TS

# Verify

- `./scripts/pnpmw.sh typecheck`
- `./scripts/pnpmw.sh test`
- `./scripts/pnpmw.sh build`
- `./scripts/pnpmw.sh smoke`
- `./init.sh`

# Tasks

- T1 suite rápida
- T2 config + autodetección
- T3 headroom interno
- T4 docs/prompts/templates
- T5 smoke + cierre
