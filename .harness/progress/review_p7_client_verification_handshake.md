# Review — p7_client_verification_handshake

## Resultado

Aprobado.

## Puntos revisados

- [x] Los bindings gestionados ahora declaran identidad de cliente sin romper el contrato repo-scoped/global previo.
- [x] El runtime registra verificación repo-local automáticamente cuando arranca con `--client`.
- [x] `doctor`, `harness_status`, `harness://health` y TUI exponen `client_verification`.
- [x] Un binding global `assumed` deja de degradar para ese cliente después de un arranque verificado.
- [x] Smoke y docs cubren el upgrade desde bindings viejos sin `--client`.

## Riesgos residuales

- La verificación sigue dependiendo de que el frontend arranque realmente el MCP al menos una vez por repo.
- Clientes custom no gestionados por el arnés seguirán en `configured` o `stale` si no respetan el contrato `--client`.
