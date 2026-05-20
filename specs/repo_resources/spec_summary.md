# Spec Summary: repo_resources

- `Goal:` exponer resources MCP de solo lectura para config resuelta y log principal
- `Touch:` `src/index.ts`, `src/resources/repo-resources.ts`, `src/safety.ts`, `README.md`
- `Constraints:` solo lectura, confinado a `repoPath`, nada fuera del protocolo MCP, sin tocar tools existentes
- `Verify:` `pnpm typecheck`, `pnpm build`, `pnpm smoke`, lectura manual de resources
- `Tasks:` `T1 -> T2 -> T3 -> T4 -> T5`
