# Review — p12_global_config_force_recovery

## Resultado

Aprobado.

## Puntos revisados

- [x] El comportamiento por defecto sigue fallando cerrado cuando una config global no parsea.
- [x] La recuperación explícita exige `--force-managed-global` y crea backup antes de regenerar.
- [x] `setup`, `repair` e `init --global` comparten la misma ruta de validación y recovery.
- [x] `doctor` ahora devuelve un fix accionable para configs globales inválidas recuperables.
- [x] El smoke cubre preservación y recuperación para JSON/JSONC y TOML globales.

## Riesgos residuales

- `--force-managed-global` preserva el archivo roto en backup, pero regenera una base mínima válida; cualquier setting manual que estuviera solo en el archivo inválido queda fuera del archivo activo hasta que el usuario lo reintroduzca.
- Errores de permisos o lectura siguen fallando cerrado aunque se pase `--force-managed-global`, que es el comportamiento deseado para no ocultar fallos del sistema de archivos.
