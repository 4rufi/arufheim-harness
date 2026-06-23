# Changelog

## Unreleased

## 1.4.1

- simplifica el onboarding en README/help con un flujo fijo: instalar runtime global, entrar al repo, `setup`, `verify`, abrir cliente y validar `harness_status`
- documenta el flujo de actualización de repos antiguos a `thin` y la limpieza manual segura de `preserved_override`

## 1.4.0

- añade un runtime global gestionado (`setup --global-runtime` / `repair --global-runtime`) bajo el root global del harness y deja de depender de `npx`/PATH ambiguo para los bindings MCP gestionados
- migra los bindings repo-scoped a un launcher portable en `.harness/runtime/launch-global-runtime.mjs` y los bindings globales a un shim absoluto user-local
- hace que `setup`, `repair`, `doctor --json`, `status --json`, `harness_status` y `harness://health` expongan y validen `runtime_status`
- corrige `setup --help` para mostrar ayuda real en vez de ejecutar el setup
- endurece el boot real del runtime gestionado: el shim apunta al entrypoint instalado del paquete, evita reinstalaciones autodestructivas y el smoke ejecuta de verdad shim global + launcher repo-scoped
- convierte el runtime global gestionado en un `global_bundle` autocontenido, expone `runtime_status.runtime_artifact` + `runtime_status.runtime_source`, mantiene warnings explícitos para `workspace_dev` / `linked_dev` y hace que `release:check` valide el shim global aun después de retirar el paquete sembrador
- corrige el fallback `workspace_dev` que recompone el bundle global cuando falta `runtime-bundle.cjs`, evitando generar artefactos con doble shebang
- deja explícito en la documentación y ayuda que `thin` es el layout recomendado para repos consumidores, y reserva `full` para debugging, inspección o materialización local completa
- agrega `arufheim-harness --version`, `-v` y `version` como salida corta de versión sin arrancar el servidor MCP

## 1.3.0

- cambia el default de `setup` para repos nuevos a `scaffold.layout=thin`, manteniendo `setup --layout full` como opción explícita para materializar `.harness-docs/`, `CHECKPOINTS.md`, `init.sh` y prompts/agentes largos
- añade `arufheim-harness migrate --to thin`, `verify`, `docs list` y `docs show <topic>` para separar mejor setup, migración de layout, gate estricto del repo consumidor y acceso a docs compartidas
- hace que `doctor --json`, `status --json`, `harness_status` y `harness://health` expongan `scaffold_layout`, y endurece la detección de repos válidos para no tratar markers legacy débiles como repos harness reales
- formaliza TDD parcial por capas en el harness con una suite rápida `test/test:unit`, `verify` e `init.sh` alineados al gate `typecheck -> test -> build -> smoke`
- añade autodetección y configuración opcional `testing.fastCommand` / `testing.integrationCommand`, con fallback `Vitest` solo para repos JS/TS sin suite rápida detectable
- añade `head_<feature>.md` como headroom interno del loop y lo conecta a `agent`, prompts, `setup`, `repair` y mutations del workflow sin exponerlo todavía como surface pública nueva
- reduce el ruido operativo del scaffold de testing: la suite rápida pasa a enseñarse como feedback contextual del repo y del cambio, no como preflight universal de `pnpm`/`vitest`
- quita el fallback implícito a `npx` del `init.sh` scaffolded para repos consumidores en layout `full`; ahora exige harness local vía `ARUFHEIM_HARNESS_ENTRY` o `PATH` y deriva a `verify` cuando no aplica

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
