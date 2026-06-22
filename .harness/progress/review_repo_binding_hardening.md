# Review: repo_binding_hardening

## Checklist

- [x] Codex y Claude Code tienen scaffold repo-scoped explícito.
- [x] Las entradas globales controladas por `init` pasan `--repo-path`.
- [x] `harness_status` expone identidad de repo/config en `brief_only` y `full`.
- [x] `doctor` valida bindings explícitos sin romper compatibilidad legacy.
- [x] `init.sh` y el smoke cubren los nuevos artefactos y señales.
- [x] `./init.sh` quedó verde con la feature implementada.

## Veredicto

APROBADO
