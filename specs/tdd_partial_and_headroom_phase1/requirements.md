# Requirements

- R1. El repositorio DEBE separar una suite rápida de feedback (`test` / `test:unit`) del smoke end-to-end, manteniendo `smoke` como contrato de integración y haciendo que `verify` e `init.sh` exijan ambas capas.
- R2. El sistema DEBE formalizar una policy TDD parcial por capas en README, docs de workflow, prompts y scaffold: `unit-first`, `contract-first`, `smoke-driven` y testing liviano para scaffold/docs salvo cambio contractual.
- R3. El sistema DEBE admitir configuración opcional `testing.fastCommand` y `testing.integrationCommand` en `harness.config.json`, además de autodetección desde el repo cuando esas claves no existen.
- R4. La autodetección DEBE preferir suites rápidas (`test:unit`, `unit`, `test:fast`, `vitest`, `jest`) y solo usar `test` cuando no parezca `e2e` o `smoke`.
- R5. En repos JS/TS sin suite rápida detectable, el scaffold DEBE recomendar `Vitest`; en repos no JS/TS sin stack detectable, DEBE dejar una guía neutral.
- R6. `setup` y `repair` DEBEN propagar la guidance de testing detectada al scaffold gestionado y solo ampliar `allowedCommands` por merge cuando el comando rápido detectado falte.
- R7. El sistema DEBE generar un artifact interno reescribible `.harness/progress/head_<feature>.md` para la feature activa con objetivo, fase/intento, R<n> en foco, capa de test elegida, comando rápido recomendado, último error, último strategy_delta, archivos mínimos y siguiente acción.
- R8. El modo `agent` DEBE refrescar y consumir `head_<feature>.md` como contexto preferente después de `startup_brief`, y `context_manager.md` DEBE explicitar el nuevo nivel `head`.
- R9. El sistema NO DEBE exponer todavía `headroom` como surface pública nueva en `status`, `doctor`, `tui` o MCP.
- R10. La suite nueva DEBE cubrir al menos policy/config/testing detection/headroom y el smoke DEBE cubrir autodetección y refresh de `head_<feature>.md` sin romper compatibilidad existente.
