# Requirements

## R1. Scope repo-local coherente

CUANDO un repo tenga `scaffold.localClients` definido, el sistema DEBE evaluar como blocking solo los bindings repo-scoped y globales de los clientes esperados para ese repo.

## R2. Shadowing real

SI un cliente esperado ya tiene override repo-scoped válido, ENTONCES un config global inválido del mismo cliente NO DEBE degradar ni bloquear el health de ese repo.

## R3. Resumen operativo consistente

`setup`, `doctor` y `status` DEBEN producir el mismo health resumido para un repo con clientes parciales, sin falsos `error` por clientes ajenos.

## R4. Cobertura de regresión

El smoke DEBE cubrir un repo `codex-only` con un config global inválido de Claude Desktop y confirmar que `setup` y `doctor` siguen sanos para ese repo.
