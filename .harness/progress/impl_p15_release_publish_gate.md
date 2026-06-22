# Implementación — p15_release_publish_gate

## Objetivo

Cerrar los huecos de release que seguían abiertos:

- eliminar el drift entre versión publicada, runtime MCP y changelog
- convertir la checklist manual de clientes en un gate de publicación explícito y rastreable

## Cambios

- `package.json`, `src/version.ts` y `src/index.ts`
  - la versión pública quedó alineada en `1.1.0`
  - el runtime MCP ahora toma su versión desde `package.json` en vez de duplicarla hardcodeada
  - se añadió el script `release:publish-check`
- `CHANGELOG.md`
  - `Unreleased` quedó vacío
  - se abrió la sección `1.1.0` con los cambios reales de la release
- `release-readiness.json`
  - se añadió como fuente machine-readable del signoff manual por versión
  - separa checks requeridos de checks opcionales para bindings `assumed`
- `scripts/release-publish-check.mjs`
  - valida versión, changelog y cierre de la checklist manual
  - soporta `--skip-automated` y `--root` para smoke con fixtures temporales
  - falla de forma explícita si la evidencia manual requerida no está cerrada
- `scripts/release-check.sh`
  - mantiene el gate automatizado como paso aparte
  - al terminar recuerda el paso manual de publish en vez de mezclarlo con CI normal
- `README.md`, `src/help.ts` y `manual-release-checklist.md`
  - el flujo de publicación ahora queda documentado como:
    `release:check -> checklist manual -> release-readiness.json -> release:publish-check`
- `scripts/smoke-stdio.mjs`
  - el smoke ya cubre el caso feliz del gate nuevo y el fallo esperado cuando falta signoff manual

## Verificación ejecutada

- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `npm run release:check -- --allow-dirty`
- `npm run release:publish-check -- --skip-automated`
  - resultado esperado: falla porque `release-readiness.json` sigue abierto
- `./init.sh`

## Trazabilidad

- R1 -> `1.1.0` alineado entre paquete, runtime y changelog.
- R2 -> `scripts/release-publish-check.mjs` valida changelog/versionado antes de publicar.
- R3 -> `release-readiness.json` se vuelve la evidencia rastreable del signoff manual.
- R4 -> `release:check` sigue separado y usable en CI sin depender de validación humana.
- R5 -> README/help/checklist/smoke reflejan y cubren el flujo nuevo.
