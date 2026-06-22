# Review — p13_expected_client_health_scope

## Resultado

Aprobado.

## Puntos revisados

- [x] Un repo con scaffold parcial ya no falla por configs globales inválidas de clientes no esperados.
- [x] Los bindings globales válidos siguen visibles cuando sirven como fallback, incluyendo el estado `assumed`.
- [x] La promoción `assumed -> verified` por arranque real se conserva para Claude Desktop y Codex.
- [x] Los snapshots persistidos y el runtime usan el mismo criterio de scope esperado.
- [x] El smoke cubre tanto el caso regresivo `codex-only` como el contrato previo de bindings globales asumidos.

## Riesgos residuales

- El filtro usa `scaffold.localClients` como fuente de verdad del scope esperado; si un repo quiere observar un cliente fuera de ese scaffold, debe configurarlo explícitamente o quedará solo como fallback visible cuando exista un binding válido.
- Los bindings globales `assumed` siguen necesitando un primer arranque real para pasar a `verified`, que es parte intencional del contrato de seguridad/operabilidad.
