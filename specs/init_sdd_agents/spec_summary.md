# Spec Summary: init_sdd_agents

- `Goal:` que `init` deje prompts/agentes SDD mínimos y portables
- `Touch:` `src/init.ts`, `README.md`
- `Constraints:` templates inline versionados; sin depender del repo fuente; solo referenciar surface creada por bootstrap
- `Verify:` `pnpm typecheck`, `pnpm build`, `pnpm smoke`, inspección del scaffold
- `Tasks:` `T1 -> T2 -> T3 -> T4 -> T5`
