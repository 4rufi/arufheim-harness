# Requirements

R1. CUANDO `setup --global` o `repair --global` se ejecuten con un repo harness detectable, el sistema DEBE dejar también listos los bindings repo-scoped preferidos para los clientes cuyo fallback global es ambiguo.
R2. El sistema DEBE limitar ese scaffold repo-scoped automático a repos explícitos o detectables como repo harness, para no escribir assets locales en cwd arbitrarios.
R3. La salida operativa DEBE distinguir configuración global fallback de bindings repo-scoped preferidos generados automáticamente.
R4. README, help y smoke DEBEN reflejar que el camino híbrido deja listo `Claude Code` y `Codex` por repo cuando hay repo activo.
