# Spec Summary

Goal: volver explícito qué cliente ya está listo, cuál necesita primer arranque real y cuál requiere fix manual, además de automatizar el gate de release en CI.

Touch: health/status/setup/repair/init/help, adapters generados, smoke, release-check, workflow CI.

Constraints: mantener compatibilidad de `doctor`/`status`, no tocar el contrato fail-closed de configs globales inválidas, no añadir automatización GUI nueva.

Verify: `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`, `npm run release:check -- --allow-dirty`.

Tasks:
- T1 estado operativo derivado por cliente
- T2 resumen operativo en setup/repair/status
- T3 convergencia de Codex repo-scoped
- T4 alineación de adapters/docs
- T5 workflow CI para release gate
- T6 smoke de regresión
