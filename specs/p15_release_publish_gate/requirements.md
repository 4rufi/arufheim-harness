# Requirements

- R1. El sistema DEBE tener una versión de release explícita y consistente entre paquete, runtime MCP y changelog.
- R2. El sistema DEBE exponer un gate de publicación separado de `release:check` que valide changelog alineado con la versión publicada.
- R3. El sistema DEBE exigir una fuente rastreable de signoff manual para la checklist de clientes antes de publicar.
- R4. El sistema NO DEBE meter el gate manual en la CI normal; `release:check` debe seguir sirviendo como gate automatizado reproducible.
- R5. El sistema DEBE documentar el flujo nuevo de publish y cubrir al menos el caso feliz del gate nuevo en smoke.
