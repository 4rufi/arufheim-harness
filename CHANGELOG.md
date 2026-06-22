# Changelog

## Unreleased

## 1.2.0

- añade `arufheim-harness simulate` para estimar bytes y tokens locales por flujo (`startup`, `activation`, `loop`, `triage`) sin contaminar `.harness/metrics/session.json`
- integra un loop canónico `plan_execute_verify` con policy configurable, route-back automático y estado persistido por feature en `.harness/metrics/loops/`
- añade `harness_loop_status`, `harness_loop_event`, `harness://loop/active` y `loop_summary` en `harness_status`, `status --json`, `doctor --json` y `tui`
- vuelve `setup --update`, `repair`, `agent`, prompts, agents y scaffold managed conscientes del loop, incluyendo reseed del loop activo faltante
- hace explícito en el flujo del harness el paso `tests+README+CHANGELOG` antes de `done` y exige `CHANGELOG.md` cuando el cambio es release-facing
- alinea `AGENTS.md`, prompts, comandos y templates scaffolded con ese contrato, incluyendo el scaffold base de `.harness/progress/current.md`
- añade `brief_minimal` como startup contract recomendado para `harness_status` y `status`, dejando `brief_only` como snapshot rico para activation/`client_readiness`
- registra `response_output_bytes` y `response_output_tokens` por surface en `.harness/metrics/session.json`, incluyendo salidas de `harness_status` y `status`

## 1.1.0

- añade `client_readiness` a `doctor --json`, `status --brief --json` y `harness_status` para distinguir `verified`, `configured_needs_activation`, `stale_reverification_required`, `invalid_manual_fix_required` y `missing`
- alinea los adapters de Codex, Claude y OpenCode hacia un protocolo único: `harness_status(mode: "brief_only")` primero y fallback CLI si la tool MCP no cargó
- añade workflow de CI con `typecheck`, `build`, `smoke` y `release:check` usando `HARNESS_RELEASE_ALLOW_DIRTY=1` solo para el gate de worktree limpio
- reconcilia `.codex/config.toml` repo-scoped con `--client codex`
- endurece la detección de repo híbrido para `setup/repair --global` y evita mutaciones por markers débiles
- hace que `status --brief` invalide `health.json` cuando cambian los bindings o archivos observados
- añade `release-readiness.json` y `release:publish-check` para exigir changelog alineado y signoff manual rastreable antes de publicar

## 1.1.0

- añade `setup` y `repair` como capa operativa recomendada sobre `init`, sin romper compatibilidad con flujo previo
- añade `doctor --json`, `harness://health`, alerts compartidas y banner/TUI con health transversal
- añade handshake y verificación automática por cliente para distinguir `configured`, `verified`, `stale` y `missing`
- deja verificados por contrato los bindings determinísticos y reserva validación runtime solo para globals realmente `assumed`
- endurece `setup --global` y `repair --global`, falla cerrado sobre configs inválidas y hace explícitos pasos de activación por cliente
- cuando hay repo disponible, `setup --global` y `repair --global` dejan también bindings repo-scoped preferidos para Claude Code y Codex
- añade `arufheim-harness status --brief --json` como fallback operativo cuando el frontend no cargó `harness_status`
- endurece `npm run release:check`: empaqueta, instala el tarball real en un repo temporal y valida `setup`, `status`, `repair` y `doctor`
