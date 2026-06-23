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
pending -> spec_ready -> aprobación humana -> in_progress
in_progress -> plan -> execute -> verify -> review -> route_back? -> done|blocked
```

Úsalo cuando implementar mal cuesta más que escribir el spec.

Disciplina de feedback dentro del loop:

- traduce `R<n>` a comportamiento verificable durante `plan`
- intenta la capa rápida correcta durante `execute`: `unit`, `contract` o `smoke`
- si no existe test rápido razonable, deja excepción justificada y evidencia ejecutable
- `verify` siempre corre la verificación estándar relevante antes de pedir review

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
de la feature, el loop file, `head_<feature>.md` y los artifacts que produce.
