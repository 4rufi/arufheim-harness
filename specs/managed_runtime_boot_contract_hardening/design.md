# Design

## Decision

El runtime gestionado dejará de copiar `dist/` al root global. En su lugar, metadata, shim y launcher apuntarán al entrypoint real del paquete actualmente ejecutado. El smoke validará ese contrato ejecutando el shim y el launcher contra un home temporal.

## Touch

`src/runtime.ts`, `src/config.ts`, `scripts/smoke-stdio.mjs`, `tests/contracts.test.ts`, `README.md`, `CHANGELOG.md`

## Constraints

- No introducir `arufheim-harness` como dependencia del repo consumidor
- Mantener portabilidad repo-scoped
- No romper `setup`, `repair`, `verify`, `doctor`, `status` ni el scaffold actual

## Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`
