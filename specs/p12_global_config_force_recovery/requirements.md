# Requirements

## R1. Fail-closed por defecto

SI `setup --global` o `repair --global` encuentran una config global inválida o no parseable y no se pasó una bandera explícita de recuperación, ENTONCES el sistema DEBE fallar cerrado y NO DEBE sobrescribir ningún archivo global gestionado.

## R2. Recuperación explícita con backup

SI el usuario pasa la bandera explícita de recuperación y una config global gestionada es inválida o no parseable, ENTONCES el sistema DEBE guardar un backup del archivo roto antes de regenerar una config válida gestionada por el arnés.

## R3. Alcance limitado de la recuperación

CUANDO se active la recuperación explícita, el sistema DEBE tocar solo los archivos globales gestionados de los clientes seleccionados y NO DEBE modificar backlog, specs, artifacts humanos ni contenido de negocio del repo.

## R4. Señal operativa visible

CUANDO una recuperación explícita cree uno o más backups, el sistema DEBE reportarlo en la salida de `setup` o `repair` con rutas accionables para auditoría manual.

## R5. Contrato documentado y probado

El sistema DEBE documentar la nueva bandera explícita en help y README, y DEBE cubrir con smoke tanto el fail-closed por defecto como la recuperación exitosa con backup.
