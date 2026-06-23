# Requirements

- R1. El sistema DEBE soportar `scaffold.layout` con valores `thin` y `full` en `harness.config.json`, usando `thin` por defecto solo en repos nuevos y preservando el layout existente en repos ya configurados.
- R2. `setup` DEBE aceptar `--layout thin|full`; en repos existentes `setup --update` DEBE reconciliar el layout actual sin migrarlo implícitamente.
- R3. El sistema DEBE exponer `migrate --to thin` con soporte `--dry-run` y `--json` para migrar repos `full` o mixed a `thin` de forma explícita.
- R4. DURANTE `migrate --to thin`, el sistema DEBE podar solo assets gestionados seguros del layout `full`, preservando overrides o customizaciones locales y reportándolos como preservados.
- R5. DURANTE `migrate --to thin`, el sistema DEBE reemplazar `AGENTS.md`, `CODEX.md` y `CLAUDE.md` por wrappers mínimos gestionados, preservando contenido fuera de la sección gestionada cuando exista.
- R6. El sistema DEBE exponer `verify` como entrypoint recomendado para repos consumidores y NO DEBE requerir `init.sh` materializado en repos `thin`.
- R7. El sistema DEBE exponer docs compartidas por CLI mediante `docs list` y `docs show <topic>`.
- R8. El sistema DEBE exponer docs compartidas por MCP mediante `harness://docs/index` y `harness://docs/<topic>`.
- R9. `doctor --json`, `status`, `harness_status` y `harness://health` DEBEN exponer `scaffold_layout` además de `workflow_layout`.
- R10. `repair` DEBE respetar el `scaffold.layout` actual del repo y NO DEBE rematerializar assets `full` en un repo `thin`.
- R11. `setup --global` y la detección de repo harness válido DEBEN funcionar sin depender de `.harness-docs/` o `CHECKPOINTS.md`; la detección DEBE basarse en `harness.config.json`, `.harness/` y bindings/estado canónicos.
- R12. La guidance de testing para repos consumidores DEBE seguir usando una sola fuente de verdad package-manager-neutral: `pnpm` solo si el repo lo declara, `npm`/`yarn` cuando corresponda y wording neutral fuera de JS/TS.
- R13. El smoke y la suite rápida DEBEN cubrir: repo nuevo thin por defecto, repo full explícito, `setup --update` preservando full, migración dry-run/real, docs CLI/MCP y guidance neutral `npm`/`yarn`/`pnpm`.
