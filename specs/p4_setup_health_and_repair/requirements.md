# Requirements

R1. CUANDO el usuario ejecute `arufheim-harness setup`, el sistema DEBE dejar scaffold, bindings repo-scoped, config base, validación final y resumen legible usando el workflow completo actual como baseline.
R2. `setup` DEBE aceptar `--repo-path`, `--global`, `--update` y `--clients <lista>` sin romper `init`, `init --global`, `init --update` ni los targets actuales.
R3. `doctor` DEBE producir diagnósticos estructurados con `code`, `severity`, `blocking`, `message`, `detected_at`, `fix_available` y `fix_command` o `fix_hint`.
R4. `repair` DEBE compartir reglas con `doctor` y SOLO DEBE corregir assets/config/bindings gestionados por el arnés; NO DEBE mutar backlog, specs, memoria ni contenido humano de negocio.
R5. `harness_status` DEBE exponer `alerts[]`, `binding_status`, `doctor_summary`, `last_verified_at` y `degraded_mode` usando el mismo modelo de health que `doctor`.
R6. El servidor MCP DEBE exponer `harness://health`, la TUI DEBE mostrar alertas activas arriba y el banner de arranque DEBE incluir repo/config/layout/health breve.
R7. SI hay binding ambiguo o config peligrosa, ENTONCES el runtime DEBE seguir fail-closed; SI falta algo opcional o reparable no fatal, ENTONCES DEBE reportarlo como `warn` sin tumbar el proceso.
R8. README, `help` y el smoke DEBEN mover la narrativa recomendada a `setup -> doctor -> repair -> init.sh` preservando compatibilidad con comandos y layouts actuales.
