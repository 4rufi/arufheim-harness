# Design

## 1. `archived_count` via health compartido

Se añadirá `archived_count` al snapshot de health:

- `evaluateHarnessHealth()` leerá `feature_history.json` una vez y persistirá el conteo
- `buildHarnessStatus()` tomará ese conteo desde health y dejará de leer `feature_history.json`

Con eso:

- `harness_status(mode: "brief_only")` sigue siendo fresco
- `status --brief` puede reutilizar el health persistido
- se elimina una lectura redundante del hot path

## 2. Release tarball más completo

El gate del artefacto instalado hará:

1. `setup` en repo temporal
2. `status --brief --json`
3. romper un archivo scaffold gestionado
4. `repair`
5. `doctor --json`

## 3. Packaging/docs

La checklist manual se incluirá en `package.json#files` para mantener válidos los links locales del README empaquetado.

## 4. Compatibilidad

No se rompe el contrato JSON actual del brief; solo cambia la fuente del `archived_count`.
