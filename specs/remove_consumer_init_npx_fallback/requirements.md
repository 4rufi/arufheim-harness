# Requirements

- R1. El `init.sh` scaffoldeado para repos consumidores NO DEBE ejecutar `npx --yes arufheim-harness ...` como fallback implícito.
- R2. El `init.sh` scaffoldeado DEBE seguir soportando `ARUFHEIM_HARNESS_ENTRY` y el binario `arufheim-harness` en `PATH`.
- R3. Si el harness no está disponible localmente, el mensaje de error DEBE explicar una salida offline-first clara.
- R4. README/help/smoke DEBEN quedar alineados con ese contrato.
