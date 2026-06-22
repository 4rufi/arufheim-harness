# Requirements

R1. `setup --global` y `repair --global` NO DEBEN sobrescribir configs globales inválidas o no parseables; DEBEN fallar cerrado o degradar con fix manual consistente con `doctor`.
R2. CUANDO `setup --global` o `repair --global` escriban o reconcilien entradas gestionadas, el sistema DEBE mostrar pasos de activación/reinicio por cliente para que la configuración resulte usable.
R3. `doctor` DEBE clasificar bindings globales portables según la semántica real de cada cliente, y NO DEBE tratar `--repo-path "."` como portable universal.
R4. SI un binding global usa una forma solo “asumida” o no verificable para el repo actual, ENTONCES el sistema DEBE reportarlo como degradación o error accionable, no como health verde implícito.
R5. README, help y smoke DEBEN reflejar el contrato final de preservación de configs inválidas, activación post-setup y validación manual por cliente.
