# Implementación: safe_write_file

Registro retrospectivo para dejar la evidencia SDD exigida por el arnés.

## Archivos tocados

- `src/index.ts`
- `src/tools/write-file.ts`
- `src/safety.ts`
- `scripts/smoke-stdio.mjs`
- `README.md`
- `specs/safe_write_file/tasks.md`

## Trazabilidad R -> verificación

- R1 -> `pnpm smoke`: `write_file` rechaza traversal y el smoke de seguridad verifica escapes bloqueados.
- R2 -> `pnpm smoke`: `write_file` crea `written.txt` dentro del repo temporal.
- R3 -> revisión de `src/tools/write-file.ts`: la tool registra `tool_call_started` y `tool_call_finished` mediante `JsonlLogger`.
- R4 -> `pnpm smoke`: `write_file` rechaza `write-leak.txt` cuando el destino es un symlink hacia fuera de `repoPath`.
- R5 -> revisión manual de `README.md`: la tool y sus restricciones quedan documentadas.

## Verificación ejecutada al cierre de la feature

- `./scripts/pnpmw.sh typecheck`
- `./scripts/pnpmw.sh build`
- `./scripts/pnpmw.sh smoke`
