# Review — remove_consumer_init_npx_fallback

## Review 1

- verdict: APPROVED
- classification: review_passed

- [x] `R1` queda cubierto por `src/init.ts` y smoke: el `init.sh` scaffolded ya no ejecuta `npx --yes arufheim-harness ...`.
- [x] `R2` se mantiene: el wrapper sigue soportando `ARUFHEIM_HARNESS_ENTRY` y `arufheim-harness` en `PATH`.
- [x] `R3` queda explícito en el mensaje de error y en `README.md`: el camino correcto pasa por binario local o `verify`, no por descarga implícita.
- [x] `R4` quedó alineado en `scripts/smoke-stdio.mjs`, `README.md`, `src/help.ts`, `.harness-docs/verification.md` y `CHANGELOG.md`.
- [x] `typecheck`, `test`, `build`, `smoke` e `init.sh` pasaron con el contrato nuevo.
