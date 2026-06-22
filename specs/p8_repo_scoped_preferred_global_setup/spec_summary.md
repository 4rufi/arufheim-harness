# Goal

Hacer que `setup --global` y `repair --global` dejen también listos los bindings repo-scoped preferidos cuando hay un repo harness activo.

# Touch

`src/setup.ts`, `src/repair.ts`, `src/init.ts`, `README.md`, `src/help.ts`, `manual-release-checklist.md`, `scripts/smoke-stdio.mjs`

# Constraints

Solo escribir scaffold repo-scoped si el repo es explícito o detectable; no romper configs globales ni el fallback actual.

# Verify

`npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`

# Tasks

T1 detect repo activo; T2 scaffold híbrido; T3 docs+smoke; T4 verify+close
