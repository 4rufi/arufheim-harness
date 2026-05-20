# Cuándo usar SDD

Usa `sdd: true` si implementar mal la feature cuesta más que escribir el spec.

## Marca `sdd: true` cuando la feature:

- cambia comportamiento observable
- toca más de un archivo o más de una capa
- introduce una tool, command, resource o surface nueva
- cambia contratos, estados, formatos o flujo
- toca seguridad, permisos, escritura, ejecución o boundaries
- tiene ambigüedad de diseño o varias implementaciones razonables
- necesita trazabilidad clara para review

## Normalmente no requiere SDD

- fix local y obvio
- rename mecánico
- doc pequeña
- test faltante de comportamiento ya decidido
- refactor interno sin cambio observable ni riesgo alto

## Regla operativa

- `0` criterios: no SDD
- `1` criterio suave: decide líder o humano
- `1` criterio fuerte o `2` suaves: `sdd: true`

## Criterios fuertes

- seguridad
- tool/command/resource nueva
- cambio de contrato, estado o flujo
- cambio multiarchivo con comportamiento observable
