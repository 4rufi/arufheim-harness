# Review — p5_release_readiness_closure

- [x] `setup` ya no oculta `--update`; la ayuda, README y el comportamiento coinciden.
- [x] `repair --global` y la ruta global de update reescriben la entrada gestionada en vez de hacer `skip`.
- [x] La versión del paquete y del servidor MCP quedó alineada en `1.1.0`.
- [x] El gate `release:check` usa cache temporal para `npm pack --dry-run` y exige worktree limpio por defecto.
- [x] El smoke cubre `setup --update`, la reparación global y la surface pública actualizada.

## Veredicto

APROBADO
