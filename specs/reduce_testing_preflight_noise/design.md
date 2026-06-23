# Decision

Reducir el ruido desde las fuentes de instrucción, no desde hacks del runtime. El ajuste vive en:

- prompts/templates del implementer
- texto derivado de `buildTestingTemplateContext`
- `headroom` y su `next_action`
- docs/checkpoints donde hoy la policy puede leerse como obligación universal

No se cambia el contrato público de `testing.fastCommand` ni la autodetección; solo se vuelve explícito que la suite rápida es contextual.

# Touch

- `src/testing.ts`
- `src/headroom.ts`
- `src/init.ts`
- `README.md`
- `.harness-docs/verification.md`
- `CHECKPOINTS.md`
- prompts/agentes gestionados regenerados

# Constraints

- sin quitar TDD parcial por capas
- sin romper autodetección existente
- sin introducir estados ni config nueva
- sin volver invisible el valor de la suite rápida cuando sí aplica

# Verify

- `./scripts/pnpmw.sh test`
- `./scripts/pnpmw.sh smoke`
- `./init.sh`

# Notes

- El cambio correcto es “usa el primer comando real si hace falta”, no “chequea la existencia del tool”.
