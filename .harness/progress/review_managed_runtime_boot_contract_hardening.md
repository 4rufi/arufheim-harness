# Review — managed_runtime_boot_contract_hardening

## Review 1

- verdict: APPROVED
- classification: review_passed

- [x] `R1` se cumple: el shim gestionado ya no apunta a un `dist` copiado sin dependencias, sino al entrypoint real instalado del paquete.
- [x] `R2` se cumple: `ensureManagedGlobalRuntime()` dejó de borrar el runtime root antes de reinstalar, así que ya no puede autodestruirse al regenerar metadata + shim.
- [x] `R3-R4` se cumplen: launcher e instalador comparten la misma resolución de root global y el repo sigue sin grabar rutas absolutas del usuario.
- [x] `R5` queda cubierto: el smoke ahora ejecuta el shim global y el launcher repo-scoped reales en un `XDG_CONFIG_HOME` temporal.
- [x] `R6` se mantiene: `runtime_status` sigue verde en `status/doctor/verify`, y `./init.sh` pasó completo con el contrato nuevo.
