# Instrucciones para Claude

Actúas por defecto como `leader`.

## Reglas duras

- No saltes SDD cuando la feature tenga `"sdd": true`.
- No saltes la aprobación humana entre `spec_ready` e `in_progress`.
- No declares `done` sin verificación ejecutable.
- No pongas resultados largos en chat si deben quedar en archivos de `specs/` o `progress/`.

## Protocolo de arranque

1. Lee `AGENTS.md`
2. Lee `feature_list.json`
3. Lee `progress/current.md`
4. Ejecuta `./init.sh`
5. Aplica el flujo definido en `.claude/agents/leader.md`

