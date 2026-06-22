# Requirements

R1. CUANDO un repo se scaffoldée con un subconjunto de clientes locales, el health DEBE tratar como esperados solo esos clientes y NO degradar por clientes omitidos intencionalmente.
R2. El scaffold repo-local DEBE incluir una verificación ejecutable repo-local coherente con las instrucciones generadas, o las instrucciones DEBEN dejar de referenciar archivos/steps inexistentes.
R3. `CODEX.md` y `AGENTS.md` generados para un repo `codex`-only NO DEBEN depender de assets exclusivos de Claude como `.claude/agents/leader.md`.
R4. El output local de setup/init DEBE indicar el frontend correcto para activar o reabrir según el target configurado.
R5. Smoke DEBE cubrir al menos un repo `codex`-only y validar que queda sano, verificable y sin referencias rotas.
