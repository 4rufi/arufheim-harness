# Requirements

R1. Los bindings generados por `setup`/`init` DEBEN poder identificar el frontend que inició el runtime, sin romper compatibilidad con clientes existentes.
R2. CUANDO el runtime arranque con identidad de cliente conocida, el sistema DEBE persistir una verificación por cliente con al menos `client`, `repo_path`, `config_scope`, timestamp y evidencia suficiente para invalidarla si la config relevante cambia.
R3. `doctor`, `harness_status`, `harness://health` y la TUI DEBEN exponer estados de verificación por cliente distinguiendo al menos `configured`, `verified`, `stale` y `missing`.
R4. SI un binding global está clasificado como `assumed` y existe una verificación vigente para ese cliente en el repo actual, ENTONCES el sistema DEBE promoverlo a estado operativo verificado; SI la verificación falta o quedó stale, ENTONCES DEBE seguir degradando.
R5. README, help y smoke DEBEN documentar y validar el contrato nuevo sin exigir una tool manual separada al usuario.
