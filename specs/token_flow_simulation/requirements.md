# Requirements

- R1. El sistema DEBE exponer una simulación reproducible por CLI para estimar bytes y tokens locales de un flujo del harness.
- R2. La simulación DEBE reutilizar el criterio local de tokens existente basado en bytes y no DEBE escribir en `.harness/metrics/session.json`.
- R3. El sistema DEBE soportar al menos flujos predefinidos para `startup`, `activation`, `loop` y `triage`, con detalle por paso y total agregado.
- R4. Cada paso del flujo DEBE identificar la surface simulada, el formato de salida, los bytes estimados y los tokens estimados.
- R5. SI el flujo requiere estado de loop, ENTONCES la simulación DEBE reflejar el estado real del repo y seguir funcionando cuando no haya feature activa.
- R6. El sistema DEBE soportar salida humana y `--json` para consumo automatizado.
- R7. `help`, `README.md` y el scaffold relevante DEBEN documentar el comando y cuándo usarlo.
- R8. El smoke DEBE cubrir al menos un flujo base y verificar que la simulación no contamina las métricas reales persistidas.
