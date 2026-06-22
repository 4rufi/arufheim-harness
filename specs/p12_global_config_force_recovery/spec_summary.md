# Goal

Permitir que `setup --global` y `repair --global` recuperen configs globales inválidas gestionadas por el arnés mediante una bandera explícita con backup previo, sin cambiar el fail-closed por defecto.

# Touch

`src/init.ts`, `src/setup.ts`, `src/repair.ts`, `src/help.ts`, `scripts/smoke-stdio.mjs`, `README.md`, `manual-release-checklist.md`

# Constraints

El comportamiento por defecto sigue siendo fail-closed; solo se puede sobrescribir una config inválida si el usuario pasa una opción explícita y el arnés deja respaldo legible del archivo roto.

# Verify

`npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`

# Tasks

T1 flag explícito y backups; T2 wiring en setup/repair; T3 smoke/docs/help; T4 verify y cierre
