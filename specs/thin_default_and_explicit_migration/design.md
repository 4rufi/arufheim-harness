# Decision

Introducir un layout lógico `scaffold_layout` (`thin|full`) separado del `workflow_layout` físico (`hidden|root-legacy`). `thin` conserva solo estado repo-canónico y wrappers mínimos; los assets compartidos salen de una fuente de verdad interna del runtime y se sirven por nuevos comandos `docs` y resources `harness://docs/*`. La migración de repos existentes se hace con un comando explícito `migrate --to thin`, nunca como efecto colateral de `setup --update`.

# Touch

- `src/config.ts`, `src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/index.ts`, `src/help.ts`
- `src/health.ts`, `src/status.ts`, `src/tools/harness-status.ts`, `src/global-mode.ts`, `src/workflow.ts`
- `src/resources/repo-resources.ts`
- Nuevos módulos para `migrate`, `verify` y docs compartidas
- `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.harness-docs/*`
- `tests/**`, `scripts/smoke-stdio.mjs`

# Constraints

- No mover `.harness/`, `specs/`, loops, memoria ni backlog fuera del repo.
- `workflow_layout` mantiene su semántica actual para no romper contratos existentes.
- `setup --update` no puede cambiar de layout por sorpresa.
- La poda de `migrate --to thin` debe ser conservadora: si un asset `full` no coincide con el contenido gestionado esperado, se preserva y se reporta.
- `verify` aplica a repos consumidores; `./init.sh` sigue siendo el gate interno de este repo harness.

# Verify

- `./scripts/pnpmw.sh typecheck`
- `./scripts/pnpmw.sh test`
- `./scripts/pnpmw.sh build`
- `./scripts/pnpmw.sh smoke`
- `PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH COREPACK_HOME=/private/tmp/corepack-home ./init.sh`

# Notes

- `scaffold.layout` se resuelve por precedencia: flag explícito > config existente > inferencia por assets presentes > default thin para repo nuevo.
- Los wrappers mínimos locales deben apuntar a `arufheim-harness verify` y `arufheim-harness docs show <topic>`.
- Las docs compartidas del runtime deben salir de la misma fuente de verdad que usa `full` para materializar assets, evitando drift entre `docs show` y `setup --layout full`.
