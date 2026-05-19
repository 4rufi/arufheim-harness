# AGENTS.md

Este archivo es el punto de entrada para cualquier agente que trabaje en harness. No es una biblia de reglas; es un mapa.

## Antes de empezar

1. Ejecuta `./init.sh`. Si falla, paras y resuelves el entorno antes de tocar código.
2. Lee `progress/current.md` para ver el estado de la sesión anterior.
3. Si vas a tocar el flujo de sesión o artifacts de progreso, lee `progress/README.md`.
4. Lee `feature_list.json`.
5. Si la feature activa tiene `"sdd": true`, lee `docs/specs.md` antes de tocar specs o código.

## Mapa del repo

| Ruta                              | Qué contiene                                                                       | Cuándo leerla                        |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| `feature_list.json`               | Lista de features y su estado                                                      | Siempre                              |
| `progress/README.md`              | Contrato de `progress/` y plantillas canónicas                                     | Si tocas el flujo de sesión          |
| `progress/current.md`             | Estado vivo de la sesión; solo usa `Plan`, `Bitácora` y `Próximo paso`             | Siempre                              |
| `progress/history.md`             | Bitácora append-only de sesiones cerradas                                          | Si necesitas contexto                |
| `progress/explore_<topic>.md`     | Notas de discovery o exploración que sustentan una decisión                        | Si arrancas con análisis             |
| `specs/<feature>/`                | `requirements.md`, `design.md`, `tasks.md`                                         | Antes de implementar una feature SDD |
| `docs/architecture.md`            | Restricciones y modelo del sistema                                                 | Antes de diseñar                     |
| `docs/conventions.md`             | Estilo, naming y reglas de edición                                                 | Antes de escribir código             |
| `docs/specs.md`                   | Flujo SDD y formato de specs                                                       | Antes de redactar o revisar specs    |
| `docs/verification.md`            | Cómo demostrar que el cambio funciona                                              | Antes de cerrar                      |
| `CHECKPOINTS.md`                  | Criterios objetivos de salida correcta                                             | Para autoevaluación                  |
| `.claude/agents/`                 | Roles `leader`, `spec_author`, `implementer`, `reviewer`, `inbox_reader`, `scoper` | Si orquestas subagentes              |
| `.github/prompts/`                | Prompts equivalentes para GitHub Copilot                                           | Si trabajas desde Copilot            |
| `.github/copilot-instructions.md` | Instrucciones base para Copilot                                                    | Si trabajas desde Copilot            |
| `CLAUDE.md`                       | Punto de entrada operativo para Claude Code                                        | Si trabajas desde Claude             |
| `CODEX.md`                        | Punto de entrada operativo para Codex                                              | Si trabajas desde Codex              |
| `inbox/`                          | Requerimientos en bruto pendientes de procesar                                     | Si hay archivos nuevos del humano    |
| `inbox/processed/`                | Archivos ya procesados por `inbox_reader`                                          | Solo referencia histórica            |
| `progress/spec_<feature>.md`      | Bloqueo del `spec_author` cuando falta claridad para escribir un spec verificable  | Si una spec termina en `blocked`     |
| `progress/impl_<feature>.md`      | Log del implementer: archivos tocados + trazabilidad R→verificación                | Antes de review                      |
| `progress/review_<feature>.md`    | Log del reviewer: checklist + veredicto                                            | Para cerrar la feature               |
| `src/`                            | Servidor MCP y tools                                                               | Para implementar                     |
| `scripts/`                        | Smoke tests y utilidades de verificación                                           | Para validar                         |

## Reglas duras

- Una sola feature en `in_progress`.
- No cierres una feature sin `./init.sh` en verde.
- Toda feature con `"sdd": true` pasa por `pending -> spec_ready -> aprobación humana -> in_progress -> done`.
- No inventes estado: actualiza `progress/current.md` mientras trabajas.
- No rompas la plantilla de `progress/current.md`; usa `## Plan`, `## Bitácora` y `## Próximo paso`.
- No escribas en `stdout` logs arbitrarios del servidor MCP; `stdout` es del protocolo.
- Si te bloqueas, documéntalo en `progress/current.md` y usa `blocked`.

## Flujo completo

```text
[inbox_reader] -> pending
[scoper]       -> filtra features por proyecto para la sesión
pending        -> [spec_author] -> spec_ready -> HUMANO -> in_progress -> [implementer -> reviewer] -> done
```

`inbox_reader` y `scoper` son opcionales; el flujo SDD es obligatorio para features con `"sdd": true`.

## Cierre de sesión

1. `./init.sh`
2. Si acabaste la feature, actualiza `feature_list.json`
3. Añade un resumen append-only a `progress/history.md` con `Agente`, `Plan`, `Cambios`, `Verificación` y `Cierre`
4. Limpia `progress/current.md` dejando la plantilla canónica
5. Conserva `explore_*.md`, `impl_*.md`, `review_*.md` y `spec_*.md` como evidencia
