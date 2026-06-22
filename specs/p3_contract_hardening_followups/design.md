# Design

## Decision

Endurecer contratos donde hoy solo existe verificación diferida en `init.sh`, mover el binding ambiguo del repo a fail-closed y ampliar la CLI de config sin abrir una surface nueva.

## Touch

- `src/tools/harness-update.ts`
- `src/tools/read-file.ts`
- `src/config.ts`
- `src/config-command.ts`
- `scripts/smoke-stdio.mjs`
- `src/help.ts`
- `README.md`

## Constraints

- No romper layouts `hidden` y `root-legacy`.
- Reusar las mismas invariantes que ya exige `init.sh` para cierre SDD.
- Mantener `config set` como surface principal; los arrays entran como JSON.
- La cobertura smoke debe validar los nuevos rechazos, no solo caminos felices.

## Verify

- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke`
- `./init.sh`

## Notes

- El fail-closed se aplica cuando solo existe config global por defecto; un repo con `harness.config.json` local o `--repo-path` explícito sigue funcionando.
- `read_file` cambia a lectura incremental por líneas para reducir presión de memoria en archivos grandes.
