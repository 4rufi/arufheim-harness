# Review — p15_release_publish_gate

## Resultado

Aprobado.

## Puntos revisados

- [x] `package.json`, runtime MCP y `CHANGELOG.md` ya no divergen en la versión publicada.
- [x] `release:publish-check` existe como gate separado y no reemplaza `release:check`.
- [x] El publish real queda bloqueado mientras `release-readiness.json` tenga checks requeridos sin cerrar.
- [x] Los bindings opcionales `assumed` no impiden publicar si el resto de la checklist requerida está cerrada.
- [x] El smoke cubre tanto el fixture válido como el bloqueo esperado por signoff manual faltante.

## Riesgos residuales

- La release sigue requiriendo una pasada manual real sobre clientes antes de marcar `release-readiness.json`; eso es deliberado y ahora quedó forzado por contrato.
- Si en futuras releases cambia la estructura de `CHANGELOG.md` o del archivo de readiness, `release:publish-check` deberá actualizarse junto con esa convención para evitar falsos rojos.
