# Requirements

## R1. Packaging de release docs

El artefacto publicado no debe dejar roto el camino de documentación que el README presenta para release.

### Acceptance

- El paquete npm incluye `manual-release-checklist.md` o el README deja de apuntar a una ruta local ausente.

## R2. Gate del tarball más representativo

El `release:check` sobre artefacto instalado debe cubrir el fallback CLI y la autoreparación gestionada.

### Acceptance

- El repo temporal instalado ejecuta `setup`, `status --brief --json`, `repair` y `doctor --json`.
- Si `repair` debe actuar, el check detecta la regresión.

## R3. Brief barato

`brief_only` no debe leer `feature_history.json` solo para calcular `archived_count`.

### Acceptance

- `archived_count` viene de un snapshot de health o metadato compartido, no de parsear el history completo en cada arranque.
- Se preserva el contrato público de `status`/`harness_status`.

## R4. Release communication correcta

El changelog y las notas de release no deben prometer un gate distinto al real.

### Acceptance

- `CHANGELOG.md` refleja el gate actual del tarball publicado y el fallback `status`.
