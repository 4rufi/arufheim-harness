# Goal

Hacer que el health repo-local solo falle por clientes esperados para ese repo, de modo que un `setup` válido no quede en error por bindings globales o repo-scoped ajenos.

# Touch

`src/health.ts`, `scripts/smoke-stdio.mjs`

# Constraints

No se deben esconder problemas de clientes realmente esperados ni de bindings globales que sí afectan al repo; los repo-scoped deben seguir shadowing a los globales cuando corresponda.

# Verify

`npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`

# Tasks

T1 scope esperado por repo; T2 filtrar bindings y readiness; T3 smoke de regresión; T4 verify y cierre
