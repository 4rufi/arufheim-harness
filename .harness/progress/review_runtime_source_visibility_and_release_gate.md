# Review — runtime_source_visibility_and_release_gate

## Review 1

- verdict: APPROVED
- classification: review_passed

- [x] `R1-R2` quedan cubiertos: `runtime_status` y metadata exponen la procedencia del runtime con `package_install`, `workspace_dev`, `linked_dev` y `unknown`.
- [x] `R3` se cumple: un runtime sembrado desde el workspace o un link de desarrollo ya no parece “release-grade”; `doctor/status/verify` lo muestran y health lo degrada con warning explícito.
- [x] `R4` se mantiene: un runtime sembrado desde instalación publicada queda limpio y no degrada el repo.
- [x] `R5` queda blindado: `release:check` siembra el runtime desde el tarball real en un `XDG_CONFIG_HOME` temporal, ejecuta el shim y exige `package_install`.
- [x] `R6` quedó documentado en README, help y checklist manual.
