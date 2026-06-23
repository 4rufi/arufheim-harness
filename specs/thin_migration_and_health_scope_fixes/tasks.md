# Tasks

- [ ] T1 (R1-R2) Corregir `migrate.ts` para que la migración real full->thin limpie directorios vacíos sin romper la poda conservadora.
- [ ] T2 (R3) Ajustar `health.ts` para no inspeccionar ni degradar por globals fuera de `scaffold.localClients`.
- [ ] T3 (R4) Añadir cobertura automática para migración real y para `codex-only` con globals válidos fuera de scope.
