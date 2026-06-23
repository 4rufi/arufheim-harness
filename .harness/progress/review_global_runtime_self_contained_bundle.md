# Review — global_runtime_self_contained_bundle

## Review 1

- verdict: APPROVED
- classification: review_passed

- [x] `R1` se cumple: el runtime gestionado ya se siembra como `global_bundle` en el root global y deja de depender del `dist/index.js` del paquete sembrador.
- [x] `R2` se cumple: `runtime_status` separa `runtime_artifact` de `runtime_source` y la compatibilidad legacy queda encapsulada en `src/runtime.ts`.
- [x] `R3` se cumple: `docs list`, `docs show <topic>` y `harness://docs/*` salen de una registry embebida y el smoke prueba el caso contra el shim global.
- [x] `R4` se cumple: metadata v1 o package-entrypoint legacy quedan `stale` con `repair --global-runtime` como fix.
- [x] `R5` se cumple: `release:check` instala el tarball real, siembra el runtime, retira el paquete sembrador y vuelve a validar `status`, `doctor` y `docs show verification` desde el shim global.
- [x] `R6` quedó alineado en README, help, checklist manual y changelog.
