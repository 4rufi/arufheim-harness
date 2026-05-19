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
