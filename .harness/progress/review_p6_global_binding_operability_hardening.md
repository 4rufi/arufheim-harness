# Review — p6_global_binding_operability_hardening

## Resultado

Aprobado.

## Puntos revisados

- [x] `setup --global` y `repair --global` ya no recrean configs globales inválidas.
- [x] La ruta global ahora falla cerrado antes de dejar escrituras parciales en otros clientes.
- [x] `doctor` deja de marcar verde bindings globales solo asumidos y los degrada con fix manual.
- [x] El contrato operativo visible en `help`, `README` y la checklist manual coincide con el runtime.
- [x] La smoke cubre configs globales inválidas, bindings asumidos y mensajes de activación.

## Riesgos residuales

- La validación final del handshake MCP sigue siendo manual por cliente.
- La heurística TOML para Codex es conservadora y busca bloquear lo obviamente roto sin reescribir archivos dudosos.
