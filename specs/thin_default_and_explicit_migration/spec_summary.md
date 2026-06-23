# Goal

Hacer que el harness deje un repo mucho más delgado por defecto, sin perder el estado operativo local ni la observabilidad del runtime.

# Touch

`config/init/setup/repair/health/status/resources/help` + nuevos comandos `migrate`, `verify`, `docs` + smoke/tests/docs.

# Constraints

No mover `.harness/` ni `specs/`; no migrar layouts por sorpresa; `workflow_layout` sigue intacto; la poda a `thin` debe ser conservadora.

# Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh` con PATH explícito.

# Tasks

T1 layout/config/health
T2 setup thin/full + wrappers
T3 migrate --to thin
T4 docs CLI/MCP
T5 verify + docs de uso
T6 tests y smoke
