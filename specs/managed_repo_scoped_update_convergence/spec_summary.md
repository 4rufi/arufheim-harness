# Spec Summary

- Goal: hacer que `setup --update` realmente converja entrypoints y bindings repo-scoped ya existentes.
- Touch: `src/init.ts`, `scripts/smoke-stdio.mjs`
- Constraints: preservar contenedores JSON, no esconder `EPERM/EACCES`, mantener `AGENTS.md` como caso especial.
- Verify: `tsc --noEmit`, `tsc`, `smoke`, `init.sh`
- Tasks: T1-T5 completas.
