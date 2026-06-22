# Review — p8_repo_scoped_preferred_global_setup

## Resultado

Aprobado.

## Puntos revisados

- [x] `setup --global` y `repair --global` solo scaffoldean local cuando existe `--repo-path` explícito o un repo harness detectable.
- [x] Claude Code y Codex pasan a tener una ruta preferente repo-scoped cuando el repo está disponible.
- [x] La salida operativa distingue claramente config global y scaffold repo-scoped preferido.
- [x] El smoke cubre tanto el caso seguro sin contaminación como el caso híbrido explícito/detectado.
- [x] El caso `assumed` sigue existiendo y quedó acotado al smoke de `claude-desktop`.

## Riesgos residuales

- `Claude Desktop` sigue necesitando validación en runtime cuando el binding global depende del cwd real del frontend.
- El scaffold híbrido reutiliza `runInit`, así que en repos explícitos nuevos crea también el workflow base del arnés, no solo `.mcp.json` o `.codex/config.toml`.
