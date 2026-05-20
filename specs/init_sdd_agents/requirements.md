# Requirements: init_sdd_agents

R1. El sistema DEBE escribir seis prompts en `.github/prompts/` cuando corre `init` con soporte Copilot.
R2. El sistema DEBE escribir seis agentes en `.claude/agents/` cuando corre `init` con soporte Claude.
R3. El sistema DEBE crear un `AGENTS.md` mínimo en el repo bootstrappeado.
R4. El sistema DEBE incluir un marcador de versión para permitir refresco por `init --update`.
R5. El sistema DEBE regenerar prompts/agentes versionados cuando cambie el marcador esperado.
R6. Los prompts y agentes generados DEBEN referenciar solo archivos y tools que el bootstrap crea o soporta.
