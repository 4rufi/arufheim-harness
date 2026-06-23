# Requirements

- R1. `migrate --to thin` DEBE completar la migración real de un repo `full` a `thin` sin fallar al limpiar directorios gestionados vacíos.
- R2. La poda real de `migrate --to thin` DEBE seguir siendo conservadora: solo elimina assets gestionados seguros y luego limpia contenedores vacíos.
- R3. Un repo con `scaffold.localClients` acotado DEBE evaluar health/readiness solo para esos clientes locales; globals fuera de scope NO DEBEN degradar `doctor`.
- R4. La verificación automática DEBE cubrir la migración real full->thin y el caso `codex-only` con globals válidos de otros clientes presentes en el host.
