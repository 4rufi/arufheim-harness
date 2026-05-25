# Planning Model

El arnés soporta tres modos de planificación.

## 1. simple / reactive

Usa este modo cuando:

- el cambio es local y obvio
- no requiere spec
- una sola persona/agente puede cerrarlo de punta a punta

## 2. SDD

Usa este modo cuando la feature tiene `sdd: true`.

Flujo:

```text
pending -> spec_ready -> aprobación humana -> in_progress -> done
```

Úsalo cuando implementar mal cuesta más que escribir el spec.

## 3. orchestration

Usa este modo cuando hace falta dividir trabajo entre roles:

- `leader`
- `spec_author`
- `implementer`
- `reviewer`
- opcionalmente `inbox_reader` y `scoper`

## Regla de selección

- `0` criterios de SDD y cambio local: `simple`
- `sdd: true`: `SDD`
- múltiples roles, handoffs o coordinación explícita: `orchestration`

## Regla operativa

No mezclar modos sin decirlo. El modo activo debe ser evidente desde el estado
de la feature y los artifacts que produce.
