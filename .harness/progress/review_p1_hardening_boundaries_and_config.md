# Review: p1_hardening_boundaries_and_config

## Checklist

- [x] `loadConfig()` falla cerrado para config explícita inválida y conserva fallback solo en `ENOENT`.
- [x] `search_repo` rechaza `include` absoluto o con traversal antes de expandir globs.
- [x] El smoke cubre ambas regresiones P1.
- [x] El fixture legacy quedó alineado con `doctor`.
- [x] `./init.sh` quedó verde con la feature implementada.

## Veredicto

APROBADO
