# Bitácora histórica (append-only)

> Cada vez que se cierra una sesión, su resumen se añade aquí.
> No edites entradas anteriores. Solo añades al final.

---

## 2026-06-22 — Fixes de migración thin y scope de health

- **Agente:** Codex
- **Plan:** corregir la migración real `full -> thin` y evitar que el health repo-local se degrade por globals fuera de `scaffold.localClients`.
- **Cambios:** `src/migrate.ts` ahora limpia directorios gestionados vacíos sin romper la poda conservadora; `src/health.ts` deja de inspeccionar globals fuera del scope esperado; `scripts/smoke-stdio.mjs` ganó cobertura para migración real, `codex-only` con globals válidos fuera de scope y el caso correcto de `assumed global binding`.
- **Verificación:** `./scripts/pnpmw.sh typecheck`, `./scripts/pnpmw.sh test`, `./scripts/pnpmw.sh build`, `./scripts/pnpmw.sh smoke` y `./init.sh` con PATH explícito.
- **Cierre:** feature archivada como `done`; quedaron reparados los dos hallazgos de compatibilidad detectados en la revisión completa.

## 2026-06-22 — Thin default y migración explícita

- **Agente:** Codex
- **Plan:** introducir `thin` como layout por defecto, separar migración de layout en `migrate --to thin`, servir docs compartidas desde runtime y mantener `verify` como gate del repo consumidor.
- **Cambios:** se añadieron `src/scaffold-layout.ts`, `src/migrate.ts`, `src/verify.ts`, `src/shared-docs.ts` y `src/docs-command.ts`; `setup/init/repair/doctor/status/health/resources/help` ahora entienden `scaffold_layout`; el scaffold repo-local por defecto quedó en `thin`; la detección de repos válidos dejó de aceptar `feature_list.json` suelto; `README.md` y `CHANGELOG.md` quedaron alineados.
- **Verificación:** `./scripts/pnpmw.sh test`, `./scripts/pnpmw.sh build`, `./scripts/pnpmw.sh smoke`, `node dist/index.js docs list`, `node dist/index.js migrate --to thin --repo-path <tmp-repo> --dry-run --json`, `node dist/index.js verify --repo-path . --json` y `./init.sh` con PATH explícito.
- **Cierre:** feature archivada como `done`; el repo del harness sigue en layout `full`, pero los repos nuevos pasan a `thin` salvo que pidan `--layout full`.

## 2026-05-18 — Spec inicial de repo_resources

- **Agente:** leader -> spec_author
- **Plan:** redactar la spec inicial de `repo_resources`.
- **Cambios:** se creó la spec inicial (`requirements`, `design`, `tasks`) y la feature pasó a `spec_ready`.
- **Verificación:** revisión del arnés actual y de la API del SDK para resources.
- **Cierre:** pendiente aprobación humana antes de implementar.

## 2026-05-19 — Implementación de repo_resources

- **Agente:** leader -> implementer
- **Plan:** implementar los resources de solo lectura del repo y validarlos por cliente `stdio`.
- **Cambios:** se implementaron `harness://config/resolved` y `harness://logs/main`, con logging de lecturas y smoke MCP por cliente `stdio`.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json` y `node scripts/smoke-stdio.mjs`.
- **Cierre:** `init.sh` no pudo correrse en este sandbox por falta de `pnpm` en `PATH`.

## 2026-05-19 — Hardening followups

- **Agente:** Codex
- **Plan:** cerrar hallazgos de seguridad y contrato después del review.
- **Cambios:** se bloquearon escapes por symlink y glob, `run_command` ahora propaga errores MCP, `raw_config` soporta ausencia de archivo, `init.sh` exige evidencia SDD y el smoke cubre estos contratos.
- **Verificación:** `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** próximo frente identificado: `safe_write_file` con flujo SDD completo.

## 2026-05-19 — Bootstrap portable para pnpm

- **Agente:** Codex
- **Plan:** permitir que el arnés use `pnpm` desde `PATH` o vía `corepack`, y documentar bootstrap por `npm` o `yarn`.
- **Cambios:** se añadió `scripts/pnpmw.sh`, `init.sh` ahora acepta `corepack pnpm` y el repo documenta cómo instalar `pnpm` cuando falta en `PATH`.
- **Verificación:** `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** próximo frente identificado: `safe_write_file` con flujo SDD completo.

## 2026-05-19 — Alineación del flujo progress

- **Agente:** Codex
- **Plan:** normalizar `current.md` y `history.md`, documentar el contrato de `progress/` y alinear prompts y checks del arnés.
- **Cambios:** se añadió `progress/README.md`; se migró `progress/history.md`; se actualizaron `AGENTS.md`, `CHECKPOINTS.md`, `init.sh` y los prompts de Claude/Copilot que escriben en `progress/`.
- **Verificación:** `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** `progress/` quedó alineado al formato canónico del harness y `current.md` volvió a la plantilla base.

## 2026-05-19 — Corrección del campo Agente en history

- **Agente:** Codex
- **Plan:** eliminar placeholders ambiguos en `history.md` y exigir provenance concreta en el contrato de `progress/`.
- **Cambios:** se actualizó `progress/README.md` para exigir un `Agente` concreto y se reemplazaron entradas con `_no registrado_` por actores o cadenas de roles sostenibles desde el flujo del repo.
- **Verificación:** `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** `history.md` ahora registra provenance útil y consistente con el harness.

## 2026-05-19 — Explore opcional y orientado a decisión

- **Agente:** Codex
- **Plan:** dejar `explore_*.md` explícitamente opcional y cambiar su formato sugerido a uno breve, orientado a hallazgos y decisión.
- **Cambios:** se actualizó `progress/README.md` para aclarar que `explore_*.md` no es requisito del flujo base ni de `init.sh`, y se añadió una plantilla sugerida sin métricas mecánicas de archivo.
- **Verificación:** `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** `explore_*.md` quedó como artifact opcional de discovery, no como obligación del arnés.

## 2026-05-19 — Cierre de P0/P1 de seguridad y workflow

- **Agente:** Codex
- **Plan:** cerrar el escape de `write_file`, alinear las tools del workflow con el contrato real del repo y dejar consistentes las features SDD `done`.
- **Cambios:** `write_file` ahora abre targets con guardrails canónicos contra symlinks; se añadió `src/workflow.ts` para soportar layout raíz y `.harness/`; `harness_status`, `harness_update`, `progress`, `inbox`, `memory`, `doctor` y `tui` leen el workflow real del repo; se actualizó el smoke para cubrir `harness_status` y el escape por symlink; se añadieron specs/evidencia retrospectiva para `safe_write_file` e `init_sdd_agents`; se restauró la evidencia SDD de `repo_resources`; `README.md`, `CODEX.md` y `copilot-instructions.md` quedaron alineados.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** P0 y P1 quedaron en verde; el arnés vuelve a cerrarse sobre sí mismo con verificación ejecutable completa.

## 2026-05-19 — Cierre de P2 de cobertura y doctor

- **Agente:** Codex
- **Plan:** ampliar la verificación ejecutable al surface real del workflow, corregir placeholders viejos del contrato `progress/` y alinear el repo con `doctor`.
- **Cambios:** `scripts/smoke-stdio.mjs` ahora cubre workflow root y `.harness/`, inbox, memory, `harness_add/update/log`, `progress_set_plan`, `progress_next_step`, `history_append`, `help`, `doctor` y `tui`; `harness_status` ignora el placeholder canónico de `Próximo paso`; `harness_log` reemplaza correctamente el placeholder de `Bitácora`; `package.json` usa `./scripts/pnpmw.sh` en `verify`; `README.md` y `src/help.ts` quedaron alineados con `spec_ready` y el inbox de workflow; el repo ahora incluye `.claude/commands/harness.md`, `.vscode/mcp.json`, `harness.config.json` con `version: 1` y secciones `## Comunicación` donde `doctor` las exige.
- **Verificación:** `node dist/index.js doctor --repo-path /Users/andyau/Documents/hermess`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** los P2 quedaron verdes; `doctor` ahora también dogfoodea el repo sin drift. `npm run verify` no se pudo ejecutar en este sandbox porque `npm` no está en `PATH`, pero el script quedó alineado con el runner del repo.

## 2026-05-19 — Alineación de init con contrato real

- **Agente:** Codex
- **Plan:** hacer que `init` genere el workflow canónico del repo y dejar prueba ejecutable sobre un repo recién scaffoldeado.
- **Cambios:** `src/init.ts` ahora genera `feature_list.json` raíz con objeto `features`, `progress/{README,current,history}.md`, `inbox/`, `docs/{architecture,conventions,specs,verification}.md`, `CHECKPOINTS.md`, `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.claude/commands/harness.md`, `.claude/agents/` y `.github/prompts/` alineados con el flujo actual; el scaffold usa layout raíz por defecto pero adapta paths si actualiza un repo legacy `.harness/`; `scripts/smoke-stdio.mjs` ahora prueba `init` sobre un repo temporal y exige que `doctor` quede verde; `src/doctor.ts`, `src/help.ts` y `README.md` quedaron alineados con el scaffold nuevo.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke`, `node dist/index.js doctor --repo-path /Users/andyau/Documents/hermess` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** `init` ya no nace en un contrato viejo; repo recién inicializado queda más cerca del flujo real que el runtime ya soporta.

## 2026-05-19 — Arranque compacto con `harness_status`

- **Agente:** Codex
- **Plan:** bajar el costo de arranque del flujo SDD haciendo que los roles consuman un snapshot corto antes de leer archivos grandes, y replicar esa práctica en el scaffold de `init`.
- **Cambios:** `src/tools/harness-status.ts` ahora expone `startup_brief`; `CODEX.md`, `CLAUDE.md`, `copilot-instructions.md`, los prompts reales de `leader`, `implementer`, `reviewer` y `spec_author`, y sus plantillas en `src/init.ts` fueron cambiados para arrancar con `harness_status` y leer solo archivos mínimos según el caso; `implementer`, `reviewer` y `spec_author` también recibieron acceso explícito a `harness_status` en los prompts de Copilot; el smoke ahora exige `startup_brief` y que el scaffold nuevo use ese flujo compacto.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke`, `node dist/index.js doctor --repo-path /Users/andyau/Documents/hermess` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** el arranque normal de una feature ya no depende de releer por defecto `AGENTS.md`, `feature_list.json` y `progress/README.md`; el contrato compacto quedó ejecutable y protegido por smoke.

## 2026-05-20 — P0/P1/P2 de ahorro de tokens

- **Agente:** Codex
- **Plan:** dividir backlog activo e histórico, introducir `spec_summary.md` para SDD y terminar de compactar el arranque con `harness_status` en modo `brief_only`.
- **Cambios:** `feature_list.json` quedó reducido al backlog activo y las features cerradas pasaron a `feature_history.json`; `harness_update` ahora archiva automáticamente al cerrar con `done`; `harness_status` soporta `mode: "brief_only"` y reporta el conteo archivado; `doctor`, `init.sh`, `README.md`, `AGENTS.md`, `help`, `smoke` y el scaffold de `init` quedaron alineados con `feature_history.json`; `docs/specs.md`, prompts reales y templates ahora exigen `spec_summary.md`; se añadieron `spec_summary.md` para `repo_resources`, `safe_write_file` e `init_sdd_agents`; `leader`, `implementer`, `reviewer`, `spec_author` y el comando de arranque de Claude/Copilot fueron recortados para leer primero snapshots y summaries cortos.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke`, `node dist/index.js doctor --repo-path /Users/andyau/Documents/hermess` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** el flujo normal ahora paga menos por backlog histórico, specs largas y arranque; el contrato nuevo quedó cubierto por smoke y verificación del repo.

## 2026-05-20 — Memoria selectiva con SQLite/FTS

- **Agente:** Codex
- **Plan:** llevar la memoria del harness desde JSONL lineal a retrieval selectivo con dedup real, contexto compacto y resumen de sesión persistente.
- **Cambios:** `src/tools/shared-memory.ts` ahora usa SQLite nativo con FTS5 y migración automática desde `.harness/memory.jsonl` a `.harness/memory.sqlite`; `mem_save` deduplica por hash y hace upsert por `topic_key`; se añadieron `mem_session_summary` y `mem_get_observation`; `mem_search` y `mem_context` ahora consultan por relevancia y devuelven shapes compactos; `README.md`, `help`, prompts reales, scaffold de `init` y comandos de arranque quedaron alineados para usar `mem_context` y resúmenes compactos; `init.sh` acepta veredictos `APROBADO` o `APPROVED` para no romper evidencia histórica válida.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** la memoria ya no necesita cargar historial completo, sobrevive a compaction, deduplica mejor y puede recuperar solo contexto relevante para la sesión actual.

## 2026-05-20 — arufheim_memory

- **Agente:** implementer → reviewer
- **Plan:** Progressive disclosure en mem_search, dedup por topic_key en mem_save, nuevas tools mem_get y mem_context, campos opcionales en MemEntry, templates de init.ts actualizados.
- **Cambios:** `src/tools/shared-memory.ts` (MemEntry extendida, rewriteMemoryFile, upsertMemoryEntry), `src/tools/memory.ts` (mem_save, mem_search modificados; mem_get y mem_context añadidos), `src/init.ts` (tablas MCP y secciones de arranque actualizadas en 4 templates de instrucciones y 7 templates de agente).
- **Verificación:** `./init.sh` verde (typecheck + build + smoke); trazabilidad R1–R17 completa en `progress/impl_arufheim_memory.md`.
- **Cierre:** APPROVED. Sin hallazgos bloqueantes.

## 2026-05-23 — P0 de arquitectura explícita del arnés

## 2026-06-06 — Hardening P1 de config y boundaries

- **Agente:** Codex
- **Plan:** cerrar los P1 de fail-open en config explícita, traversal por `include` en `search_repo` y drift del smoke legacy.
- **Cambios:** `src/config.ts` ahora falla cerrado cuando `--repo-path` apunta a una config existente pero inválida y solo usa defaults en `ENOENT`; `src/tools/search-repo.ts` valida `include` antes de ejecutar `fast-glob`; `scripts/smoke-stdio.mjs` agrega cobertura para config inválida con `--repo-path`, rechazo de `include` inseguro y alinea el fixture legacy agregando `CODEX.md`.
- **Verificación:** `./init.sh` verde (typecheck, build y smoke OK) ejecutado fuera del sandbox.
- **Cierre:** P1 implementado y archivado; la spec quedó preservada en `specs/p1_hardening_boundaries_and_config/`.

## 2026-06-06 — P2 de workflow lock y read_file

- **Agente:** Codex
- **Plan:** cerrar las carreras en `harness_add/harness_update` y corregir `read_file` para rangos tardíos en archivos grandes.
- **Cambios:** `src/tools/harness-update.ts` ahora ejecuta `harness_add` y `harness_update` bajo `withWorkflowWriteLock()`; `src/tools/read-file.ts` selecciona primero el rango lógico y solo después aplica truncado; `scripts/smoke-stdio.mjs` ahora cubre concurrencia de `harness_add` y lectura tardía/truncada en `large.txt`.
- **Verificación:** `./init.sh` verde (typecheck, build y smoke OK).
- **Cierre:** P2 implementado y archivado; la spec quedó preservada en `specs/p2_workflow_lock_and_read_file_ranges/`.

## 2026-06-06 — Limpieza de señal del inbox pendiente

- **Agente:** Codex
- **Plan:** unificar la regla de archivo pendiente del inbox para excluir `README.md`, propagarla a tools/runtime/TUI y cubrir la regresión en smoke.
- **Cambios:** `src/workflow.ts` ahora expone `INBOX_RESERVED_BASENAMES`, `isPendingInboxEntryName()` y `listPendingInboxEntries()`; `src/tools/inbox.ts`, `src/tools/harness-status.ts`, `src/agent.ts` y `src/tui.ts` reutilizan esa regla compartida; `scripts/smoke-stdio.mjs` verifica que `README.md` no aparezca en `harness_status` ni `inbox_list` y que `inbox_consume` lo rechace.
- **Verificación:** `./init.sh` verde (typecheck, build y smoke OK).
- **Cierre:** feature implementada y archivada; la spec quedó preservada en `specs/inbox_signal_cleanup/`.

## 2026-06-06 — Hardening del binding MCP por repo

- **Agente:** Codex
- **Plan:** fijar binding repo-scoped para Codex y Claude Code, endurecer entrypoints globales, hacer visible `repo_path/config_path` en `harness_status` y validar todo en `doctor`, `init.sh` y smoke.
- **Cambios:** `src/init.ts` ahora scaffoldea `.codex/config.toml` y `.mcp.json`, añade Codex a `init --global` y hace que las integraciones globales pasen `--repo-path`; `src/tools/harness-status.ts` expone `repo_path`, `config_path`, `config_scope` y `workflow_layout`; `src/doctor.ts` valida bindings repo-scoped/globales sin romper compatibilidad legacy; `init.sh`, `README.md`, `CODEX.md`, `src/help.ts` y `scripts/smoke-stdio.mjs` quedaron alineados.
- **Verificación:** `./init.sh` verde (typecheck, build y smoke OK).
- **Cierre:** feature implementada y archivada; la spec quedó preservada en `specs/repo_binding_hardening/`.

- **Agente:** Codex
- **Plan:** formalizar la arquitectura del arnés en docs separadas, fijar contratos de startup y handoff, y declarar una política mínima de retry/blocked sin volverlos parte del hot path.
- **Cambios:** se añadieron `.harness-docs/model_interface.md`, `.harness-docs/context_manager.md`, `.harness-docs/execution_engine.md`, `.harness-docs/memory_system.md` y `.harness-docs/orchestration.md`; `AGENTS.md` quedó enlazado a estas docs como referencia solo para cambios del propio arnés; `src/init.ts`, `src/doctor.ts`, `scripts/smoke-stdio.mjs` e `init.sh` ahora las scaffoldean y validan en repos nuevos.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** P0 listo. La arquitectura del arnés quedó nombrada y modular sin aumentar lecturas obligatorias del flujo normal.

## 2026-05-23 — P1 de runtime contracts del arnés

- **Agente:** Codex
- **Plan:** explicitar catálogo de tools/riesgo, política de observación, modelo de memoria más formal y estrategia de planificación, manteniéndolos fuera del hot path normal.
- **Cambios:** se añadieron `.harness-docs/tool_catalog.md`, `.harness-docs/observation_policy.md` y `.harness-docs/planning_model.md`; `memory_system.md` quedó extendido con `observación puntual`, `save policy` y `budget`; `AGENTS.md` los referencia solo para cambios del propio arnés; `src/init.ts`, `src/doctor.ts`, `scripts/smoke-stdio.mjs` e `init.sh` ahora los scaffoldean y validan en repos nuevos.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** P1 listo. El arnés ya tiene contratos explícitos para tools, observación, memoria y modo de planificación.

## 2026-05-23 — P2 de budgets, versionado y adapters

- **Agente:** Codex
- **Plan:** cerrar el runtime contract con budgets operativos, versionado explícito de contratos y mapa por frontend, y luego revisar el flujo/token cost actualizado.
- **Cambios:** se añadieron `.harness-docs/budgets.md`, `.harness-docs/contract_versions.md` y `.harness-docs/frontend_adapters.md`; `model_interface.md`, `execution_engine.md`, `memory_system.md` y `observation_policy.md` quedaron enlazadas a budgets/versionado; `AGENTS.md`, `src/init.ts`, `src/doctor.ts`, `scripts/smoke-stdio.mjs` e `init.sh` ahora las scaffoldean y validan en repos nuevos.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** P2 listo. El arnés ya tiene budgets, contratos versionados y separación explícita entre core y adapters por frontend.

## 2026-05-23 — P0 operativo: policy, métricas y capacidad por frontend

- **Agente:** Codex
- **Plan:** implementar `PermissionPolicy`, métricas de sesión con tokens locales estimados y una matriz de capacidades por frontend, sin romper el flujo ni el hot path actual.
- **Cambios:** `src/config.ts` ahora acepta `permissionPolicy`; se añadieron `src/policy.ts`, `src/session-metrics.ts` y `src/tools/harness-metrics.ts`; `run_command`, `write_file`, `inbox_consume`, `harness_update`, `harness_add`, `harness_log`, `progress_*` e `history_append` ya respetan `PermissionPolicy`; `read_file`, `list_files`, `search_repo`, `memory` y `harness_status` alimentan métricas locales; `README.md`, `harness.config.json`, `help`, `tool_catalog.md`, `frontend_adapters.md`, `index` y el scaffold de `init` quedaron alineados. OpenCode quedó documentado en la matriz de capacidades, pero todavía no existe un adapter dedicado.
- **Verificación:** `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh typecheck`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh build`, `PATH="/private/tmp:$PATH" ./scripts/pnpmw.sh smoke` y `PATH="/private/tmp:$PATH" ./init.sh`.
- **Cierre:** P0 listo. El arnés ya puede estimar tokens locales por sesión y bloquear mutaciones/command execution por policy declarativa.

## 2026-05-23 — P1 operativo: scaffold y adapter mínimo para OpenCode

- **Agente:** Codex
- **Plan:** añadir soporte real de OpenCode al scaffold del repo, con config MCP local, comando de arranque compacto y validación ejecutable en `doctor`, smoke e `init.sh`.
- **Cambios:** `src/init.ts` ahora soporta `init --opencode` y scaffoldea `.opencode/opencode.json` + `.opencode/commands/harness.md`; `src/doctor.ts`, `scripts/smoke-stdio.mjs`, `src/help.ts`, `README.md`, `init.sh` y `.harness-docs/frontend_adapters.md` quedaron alineados; el repo actual ahora incluye los archivos canónicos de OpenCode en `.opencode/`.
- **Verificación:** `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh typecheck`, `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh build`, `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh smoke` y `PATH=/private/tmp:$PATH ./init.sh`.
- **Cierre:** P1 listo. OpenCode ya tiene adapter mínimo verificable sin cambiar el flujo central del arnés.

## 2026-05-23 — P2 operativo: loop contract y observabilidad en TUI

- **Agente:** Codex
- **Plan:** formalizar el `loop contract` del arnés sin introducir un loop engine propio, y mejorar el `tui` para exponer policy y métricas de sesión.
- **Cambios:** se añadió `.harness-docs/loop_contract.md`; `contract_versions.md`, `AGENTS.md`, `src/init.ts`, `src/doctor.ts`, `scripts/smoke-stdio.mjs` e `init.sh` quedaron alineados para scaffold y validación; `src/tui.ts` ahora muestra una sección `Runtime` con `PermissionPolicy`, contadores de tools/commands y `estimated_local_tokens`; `README.md`, `src/help.ts` y `tool_catalog.md` reflejan el dashboard ampliado.
- **Verificación:** `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh typecheck`, `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh build`, `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh smoke` y `PATH=/private/tmp:$PATH ./init.sh`.
- **Cierre:** P2 listo. El arnés ahora tiene contrato explícito para `request -> observe -> decide -> act -> retry/block` y una vista operativa del runtime sin mover el hot path del workflow normal.

## 2026-05-23 — Compatibilidad legacy + migración + versión 1.0.0

- **Agente:** Codex
- **Plan:** hacer que el runtime nuevo siga leyendo repos legacy, que `doctor` los marque como compatibles pero desactualizados, y que `init --update` migre al layout actual sin borrar archivos viejos; alinear además la versión pública a `1.0.0`.
- **Cambios:** `src/workflow.ts` ahora detecta layout `.harness/` o `root-legacy`, soporta `feature_list.json` array u objeto y `feature_history.json` array u objeto; `src/init.ts` migra `feature_list.json`, `feature_history.json`, `progress/`, `inbox/` y `docs/*.md` al layout actual cuando corres `init --update`; `src/doctor.ts` acepta repos legacy como compatibles y recomienda migración; `scripts/smoke-stdio.mjs` cubre runtime legacy y migración; `README.md` documenta el path de upgrade; `package.json`, `src/index.ts` y smoke quedaron en `1.0.0`.
- **Verificación:** `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh typecheck`, `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh build`, `PATH=/private/tmp:$PATH ./scripts/pnpmw.sh smoke` y `PATH=/private/tmp:$PATH ./init.sh`.
- **Cierre:** el binario nuevo puede convivir con repos viejos y migrarlos al contrato actual; base lista para release `1.0.0`.

## 2026-06-06 — P3 de contratos runtime, cierre SDD y config CLI

- **Agente:** Codex
- **Plan:** cerrar los huecos detectados en el review completo: validar cierres SDD en la tool, hacer fail-closed el binding global ambiguo, corregir `read_file` para rangos inválidos/archivos grandes y ampliar `config set` para policy/comandos.
- **Cambios:** `src/tools/harness-update.ts` ahora exige spec para estados SDD y evidencia `impl/review` válida antes de `done`; `src/config.ts` falla cerrado cuando solo existe config global sin binding explícito; `src/tools/read-file.ts` valida `end_line < start_line` y calcula previews por streaming; `src/config-command.ts`, `src/help.ts` y `README.md` ahora soportan/documentan `permissionPolicy.*`, `allowedCommands` e `ignored`; `scripts/smoke-stdio.mjs` cubre fallback global ambiguo, rangos invertidos, cierre SDD inválido/válido y mutaciones CLI de config.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke` y `./init.sh`.
- **Cierre:** feature implementada y archivada; la spec quedó preservada en `specs/p3_contract_hardening_followups/`.

## 2026-06-06 — P4 de setup, health y repair operable

- **Agente:** Codex
- **Plan:** encapsular el arnés actual detrás de `setup`, `doctor`, `repair` y un modelo común de health sin recortar SDD, backlog, memoria ni compatibilidad de `init`.
- **Cambios:** se añadieron `src/health.ts`, `src/setup.ts`, `src/repair.ts` y `src/client-selection.ts`; `src/doctor.ts` ahora consume el snapshot común y soporta `--json`; `src/index.ts` expone `setup`, `repair` y banner con `layout/health`; `src/tools/harness-status.ts`, `src/resources/repo-resources.ts` y `src/tui.ts` ahora muestran `alerts`, `binding_status`, `doctor_summary`, `last_verified_at`, `degraded_mode` y `harness://health`; `src/init.ts` ganó selección programática de clientes e `init --codex`; `src/help.ts`, `README.md` y `scripts/smoke-stdio.mjs` mueven el camino recomendado a `setup -> doctor -> repair -> init.sh` y cubren idempotencia, `doctor --json`, `repair` y el resource de health.

## 2026-06-14 — Operabilidad y release hardening

- **Agente:** Codex
- **Plan:** estabilizar identidad de repo, añadir fallback CLI de status, abaratar el startup brief y validar la release desde el tarball instalado.
- **Cambios:** `repoPath` quedó normalizado en init/setup/repair/health; se añadió `src/status.ts` y el comando `arufheim-harness status`; `harness_status` comparte esa lógica y evita blockers/métricas en `brief_only`; `README.md`, `help`, prompts y checklist manual documentan el fallback `status --brief --json`; `scripts/release-check.sh` ahora instala el tarball en un repo temporal y corre `setup` + `doctor`; `scripts/smoke-stdio.mjs` cubre `--repo-path .` y el nuevo surface CLI.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh` y `npm run release:check -- --allow-dirty`.
- **Cierre:** la operabilidad ya no depende solo de que el frontend cargue tools MCP en el primer intento y la release valida el artefacto empaquetado real.

## 2026-06-14 — Cierre de packaging, brief y gate de release

- **Agente:** Codex
- **Plan:** cerrar los cuatro huecos remanentes del flujo completo: checklist empaquetada, gate del tarball más representativo, `archived_count` fuera del hot path y changelog alineado.
- **Cambios:** `manual-release-checklist.md` ahora viaja en el paquete npm; `release-check` valida la checklist instalada y ejecuta `setup`, `status --brief --json`, `repair` y `doctor` sobre el tarball; `archived_count` pasó al snapshot de health y `status` dejó de releer `feature_history.json` en cada brief; `README.md` y `CHANGELOG.md` quedaron alineados con el gate real.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh` y `npm run release:check -- --allow-dirty`.
- **Cierre:** el flujo publicado ya cubre mejor el artefacto real y el startup brief quedó más barato sin romper contrato visible.

## 2026-06-14 — P1 de claridad operativa, adapters y gate automático

- **Agente:** Codex
- **Plan:** hacer explícito el estado operativo por cliente, alinear el protocolo de arranque entre adapters y dejar un workflow de CI que ejecute el gate completo de release.
- **Cambios:** `src/health.ts` ahora deriva `client_readiness`; `setup`, `repair`, `doctor`, `status` y `tui` exponen ese resumen operativo; `CODEX.md`, `CLAUDE.md`, `.claude/commands/harness.md`, `.opencode/commands/harness.md` y sus templates quedaron alineados al mismo fallback `harness_status -> status --brief --json`; `.codex/config.toml` del repo quedó reconciliado con `--client codex`; se añadió `.github/workflows/ci.yml`; `README.md`, `manual-release-checklist.md`, `CHANGELOG.md` y `help` quedaron actualizados; el smoke cubre `client_readiness` y la transición `configured_needs_activation -> verified`.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh` y `npm run release:check -- --allow-dirty`.
- **Cierre:** feature cerrada y archivada; el repo del harness quedó en `doctor=ok` con surface operativa más clara para CLI y frontend.

## 2026-06-07 — Cierre de repo_bootstrap_contract_alignment

- **Agente:** Codex
- **Plan:** alinear scaffold repo-local, docs Codex-only y health para setups parciales por cliente.
- **Cambios:** `src/init.ts` ahora scaffoldea `init.sh` ejecutable, desacopla `CODEX.md` de `.claude/agents/leader.md`, persiste `scaffold.localClients` y muestra activación por target; `src/health.ts` filtra alerts cliente según `scaffold.localClients` y exige `init.sh` en layout actual; `scripts/smoke-stdio.mjs` añade smoke dedicado para `setup --clients codex`; `README.md` documenta el contrato nuevo.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** feature archivada; los repos Codex-only ya no nacen degradados ni con instrucciones rotas.

## 2026-06-07 — Convergencia real de `setup --update` repo-scoped

- **Agente:** Codex
- **Plan:** hacer que `setup --update` reescriba bindings y entrypoints managed ya existentes, y que no esconda fallos de escritura.
- **Cambios:** `src/init.ts` ahora usa `writeManagedFile()` para entrypoints managed, actualiza la entrada `arufheim-harness` en `.vscode/mcp.json`, `.mcp.json`, `.opencode/opencode.json` y reemplaza la sección correspondiente en `.codex/config.toml`; además ya no silencia `EPERM/EACCES`; `scripts/smoke-stdio.mjs` añade un smoke dedicado al caso de configs repo-scoped viejas.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** `setup --update` ahora converge de verdad; en este workspace concreto `.codex/config.toml` sigue bloqueado por la policy local de Codex, pero el error ya sale explícito.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke` y `./init.sh`.
- **Cierre:** feature implementada y archivada; el arnés queda operable como infra resuelta con observabilidad transversal y compatibilidad gradual preservada.

## 2026-06-06 — P5 de cierre de release-readiness

- **Agente:** Codex
- **Plan:** cerrar los tres blockers restantes antes de publicar: contrato final de `setup --update`, versionado público alineado y gate de release reproducible.
- **Cambios:** `src/init.ts` ahora hace upsert de entradas globales gestionadas para VS Code, Claude Desktop, Claude Code y Codex; `src/setup.ts` distingue modo normal de `--update`; `src/repair.ts` usa la ruta global de reconcile; `package.json`, `src/index.ts`, `README.md`, `src/help.ts` y `CHANGELOG.md` quedaron alineados en `1.1.0`; se añadió `scripts/release-check.sh` y el script `npm run release:check`; `scripts/smoke-stdio.mjs` cubre `setup --update`, reparación global gestionada y la nueva surface pública.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke`, `./scripts/release-check.sh` (fallo esperado con worktree sucio), `HARNESS_RELEASE_ALLOW_DIRTY=1 ./scripts/release-check.sh` y `./init.sh`.
- **Cierre:** feature implementada y archivada; la release queda acotada a tener worktree limpio y decidir el acto de publicación.

## 2026-06-06 — Upgrade seguro de AGENTS.md existente

- **Agente:** Codex
- **Plan:** mantener `AGENTS.md` como archivo preservado del repo, pero añadir una sección gestionada del harness que `setup` y `repair` puedan reconciliar sin sobrescribir contenido custom.
- **Cambios:** `src/init.ts` ahora crea `AGENTS.md` nuevo con un bloque gestionado marcado y, en modo update, inserta o regenera solo ese bloque sobre archivos existentes; `src/health.ts` añade el diagnóstico `scaffold.agents.managed` para detectar `AGENTS.md` presentes pero no gestionados o desactualizados; `scripts/smoke-stdio.mjs` cubre el caso de un repo con `AGENTS.md` propio que primero degrada en `doctor` y luego converge con `setup`; `README.md` documenta la semántica no destructiva.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke` y `./init.sh`.
- **Cierre:** feature implementada y archivada; `AGENTS.md` existente ahora converge sin perder contenido del repo.

## 2026-06-06 — P6 de operabilidad y hardening de bindings globales

- **Agente:** Codex
- **Plan:** cerrar los hallazgos del review final sobre la capa global: no sobrescribir configs inválidas, distinguir bindings asumidos de portables reales y dejar pasos manuales explícitos por cliente.
- **Cambios:** `src/init.ts` ahora valida configs globales antes de escribir y falla cerrado sobre JSON/JSONC/TOML inválidos; `src/setup.ts` y `src/repair.ts` muestran pasos de activación o reinicio por cliente; `src/health.ts` añade el estado `assumed` y `global_assumed` para bindings globales no verificables; `scripts/smoke-stdio.mjs` cubre fail-closed de configs globales inválidas, bindings asumidos y la nueva salida operativa; `src/help.ts`, `README.md` y `manual-release-checklist.md` documentan el contrato nuevo.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke` y `./init.sh`.
- **Cierre:** feature implementada y archivada; la capa global ahora falla cerrado donde corresponde y expone explícitamente qué sigue requiriendo validación manual.

## 2026-06-06 — P7 de handshake y verificación automática por cliente

- **Agente:** Codex
- **Plan:** mover la validación de integraciones cliente desde la checklist manual al runtime del harness, sin romper setup/init/doctor ni bindings existentes.
- **Cambios:** `src/init.ts` ahora genera bindings con `--client`; `src/config.ts` resuelve `clientId` y `configScope`; `src/index.ts` registra verificación repo-local al arranque; `src/health.ts` persiste `client-verifications.json`, expone `client_verification` y promueve bindings globales `assumed` a `verified`; `src/tools/harness-status.ts`, `src/doctor.ts` y `src/tui.ts` muestran el estado nuevo; `scripts/smoke-stdio.mjs`, `README.md`, `src/help.ts` y `manual-release-checklist.md` quedaron alineados con el contrato de upgrade automático.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** feature implementada y archivada; el arnés ahora distingue configuración escrita de frontend realmente verificado y deja de degradar bindings `assumed` cuando la evidencia sigue vigente.

## 2026-06-07 — Follow-up: pre-verificación de bindings determinísticos

- **Agente:** Codex
- **Plan:** eliminar el ruido operativo restante donde bindings repo-scoped o globales portables quedaban en `configured` pese a no depender ya del frontend.
- **Cambios:** `src/health.ts` ahora trata bindings `config_sufficient` como `verified` por contrato de config; `src/setup.ts`/`src/repair.ts`, `scripts/smoke-stdio.mjs`, `README.md`, `src/help.ts` y `manual-release-checklist.md` quedaron alineados para reservar el primer arranque real solo a globals `assumed`.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** el camino normal repo-scoped ya queda `verified` al hacer `setup` o `repair`; solo los bindings globales que dependen del cwd real del cliente siguen esperando arranque real.

## 2026-06-07 — P8 de preferencia repo-scoped en setup/repair globales

- **Agente:** Codex
- **Plan:** hacer que `setup --global` y `repair --global` dejen una ruta resuelta para Claude Code y Codex cuando ya existe un repo disponible, sin contaminar cwd arbitrarios.
- **Cambios:** se añadió `src/global-mode.ts` para resolver `repo_context` seguro, centralizar el scaffold híbrido y la pre-verificación determinística; `src/setup.ts`, `src/repair.ts` y `src/init.ts` ahora distinguen config global de bindings repo-scoped preferidos en output y activación; `scripts/smoke-stdio.mjs` cubre el camino híbrido explícito/detectado y el no-write fuera de repo; `README.md`, `src/help.ts` y `manual-release-checklist.md` documentan `setup --global --repo-path <repo>`.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** feature implementada y archivada; Claude Code y Codex ya no dependen solo del fallback global ambiguo cuando el repo está disponible.

## 2026-06-07 — Cierre release-facing de 1.1.0

- **Agente:** Codex
- **Plan:** alinear changelog y guía mínima de publish con estado real de `1.1.0`.
- **Cambios:** `CHANGELOG.md` ahora refleja setup/repair, health compartido, verificación por cliente y preferencia repo-scoped; `README.md` y `manual-release-checklist.md` ahora separan gate automático de publish y pasada manual de clientes.
- **Verificación:** `./init.sh`.
- **Cierre:** narrativa pública lista; publish sigue bloqueado hasta tener worktree limpio y pasada manual final según checklist.

## 2026-06-07 — Higiene de release: ignorar `.pnpm-store/`

- **Agente:** Codex
- **Plan:** sacar ruido local del gate de release sin bajar estándar.
- **Cambios:** `.gitignore` ahora ignora `.pnpm-store/`, evitando que cache local de pnpm ensucie `git status` y confunda el estado real de publish.
- **Verificación:** `./init.sh`.
- **Cierre:** ruido local corregido; lo que sigue bloqueando publish son cambios reales sin integrar y la pasada manual de clientes.

## 2026-06-14 — P2 de recovery explícito para configs globales inválidas

- **Agente:** Codex
- **Plan:** mantener el fail-closed por defecto, pero abrir una vía explícita para que `setup`/`repair` globales respalden y regeneren configs inválidas gestionadas por el arnés.
- **Cambios:** `src/init.ts` ahora distingue parse failures recuperables de errores de lectura, soporta `--force-managed-global`, guarda backups sidecar y reutiliza un preflight cacheado para no duplicar respaldos; `src/setup.ts`, `src/repair.ts` e `src/index.ts` cablean la bandera y reportan `invalid_global_recovery` más los backups creados; `src/health.ts` propone `repair --global --force-managed-global` como fix accionable; `src/help.ts`, `README.md`, `manual-release-checklist.md` y `scripts/smoke-stdio.mjs` quedaron alineados con el contrato nuevo.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke` y `./init.sh`.
- **Cierre:** feature archivada; ahora existe recovery explícito para configs globales rotas sin debilitar el comportamiento seguro por defecto.

## 2026-06-15 — P1 de scope de health por clientes esperados

- **Agente:** Codex
- **Plan:** evitar que el health de un repo se degrade por bindings globales o repo-scoped ajenos al scaffold activo, sin perder visibilidad de fallbacks válidos ni la promoción por arranque real.
- **Cambios:** `src/health.ts` ahora deriva clientes observables desde `scaffold.localClients`, filtra checks repo-scoped/globales irrelevantes, mantiene visibles bindings globales válidos `explicit`/`portable`/`assumed` aunque no pertenezcan al scaffold local y alinea `client_verification`/`client_readiness` persistidos con ese mismo scope; `scripts/smoke-stdio.mjs` añade el caso `codex-only` con global ajeno roto y preserva el contrato de promoción para globals `assumed`.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke` y `./init.sh`.
- **Cierre:** feature archivada; `setup`, `doctor` y el brief local ya no se rompen por configs globales inválidas de clientes no esperados, pero siguen mostrando fallbacks válidos cuando existen.

## 2026-06-15 — P1 de detección segura de repo y brief fresco

- **Agente:** Codex
- **Plan:** cerrar los dos P1 abiertos sin tocar otros contratos: endurecer la auto-detección de repo en `setup/repair --global` y hacer que `status --brief` invalide health cache cuando cambie la evidencia observada.
- **Cambios:** `src/global-mode.ts` ya no acepta un `feature_list.json` suelto como repo detectable y exige evidencia real para root-legacy; `src/health.ts` persiste una firma ligera de inputs observados y rechaza snapshots stale; `src/status.ts` refresca `health.json` cuando `brief_only` no puede confiar en la cache; `scripts/smoke-stdio.mjs` ahora cubre cwd con marker débil, repo legacy real detectado y refresh del brief tras romper `.codex/config.toml`.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke`, repro manual de `setup --global` con marker débil, repro manual de `status --brief --json` tras borrar `.codex/config.toml`, y `./init.sh`.
- **Cierre:** feature archivada; el camino global ya no muta cwd arbitrarios por detección débil y el fallback CLI del brief vuelve a ser observable y confiable.

## 2026-06-15 — P1 de gate de publicación y versionado explícito

- **Agente:** Codex
- **Plan:** cerrar los últimos huecos release-facing sin tocar el runtime fuera de ese alcance: alinear la versión publicada y forzar un gate explícito para la checklist manual de clientes.
- **Cambios:** `package.json`, `src/version.ts` y `src/index.ts` quedaron alineados en `1.1.0`; `CHANGELOG.md` abrió la sección `1.1.0` y vació `Unreleased`; se añadió `release-readiness.json` como evidencia manual rastreable; `scripts/release-publish-check.mjs` valida versión, changelog y signoff manual; `scripts/release-check.sh`, `README.md`, `src/help.ts`, `manual-release-checklist.md` y `scripts/smoke-stdio.mjs` quedaron alineados con el flujo `release:check -> checklist -> release:publish-check`.
- **Verificación:** `npm run typecheck`, `npm run build`, `npm run smoke`, `npm run release:check -- --allow-dirty`, `npm run release:publish-check -- --skip-automated` y `./init.sh`.
- **Cierre:** feature archivada; la release ya no puede salir con drift de versión/changelog ni sin evidencia manual cerrada. `release:publish-check` queda rojo hasta completar de verdad `release-readiness.json`.

## 2026-06-15 — Pasada de release-readiness parcial

- **Agente:** Codex
- **Plan:** cerrar de forma honesta todos los checks de publish que ya tenían evidencia actual y dejar explícito el bloqueo real restante.
- **Cambios:** `release-readiness.json` ahora marca `repo_base`, `vscode`, `claude_code_repo_scoped`, `codex_repo_scoped`, `opencode` y `broken_global_recovery` como cerrados con notas rastreables; `claude_desktop` quedó abierto con nota de bloqueo real por falta de handshake frontend verificable en esta máquina.
- **Verificación:** `./init.sh`, `node dist/index.js status --repo-path . --brief --json`, `node dist/index.js doctor --repo-path . --json`, lectura de `.harness/metrics/client-verifications.json`, inspección de configs globales reales y reproducción explícita de `setup/repair --global` con `HOME` temporal para validar fail-closed + backup + recovery forzado.
- **Cierre:** el gate de publish queda acotado a `claude_desktop`; si ese cliente no es parte del release target, el siguiente paso es cambiar ese requisito de negocio antes de publicar.

## 2026-06-15 — Ajuste de publish para Claude Desktop opcional

- **Agente:** Codex
- **Plan:** dejar de tratar `claude_desktop` como requisito universal de publish sin perder la trazabilidad cuando sí entra en scope.
- **Cambios:** `release-readiness.json` ahora deja `claude_desktop` como `required=false`; `manual-release-checklist.md` y `README.md` aclaran que los checks opcionales no bloquean publish, pero si se cubren deben validarse con evidencia real antes de marcarse como completados.
- **Verificación:** `npm run release:publish-check -- --skip-automated` y `./init.sh`.
- **Cierre:** publish gate verde con el scope actual; Claude Desktop sigue verificable y auditable cuando el release target realmente lo incluye.

## 2026-06-15 — Paso explícito de tests y README en el flujo

- **Agente:** Codex
- **Plan:** volver explícito en el flujo del harness que antes de `done` hay que correr verificación relevante y actualizar README/docs si el cambio afecta uso visible.
- **Cambios:** `AGENTS.md`, `README.md` y `.harness-docs/verification.md` ahora muestran el paso `tests+README`; `CODEX.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/commands/harness.md` y `.opencode/commands/harness.md` endurecen la regla de cierre; `leader`, `implementer` y `reviewer` quedaron alineados en `.claude/agents/`, `.github/prompts/` y `src/init.ts`; el marker de agentes subió a `v2` y `promptBody()` acepta `v1|v2` para facilitar `setup --update`.
- **Verificación:** `./init.sh`.
- **Cierre:** feature archivada; el contrato del harness ya no deja implícito el paso de tests/README antes de `done`.

## 2026-06-15 — Paso explícito de CHANGELOG para cambios release-facing

- **Agente:** Codex
- **Plan:** hacer explícito en el flujo del harness que los cambios release-facing deben dejar `CHANGELOG.md` alineado antes de `done`, y propagar esa regla a prompts, comandos y templates scaffolded.
- **Cambios:** `AGENTS.md`, `README.md`, `CHECKPOINTS.md`, `.harness-docs/verification.md`, `CODEX.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/commands/harness.md` y `.opencode/commands/harness.md` ahora exigen `CHANGELOG.md` o justificación explícita cuando el cambio es release-facing; `leader`, `implementer` y `reviewer` quedaron alineados en `.claude/agents/`, `.github/prompts/` y `src/init.ts`; el marker gestionado subió a `v3` y `promptBody()` acepta markers antiguos; además, el scaffold base de `.harness/progress/current.md` volvió a incluir `Feature en curso`, `Inicio` y `Agente` para converger con el contrato documentado.
- **Verificación:** `./init.sh`.
- **Cierre:** feature archivada; el flujo del harness ahora hace visible el paso `tests+README+CHANGELOG` y deja alineado el material scaffolded con esa regla.

## 2026-06-16 — Métricas reales de response y startup brief mínimo

- **Agente:** Codex
- **Plan:** medir bytes/tokens locales realmente devueltos por `harness_status` y `status`, y bajar el hot path de arranque moviendo el contrato recomendado a `brief_minimal`.
- **Cambios:** `src/session-metrics.ts` ahora registra `response_output_bytes` / `response_output_tokens` y breakdown por surface; `src/status.ts` añade `brief_minimal`, evita leer backlog/current/inbox en ese modo y registra output de `cli:status:*`; `src/tools/harness-status.ts`, `src/tools/harness-metrics.ts` y `src/tui.ts` quedaron alineados con la métrica nueva; `README.md`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/`, `.opencode/commands/`, `.claude/agents/`, `.github/prompts/`, `.github/copilot-instructions.md`, `.harness-docs/model_interface.md` y `src/init.ts` mueven el startup recomendado a `brief_minimal` sin quitar `brief_only`; el marker gestionado subió a `v4` para que `setup --update` propague el contrato nuevo; `scripts/smoke-stdio.mjs` ahora cubre el snapshot mínimo y la persistencia de métricas por surface.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs`, comprobación local de `node dist/index.js status --repo-path . --brief-minimal --json`, comprobación local de `node dist/index.js status --repo-path . --brief --json`, y `./init.sh`.
- **Cierre:** feature archivada; el arnés ya distingue el costo local de `brief_minimal` vs `brief_only` y el arranque recomendado baja a un snapshot mínimo verificable.

## 2026-06-17 — Loop engineering canónico para workflow y runtime

- **Agente:** Codex
- **Plan:** integrar un loop `plan_execute_verify` trazable y reusable entre workflow, runtime MCP, surfaces ricas, agent y scaffold sin cambiar los estados del backlog.
- **Cambios:** se añadió `src/loop.ts` como fuente de verdad de policy, reducción y diagnósticos; `src/config.ts` acepta `loopPolicy`; `harness_update`, `setup` y `repair` siembran/sincronizan loops; se añadieron `harness_loop_status`, `harness_loop_event` y `harness://loop/active`; `harness_status`, `status`, `doctor`, `health`, `tui` y `agent` ahora exponen/consumen `loop_summary`; `src/init.ts`, `AGENTS.md`, `README.md`, `CODEX.md`, `CLAUDE.md`, prompts, agents y adapters quedaron alineados al route-back automático; el smoke ahora cubre retries válidos/inválidos, reconciliación por `setup --update`/`repair` y el contract nuevo del loop.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** feature archivada; el repo conserva el loop terminal de la feature cerrada y `repair` puede reseedear loops activos faltantes sin inventar historial.

## 2026-06-17 — Simulación de flujos para costo local de tokens

- **Agente:** Codex
- **Plan:** añadir una simulación reproducible por flujo para estimar bytes y tokens locales del harness sin contaminar `.harness/metrics/session.json`.
- **Cambios:** se añadió `src/simulate.ts` con el comando `arufheim-harness simulate`; `src/session-metrics.ts` ahora exporta la heurística reusable de estimación; `src/doctor.ts` expone un builder reutilizable sin persistencia; `src/index.ts` y `src/help.ts` quedaron alineados con la surface nueva; `README.md`, `CODEX.md`, `CLAUDE.md`, `.claude/commands/harness.md`, `.opencode/commands/harness.md` y `src/init.ts` documentan el comando; `scripts/smoke-stdio.mjs` cubre `startup`, `loop`, `triage` y verifica que la simulación no muta `session.json`.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs`, `node dist/index.js simulate --repo-path . --flow startup --json`, `node dist/index.js simulate --repo-path . --flow loop,triage` y `./init.sh`.
- **Cierre:** feature archivada; el repo ya puede estimar el costo local de startup, activation, loop y triage sin mezclar esa simulación con las métricas reales de sesión.

## 2026-06-17 — Corte de release 1.2.0

- **Agente:** Codex
- **Plan:** alinear versión, changelog y release-readiness para publicar la nueva release con loop engineering y simulate.
- **Cambios:** `package.json` y `release-readiness.json` quedaron en `1.2.0`; `CHANGELOG.md` movió los cambios de `Unreleased` a `## 1.2.0`; se resembró el loop de la feature de release para no romper `doctor`; el gate `release:check` pasó contra el tarball real instalado en un repo temporal y `release:publish-check -- --skip-automated` quedó verde.
- **Verificación:** `node dist/index.js repair --repo-path .`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty`, `npm run release:publish-check -- --skip-automated` y `./init.sh`.
- **Cierre:** feature archivada; el repo queda listo para publicar `1.2.0`.

## 2026-06-22 — TDD parcial por capas y headroom interno fase 1

- **Agente:** Codex
- **Plan:** formalizar TDD parcial por capas sin tocar surfaces públicas nuevas, añadir una suite rápida real, autodetección de testing para scaffold y un `head_<feature>.md` interno consumido por `agent` y prompts.
- **Cambios:** se añadió `Vitest` como suite rápida oficial del repo; `package.json`, `init.sh`, `scripts/release-check.sh` y `scripts/pnpmw.sh` quedaron alineados con el gate `typecheck -> test -> build -> smoke`; `src/testing.ts` introduce `testing.fastCommand` / `testing.integrationCommand`, autodetección y merge conservador de `allowedCommands`; `src/headroom.ts` genera/refresca `.harness/progress/head_<feature>.md` y se conectó a `agent`, `setup`, `repair`, `harness_update` y `harness_loop_event`; `README.md`, `CHECKPOINTS.md`, `.harness-docs/*`, `AGENTS.md`, `src/help.ts`, prompts/agentes gestionados y `src/init.ts` quedaron alineados con la policy TDD parcial y el nuevo nivel `head`; `scripts/smoke-stdio.mjs` ahora cubre autodetección, guidance de testing, fallback JS/TS vs no-JS y refresh de `head_<feature>.md`.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs`, `node dist/index.js setup --repo-path . --update` y `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./init.sh`.
- **Cierre:** feature archivada; el harness ya expone TDD parcial por capas en scaffold y docs, autodetecta la capa rápida del repo y usa `head_<feature>.md` como headroom interno sin abrir surfaces públicas nuevas.

## 2026-06-22 — Reducir ruido de preflight de testing

- **Agente:** Codex
- **Plan:** bajar el ruido operacional del harness para que `pnpm`/`Vitest` se traten como feedback contextual del repo y no como chequeo previo universal antes de editar.
- **Cambios:** `src/testing.ts` ahora presenta `testing.fastCommand` e `integrationCommand` como comandos reales a usar cuando aplican; `src/headroom.ts` cambió la siguiente acción para evitar preflights de tooling; `src/init.ts` subió el marker gestionado a `v7` y actualizó prompts/templates/checkpoints para prohibir `pnpm --version` / `vitest --version` salvo fallo real o trabajo explícito sobre tooling/testing; `README.md`, `.harness-docs/verification.md` y `CHECKPOINTS.md` quedaron alineados; `setup --update` regeneró `.github/prompts/implementer.prompt.md` y `.claude/agents/implementer.md`; `scripts/smoke-stdio.mjs` y `tests/testing.test.ts` fijan la regresión.
- **Verificación:** `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh test`, `./scripts/pnpmw.sh build`, `node dist/index.js setup --repo-path . --update`, `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh smoke` y `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./init.sh`.
- **Cierre:** feature archivada; el harness mantiene TDD parcial por capas, pero deja de inducir preflights ruidosos de `pnpm`/`Vitest` en prompts y headroom.

## 2026-06-22 — Quitar fallback a npx en init.sh de repos consumidores

- **Agente:** Codex
- **Plan:** eliminar el fallback implícito a `npx` del `init.sh` scaffolded para repos consumidores, dejar un error offline-first accionable y alinear smoke/docs/help con el contrato nuevo.
- **Cambios:** `src/init.ts` quitó `npx --yes arufheim-harness ...` del `init.sh` scaffolded y dejó una salida cerrada que exige `ARUFHEIM_HARNESS_ENTRY`, `arufheim-harness` en `PATH` o `verify`; `scripts/smoke-stdio.mjs` ahora fija que el scaffold `full` ya no dependa de `npx`; `README.md`, `src/help.ts`, `.harness-docs/verification.md` y `CHANGELOG.md` quedaron alineados con el contrato offline-first del repo consumidor.
- **Verificación:** `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh typecheck`, `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh test`, `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh build`, `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/pnpmw.sh smoke` y `COREPACK_HOME=/private/tmp/corepack-home PATH=/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./init.sh`.
- **Cierre:** feature archivada; el repo consumidor en layout `full` ya no intenta descargar el harness al cerrar o verificar y el camino correcto quedó explícito.

## 2026-06-22 — Preparar release 1.3.0

- **Agente:** Codex
- **Plan:** correr la pasada de release real sobre el estado actual, validar el paquete en un repo limpio con `setup --layout full` y alinear versión/changelog/readiness para dejar el publish gate listo.
- **Cambios:** se añadió el loop de la feature de release para no romper `doctor`; `package.json`, `release-readiness.json` y `CHANGELOG.md` quedaron alineados en `1.3.0`; `release-readiness.json` refrescó `repo_base` con evidencia nueva del tarball actual; `CHANGELOG.md` vació `Unreleased` y movió los cambios acumulados a `## 1.3.0`.
- **Verificación:** `PATH=/private/tmp/harness-release-bin:/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./scripts/release-check.sh --allow-dirty`, repo limpio desde tarball actual con `setup --layout full`, `./init.sh` usando binario local en `PATH`, `doctor --json` en `ok`, y `/Users/andyau/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/release-publish-check.mjs --skip-automated`.
- **Cierre:** feature archivada; el release contract de `1.3.0` quedó alineado. Solo falta el paso operativo normal de dejar el worktree limpio antes de publicar desde este repo.

## 2026-06-23 — Runtime global gestionado y bindings reproducibles

- **Agente:** Codex
- **Plan:** reemplazar la dependencia de `npx`/PATH ambiguo en bindings MCP por un runtime global gestionado y un launcher repo-portable, sin convertir `arufheim-harness` en dependencia del proyecto.
- **Cambios:** se añadió `src/runtime.ts` para instalar/verificar el runtime global gestionado, persistir `runtime.json` y exponer un launcher repo-portable en `.harness/runtime/launch-global-runtime.mjs`; `src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/config.ts` y `src/index.ts` migraron los bindings globales al shim absoluto y los repo-scoped a `node + launcher`, además de corregir `setup --help`; `src/health.ts`, `src/status.ts`, `src/doctor.ts` y `src/verify.ts` exponen `runtime_status` y tratan `npx` como drift legacy reparable; `README.md`, `manual-release-checklist.md`, `src/help.ts`, `CHANGELOG.md` y `scripts/smoke-stdio.mjs` quedaron alineados con el contrato nuevo y con seed aislado del runtime en smoke.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** feature archivada; el harness ya no depende de `npx` para sus bindings gestionados y el repo consumidor sigue portable sin dependencia local del paquete.

## 2026-06-23 — Hardening del boot real del runtime gestionado

- **Agente:** Codex
- **Plan:** cerrar los hallazgos del review del runtime gestionado: boot roto fuera del repo, riesgo de reinstall autodestructivo, drift en la resolución del global root y smoke insuficiente.
- **Cambios:** `src/runtime.ts` dejó de copiar `dist/` al root global y ahora escribe metadata + shim apuntando al entrypoint real instalado del paquete; el launcher repo-scoped usa `os.homedir()` y la misma raíz global canónica exportada desde `src/config.ts`; `evaluateManagedGlobalRuntimeStatus()` marca como `stale` los runtimes legacy que aún apunten a `runtime/dist`; se añadió `tests/runtime.test.ts`; `scripts/smoke-stdio.mjs` ahora ejecuta el shim global y el launcher repo-scoped reales con `status --brief-minimal --json`; `README.md` y `CHANGELOG.md` quedaron alineados con el contrato nuevo.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs` y `./init.sh`.
- **Cierre:** feature archivada; el runtime gestionado ya arranca de verdad fuera del repo y el smoke protege ese contrato end-to-end.

## 2026-06-23 — Procedencia visible del runtime y gate real de release

- **Agente:** Codex
- **Plan:** hacer visible si el runtime gestionado viene de un package install o de un workspace/link de desarrollo, degradar ese matiz con warning explícito y mover la garantía fuerte al gate de release sobre el tarball real.
- **Cambios:** `src/runtime.ts` ahora deriva y persiste `runtime_source`; `src/health.ts` propaga esa procedencia y degrada con warning `workspace_dev` / `linked_dev`; `src/doctor.ts`, `src/verify.ts` y `src/status.ts` muestran `source=<kind>` en la línea de runtime; `tests/runtime.test.ts` cubre `workspace_dev`, `package_install` y `linked_dev`; `scripts/smoke-stdio.mjs` acepta el warning de desarrollo en repos sembrados desde este workspace; `scripts/release-check.sh` usa un `XDG_CONFIG_HOME` temporal, siembra el runtime desde el tarball instalado, ejecuta el shim real y exige `runtime_status.runtime_source.kind=package_install`; `README.md`, `manual-release-checklist.md`, `src/help.ts` y `CHANGELOG.md` quedaron alineados.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc -p tsconfig.json`, `node scripts/smoke-stdio.mjs`, `HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check -- --allow-dirty` y `./init.sh`.
- **Cierre:** feature archivada; el matiz de runtime de desarrollo ya es visible y la release valida el caso `package_install` real antes de publicar.

## 2026-06-23 — Bundle global autocontenido para el runtime gestionado

- **Agente:** Codex
- **Plan:** convertir el runtime global en un artefacto JS autocontenido sembrado en el root global, separar `runtime_artifact` de `runtime_source`, embedir docs compartidas y endurecer `release:check` para validar el shim sin el paquete sembrador.
- **Cambios:** se añadió `scripts/generate-shared-docs-registry.mjs` para generar una registry embebida de docs compartidas y `scripts/build-runtime-bundle.mjs` para producir `dist/runtime-bundle.cjs` con `esbuild`; `src/shared-docs.ts` dejó de depender de `packageRoot()`; `src/runtime.ts` ahora siembra `runtime/arufheim-harness.cjs`, escribe metadata v2 con `artifact_kind/artifact_path` y `seed_*`, mantiene compatibilidad legacy v1 como `stale` y usa fallback de bundle solo para workspace dev; `src/health.ts`, `src/doctor.ts`, `src/status.ts`, `src/verify.ts`, `src/help.ts`, `README.md`, `manual-release-checklist.md` y `CHANGELOG.md` quedaron alineados con `runtime_artifact + runtime_source`; `tests/runtime.test.ts`, `tests/contracts.test.ts`, `scripts/smoke-stdio.mjs` y `scripts/release-check.sh` ahora validan el bundle global, `docs list/show` desde el runtime gestionado y el caso de release donde se retira el paquete sembrador.
- **Verificación:** `./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `node scripts/generate-shared-docs-registry.mjs && ./node_modules/.bin/vitest run`, `node scripts/generate-shared-docs-registry.mjs && ./node_modules/.bin/tsc -p tsconfig.json && node scripts/build-runtime-bundle.mjs`, `node scripts/smoke-stdio.mjs`, `npm run release:check -- --allow-dirty` y `./init.sh`.
- **Cierre:** feature archivada; el runtime gestionado ya es autocontenido a nivel de artefacto global y la release prueba explícitamente que el shim sigue vivo aun sin el paquete sembrador.
