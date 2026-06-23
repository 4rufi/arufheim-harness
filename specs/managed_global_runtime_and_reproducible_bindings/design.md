# Decision

Introducir un módulo de runtime global gestionado que copie el `dist/` actual del harness a un root user-local estable y escriba:

- un shim ejecutable (`bin/arufheim-harness` o `.cmd`)
- metadata (`runtime.json`)
- un launcher repo-local portable (`.harness/runtime/launch-global-runtime.mjs`)

La copia del runtime evita depender de rutas efímeras de `npx` y mantiene el paquete fuera de `node_modules` del repo consumidor. `setup` y `repair` aseguran primero el runtime y luego regeneran bindings gestionados. Health pasa a modelar `runtime_status` y reconoce dos contratos válidos: shim absoluto para globales y `node + launcher portable` para repo-scoped. Los bindings legacy con `npx` pasan a ser warnings reparables.

# Touch

- `src/runtime.ts` nuevo
- `src/config.ts`
- `src/init.ts`
- `src/setup.ts`
- `src/repair.ts`
- `src/health.ts`
- `src/status.ts`
- `src/doctor.ts`
- `src/help.ts`
- `src/tools/harness-status.ts`
- `scripts/smoke-stdio.mjs`
- `README.md`
- `manual-release-checklist.md`
- `CHANGELOG.md`

# Constraints

- No introducir `arufheim-harness` como dependencia del proyecto consumidor.
- El launcher repo-scoped debe seguir siendo portable entre máquinas.
- `repair` y `setup --update` migran lo gestionado, pero no pisan archivos rotos del usuario fuera del contrato ya existente.
- El init interno del repo harness puede seguir existiendo; el cambio afecta el scaffold consumidor y el runtime compartido.

# Verify

- `./scripts/pnpmw.sh typecheck`
- `./scripts/pnpmw.sh test`
- `./scripts/pnpmw.sh build`
- `./scripts/pnpmw.sh smoke`
- `./init.sh`
