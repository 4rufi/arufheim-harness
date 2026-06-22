# Design

## 1. Normalización temprana de repo path

La fuente de verdad será una ruta absoluta resuelta desde `process.cwd()` al parsear `--repo-path`. Eso evita que `.` llegue a `setup`, `repair`, `doctor` o `recordDeterministicClientVerification`.

## 2. Lógica de status compartida

Se extraerá una capa compartida para construir el snapshot de status:

- `full`: mantiene el contrato actual
- `brief_only`: solo carga workflow mínimo + health resumido

El nuevo comando CLI `status` reutilizará esa capa y ofrecerá:

- `status --brief`
- `status --json`

## 3. Reutilización de health persistido

Para `brief_only` y `status --brief`, si existe `health.json`, se puede usar como base de alertas/binding/doctor_summary sin recomputar todo. Si no existe, se calcula health normal.

## 4. Release check sobre artefacto

`scripts/release-check.sh` hará:

1. `npm run typecheck`
2. `npm run build`
3. `npm run smoke`
4. `npm pack`
5. Crear repo temporal limpio
6. Instalar el tarball empaquetado
7. Ejecutar `npx arufheim-harness setup --clients codex --repo-path <repo>`
8. Ejecutar `npx arufheim-harness doctor --repo-path <repo> --json`

## 5. Compatibilidad

No se rompe `doctor` ni el contrato MCP. `status` es un surface adicional, no un reemplazo.
