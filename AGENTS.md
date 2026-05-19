# AGENTS.md

Este archivo es el punto de entrada para cualquier agente que trabaje en Hermess. No es una biblia de reglas; es un mapa.

## Antes de empezar

1. Ejecuta `./init.sh`. Si falla, paras y resuelves el entorno antes de tocar código.
2. Lee `progress/current.md` para ver el estado de la sesión anterior.
3. Lee `feature_list.json`.
4. Si la feature activa tiene `"sdd": true`, lee `docs/specs.md` antes de tocar specs o código.

## Mapa del repo

| Ruta                           | Qué contiene                                                                       | Cuándo leerla                        |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------ |
| `feature_list.json`            | Lista de features y su estado                                                      | Siempre                              |
| `progress/current.md`          | Estado vivo de la sesión                                                           | Siempre                              |
| `progress/history.md`          | Bitácora append-only                                                               | Si necesitas contexto                |
| `specs/<feature>/`             | `requirements.md`, `design.md`, `tasks.md`                                         | Antes de implementar una feature SDD |
| `docs/architecture.md`         | Restricciones y modelo del sistema                                                 | Antes de diseñar                     |
| `docs/conventions.md`          | Estilo, naming y reglas de edición                                                 | Antes de escribir código             |
| `docs/specs.md`                | Flujo SDD y formato de specs                                                       | Antes de redactar o revisar specs    |
| `docs/verification.md`         | Cómo demostrar que el cambio funciona                                              | Antes de cerrar                      |
| `CHECKPOINTS.md`               | Criterios objetivos de salida correcta                                             | Para autoevaluación                  |
| `.claude/agents/`              | Roles `leader`, `spec_author`, `implementer`, `reviewer`, `inbox_reader`, `scoper` | Si orquestas subagentes              |
| `.github/prompts/`             | Prompts equivalentes para GitHub Copilot                                           | Si trabajas desde Copilot            |
| `.github/copilot-instructions.md` | Instrucciones base para Copilot                                                 | Si trabajas desde Copilot            |
| `CLAUDE.md`                    | Punto de entrada operativo para Claude Code                                        | Si trabajas desde Claude             |
| `CODEX.md`                     | Punto de entrada operativo para Codex                                              | Si trabajas desde Codex              |
| `inbox/`                       | Requerimientos en bruto pendientes de procesar                                     | Si hay archivos nuevos del humano    |
| `inbox/processed/`             | Archivos ya procesados por `inbox_reader`                                          | Solo referencia histórica            |
| `progress/impl_<feature>.md`   | Log del implementer: archivos tocados + trazabilidad R→test                        | Antes de review                      |
| `progress/review_<feature>.md` | Log del reviewer: checklist + veredicto                                            | Para cerrar la feature               |
| `src/`                         | Servidor MCP y tools                                                               | Para implementar                     |
| `scripts/`                     | Smoke tests y utilidades de verificación                                           | Para validar                         |

## Reglas duras

- Una sola feature en `in_progress`.
- No cierres una feature sin `./init.sh` en verde.
- Toda feature con `"sdd": true` pasa por `pending -> spec_ready -> aprobación humana -> in_progress -> done`.
- No inventes estado: actualiza `progress/current.md` mientras trabajas.
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
3. Resume en `progress/history.md`
4. Limpia `progress/current.md` dejando la plantilla
