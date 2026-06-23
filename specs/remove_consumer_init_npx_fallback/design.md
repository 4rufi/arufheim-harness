# Design

- `src/init.ts`: modificar `SCAFFOLD_REPO_INIT_SH` para eliminar el bloque `npx` y reemplazarlo por un error guiado.
- `scripts/smoke-stdio.mjs`: añadir o ajustar un smoke que verifique que el scaffold `full` no contiene fallback a `npx`.
- `README.md` y `help`/wrappers si aplica: documentar que el repo consumidor debe usar `verify`, `ARUFHEIM_HARNESS_ENTRY` o el binario local instalado/linkeado.
