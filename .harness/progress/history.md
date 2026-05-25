# Bitácora histórica (append-only)

> Cada vez que se cierra una sesión, su resumen se añade aquí.
> No edites entradas anteriores. Solo añades al final.

---

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
