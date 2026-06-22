# Design

## Decision

Se añade una bandera explícita `--force-managed-global` para `setup --global` y `repair --global`. Sin esa bandera el contrato no cambia. Con esa bandera, el arnés puede respaldar una config global inválida y regenerar únicamente la porción gestionada necesaria para el cliente seleccionado.

## Touch

- `src/init.ts`
- `src/setup.ts`
- `src/repair.ts`
- `src/help.ts`
- `scripts/smoke-stdio.mjs`
- `README.md`
- `manual-release-checklist.md`

## Constraints

- La recuperación explícita no debe habilitar escrituras parciales silenciosas.
- El preflight sigue siendo atómico por selección de clientes.
- Los backups deben ser legibles y quedar junto al archivo original.
- Codex y JSON/JSONC deben seguir rutas de validación separadas.

## Verify

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `./init.sh`

## Notes

- `ManagedGlobalWriteOptions` debe transportar tanto `update` como el modo de recuperación forzada.
- La validación previa y los lectores opcionales deben compartir la misma lógica para no duplicar reglas.
- La salida de `setup`/`repair` debe listar backups creados cuando aplique.
